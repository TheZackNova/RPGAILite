import { useCallback, useMemo, useContext } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { AIContext } from '../../App.tsx';
import type { SaveData, Entity, GameHistoryEntry, Status, Quest, Memory, CustomRule } from '../types.ts';
import { buildEnhancedRagPrompt } from '../promptBuilder.ts';

// Helper function for time calculation
const calculateNewTime = (
    currentTime: { year: number; month: number; day: number; hour: number; },
    elapsed: { years: number; months: number; days: number; hours: number; }
): { year: number; month: number; day: number; hour: number; } => {
    let { year, month, day, hour } = currentTime;

    hour += elapsed.hours;
    day += Math.floor(hour / 24);
    hour = hour % 24;

    day += elapsed.days;
    // Assuming 30 days a month for simplicity
    if (day > 30) {
        month += Math.floor((day - 1) / 30);
        day = ((day - 1) % 30) + 1;
    }
    
    month += elapsed.months;
    // Assuming 12 months a year
    if (month > 12) {
        year += Math.floor((month - 1) / 12);
        month = ((month - 1) % 12) + 1;
    }
    
    year += elapsed.years;

    return { year, month, day, hour };
};

const applyStatusWithLimit = (prevStatuses: Status[], newStatusAttributes: any, owner: string): Status[] => {
    const newStatusType = newStatusAttributes.type;
    if (!newStatusType) {
        // Failsafe for statuses without a type, just add it.
        return [...prevStatuses, { ...newStatusAttributes, owner } as Status];
    }

    // 1. Remove any existing status with the same name for the same owner to allow "refreshing" a status.
    const filteredStatuses = prevStatuses.filter(s => !(s.name === newStatusAttributes.name && s.owner === owner));
    
    // 2. Separate statuses for the target owner.
    const otherOwnersStatuses = filteredStatuses.filter(s => s.owner !== owner);
    const ownerStatuses = filteredStatuses.filter(s => s.owner === owner);

    // 3. Separate the owner's statuses by the new status's type.
    const ownerStatusesOfType = ownerStatuses.filter(s => s.type === newStatusType);
    const ownerStatusesOfOtherTypes = ownerStatuses.filter(s => s.type !== newStatusType);
    
    // 4. Apply the limit. Max 2 statuses per type.
    const maxStatusesPerType = 2;
    let finalOwnerStatusesOfType = ownerStatusesOfType;

    if (ownerStatusesOfType.length >= maxStatusesPerType) {
        // If limit is reached or exceeded, keep only the newest (limit - 1) statuses.
        // The oldest ones are at the beginning of the array.
        finalOwnerStatusesOfType = ownerStatusesOfType.slice(ownerStatusesOfType.length - (maxStatusesPerType - 1));
    }
    
    // 5. Create the new status object to add.
    const newStatusToAdd: Status = { ...newStatusAttributes, owner: owner };
    
    // 6. Reconstruct and return the new status list.
    return [
        ...otherOwnersStatuses, 
        ...ownerStatusesOfOtherTypes,
        ...finalOwnerStatusesOfType, 
        newStatusToAdd
    ];
};

interface GameSetters {
    setKnownEntities: React.Dispatch<React.SetStateAction<any>>;
    setStatuses: React.Dispatch<React.SetStateAction<Status[]>>;
    setQuests: React.Dispatch<React.SetStateAction<Quest[]>>;
    setGameHistory: React.Dispatch<React.SetStateAction<GameHistoryEntry[]>>;
    setMemories: React.Dispatch<React.SetStateAction<Memory[]>>;
    setParty: React.Dispatch<React.SetStateAction<Entity[]>>;
    setChronicle: React.Dispatch<React.SetStateAction<any>>;
    setGameTime: React.Dispatch<React.SetStateAction<any>>;
    setCurrentTurnTokens: React.Dispatch<React.SetStateAction<number>>;
    setTotalTokens: React.Dispatch<React.SetStateAction<number>>;
    setTurnCount: React.Dispatch<React.SetStateAction<number>>;
    setStoryLog: React.Dispatch<React.SetStateAction<string[]>>;
    setChoices: React.Dispatch<React.SetStateAction<string[]>>;
    setLocationDiscoveryOrder: React.Dispatch<React.SetStateAction<string[]>>;
}

interface ModalSetters {
    setNotification: React.Dispatch<React.SetStateAction<string | null>>;
    setShowSaveSuccess: React.Dispatch<React.SetStateAction<boolean>>;
}

interface ModalActions {
    closeRestartModal: () => void;
}

export const useGameController = (
    gameState: SaveData,
    initialGameState: SaveData,
    setters: GameSetters,
    modalSetters: ModalSetters,
    modalActions: ModalActions,
    isLoading: boolean,
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>,
    setCustomAction: React.Dispatch<React.SetStateAction<string>>
) => {
    const { ai, isAiReady, apiKeyError, rotateKey, isUsingDefaultKey, userApiKeyCount } = useContext(AIContext);

    const parseStoryAndTags = useCallback((storyText: string, applySideEffects = true): string => {
        if (!storyText) return '';
    
        const tagRegex = /\[([A-Z_]+):\s*([^\]]+)\]/g;
        let cleanStory = storyText;
    
        const parseAttributes = (attrString: string): { [key: string]: any } => {
            const attributes: { [key: string]: any } = {};
            const attrRegex = /(\w+)=("([^"]*)"|([^\s"\]]+))/g; // Handle quoted and unquoted values
            let match;
            while ((match = attrRegex.exec(attrString)) !== null) {
                const key = match[1];
                let value: string | boolean | number | { description: string, completed: boolean }[] = match[3] !== undefined ? match[3] : match[4];
    
                if ((key === 'isMainQuest' || key === 'equippable' || key === 'usable' || key === 'consumable' || key === 'learnable') && typeof value === 'string') {
                    value = value.toLowerCase() === 'true';
                } else if (key === 'objectives' && typeof value === 'string') {
                    value = value.split(';').map(desc => ({ description: desc.trim(), completed: false }));
                } else if ((key === 'uses' || key === 'durability' || key === 'damage' || key === 'repairedAmount' || key === 'years' || key === 'months' || key === 'days' || key === 'hours') && typeof value === 'string' && !isNaN(Number(value))) {
                    attributes[key] = Number(value);
                    continue;
                }
                attributes[key] = value;
            }
            return attributes;
        };
    
        let match;
        const unprocessedTags: string[] = [];
        while ((match = tagRegex.exec(storyText)) !== null) {
            cleanStory = cleanStory.replace(match[0], ''); // Remove tag from displayed story
            
            if (applySideEffects) {
                const tagType = match[1];
                const rawContent = match[2];
                
                const attributes = parseAttributes(rawContent);
                if (tagType === 'MEMORY_ADD' && attributes.text) {
                    setters.setMemories(prev => [...prev, { text: attributes.text, pinned: false }]);
                    continue;
                }
                if (Object.keys(attributes).length === 0) {
                     unprocessedTags.push(match[0]);
                     continue;
                }
        
                switch (tagType) {
                    case 'TIME_ELAPSED':
                        const elapsed = {
                            years: Number(attributes.years) || 0,
                            months: Number(attributes.months) || 0,
                            days: Number(attributes.days) || 0,
                            hours: Number(attributes.hours) || 0
                        };
                        if (Object.values(elapsed).some(v => v > 0)) {
                            setters.setGameTime(prevTime => calculateNewTime(prevTime, elapsed));
                        }
                        break;
                    case 'CHRONICLE_TURN':
                        if (attributes.text) {
                            setters.setChronicle(prev => ({ ...prev, turn: [...prev.turn, attributes.text] }));
                        }
                        break;
                    case 'CHRONICLE_CHAPTER':
                        if (attributes.text) {
                            setters.setChronicle(prev => ({ ...prev, chapter: [...prev.chapter, attributes.text] }));
                        }
                        break;
                    case 'CHRONICLE_MEMOIR':
                         if (attributes.text) {
                            setters.setChronicle(prev => ({ ...prev, memoir: [...prev.memoir, attributes.text] }));
                        }
                        break;
                    case 'STATUS_APPLIED_SELF':
                        setters.setStatuses(prev => applyStatusWithLimit(prev, attributes, 'pc'));
                        break;
                    case 'STATUS_APPLIED_NPC':
                        if (attributes.npcName) {
                            const { npcName, ...statusData } = attributes;
                            setters.setStatuses(prev => applyStatusWithLimit(prev, statusData, npcName));
                        }
                        break;
                    case 'STATUS_CURED_SELF':
                        setters.setStatuses(prev => prev.filter(s => !(s.name === attributes.name && s.owner === 'pc')));
                        break;
                    case 'STATUS_CURED_NPC':
                        setters.setStatuses(prev => prev.filter(s => !(s.name === attributes.name && s.owner === attributes.npcName)));
                        break;
                    case 'LORE_SKILL':
                        setters.setKnownEntities(prev => {
                            const { name, description, ...rest } = attributes;
                            if (name && description) {
                                const newSkill: Entity = {
                                    type: 'skill',
                                    name: name,
                                    description: description,
                                    ...rest
                                };
                                return { ...prev, [name]: newSkill };
                            }
                            return prev;
                        });
                        break;
                    case 'SKILL_LEARNED':
                        setters.setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            const { name, description, ...rest } = attributes;
                            if (name && description) {
                                const newSkill: Entity = {
                                    type: 'skill',
                                    name: name,
                                    description: description,
                                    ...rest
                                };
                                newEntities[name] = newSkill;
                        
                                const pc = Object.values(newEntities).find(e => e.type === 'pc');
                                if (pc) {
                                    const pcName = pc.name;
                                    const updatedPc = { ...newEntities[pcName] };
                                    if (!updatedPc.learnedSkills) {
                                        updatedPc.learnedSkills = [];
                                    }
                                    if (!updatedPc.learnedSkills.includes(name)) {
                                        updatedPc.learnedSkills.push(name);
                                    }
                                    newEntities[pcName] = updatedPc;
                                }
                            }
                            return newEntities;
                        });
                        break;
                    case 'LORE_NPC':
                        setters.setKnownEntities(prev => {
                            const newAttributes = { ...attributes };
                            if (typeof newAttributes.skills === 'string') {
                                newAttributes.skills = newAttributes.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
                            }
                            return { ...prev, [attributes.name]: { type: 'npc', ...newAttributes } };
                        });
                        break;
                    case 'LORE_ITEM':
                        setters.setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'item', ...attributes } }));
                        break;
                    case 'LORE_LOCATION':
                        setters.setKnownEntities(prev => {
                            const newEntities = { ...prev, [attributes.name]: { type: 'location', ...attributes } };
                            setters.setLocationDiscoveryOrder(prevOrder => {
                                if (!prevOrder.includes(attributes.name)) {
                                    return [...prevOrder, attributes.name];
                                }
                                return prevOrder;
                            });
                            return newEntities;
                        });
                        break;
                    case 'LORE_FACTION':
                         setters.setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'faction', ...attributes } }));
                         break;
                    case 'LORE_CONCEPT':
                         setters.setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'concept', ...attributes } }));
                         break;
                    case 'ENTITY_UPDATE':
                        setters.setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            const targetName = attributes.name;
                            if (newEntities[targetName]) {
                                const { name, newDescription, ...updateData } = attributes;
                                const finalUpdateData = { ...updateData };
                                if (newDescription) {
                                    finalUpdateData.description = newDescription;
                                }
                                
                                if (attributes.newName && attributes.newName !== targetName) {
                                    const oldEntity = newEntities[targetName];
                                    delete newEntities[targetName];
                                    newEntities[attributes.newName] = {
                                        ...oldEntity,
                                        ...finalUpdateData,
                                        name: attributes.newName
                                    };
                                } else {
                                    newEntities[targetName] = { ...newEntities[targetName], ...finalUpdateData };
                                }
                            }
                            return newEntities;
                        });
                        break;
                    case 'ITEM_AQUIRED':
                        setters.setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'item', owner: 'pc', ...attributes } }));
                        break;
                     case 'ITEM_CONSUMED':
                        setters.setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            const itemToConsume = newEntities[attributes.name];
    
                            if (itemToConsume && itemToConsume.type === 'item' && itemToConsume.owner === 'pc') {
                                if (typeof itemToConsume.uses === 'number' && itemToConsume.uses > 1) {
                                    newEntities[attributes.name] = {
                                        ...itemToConsume,
                                        uses: itemToConsume.uses - 1,
                                    };
                                } else {
                                    const { owner, equipped, ...restOfItem } = itemToConsume;
                                    newEntities[attributes.name] = restOfItem;
                                }
                            }
                            return newEntities;
                        });
                        break;
                    case 'ITEM_EQUIPPED':
                        setters.setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            const item = newEntities[attributes.name];
                            if (item && item.owner === 'pc' && item.equippable) {
                                item.equipped = true;
                            }
                            return newEntities;
                        });
                        break;
                    case 'ITEM_UNEQUIPPED':
                        setters.setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            const item = newEntities[attributes.name];
                            if (item && item.owner === 'pc') {
                                item.equipped = false;
                            }
                            return newEntities;
                        });
                        break;
                    case 'ITEM_TRANSFORMED':
                        setters.setKnownEntities(prev => {
                            const { oldName, newName, description, ...rest } = attributes;
                            if (!oldName || !newName) return prev;
    
                            const newEntities = { ...prev };
                            const oldItem = newEntities[oldName];
                            
                            if (oldItem) delete newEntities[oldName];
                            
                            const newItem: Entity = {
                                ...rest,
                                name: newName,
                                type: 'item',
                                owner: oldItem?.owner || 'pc',
                                description: description || `Vật phẩm được biến đổi từ ${oldName}.`,
                            };
    
                            newEntities[newName] = newItem;
                            
                            return newEntities;
                        });
                        break;
                    case 'ITEM_UPDATED':
                         setters.setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            if (newEntities[attributes.name] && newEntities[attributes.name].owner === 'pc') {
                                 newEntities[attributes.name] = { ...newEntities[attributes.name], ...attributes };
                            }
                            return newEntities;
                        });
                        break;
                     case 'ITEM_DAMAGED':
                        setters.setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            const item = newEntities[attributes.name];
                            if (item && typeof item.durability === 'number') {
                                item.durability = Math.max(0, item.durability - (attributes.damage || 0));
                            }
                            return newEntities;
                        });
                        break;
                    case 'ITEM_REPAIRED':
                        setters.setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            const item = newEntities[attributes.name];
                            if (item && typeof item.durability === 'number') {
                                item.durability = Math.min(100, item.durability + (attributes.repairedAmount || 0));
                            }
                            return newEntities;
                        });
                        break;
                    case 'REALM_UPDATE':
                        setters.setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            const targetEntity = Object.values(newEntities).find(e => e.name === attributes.target);
                            if (targetEntity) {
                                newEntities[targetEntity.name].realm = attributes.realm;
                            }
                            return newEntities;
                        });
                        break;
                    case 'COMPANION':
                         const newCompanion = { type: 'companion', ...attributes } as Entity;
                         if (newCompanion.name && newCompanion.description) {
                            setters.setParty(prev => [...prev.filter(p => p.name !== newCompanion.name), newCompanion]);
                            setters.setKnownEntities(prev => ({ ...prev, [newCompanion.name]: newCompanion }));
                         }
                         break;
                    case 'RELATIONSHIP_CHANGED':
                        setters.setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            if (newEntities[attributes.npcName]) {
                                newEntities[attributes.npcName].relationship = attributes.relationship;
                            }
                            return newEntities;
                        });
                        break;
                    case 'QUEST_ASSIGNED':
                        const newQuest: Quest = {
                             title: attributes.title,
                             description: attributes.description,
                             objectives: attributes.objectives || [],
                             giver: attributes.giver,
                             reward: attributes.reward,
                             isMainQuest: attributes.isMainQuest || false,
                             status: 'active'
                        };
                        setters.setQuests(prev => [...prev.filter(q => q.title !== newQuest.title), newQuest]);
                        break;
                    case 'QUEST_UPDATED':
                        setters.setQuests(prev => prev.map(q => q.title === attributes.title ? { ...q, status: attributes.status } : q));
                        break;
                    case 'QUEST_OBJECTIVE_COMPLETED':
                        setters.setQuests(prev => prev.map(q => {
                            if (q.title === attributes.questTitle) {
                                const newObjectives = q.objectives.map(obj => 
                                    obj.description === attributes.objectiveDescription ? { ...obj, completed: true } : obj
                                );
                                const allCompleted = newObjectives.every(obj => obj.completed);
                                return {
                                    ...q,
                                    objectives: newObjectives,
                                    status: allCompleted ? 'completed' : q.status
                                };
                            }
                            return q;
                        }));
                        break;
                     default:
                        if (tagType !== 'DEFINE_REALM_SYSTEM') {
                           unprocessedTags.push(match[0]);
                        }
                }
            }
        }
        const finalStory = cleanStory.trim();
        if (unprocessedTags.length > 0 && applySideEffects) {
             console.warn("Unprocessed Tags:", unprocessedTags);
        }
        return finalStory;
    }, [setters]);

    const responseSchema = useMemo(() => ({
        type: Type.OBJECT,
        properties: {
            story: { type: Type.STRING, description: "Phần văn bản tường thuật của câu chuyện, bao gồm các định dạng đặc biệt và các thẻ lệnh ẩn." },
            choices: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Một mảng gồm 4-5 lựa chọn cho người chơi." },
        },
        required: ['story', 'choices']
    }), []);

    const parseApiResponse = useCallback((text: string) => {
        try {
            const jsonResponse = JSON.parse(text);
            const cleanStory = parseStoryAndTags(jsonResponse.story, true);
            setters.setStoryLog(prev => [...prev, cleanStory]);
            setters.setChoices(jsonResponse.choices || []);
        } catch (e) {
            console.error("Failed to parse AI response:", e, "Raw response:", text);
            setters.setStoryLog(prev => [...prev, "Lỗi: AI trả về dữ liệu không hợp lệ. Hãy thử lại."]);
            setters.setChoices([]);
        }
    }, [parseStoryAndTags, setters]);
    
    const generateInitialStory = useCallback(async () => {
        if (!ai) return;
        setIsLoading(true);
        const { worldData, customRules, systemInstruction } = initialGameState;
        const pcEntity: Entity = {
            name: worldData.characterName || 'Vô Danh', type: 'pc', description: worldData.bio,
            gender: worldData.gender, personality: worldData.customPersonality || worldData.personalityFromList, learnedSkills: [],
        };
        if (!gameState.knownEntities[pcEntity.name]){
            setters.setKnownEntities({ [pcEntity.name]: pcEntity });
        }
        if (gameState.party.length === 0){
             setters.setParty([pcEntity]);
        }
       
        const activeRules = customRules.filter(r => r.isActive);
        let customRulesContext = activeRules.length > 0 ? `\n--- TRI THỨC & LUẬT LỆ TÙY CHỈNH (ĐANG ÁP DỤNG) ---\n${activeRules.map(r => `- ${r.content}`).join('\n')}\n--- KẾT THÚC ---\n` : '';
        const userPrompt = `${customRulesContext}BẠN LÀ QUẢN TRÒ...`; // Add full prompt here from original
        const initialHistory: GameHistoryEntry[] = [{ role: 'user', parts: [{ text: userPrompt }] }];
        setters.setGameHistory(initialHistory);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash', contents: initialHistory,
                config: { systemInstruction, responseMimeType: "application/json", responseSchema }
            });
            const turnTokens = response.usageMetadata?.totalTokenCount || 0;
            setters.setCurrentTurnTokens(turnTokens);
            setters.setTotalTokens(prev => prev + turnTokens);
            const responseText = response.text.trim();
            parseApiResponse(responseText);
            setters.setGameHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
        } catch (error) {
            console.error("Error generating initial story:", error);
            setters.setStoryLog(["Có lỗi xảy ra khi bắt đầu câu chuyện. Vui lòng thử lại."]);
        } finally {
            setIsLoading(false);
        }
    }, [ai, initialGameState, gameState, setters, parseApiResponse, responseSchema]);

    useEffect(() => {
        if (gameState.gameHistory.length === 0 && isAiReady) {
            generateInitialStory();
        } else if (!isAiReady) {
            setters.setStoryLog([apiKeyError || "AI chưa sẵn sàng. Vui lòng kiểm tra API Key và quay về trang chủ."]);
            setIsLoading(false);
        }
    }, [gameState.gameHistory.length, isAiReady, apiKeyError, generateInitialStory, setters]);
    
    const handleAction = useCallback(async (action: string) => {
        let originalAction = action.trim();
        if (!originalAction || isLoading || !ai) return;

        setIsLoading(true);
        setters.setChoices([]);
        setCustomAction('');
        setters.setStoryLog(prev => [...prev, `> ${originalAction}`]);

        const userPrompt = buildEnhancedRagPrompt(originalAction, gameState, '', '');
        const newUserEntry: GameHistoryEntry = { role: 'user', parts: [{ text: userPrompt }] };
        const updatedHistory = [...gameState.gameHistory, newUserEntry];
        
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash', contents: updatedHistory,
                config: { systemInstruction: gameState.systemInstruction, responseMimeType: "application/json", responseSchema }
            });
            const turnTokens = response.usageMetadata?.totalTokenCount || 0;
            setters.setCurrentTurnTokens(turnTokens);
            setters.setTotalTokens(prev => prev + turnTokens);
            const responseText = response.text.trim();
            setters.setGameHistory(prev => [...prev, newUserEntry, { role: 'model', parts: [{ text: responseText }] }]);
            parseApiResponse(responseText);
            setters.setTurnCount(prev => prev + 1); 
        } catch (error: any) {
            console.error("Error continuing story:", error);
            setters.setStoryLog(prev => prev.slice(0, -1));
            if (!isUsingDefaultKey && userApiKeyCount > 1 && error.toString().includes('429')) {
                rotateKey();
                modalSetters.setNotification("Lỗi giới hạn yêu cầu. Đã tự động chuyển API Key.");
            } else {
                 setters.setStoryLog(prev => [...prev, "Lỗi: AI không thể xử lý yêu cầu."]);
            }
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, ai, gameState, setters, modalSetters, isUsingDefaultKey, userApiKeyCount, rotateKey, parseApiResponse, responseSchema]);

    const handleSaveGame = useCallback(() => {
        modalSetters.setShowSaveSuccess(true);
        setTimeout(() => modalSetters.setShowSaveSuccess(false), 3000);
        const jsonString = JSON.stringify(gameState, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `AI-RolePlay-Save-${new Date().toISOString()}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [gameState, modalSetters]);

    const handleRestartGame = useCallback(() => {
        modalActions.closeRestartModal();
        const pcEntity: Entity = {
            name: initialGameState.worldData.characterName || 'Vô Danh',
            type: 'pc',
            description: initialGameState.worldData.bio,
            gender: initialGameState.worldData.gender,
            personality: initialGameState.worldData.customPersonality || initialGameState.worldData.personalityFromList,
            learnedSkills: [],
        };
        setters.setKnownEntities({ [pcEntity.name]: pcEntity });
        setters.setParty([pcEntity]);
        setters.setStatuses([]);
        setters.setQuests([]);
        setters.setGameHistory([]);
        setters.setTurnCount(0);
        setters.setMemories([]);
        setters.setChronicle({ memoir: [], chapter: [], turn: [] });
        setters.setGameTime({ year: 1, month: 1, day: 1, hour: 8 });
        setters.setCurrentTurnTokens(0);
        setters.setTotalTokens(0);
        setters.setStoryLog([]);
        setters.setChoices([]);
        setters.setLocationDiscoveryOrder([]);
    }, [initialGameState, setters, modalActions]);

    const handleSuggestAction = useCallback(async () => {
        if (!ai || isLoading) return;
        setIsLoading(true);
        try {
            const suggestionPrompt = "Dựa trên tình hình hiện tại, hãy gợi ý một hành động sáng tạo và bất ngờ cho người chơi. Chỉ trả về một câu hành động, không giải thích hay thêm bất cứ thứ gì khác.";
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: suggestionPrompt,
            });
            setCustomAction(response.text.trim());
        } catch (error) {
            console.error("Error suggesting action:", error);
            setCustomAction("Không thể nhận gợi ý lúc này.");
        } finally {
            setIsLoading(false);
        }
    }, [ai, isLoading, setIsLoading, setCustomAction]);

    return {
        parseStoryAndTags,
        parseApiResponse,
        generateInitialStory,
        handleAction,
        handleSaveGame,
        handleRestartGame,
        handleSuggestAction,
        responseSchema
    };
};