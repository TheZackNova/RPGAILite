import { Type } from "@google/genai";
import { 
    Entity, 
    Status, 
    Quest, 
    Memory, 
    KnownEntities,
    GameHistoryEntry
} from '../types';

// API Response Schema for Google GenAI
export const responseSchema = {
    type: Type.OBJECT,
    properties: {
        story: { 
            type: Type.STRING, 
            description: "Phần văn bản tường thuật của câu chuyện, bao gồm các định dạng đặc biệt và các thẻ lệnh ẩn." 
        },
        choices: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Một mảng gồm 4-5 lựa chọn cho người chơi."
        },
    },
    required: ['story', 'choices']
};

// TypeScript interface for the API response
export interface AIResponse {
    story: string;
    choices: string[];
}

// Game state setters interface for parseStoryAndTags
interface GameStateSetters {
    setMemories: (fn: (prev: Memory[]) => Memory[]) => void;
    setGameTime: (fn: (prev: any) => any) => void;
    setChronicle: (fn: (prev: any) => any) => void;
    setStatuses: (fn: (prev: Status[]) => Status[]) => void;
    setKnownEntities: (fn: (prev: KnownEntities) => KnownEntities) => void;
    setLocationDiscoveryOrder: (fn: (prev: string[]) => string[]) => void;
    setParty: (fn: (prev: Entity[]) => Entity[]) => void;
    setQuests: (fn: (prev: Quest[]) => Quest[]) => void;
}

// Helper function to calculate new time
const calculateNewTime = (prevTime: any, elapsed: any) => {
    // This should contain the actual time calculation logic
    // For now, just return the previous time plus elapsed
    return {
        ...prevTime,
        year: prevTime.year + (elapsed.years || 0),
        month: prevTime.month + (elapsed.months || 0),
        day: prevTime.day + (elapsed.days || 0),
        hour: prevTime.hour + (elapsed.hours || 0)
    };
};

// Helper function to apply status with limit
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

// Main parsing function for story text and embedded tags
export const parseStoryAndTags = (
    storyText: string, 
    applySideEffects: boolean,
    gameStateSetters: GameStateSetters
): string => {
    if (!storyText) return '';
    const tagRegex = /\[([A-Z_]+):\s*([^\]]+)\]/g;
    let cleanStory = storyText;
    
    const parseAttributes = (attrString: string): { [key: string]: any } => {
        const attributes: { [key: string]: any } = {};
        const attrRegex = /(\w+)=("([^"]*)"|([^\s"\]]+))/g;
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
        cleanStory = cleanStory.replace(match[0], '');
        
        if (applySideEffects && gameStateSetters) {
            const tagType = match[1];
            const rawContent = match[2];
            const attributes = parseAttributes(rawContent);
            
            // Handle MEMORY_ADD separately
            if (tagType === 'MEMORY_ADD' && attributes.text) { 
                gameStateSetters.setMemories(prev => [...prev, { text: attributes.text, pinned: false }]); 
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
                        gameStateSetters.setGameTime(prevTime => calculateNewTime(prevTime, elapsed)); 
                    }
                    break;
                    
                case 'CHRONICLE_TURN': 
                    if (attributes.text) { 
                        gameStateSetters.setChronicle(prev => ({ ...prev, turn: [...prev.turn, attributes.text] })); 
                    } 
                    break;
                    
                case 'CHRONICLE_CHAPTER': 
                    if (attributes.text) { 
                        gameStateSetters.setChronicle(prev => ({ ...prev, chapter: [...prev.chapter, attributes.text] })); 
                    } 
                    break;
                    
                case 'CHRONICLE_MEMOIR': 
                    if (attributes.text) { 
                        gameStateSetters.setChronicle(prev => ({ ...prev, memoir: [...prev.memoir, attributes.text] })); 
                    } 
                    break;
                    
                case 'STATUS_APPLIED_SELF': 
                    gameStateSetters.setStatuses(prev => applyStatusWithLimit(prev, attributes, 'pc')); 
                    break;
                    
                case 'STATUS_APPLIED_NPC': 
                    if (attributes.npcName) { 
                        const { npcName, ...statusData } = attributes; 
                        gameStateSetters.setStatuses(prev => applyStatusWithLimit(prev, statusData, npcName)); 
                    } 
                    break;
                    
                case 'STATUS_CURED_SELF': 
                    gameStateSetters.setStatuses(prev => prev.filter(s => !(s.name === attributes.name && s.owner === 'pc'))); 
                    break;
                    
                case 'STATUS_CURED_NPC': 
                    gameStateSetters.setStatuses(prev => prev.filter(s => !(s.name === attributes.name && s.owner === attributes.npcName))); 
                    break;
                    
                case 'LORE_SKILL': 
                    gameStateSetters.setKnownEntities(prev => { 
                        const { name, description, ...rest } = attributes; 
                        if (name && description) { 
                            const newSkill: Entity = { type: 'skill', name, description, ...rest }; 
                            return { ...prev, [name]: newSkill }; 
                        } 
                        return prev; 
                    }); 
                    break;
                    
                case 'SKILL_LEARNED': 
                    gameStateSetters.setKnownEntities(prev => { 
                        const newEntities = { ...prev }; 
                        const { name, description, ...rest } = attributes; 
                        if (name && description) { 
                            const newSkill: Entity = { type: 'skill', name, description, ...rest }; 
                            newEntities[name] = newSkill; 
                            const pc = Object.values(newEntities).find(e => e.type === 'pc'); 
                            if (pc) { 
                                const pcName = pc.name; 
                                const updatedPc = { ...newEntities[pcName] }; 
                                if (!updatedPc.skills) { 
                                    updatedPc.skills = []; 
                                } 
                                if (!updatedPc.skills.includes(name)) { 
                                    updatedPc.skills.push(name); 
                                } 
                                newEntities[pcName] = updatedPc; 
                            } 
                        } 
                        return newEntities; 
                    }); 
                    break;
                    
                case 'LORE_NPC': 
                    gameStateSetters.setKnownEntities(prev => { 
                        const newAttributes = { ...attributes }; 
                        if (typeof newAttributes.skills === 'string') { 
                            newAttributes.skills = newAttributes.skills.split(',').map((s: string) => s.trim()).filter(Boolean); 
                        } 
                        return { ...prev, [attributes.name]: { type: 'npc', ...newAttributes } }; 
                    }); 
                    break;
                    
                case 'LORE_ITEM': 
                    gameStateSetters.setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'item', ...attributes } })); 
                    break;
                    
                case 'LORE_LOCATION': 
                    gameStateSetters.setKnownEntities(prev => { 
                        const newEntities = { ...prev, [attributes.name]: { type: 'location', ...attributes } }; 
                        gameStateSetters.setLocationDiscoveryOrder(prevOrder => { 
                            if (!prevOrder.includes(attributes.name)) { 
                                return [...prevOrder, attributes.name]; 
                            } 
                            return prevOrder; 
                        }); 
                        return newEntities; 
                    }); 
                    break;
                    
                case 'LORE_FACTION': 
                    gameStateSetters.setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'faction', ...attributes } })); 
                    break;
                    
                case 'LORE_CONCEPT': 
                    gameStateSetters.setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'concept', ...attributes } })); 
                    break;
                    
                case 'ENTITY_UPDATE': 
                    gameStateSetters.setKnownEntities(prev => { 
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
                                newEntities[attributes.newName] = { ...oldEntity, ...finalUpdateData, name: attributes.newName }; 
                            } else { 
                                newEntities[targetName] = { ...newEntities[targetName], ...finalUpdateData }; 
                            } 
                        } 
                        return newEntities; 
                    }); 
                    break;
                    
                case 'ITEM_AQUIRED': 
                    gameStateSetters.setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'item', owner: 'pc', ...attributes } })); 
                    break;
                    
                case 'ITEM_CONSUMED': 
                    gameStateSetters.setKnownEntities(prev => { 
                        const newEntities = { ...prev }; 
                        const itemToConsume = newEntities[attributes.name]; 
                        if (itemToConsume && itemToConsume.type === 'item' && itemToConsume.owner === 'pc') { 
                            if (typeof itemToConsume.uses === 'number' && itemToConsume.uses > 1) { 
                                newEntities[attributes.name] = { ...itemToConsume, uses: itemToConsume.uses - 1, }; 
                            } else { 
                                const { owner, equipped, ...restOfItem } = itemToConsume; 
                                newEntities[attributes.name] = restOfItem; 
                            } 
                        } 
                        return newEntities; 
                    }); 
                    break;
                    
                case 'ITEM_EQUIPPED': 
                    gameStateSetters.setKnownEntities(prev => { 
                        const newEntities = { ...prev }; 
                        const item = newEntities[attributes.name]; 
                        if (item && item.owner === 'pc' && item.equippable) { 
                            item.equipped = true; 
                        } 
                        return newEntities; 
                    }); 
                    break;
                    
                case 'ITEM_UNEQUIPPED': 
                    gameStateSetters.setKnownEntities(prev => { 
                        const newEntities = { ...prev }; 
                        const item = newEntities[attributes.name]; 
                        if (item && item.owner === 'pc') { 
                            item.equipped = false; 
                        } 
                        return newEntities; 
                    }); 
                    break;
                    
                case 'ITEM_TRANSFORMED': 
                    gameStateSetters.setKnownEntities(prev => { 
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
                    gameStateSetters.setKnownEntities(prev => { 
                        const newEntities = { ...prev }; 
                        if (newEntities[attributes.name] && newEntities[attributes.name].owner === 'pc') { 
                            newEntities[attributes.name] = { ...newEntities[attributes.name], ...attributes }; 
                        } 
                        return newEntities; 
                    }); 
                    break;
                    
                case 'ITEM_DAMAGED': 
                    gameStateSetters.setKnownEntities(prev => { 
                        const newEntities = { ...prev }; 
                        const item = newEntities[attributes.name]; 
                        if (item && typeof item.durability === 'number') { 
                            item.durability = Math.max(0, item.durability - (attributes.damage || 0)); 
                        } 
                        return newEntities; 
                    }); 
                    break;
                    
                case 'ITEM_REPAIRED': 
                    gameStateSetters.setKnownEntities(prev => { 
                        const newEntities = { ...prev }; 
                        const item = newEntities[attributes.name]; 
                        if (item && typeof item.durability === 'number') { 
                            item.durability = Math.min(100, item.durability + (attributes.repairedAmount || 0)); 
                        } 
                        return newEntities; 
                    }); 
                    break;
                    
                case 'REALM_UPDATE': 
                    gameStateSetters.setKnownEntities(prev => { 
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
                        gameStateSetters.setParty(prev => [...prev.filter(p => p.name !== newCompanion.name), newCompanion]); 
                        gameStateSetters.setKnownEntities(prev => ({ ...prev, [newCompanion.name]: newCompanion })); 
                    } 
                    break;
                    
                case 'RELATIONSHIP_CHANGED': 
                    gameStateSetters.setKnownEntities(prev => { 
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
                    gameStateSetters.setQuests(prev => [...prev.filter(q => q.title !== newQuest.title), newQuest]); 
                    break;
                    
                case 'QUEST_UPDATED': 
                    gameStateSetters.setQuests(prev => prev.map(q => q.title === attributes.title ? { ...q, status: attributes.status } : q)); 
                    break;
                    
                case 'QUEST_OBJECTIVE_COMPLETED': 
                    gameStateSetters.setQuests(prev => prev.map(q => { 
                        if (q.title === attributes.questTitle) { 
                            const newObjectives = q.objectives.map(obj => 
                                obj.description === attributes.objectiveDescription ? { ...obj, completed: true } : obj 
                            ); 
                            const allCompleted = newObjectives.every(obj => obj.completed); 
                            return { ...q, objectives: newObjectives, status: allCompleted ? 'completed' : q.status }; 
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
};

// Parse API response function
export const parseApiResponse = (
    text: string,
    gameStateSetters: GameStateSetters,
    setStoryLog: (fn: (prev: string[]) => string[]) => void,
    setChoices: (choices: string[]) => void
): void => {
    try {
        const jsonResponse = JSON.parse(text);
        const cleanStory = parseStoryAndTags(jsonResponse.story, true, gameStateSetters);
        setStoryLog(prev => [...prev, cleanStory]);
        setChoices(jsonResponse.choices || []);
    } catch (e) {
        console.error("Failed to parse AI response:", e, "Raw response:", text);
        setStoryLog(prev => [...prev, "Lỗi: AI trả về dữ liệu không hợp lệ. Hãy thử lại."]);
        setChoices([]);
    }
};