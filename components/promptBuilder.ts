import { SaveData, Entity, Status, Quest, GameHistoryEntry, CustomRule } from './types.ts';
import { MBTI_PERSONALITIES } from './data/mbti.ts';

// Token Management Constants
const MAX_TOKENS_PER_TURN = 200000;
const TOKEN_BUFFER = 5000; // Safety buffer
const EFFECTIVE_TOKEN_LIMIT = MAX_TOKENS_PER_TURN - TOKEN_BUFFER;

// Token allocation priorities (percentages)
const TOKEN_ALLOCATION = {
    WORLD_CONTEXT: 0.05,      // 5% - World background
    CORE_ENTITIES: 0.25,      // 25% - PC, party, equipped items
    EXTENDED_ENTITIES: 0.15,  // 15% - Retrieved entities
    CUSTOM_RULES: 0.10,       // 10% - Active custom rules
    QUEST_CONTEXT: 0.05,      // 5% - Active quests
    CHRONICLE: 0.10,          // 10% - Game summary
    RECENT_HISTORY: 0.20,     // 20% - Recent game turns
    MEMORIES: 0.05,           // 5% - Pinned memories
    ACTION_CONTEXT: 0.05      // 5% - Current action + NSFW context
};

// Rough token estimation (1 token ≈ 0.75 words for Vietnamese)
const estimateTokens = (text: string): number => {
    const wordCount = text.split(/\s+/).length;
    return Math.ceil(wordCount / 0.75);
};

const truncateText = (text: string, maxTokens: number, preserveEnd = false): string => {
    const estimatedTokens = estimateTokens(text);
    if (estimatedTokens <= maxTokens) return text;

    const targetWordCount = Math.floor(maxTokens * 0.75);
    const words = text.split(/\s+/);
    
    if (preserveEnd) {
        // Keep the end of the text (useful for recent history)
        const truncated = words.slice(-targetWordCount).join(' ');
        return words.length > targetWordCount ? `[...] ${truncated}` : truncated;
    } else {
        // Keep the beginning of the text
        const truncated = words.slice(0, targetWordCount).join(' ');
        return words.length > targetWordCount ? `${truncated} [...]` : truncated;
    }
};

interface TokenBudget {
    worldContext: number;
    coreEntities: number;
    extendedEntities: number;
    customRules: number;
    questContext: number;
    chronicle: number;
    recentHistory: number;
    memories: number;
    actionContext: number;
}

interface PrioritizedEntities {
    core: Entity[];
    extended: Entity[];
}

// Calculate token budgets
const calculateTokenBudgets = (): TokenBudget => {
    return {
        worldContext: Math.floor(EFFECTIVE_TOKEN_LIMIT * TOKEN_ALLOCATION.WORLD_CONTEXT),
        coreEntities: Math.floor(EFFECTIVE_TOKEN_LIMIT * TOKEN_ALLOCATION.CORE_ENTITIES),
        extendedEntities: Math.floor(EFFECTIVE_TOKEN_LIMIT * TOKEN_ALLOCATION.EXTENDED_ENTITIES),
        customRules: Math.floor(EFFECTIVE_TOKEN_LIMIT * TOKEN_ALLOCATION.CUSTOM_RULES),
        questContext: Math.floor(EFFECTIVE_TOKEN_LIMIT * TOKEN_ALLOCATION.QUEST_CONTEXT),
        chronicle: Math.floor(EFFECTIVE_TOKEN_LIMIT * TOKEN_ALLOCATION.CHRONICLE),
        recentHistory: Math.floor(EFFECTIVE_TOKEN_LIMIT * TOKEN_ALLOCATION.RECENT_HISTORY),
        memories: Math.floor(EFFECTIVE_TOKEN_LIMIT * TOKEN_ALLOCATION.MEMORIES),
        actionContext: Math.floor(EFFECTIVE_TOKEN_LIMIT * TOKEN_ALLOCATION.ACTION_CONTEXT)
    };
};

// Prioritize entities by importance
const prioritizeEntities = (
    retrievedEntities: Set<Entity>,
    party: Entity[],
    knownEntities: Record<string, Entity>
): PrioritizedEntities => {
    const core: Entity[] = [];
    const extended: Entity[] = [];
    
    const pc = party.find(p => p.type === 'pc');
    
    // Core entities (highest priority)
    party.forEach(member => {
        core.push(member);
        retrievedEntities.delete(member); // Remove from extended list
    });
    
    // Equipped items
    if (pc) {
        Object.values(knownEntities).forEach(entity => {
            if (entity.type === 'item' && entity.owner === pc.name && entity.equipped) {
                core.push(entity);
                retrievedEntities.delete(entity);
            }
        });
    }
    
    // Remaining entities go to extended
    extended.push(...Array.from(retrievedEntities));
    
    return { core, extended };
};

// Enhanced entity formatting with token awareness
const formatEntityForPrompt = (
    entity: Entity, 
    allStatuses: Status[], 
    maxTokens?: number
): string => {
    const details: string[] = [];
    
    // State information
    if (entity.state) {
        const stateMap: Record<string, string> = {
            'dead': 'ĐÃ CHẾT',
            'broken': 'BỊ HỎNG',
            'destroyed': 'ĐÃ BỊ PHÁ HỦY'
        };
        const stateText = stateMap[entity.state];
        if (stateText) details.push(`Trạng thái: ${stateText}`);
    }

    // Essential information (always include)
    if (entity.description) {
        const desc = maxTokens ? truncateText(entity.description, Math.floor(maxTokens * 0.3)) : entity.description;
        details.push(`Mô tả: ${desc}`);
    }
    
    if (entity.age) details.push(`Tuổi: ${entity.age}`);
    if (entity.appearance) {
        const appearance = maxTokens ? truncateText(entity.appearance, Math.floor(maxTokens * 0.2)) : entity.appearance;
        details.push(`Dung mạo: ${appearance}`);
    }
    
    // Personality information
    if (entity.personality) {
        const personality = maxTokens ? truncateText(entity.personality, Math.floor(maxTokens * 0.15)) : entity.personality;
        details.push(`Tính cách (Bề ngoài): ${personality}`);
    }
    
    if (entity.personalityMbti && MBTI_PERSONALITIES[entity.personalityMbti]) {
        details.push(`Tính cách (Cốt lõi - ${entity.personalityMbti}): ${MBTI_PERSONALITIES[entity.personalityMbti].description}`);
    }
    
    if (entity.motivation) {
        const motivation = maxTokens ? truncateText(entity.motivation, Math.floor(maxTokens * 0.1)) : entity.motivation;
        details.push(`Động cơ: ${motivation}`);
    }
    
    if (entity.location) details.push(`Vị trí: ${entity.location}`);
    if (entity.realm) details.push(`Cảnh giới: ${entity.realm}`);

    // Skills for NPCs and companions
    if ((entity.type === 'npc' || entity.type === 'companion') && 
        Array.isArray(entity.skills) && entity.skills.length > 0) {
        const skills = entity.skills.slice(0, 10); // Limit skills to prevent bloat
        details.push(`Kỹ năng: ${skills.join(', ')}`);
    }

    // Item-specific information
    if (entity.type === 'item') {
        if (entity.equipped) details.push('Trạng thái: Đang trang bị');
        if (typeof entity.uses === 'number') details.push(`Lần dùng: ${entity.uses}`);
        if (typeof entity.durability === 'number') details.push(`Độ bền: ${entity.durability}/100`);
    }

    // Status effects
    const entityStatuses = allStatuses.filter(s => s.owner === entity.name);
    if (entityStatuses.length > 0) {
        const statusNames = entityStatuses.slice(0, 5).map(s => s.name); // Limit status effects
        details.push(`Hiệu ứng: ${statusNames.join(', ')}`);
    }

    if (entity.relationship) details.push(`Quan hệ: ${entity.relationship}`);

    const result = `- ${entity.name} (${entity.type}): ${details.join('; ')}`;
    
    // Final token check and truncation if needed
    return maxTokens ? truncateText(result, maxTokens) : result;
};

// Build entity context with token limits
const buildEntityContext = (
    prioritizedEntities: PrioritizedEntities,
    statuses: Status[],
    tokenBudget: TokenBudget
): string => {
    let context = '';
    let remainingCoreTokens = tokenBudget.coreEntities;
    let remainingExtendedTokens = tokenBudget.extendedEntities;

    // Core entities (essential - always include but may truncate)
    if (prioritizedEntities.core.length > 0) {
        const coreTokensPerEntity = Math.floor(remainingCoreTokens / prioritizedEntities.core.length);
        
        prioritizedEntities.core.forEach(entity => {
            const entityText = formatEntityForPrompt(entity, statuses, coreTokensPerEntity);
            const entityTokens = estimateTokens(entityText);
            
            if (entityTokens <= remainingCoreTokens) {
                context += entityText + '\n';
                remainingCoreTokens -= entityTokens;
            } else if (remainingCoreTokens > 100) { // Minimum viable entity description
                const truncated = truncateText(entityText, remainingCoreTokens);
                context += truncated + '\n';
                remainingCoreTokens = 0;
            }
        });
    }

    // Extended entities (include as many as token budget allows)
    if (prioritizedEntities.extended.length > 0 && remainingExtendedTokens > 0) {
        const extendedTokensPerEntity = Math.floor(remainingExtendedTokens / prioritizedEntities.extended.length);
        
        for (const entity of prioritizedEntities.extended) {
            if (remainingExtendedTokens <= 100) break; // Not enough tokens for meaningful description
            
            const entityText = formatEntityForPrompt(entity, statuses, extendedTokensPerEntity);
            const entityTokens = estimateTokens(entityText);
            
            if (entityTokens <= remainingExtendedTokens) {
                context += entityText + '\n';
                remainingExtendedTokens -= entityTokens;
            } else {
                const truncated = truncateText(entityText, remainingExtendedTokens);
                context += truncated + '\n';
                break;
            }
        }
    }

    return context;
};

// Build world context with token limits
const buildWorldContext = (worldData: SaveData['worldData'], maxTokens: number): string => {
    if (!worldData) return '';

    let context = "--- BỐI CẢNH THẾ GIỚI (CỐT LÕI) ---\n";
    
    if (worldData.genre) context += `Thể loại: ${worldData.genre}\n`;
    
    if (worldData.worldDetail) {
        const availableTokens = maxTokens - estimateTokens(context) - 50; // Reserve for closing
        const truncatedDetail = truncateText(worldData.worldDetail, availableTokens);
        context += `Chi tiết: ${truncatedDetail}\n`;
    }
    
    context += "-----------------------------------\n\n";
    
    return truncateText(context, maxTokens);
};

// Build quest context with token limits
const buildQuestContext = (quests: Quest[], maxTokens: number): string => {
    const activeQuests = quests.filter(q => q.status === 'active');
    if (activeQuests.length === 0) return '';

    let context = "\n**Nhiệm vụ đang hoạt động:**\n";
    let remainingTokens = maxTokens - estimateTokens(context);
    
    for (const quest of activeQuests) {
        if (remainingTokens <= 50) break;
        
        const objectives = quest.objectives
            .filter(o => !o.completed)
            .map(o => o.description)
            .join(', ');
        
        const questLine = `- ${quest.title}: (Mục tiêu: ${objectives})\n`;
        const questTokens = estimateTokens(questLine);
        
        if (questTokens <= remainingTokens) {
            context += questLine;
            remainingTokens -= questTokens;
        } else {
            const truncatedObjectives = truncateText(objectives, remainingTokens - 50);
            context += `- ${quest.title}: (Mục tiêu: ${truncatedObjectives})\n`;
            break;
        }
    }
    
    return context;
};

// Build chronicle context with token limits
const buildChronicleContext = (chronicle: SaveData['chronicle'], maxTokens: number): string => {
    if (!chronicle || 
        (chronicle.memoir.length === 0 && chronicle.chapter.length === 0 && chronicle.turn.length === 0)) {
        return '';
    }

    let context = `\n--- BIÊN NIÊN SỬ (TÓM TẮT LỊCH SỬ) ---\n`;
    let remainingTokens = maxTokens - estimateTokens(context) - 100; // Reserve for closing
    
    // Prioritize: memoir > chapter > turn
    const sections = [
        { title: '**Hồi Ký (Các sự kiện lớn nhất):**', items: chronicle.memoir.slice(-2) },
        { title: '**Chương (Sự kiện gần đây):**', items: chronicle.chapter.slice(-3) },
        { title: '**Lượt (Diễn biến vừa qua):**', items: chronicle.turn.slice(-3) }
    ];
    
    for (const section of sections) {
        if (section.items.length === 0 || remainingTokens <= 100) continue;
        
        const sectionHeader = section.title + '\n';
        const headerTokens = estimateTokens(sectionHeader);
        
        if (headerTokens >= remainingTokens) break;
        
        context += sectionHeader;
        remainingTokens -= headerTokens;
        
        const tokensPerItem = Math.floor(remainingTokens / section.items.length);
        
        for (const item of section.items) {
            if (remainingTokens <= 20) break;
            
            const itemText = `- ${item}\n`;
            const itemTokens = estimateTokens(itemText);
            
            if (itemTokens <= remainingTokens) {
                context += itemText;
                remainingTokens -= itemTokens;
            } else {
                const truncated = `- ${truncateText(item, remainingTokens - 10)}\n`;
                context += truncated;
                break;
            }
        }
    }
    
    context += `--- KẾT THÚC BIÊN NIÊN SỬ ---\n`;
    return context;
};

// Build history context with token limits
const buildHistoryContext = (gameHistory: GameHistoryEntry[], maxTokens: number): string => {
    let context = "--- DIỄN BIẾN GẦN NHẤT (3 LƯỢT TRỞ LẠI) ---\n";
    let remainingTokens = maxTokens - estimateTokens(context) - 50; // Reserve for closing
    
    if (gameHistory.length === 0) {
        context += "Đây là lượt đi đầu tiên.\n";
    } else {
        // Start from most recent and work backwards
        const recentHistory = gameHistory.slice(-12); // Get more entries to work with
        const processedEntries: string[] = [];
        
        for (let i = recentHistory.length - 1; i >= 0 && remainingTokens > 100; i--) {
            const entry = recentHistory[i];
            let entryText: string;
            
            if (entry.role === 'user') {
                const action = entry.parts[0].text.match(/--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---\n"([^"]+)"/);
                entryText = `> ${action ? action[1] : 'Hành động...'}`;
            } else {
                try {
                    const parsed = JSON.parse(entry.parts[0].text);
                    entryText = parsed.story ? parsed.story.replace(/\[([A-Z_]+):\s*([^\]]+)\]/g, '').trim() : '';
                } catch {
                    entryText = entry.parts[0].text.replace(/\[([A-Z_]+):\s*([^\]]+)\]/g, '').trim();
                }
            }
            
            if (!entryText) continue;
            
            const entryTokens = estimateTokens(entryText);
            
            if (entryTokens <= remainingTokens) {
                processedEntries.unshift(entryText);
                remainingTokens -= entryTokens;
            } else if (remainingTokens > 50) {
                const truncated = truncateText(entryText, remainingTokens, true);
                processedEntries.unshift(truncated);
                break;
            }
        }
        
        context += processedEntries.length > 0 
            ? processedEntries.join('\n\n') + '\n'
            : 'Không có diễn biến nào gần đây.\n';
    }
    
    context += "--- KẾT THÚC DIỄN BIẾN ---\n";
    return context;
};

// Enhanced retrieval with token awareness
const buildTokenAwareRetrievalContext = (
    action: string, 
    gameHistory: GameHistoryEntry[], 
    knownEntities: Record<string, Entity>,
    party: Entity[],
    customRules: CustomRule[]
): Set<Entity> => {
    const lowerCaseAction = action.toLowerCase();
    
    // Use smaller history window to save tokens on processing
    const historyForContext = gameHistory.slice(-6);
    const historyText = historyForContext.map(h => {
        try {
            const parsed = JSON.parse(h.parts[0].text);
            return parsed.story || '';
        } catch {
            const match = h.parts[0].text.match(/--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---\n"([^"]+)"/);
            return match ? match[1] : '';
        }
    }).join(' ');

    const relevantTextForRetrieval = (lowerCaseAction + ' ' + historyText).toLowerCase();
    const entityMap = new Map(Object.entries(knownEntities));
    const retrievedEntities = new Set<Entity>();

    // Always include party members
    party.forEach(member => retrievedEntities.add(member));
    
    // Find entities mentioned in relevant text
    for (const [name, entity] of entityMap) {
        if (relevantTextForRetrieval.includes(name.toLowerCase())) {
            retrievedEntities.add(entity);
        }
    }

    // Limited recursive retrieval to prevent token explosion
    const initialEntities = Array.from(retrievedEntities).slice(0, 20); // Limit initial set
    for (const entity of initialEntities) {
        const description = (entity.description || '').toLowerCase();
        const skills = (entity.skills || []).join(' ').toLowerCase();
        const textToScan = (description + ' ' + skills).substring(0, 1000); // Limit scan text

        let addedCount = 0;
        for (const [name, relatedEntity] of entityMap) {
            if (addedCount >= 10) break; // Limit recursive additions
            if (textToScan.includes(name.toLowerCase()) && !retrievedEntities.has(relatedEntity)) {
                retrievedEntities.add(relatedEntity);
                addedCount++;
            }
        }
    }

    return retrievedEntities;
};

// Main function with token management
export const buildRagPrompt = (
    action: string,
    gameState: SaveData,
    ruleChangeContext: string,
    playerNsfwRequest: string,
): string => {
    try {
        if (!gameState?.knownEntities || !Array.isArray(gameState.party)) {
            throw new Error('Invalid game state provided');
        }

        const {
            worldData, knownEntities, statuses, quests, party, turnCount,
            gameHistory, memories, chronicle, gameTime, customRules
        } = gameState;

        const tokenBudget = calculateTokenBudgets();

        // Special case: Rule updates (with token limits)
        if (ruleChangeContext) {
            const activeRules = customRules.filter(r => r.isActive);
            let fullRulesContext = '';
            
            if (activeRules.length > 0) {
                const rulesText = activeRules.map(r => `- ${r.content}`).join('\n');
                const truncatedRules = truncateText(rulesText, tokenBudget.customRules);
                fullRulesContext = `\n--- TRI THỨC & LUẬT LỆ TÙY CHỈNH (ĐANG ÁP DỤNG) ---\n${truncatedRules}\n--- KẾT THÚC ---\n`;
            }
            
            // Build simplified context for rule updates
            const playerActionPrompt = buildRagPrompt(action, gameState, '', playerNsfwRequest);
            const cleanedPlayerActionPrompt = playerActionPrompt.replace(
                /\n--- TRI THỨC & LUẬT LỆ TÙY CHỈNH \(LIÊN QUAN ĐẾN LƯỢT NÀY\).*?--- KẾT THÚC ---\n/s, 
                ''
            );

            const combined = `${ruleChangeContext}${fullRulesContext}${cleanedPlayerActionPrompt}`;
            return truncateText(combined, EFFECTIVE_TOKEN_LIMIT);
        }

        // Build retrieval context with token awareness
        const retrievedEntities = buildTokenAwareRetrievalContext(
            action, gameHistory, knownEntities, party, customRules
        );

        const prioritizedEntities = prioritizeEntities(retrievedEntities, party, knownEntities);

        // Find relevant custom rules with token limits
        const activeRules = customRules.filter(r => r.isActive).slice(0, 20); // Limit rules
        const relevantRules = new Set<CustomRule>();
        
        if (activeRules.length > 0) {
            const keywords = new Set<string>();
            prioritizedEntities.core.forEach(e => keywords.add(e.name.toLowerCase()));
            prioritizedEntities.extended.slice(0, 10).forEach(e => keywords.add(e.name.toLowerCase()));
            
            action.toLowerCase().split(/\s+/).forEach(word => {
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

        // Build all context sections with token limits
        const worldContext = buildWorldContext(worldData, tokenBudget.worldContext);
        
        let knowledgeContext = "--- TRI THỨC LIÊN QUAN (Được truy xuất cho lượt này) ---\n";
        if (gameTime) {
            const { year, month, day, hour } = gameTime;
            knowledgeContext += `Thời gian hiện tại: Năm ${year} Tháng ${month} Ngày ${day}, ${hour} giờ.\n`;
        }
        knowledgeContext += `Lượt hiện tại: ${turnCount}\n\n`;
        
        const entityContext = buildEntityContext(prioritizedEntities, statuses, tokenBudget);
        knowledgeContext += entityContext;
        
        // Add relevant statuses
        const allRetrievedNames = [...prioritizedEntities.core, ...prioritizedEntities.extended].map(e => e.name);
        const relevantStatuses = statuses.filter(s => allRetrievedNames.includes(s.owner)).slice(0, 20);
        
        if (relevantStatuses.length > 0) {
            knowledgeContext += "\n**Trạng thái đang ảnh hưởng:**\n";
            relevantStatuses.forEach(status => {
                knowledgeContext += `- ${status.name} (${status.owner})\n`;
            });
        }
        
        knowledgeContext += "--- KẾT THÚC TRI THỨC ---\n";

        const questContext = buildQuestContext(quests, tokenBudget.questContext);
        const chronicleContext = buildChronicleContext(chronicle, tokenBudget.chronicle);
        const historyContext = buildHistoryContext(gameHistory, tokenBudget.recentHistory);
        
        // Memory context
        const pinnedMemories = memories.filter(m => m.pinned).slice(0, 10);
        let memoryContext = '';
        if (pinnedMemories.length > 0) {
            const memoriesText = pinnedMemories.map(m => `- ${m.text}`).join('\n');
            const truncatedMemories = truncateText(memoriesText, tokenBudget.memories);
            memoryContext = `\n--- KÝ ỨC ĐÃ GHIM ---\n${truncatedMemories}\n`;
        }

        // Custom rules context
        let customRulesContext = '';
        if (relevantRules.size > 0) {
            const rulesText = Array.from(relevantRules).map(r => `- ${r.content}`).join('\n');
            const truncatedRules = truncateText(rulesText, tokenBudget.customRules);
            customRulesContext = `\n--- TRI THỨC & LUẬT LỆ TÙY CHỈNH ---\n${truncatedRules}\n--- KẾT THÚC ---\n`;
        }

        // NSFW context
        let nsfwContext = playerNsfwRequest;
        if (worldData.allowNsfw && !nsfwContext) {
            nsfwContext = `\nLƯU Ý: Chế độ NSFW đang BẬT.`;
        }

        // Combine all sections
        const sections = [
            customRulesContext,
            worldContext,
            knowledgeContext,
            questContext,
            chronicleContext,
            historyContext,
            memoryContext
        ].filter(Boolean);

        let combinedContext = sections.join('');
        
        // Final action and requirements
        const actionSection = `\n--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---\n"${action}"\n${nsfwContext}\nYÊU CẦU: Tiếp tục câu chuyện dựa trên hành động và tri thức đã truy xuất.`;
        
        const finalPrompt = combinedContext + actionSection;
        
        // Final token check and truncation
        const finalTokens = estimateTokens(finalPrompt);
        
        if (finalTokens > EFFECTIVE_TOKEN_LIMIT) {
            console.warn(`Prompt exceeds token limit: ${finalTokens} > ${EFFECTIVE_TOKEN_LIMIT}. Truncating...`);
            
            // Truncate the combined context while preserving the action section
            const actionTokens = estimateTokens(actionSection);
            const availableContextTokens = EFFECTIVE_TOKEN_LIMIT - actionTokens;
            const truncatedContext = truncateText(combinedContext, availableContextTokens);
            
            return truncatedContext + actionSection;
        }
        
        console.log(`Prompt token count: ${finalTokens}/${EFFECTIVE_TOKEN_LIMIT}`);
        return finalPrompt;
        
    } catch (error) {
        console.error('Error building RAG prompt:', error);
        throw new Error(`Failed to build RAG prompt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};