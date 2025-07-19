
import { SaveData, Entity, Status, Quest, GameHistoryEntry } from './types.ts';
import { MBTI_PERSONALITIES } from './data/mbti.ts';

const formatEntityForPrompt = (entity: Entity, allStatuses: Status[]): string => {
    let details = [];
    if (entity.state) {
        let stateText = '';
        switch(entity.state) {
            case 'dead': stateText = 'ĐÃ CHẾT'; break;
            case 'broken': stateText = 'BỊ HỎNG'; break;
            case 'destroyed': stateText = 'ĐÃ BỊ PHÁ HỦY'; break;
        }
        if (stateText) details.push(`Trạng thái: ${stateText}`);
    }
    if (entity.description) details.push(`Mô tả: ${entity.description}`);
    if (entity.age) details.push(`Tuổi: ${entity.age}`);
    if (entity.appearance) details.push(`Dung mạo: ${entity.appearance}`);
    if (entity.personality) details.push(`Tính cách (Bề ngoài): ${entity.personality}`);
    if (entity.personalityMbti && MBTI_PERSONALITIES[entity.personalityMbti]) {
        details.push(`Tính cách (Cốt lõi - ${entity.personalityMbti}): ${MBTI_PERSONALITIES[entity.personalityMbti].description}`);
    }
    if (entity.motivation) details.push(`Động cơ: ${entity.motivation}`);
    if (entity.location) details.push(`Vị trí: ${entity.location}`);
    if (entity.realm) details.push(`Cảnh giới: ${entity.realm}`);
    if ((entity.type === 'npc' || entity.type === 'companion') && Array.isArray(entity.skills) && entity.skills.length > 0) {
        details.push(`Kỹ năng: ${entity.skills.join(', ')}`);
    }
    if (entity.type === 'item') {
        if (entity.equipped) details.push('Trạng thái: Đang trang bị');
        if (typeof entity.uses === 'number') details.push(`Lần dùng: ${entity.uses}`);
        if (typeof entity.durability === 'number') details.push(`Độ bền: ${entity.durability}/100`);
    }
    const entityStatuses = allStatuses.filter(s => s.owner === entity.name);
    if (entityStatuses.length > 0) {
        details.push(`Hiệu ứng: ${entityStatuses.map(s => s.name).join(', ')}`);
    }
    if (entity.relationship) details.push(`Quan hệ: ${entity.relationship}`);

    return `- ${entity.name} (${entity.type}): ${details.join('; ')}`;
}

export const buildRagPrompt = (
    action: string,
    gameState: SaveData,
    ruleChangeContext: string,
    customRulesContext: string,
    nsfwInstructionPart: string,
): string => {
    // Handle the dedicated System Turn for rule updates
    if (action === 'SYSTEM_RULE_UPDATE') {
        const finalPrompt = `${ruleChangeContext}${customRulesContext}
--- YÊU CẦU HỆ THỐNG ---
Xử lý các cập nhật luật lệ trên. Chỉ tạo ra các thẻ lệnh cần thiết để cập nhật thế giới. KHÔNG tường thuật bất kỳ câu chuyện nào.
--- KẾT THÚC YÊU CẦU ---`;
        return finalPrompt;
    }

    const { worldData, knownEntities, statuses, quests, party, turnCount, gameHistory, memories, chronicle, gameTime } = gameState;
    const lowerCaseAction = action.toLowerCase();
    
    // --- 1. Retrieval Phase (Smarter RAG with Recursion) ---
    const directEntities = new Set<Entity>();
    const recursiveEntities = new Set<Entity>();

    // Always include PC and party members
    const pc = party.find(p => p.type === 'pc');
    if (pc) directEntities.add(pc);
    party.forEach(member => directEntities.add(member));

    // Find entities mentioned in the action string, the last model response, and all equipped items.
    const lastModelResponse = gameHistory.length > 0 ? gameHistory[gameHistory.length - 1].parts[0].text : '';
    const relevantText = lowerCaseAction + ' ' + lastModelResponse.toLowerCase();

    Object.values(knownEntities).forEach(entity => {
        if (entity.name && relevantText.includes(entity.name.toLowerCase())) {
            directEntities.add(entity);
        }
        if (entity.type === 'item' && entity.owner === pc?.name && entity.equipped) {
            directEntities.add(entity);
        }
    });

    // Recursive retrieval step
    const allEntityNames = Object.keys(knownEntities);
    directEntities.forEach(entity => {
        const description = entity.description?.toLowerCase() || '';
        allEntityNames.forEach(name => {
            if (description.includes(name.toLowerCase())) {
                const relatedEntity = knownEntities[name];
                if (relatedEntity && !directEntities.has(relatedEntity)) {
                    recursiveEntities.add(relatedEntity);
                }
            }
        });
    });


    // --- 2. Augmentation/Prompt Construction Phase ---
    let retrievedContext = "";

    // Dedicated PC context block at the top
    if (pc) {
        retrievedContext += "--- BỐI CẢNH NHÂN VẬT CHÍNH (PC) ---\n";
        retrievedContext += `Tên: ${pc.name}\n`;
        if (pc.location) retrievedContext += `Vị trí hiện tại: ${pc.location}\n`;
        if (pc.gender) retrievedContext += `Giới tính: ${pc.gender}\n`;
        if (pc.age) retrievedContext += `Tuổi: ${pc.age}\n`;
        if (pc.appearance) retrievedContext += `Dung mạo: ${pc.appearance}\n`;
        if (pc.personality) retrievedContext += `Tính cách (Bề ngoài): ${pc.personality}\n`;
        if (pc.realm) retrievedContext += `Cảnh giới: ${pc.realm}\n`;
        if (pc.fame) retrievedContext += `Danh vọng: ${pc.fame}\n`;
        if (pc.description) retrievedContext += `Tiểu sử: ${pc.description}\n`;
        
        const pcStatuses = statuses.filter(s => s.owner === pc.name || s.owner === 'pc');
        if (pcStatuses.length > 0) {
            retrievedContext += `Trạng thái hiện tại của PC: ${pcStatuses.map(s => s.name).join(', ')}\n`;
        }
        retrievedContext += "-------------------------------------\n\n";
        
        // Add a dedicated block for learned skills to make them more prominent for the AI.
        if (pc.learnedSkills && pc.learnedSkills.length > 0) {
            retrievedContext += "--- KỸ NĂNG ĐÃ HỌC (Sẵn sàng chiến đấu) ---\n";
            pc.learnedSkills.forEach(skillName => {
                const skillEntity = knownEntities[skillName];
                // Filter out broken/destroyed skills (if that's a mechanic)
                if (skillEntity && skillEntity.state !== 'broken' && skillEntity.state !== 'destroyed') {
                     if (skillEntity.description) {
                        retrievedContext += `- ${skillEntity.name}: ${skillEntity.description}\n`;
                    } else {
                        retrievedContext += `- ${skillName}\n`;
                    }
                }
            });
            retrievedContext += "-------------------------------------------\n\n";
        }
    }
    
    // NEW DEDICATED INVENTORY BLOCK
    const pcItems = Object.values(knownEntities).filter(e => e.type === 'item' && e.owner === pc?.name && e.state !== 'broken' && e.state !== 'destroyed');
    if (pcItems.length > 0) {
        retrievedContext += "--- HÀNH TRANG & VẬT PHẨM (Sẵn sàng sử dụng) ---\n";
        pcItems.forEach(item => {
            let itemDetails = [];
            if (item.description) {
                const firstSentence = item.description.split('.')[0];
                itemDetails.push(`Công dụng: ${firstSentence}.`);
            }
            if (item.equipped) itemDetails.push('Trang bị');
            if (typeof item.uses === 'number') itemDetails.push(`Dùng: ${item.uses} lần`);
            if (typeof item.durability === 'number') itemDetails.push(`Bền: ${item.durability}/100`);
            retrievedContext += `- ${item.name}: ${itemDetails.join('; ')}\n`;
        });
        retrievedContext += "----------------------------------------------\n\n";
    }

    // Add world context
    if (worldData) {
        retrievedContext += "--- BỐI CẢNH THẾ GIỚI (CỐT LÕI) ---\n";
        if (worldData.genre) retrievedContext += `Thể loại: ${worldData.genre}\n`;
        if (worldData.worldDetail) retrievedContext += `Chi tiết: ${worldData.worldDetail}\n`;
        retrievedContext += "-----------------------------------\n\n";
    }

    retrievedContext += "--- TRI THỨC LIÊN QUAN (Được truy xuất cho hành động này) ---\n";
    if (gameTime) {
        retrievedContext += `Thời gian hiện tại: Năm ${gameTime.year} Tháng ${gameTime.month} Ngày ${gameTime.day}, ${gameTime.hour} giờ.\n`;
    }
    retrievedContext += `Lượt hiện tại: ${turnCount}\n\n`;

    // Filter out dead/broken entities before displaying them
    const filterInteractable = (entity: Entity): boolean => {
        if (entity.state === 'dead' || entity.state === 'destroyed') {
            // Companions who are dead should still be shown for story purposes.
            return entity.type === 'companion';
        }
        if (entity.state === 'broken') {
            return false; // Hide broken items from interactable list
        }
        return true; // Keep everything else
    };
    
    // Filter out PC-owned items since they are now in their own block
    const isPcItem = (e: Entity) => e.type === 'item' && e.owner === pc?.name;

    const otherDirectEntities = Array.from(directEntities).filter(e => e.type !== 'pc' && !isPcItem(e) && filterInteractable(e));
    retrievedContext += "**Thực thể & Vật phẩm liên quan (trực tiếp):**\n";
    if (otherDirectEntities.length > 0) {
        otherDirectEntities.forEach(entity => {
            retrievedContext += formatEntityForPrompt(entity, statuses) + '\n';
        });
    } else {
        retrievedContext += "Không có.\n";
    }

    const filteredRecursiveEntities = Array.from(recursiveEntities).filter(e => !isPcItem(e) && filterInteractable(e));
    if (filteredRecursiveEntities.length > 0) {
        retrievedContext += "\n**Thực thể & Vật phẩm liên quan (gián tiếp):**\n";
        filteredRecursiveEntities.forEach(entity => {
            retrievedContext += formatEntityForPrompt(entity, statuses) + '\n';
        });
    }
    
    // Add a comprehensive list of all active statuses
    if (statuses.length > 0) {
        retrievedContext += "\n**DANH SÁCH TRẠNG THÁI TOÀN CỤC (QUAN TRỌNG):**\n";
        statuses.forEach(status => {
            const statusDetails = [
                `Đối tượng: ${status.owner}`,
                `Thời gian: ${status.duration || 'Không rõ'}`,
                status.cureConditions ? `Điều kiện chữa: ${status.cureConditions}` : ''
            ].filter(Boolean).join('; ');
            retrievedContext += `- ${status.name}: ${statusDetails}\n`;
        });
    }

    // Find and add quests related to the action
    const activeQuests = quests.filter(q => q.status === 'active');
    if (activeQuests.length > 0) {
        retrievedContext += "\n**Nhiệm vụ đang hoạt động:**\n";
        activeQuests.forEach(q => {
            const objectives = q.objectives.filter(o => !o.completed).map(o => o.description).join(', ');
            retrievedContext += `- ${q.title}: (Mục tiêu: ${objectives})\n`;
        });
    }

    retrievedContext += "--- KẾT THÚC TRI THỨC ---\n";
    
    // Tiered Chronicle Context
    let summaryContext = '';
    if (chronicle && (chronicle.memoir.length > 0 || chronicle.chapter.length > 0 || chronicle.turn.length > 0)) {
        summaryContext += `\n--- BIÊN NIÊN SỬ (TÓM TẮT LỊCH SỬ) ---\n`;
        if (chronicle.memoir.length > 0) {
            summaryContext += `**Hồi Ký (Các sự kiện lớn nhất):**\n` + chronicle.memoir.slice(-2).map(s => `- ${s}`).join('\n') + '\n';
        }
        if (chronicle.chapter.length > 0) {
            summaryContext += `**Chương (Sự kiện gần đây):**\n` + chronicle.chapter.slice(-3).map(s => `- ${s}`).join('\n') + '\n';
        }
        if (chronicle.turn.length > 0) {
             summaryContext += `**Lượt (Diễn biến vừa qua):**\n` + chronicle.turn.slice(-3).map(s => `- ${s}`).join('\n') + '\n';
        }
        summaryContext += `--- KẾT THÚC BIÊN NIÊN SỬ ---\n`;
    }


    let recentHistoryContext = "--- DIỄN BIẾN GẦN NHẤT (5 LƯỢT TRỞ LẠI) ---\n";
    const historyWindow = gameHistory.slice(-10); // Sliding window of 5 turns (user + model)

    if (historyWindow.length > 0) {
        const cleanedHistory = historyWindow.map(entry => {
            if (entry.role === 'user') {
                const match = entry.parts[0].text.match(/--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---\n"([^"]+)"/);
                return `> ${match ? match[1] : 'Hành động...'}`;
            }
            // model role
            try {
                const parsed = JSON.parse(entry.parts[0].text);
                const storyContent = parsed.story || '';
                return storyContent.replace(/\[([A-Z_]+):\s*([^\]]+)\]/g, '').trim();
            } catch(e) {
                return entry.parts[0].text.replace(/\[([A-Z_]+):\s*([^\]]+)\]/g, '').trim();
            }
        }).filter(Boolean).join('\n\n');
        recentHistoryContext += cleanedHistory ? (cleanedHistory + '\n') : 'Không có diễn biến nào gần đây.';
    } else {
         recentHistoryContext += "Đây là lượt đi đầu tiên.\n";
    }
    recentHistoryContext += "--- KẾT THÚC DIỄN BIẾN ---\n";


    const pinnedMemories = memories.filter(m => m.pinned).map(m => `- ${m.text}`).join('\n');
    let memoryContext = '';
    if (pinnedMemories) {
        memoryContext = `\n--- KÝ ỨC ĐÃ GHIM (QUAN TRỌNG) ---\n${pinnedMemories}\n`;
    }

    // Assemble the final prompt
    const finalPrompt = `${ruleChangeContext}${customRulesContext}${retrievedContext}${summaryContext}${recentHistoryContext}${memoryContext}
--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---
"${action}"
${nsfwInstructionPart}
YÊU CẦU: Dựa trên hành động của người chơi và TOÀN BỘ tri thức đã truy xuất, hãy tiếp tục câu chuyện một cách logic.`;

    return finalPrompt;
};
