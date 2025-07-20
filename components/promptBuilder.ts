


import { SaveData, Entity, Status, Quest, GameHistoryEntry, CustomRule } from './types.ts';
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
    playerNsfwRequest: string,
): string => {
    const { worldData, knownEntities, statuses, quests, party, turnCount, gameHistory, memories, chronicle, gameTime, customRules } = gameState;
    const lowerCaseAction = action.toLowerCase();
    
    // --- SPECIAL CASE: Rule updates require full context to be processed correctly. ---
    if (ruleChangeContext) {
        const activeRules = customRules.filter(r => r.isActive);
        let fullRulesContext = '';
        if (activeRules.length > 0) {
            fullRulesContext = `\n--- TRI THỨC & LUẬT LỆ TÙY CHỈNH (ĐANG ÁP DỤNG) ---\n${activeRules.map(r => `- ${r.content}`).join('\n')}\n--- KẾT THÚC ---\n`;
        }
        
        // Build the normal prompt for the player's action to provide story context
        const playerActionPrompt = buildRagPrompt(action, gameState, '', playerNsfwRequest);
        
        // Remove the RAG-generated rules from the normal prompt to avoid duplication
        const cleanedPlayerActionPrompt = playerActionPrompt.replace(/\n--- TRI THỨC & LUẬT LỆ TÙY CHỈNH \(LIÊN QUAN ĐẾN LƯỢT NÀY\).*?--- KẾT THÚC ---\n/s, '');

        // The final prompt for a rule-update turn
        return `${ruleChangeContext}${fullRulesContext}${cleanedPlayerActionPrompt}`;
    }

    
    // --- 1. Retrieval Phase (for normal turns) ---
    // Text from the last 2 turns (2 user + 2 model) + current action for context retrieval
    const historyForContext = gameHistory.slice(-4);
    const relevantTextForRetrieval = (lowerCaseAction + ' ' + historyForContext.map(h => {
        try {
            const parsed = JSON.parse(h.parts[0].text);
            return parsed.story || '';
        } catch (e) {
            const userActionMatch = h.parts[0].text.match(/--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---\n"([^"]+)"/);
            if (userActionMatch) return userActionMatch[1];
            return h.parts[0].text.replace(/\[([A-Z_]+):\s*([^\]]+)\]/g, '').trim();
        }
    }).join(' ')).toLowerCase();

    const retrievedEntities = new Set<Entity>();
    const pc = party.find(p => p.type === 'pc');

    // Always include PC, party members, and equipped items as they are always relevant.
    party.forEach(member => retrievedEntities.add(member));
    Object.values(knownEntities).forEach(entity => {
        if (entity.type === 'item' && entity.owner === pc?.name && entity.equipped) {
            retrievedEntities.add(entity);
        }
    });

    // Find other entities mentioned in the relevant text window.
    Object.values(knownEntities).forEach(entity => {
        if (entity.name && relevantTextForRetrieval.includes(entity.name.toLowerCase())) {
            retrievedEntities.add(entity);
        }
    });

    // Recursive retrieval step (one level deep)
    const allEntityNames = Object.keys(knownEntities);
    const recursivelyRetrieved = new Set<Entity>();
    retrievedEntities.forEach(entity => {
        const description = (entity.description || '').toLowerCase();
        const skills = (entity.skills || []).join(' ').toLowerCase();
        const textToScan = description + ' ' + skills;

        allEntityNames.forEach(name => {
            if (textToScan.includes(name.toLowerCase())) {
                const relatedEntity = knownEntities[name];
                if (relatedEntity && !retrievedEntities.has(relatedEntity)) {
                    recursivelyRetrieved.add(relatedEntity);
                }
            }
        });
    });
    recursivelyRetrieved.forEach(e => retrievedEntities.add(e));


    // --- Identify relevant custom rules ---
    const activeRules = customRules.filter(r => r.isActive);
    const relevantRules = new Set<CustomRule>();
    if (activeRules.length > 0) {
        const keywords = new Set<string>();
        retrievedEntities.forEach(e => keywords.add(e.name.toLowerCase()));
        
        lowerCaseAction.split(/\s+/).forEach(word => {
            const cleanWord = word.replace(/[.,!?]/g, '');
            if (cleanWord.length > 3) keywords.add(cleanWord);
        });

        activeRules.forEach(rule => {
            const ruleText = rule.content.toLowerCase();
            for (const keyword of keywords) {
                if (ruleText.includes(keyword)) {
                    relevantRules.add(rule);
                    break;
                }
            }
        });
    }


    // --- 2. Augmentation/Prompt Construction Phase ---
    let retrievedContext = "";

    if (worldData) {
        retrievedContext += "--- BỐI CẢNH THẾ GIỚI (CỐT LÕI) ---\n";
        if (worldData.genre) retrievedContext += `Thể loại: ${worldData.genre}\n`;
        if (worldData.worldDetail) retrievedContext += `Chi tiết: ${worldData.worldDetail}\n`;
        retrievedContext += "-----------------------------------\n\n";
    }

    retrievedContext += "--- TRI THỨC LIÊN QUAN (Được truy xuất cho lượt này) ---\n";
    if (gameTime) {
        retrievedContext += `Thời gian hiện tại: Năm ${gameTime.year} Tháng ${gameTime.month} Ngày ${gameTime.day}, ${gameTime.hour} giờ.\n`;
    }
    retrievedContext += `Lượt hiện tại: ${turnCount}\n\n`;

    if (retrievedEntities.size > 0) {
        const sortedEntities = Array.from(retrievedEntities).sort((a,b) => {
             if (a.type === 'pc') return -1;
             if (b.type === 'pc') return 1;
             return a.name.localeCompare(b.name);
        });
        sortedEntities.forEach(entity => {
             retrievedContext += formatEntityForPrompt(entity, statuses) + '\n';
        });
    }

    const allRetrievedNames = Array.from(retrievedEntities).map(e => e.name);
    const relevantStatuses = statuses.filter(s => allRetrievedNames.includes(s.owner));
    if (relevantStatuses.length > 0) {
        retrievedContext += "\n**Trạng thái đang ảnh hưởng (của các thực thể liên quan):**\n";
        relevantStatuses.forEach(status => {
            retrievedContext += `- ${status.name} (Chủ thể: ${status.owner})\n`;
        });
    }

    const activeQuests = quests.filter(q => q.status === 'active');
    if (activeQuests.length > 0) {
        retrievedContext += "\n**Nhiệm vụ đang hoạt động:**\n";
        activeQuests.forEach(q => {
            const objectives = q.objectives.filter(o => !o.completed).map(o => o.description).join(', ');
            retrievedContext += `- ${q.title}: (Mục tiêu: ${objectives})\n`;
        });
    }

    retrievedContext += "--- KẾT THÚC TRI THỨC ---\n";
    
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

    let recentHistoryContext = "--- DIỄN BIẾN GẦN NHẤT (3 LƯỢT TRỞ LẠI) ---\n";
    const historyWindow = gameHistory.slice(-6); 

    if (historyWindow.length > 0) {
        const cleanedHistory = historyWindow.map(entry => {
            if (entry.role === 'user') {
                const match = entry.parts[0].text.match(/--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---\n"([^"]+)"/);
                return `> ${match ? match[1] : 'Hành động...'}`;
            }
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

    let customRulesContext = '';
    const rulesToInclude = Array.from(relevantRules);
    if (rulesToInclude.length > 0) {
        customRulesContext = `\n--- TRI THỨC & LUẬT LỆ TÙY CHỈNH (LIÊN QUAN ĐẾN LƯỢT NÀY) ---\n${rulesToInclude.map(r => `- ${r.content}`).join('\n')}\n--- KẾT THÚC ---\n`;
    }
    
    let nsfwContext = playerNsfwRequest;
    if (worldData.allowNsfw && !nsfwContext) {
        // Game mode is NSFW, but this specific action isn't. Remind AI to generate choices.
        nsfwContext = `\nLƯU Ý: Chế độ NSFW của trò chơi đang được BẬT. Hãy tuân thủ quy tắc về việc chủ động tạo các lựa chọn NSFW trong phản hồi của bạn.`;
    }

    const finalPrompt = `${customRulesContext}${retrievedContext}${summaryContext}${recentHistoryContext}${memoryContext}
--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---
"${action}"
${nsfwContext}
YÊU CẦU: Dựa trên hành động của người chơi và TOÀN BỘ tri thức đã truy xuất, hãy tiếp tục câu chuyện một cách logic.`;

    return finalPrompt;
};
