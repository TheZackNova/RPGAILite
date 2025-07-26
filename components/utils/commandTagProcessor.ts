import type { Entity, Status, Quest, Memory, Chronicle } from '../types';
import { partyDebugger } from './partyDebugger';
import { MemoryEnhancer } from './MemoryEnhancer';

export interface CommandTagProcessorParams {
    // State setters
    setGameTime: (time: any | ((prev: any) => any)) => void;
    setChronicle: (chronicle: Chronicle | ((prev: Chronicle) => Chronicle)) => void;
    setMemories: (memories: Memory[] | ((prev: Memory[]) => Memory[])) => void;
    setStatuses: (statuses: Status[] | ((prev: Status[]) => Status[])) => void;
    setKnownEntities: (entities: { [key: string]: Entity } | ((prev: { [key: string]: Entity }) => { [key: string]: Entity })) => void;
    setQuests: (quests: Quest[] | ((prev: Quest[]) => Quest[])) => void;
    setParty: (party: Entity[] | ((prev: Entity[]) => Entity[])) => void;
    setLocationDiscoveryOrder: (order: string[] | ((prev: string[]) => string[])) => void;
    
    // Current state values for reference
    knownEntities: { [key: string]: Entity };
    statuses: Status[];
    party: Entity[];
    turnCount?: number;
}

// Helper function to calculate new time
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
    const finalResult = [
        ...otherOwnersStatuses, 
        ...ownerStatusesOfOtherTypes,
        ...finalOwnerStatusesOfType, 
        newStatusToAdd
    ];
    
    console.log('🔧 Final result:', {
        totalCount: finalResult.length,
        newStatusAdded: finalResult.find(s => s.name === newStatusAttributes.name && s.owner === owner),
        allStatuses: finalResult.map(s => `${s.name}(${s.owner})`)
    });
    
    return finalResult;
};

export const createCommandTagProcessor = (params: CommandTagProcessorParams) => {
    const {
        setGameTime, setChronicle, setMemories, setStatuses, setKnownEntities,
        setQuests, setParty, setLocationDiscoveryOrder,
        knownEntities, statuses, party, turnCount
    } = params;

    const parseStoryAndTags = (storyText: string, applySideEffects = true): string => {
        if (!storyText) return '';

        const tagRegex = /\[([A-Z_]+):\s*([^\]]+)\]/g;
        let cleanStory = storyText;
        let chronicleTurnContent = ''; // Collect Chronicle turn content to append

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
                            setGameTime(prevTime => calculateNewTime(prevTime, elapsed));
                        }
                        break;
                    case 'CHRONICLE_TURN':
                        if (attributes.text) {
                            setChronicle(prev => ({ ...prev, turn: [...prev.turn, attributes.text] }));
                            // Collect Chronicle turn content to append to story
                            chronicleTurnContent += (chronicleTurnContent ? '\n\n' : '') + attributes.text;
                            // Automatically create enhanced memory from Chronicle turn content
                            setMemories(prev => {
                                const basicMemory: Memory = { 
                                    text: attributes.text, 
                                    pinned: false,
                                    source: 'chronicle',
                                    createdAt: turnCount,
                                    lastAccessed: turnCount
                                };
                                
                                // Enhance the memory with metadata and importance scoring
                                const gameState = {
                                    knownEntities,
                                    turnCount: turnCount || 0,
                                    statuses,
                                    party,
                                    quests: [], // Will be filled from actual state
                                    gameHistory: [], // Will be filled from actual state
                                    memories: prev,
                                    customRules: [],
                                    systemInstruction: '',
                                    totalTokens: 0,
                                    gameTime: {},
                                    chronicle: {},
                                    compressedHistory: [],
                                    worldData: {}
                                };
                                
                                const enhancementResult = MemoryEnhancer.enhanceMemory(basicMemory, gameState);
                                return [...prev, enhancementResult.enhanced];
                            });
                        }
                        break;
                    case 'CHRONICLE_CHAPTER':
                        if (attributes.text) {
                            setChronicle(prev => ({ ...prev, chapter: [...prev.chapter, attributes.text] }));
                        }
                        break;
                    case 'CHRONICLE_MEMOIR':
                         if (attributes.text) {
                            setChronicle(prev => ({ ...prev, memoir: [...prev.memoir, attributes.text] }));
                        }
                        break;
                    case 'STATUS_APPLIED_SELF':
                        setStatuses(prev => {
                            const newStatuses = applyStatusWithLimit(prev, attributes, 'pc');
                            // Log status change for PC
                            if (turnCount && !prev.some(s => s.name === attributes.name && s.owner === 'pc')) {
                                partyDebugger.log('STATUS_CHANGE', `✨ Status applied to PC: ${attributes.name}`, {
                                    memberName: 'pc',
                                    memberType: 'pc',
                                    status: {
                                        name: attributes.name,
                                        type: attributes.type,
                                        description: attributes.description,
                                        duration: attributes.duration,
                                        source: attributes.source
                                    },
                                    action: 'APPLIED'
                                }, turnCount);
                            }
                            return newStatuses;
                        });
                        break;
                    case 'STATUS_APPLIED_NPC':
                        setStatuses(prev => {
                            const newStatuses = applyStatusWithLimit(prev, attributes, attributes.npcName);
                            // Log status change for NPC
                            if (turnCount && !prev.some(s => s.name === attributes.name && s.owner === attributes.npcName)) {
                                partyDebugger.log('STATUS_CHANGE', `✨ Status applied to ${attributes.npcName}: ${attributes.name}`, {
                                    memberName: attributes.npcName,
                                    memberType: 'npc',
                                    status: {
                                        name: attributes.name,
                                        type: attributes.type,
                                        description: attributes.description,
                                        duration: attributes.duration,
                                        source: attributes.source
                                    },
                                    action: 'APPLIED'
                                }, turnCount);
                            }
                            return newStatuses;
                        });
                        break;
                    case 'STATUS_CURED_SELF':
                        setStatuses(prev => prev.filter(s => !(s.name === attributes.name && s.owner === 'pc')));
                        break;
                    case 'STATUS_CURED_NPC':
                        setStatuses(prev => prev.filter(s => !(s.name === attributes.name && s.owner === attributes.npcName)));
                        break;
                    case 'LORE_SKILL':
                        setKnownEntities(prev => {
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
                        setKnownEntities(prev => {
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
                        setKnownEntities(prev => {
                            const newAttributes = { ...attributes };
                            if (typeof newAttributes.skills === 'string') {
                                newAttributes.skills = newAttributes.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
                            }
                            return { ...prev, [attributes.name]: { type: 'npc', ...newAttributes } };
                        });
                        break;
                    case 'LORE_ITEM':
                        setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'item', ...attributes } }));
                        break;
                    case 'LORE_LOCATION':
                        setKnownEntities(prev => {
                            const newEntities = { ...prev, [attributes.name]: { type: 'location', ...attributes } };
                            setLocationDiscoveryOrder(prevOrder => {
                                if (!prevOrder.includes(attributes.name)) {
                                    return [...prevOrder, attributes.name];
                                }
                                return prevOrder;
                            });
                            return newEntities;
                        });
                        break;
                    case 'LORE_FACTION':
                         setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'faction', ...attributes } }));
                         break;
                    case 'LORE_CONCEPT':
                         setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'concept', ...attributes } }));
                         break;
                    case 'ENTITY_UPDATE':
                        setKnownEntities(prev => {
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
                        setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'item', owner: 'pc', ...attributes } }));
                        break;
                     case 'ITEM_CONSUMED':
                        setKnownEntities(prev => {
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
                        setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            const item = newEntities[attributes.name];
                            if (item && item.owner === 'pc' && item.equippable) {
                                item.equipped = true;
                            }
                            return newEntities;
                        });
                        break;
                    case 'ITEM_UNEQUIPPED':
                        setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            const item = newEntities[attributes.name];
                            if (item && item.owner === 'pc') {
                                item.equipped = false;
                            }
                            return newEntities;
                        });
                        break;
                    case 'ITEM_TRANSFORMED':
                        setKnownEntities(prev => {
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
                         setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            if (newEntities[attributes.name] && newEntities[attributes.name].owner === 'pc') {
                                 newEntities[attributes.name] = { ...newEntities[attributes.name], ...attributes };
                            }
                            return newEntities;
                        });
                        break;
                     case 'ITEM_DAMAGED':
                        setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            const item = newEntities[attributes.name];
                            if (item && typeof item.durability === 'number') {
                                item.durability = Math.max(0, item.durability - (attributes.damage || 0));
                            }
                            return newEntities;
                        });
                        break;
                    case 'ITEM_REPAIRED':
                        setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            const item = newEntities[attributes.name];
                            if (item && typeof item.durability === 'number') {
                                item.durability = Math.min(100, item.durability + (attributes.repairedAmount || 0));
                            }
                            return newEntities;
                        });
                        break;
                    case 'REALM_UPDATE':
                        setKnownEntities(prev => {
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
                            // Enhanced companion processing with skill parsing
                            if (newCompanion.skills && typeof newCompanion.skills === 'string') {
                                (newCompanion as any).skills = (newCompanion.skills as string).split(',').map(s => s.trim());
                            }
                            
                            // Ensure default relationship if not provided
                            if (!newCompanion.relationship) {
                                newCompanion.relationship = 'Đồng hành';
                            }
                            
                            setParty(prev => {
                                const newParty = [...prev.filter(p => p.name !== newCompanion.name), newCompanion];
                                // Log companion join event
                                if (turnCount && !prev.some(p => p.name === newCompanion.name)) {
                                    partyDebugger.log('COMPANION_JOIN', `🎉 New companion joined: ${newCompanion.name}`, {
                                        companion: {
                                            name: newCompanion.name,
                                            type: newCompanion.type,
                                            relationship: newCompanion.relationship,
                                            skills: newCompanion.skills,
                                            realm: newCompanion.realm,
                                            personality: newCompanion.personality
                                        },
                                        partySize: newParty.length
                                    }, turnCount);
                                }
                                return newParty;
                            });
                            setKnownEntities(prev => ({ ...prev, [newCompanion.name]: newCompanion }));
                         }
                         break;
                    case 'RELATIONSHIP_CHANGED':
                        setKnownEntities(prev => {
                            const newEntities = { ...prev };
                            if (newEntities[attributes.npcName]) {
                                const oldRelationship = newEntities[attributes.npcName].relationship;
                                newEntities[attributes.npcName].relationship = attributes.relationship;
                                
                                // Log relationship change
                                if (turnCount && oldRelationship !== attributes.relationship) {
                                    partyDebugger.log('RELATIONSHIP_CHANGE', `💕 Relationship changed: ${attributes.npcName}`, {
                                        name: attributes.npcName,
                                        previousRelationship: oldRelationship || 'Unknown',
                                        newRelationship: attributes.relationship || 'Unknown',
                                        change: oldRelationship && attributes.relationship ? 
                                                (attributes.relationship.includes('yêu') || attributes.relationship.includes('thân') ? 'IMPROVED' : 'CHANGED') 
                                                : 'CHANGED'
                                    }, turnCount);
                                }
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
                        setQuests(prev => [...prev.filter(q => q.title !== newQuest.title), newQuest]);
                        break;
                    case 'QUEST_UPDATED':
                        setQuests(prev => prev.map(q => q.title === attributes.title ? { ...q, status: attributes.status } : q));
                        break;
                    case 'QUEST_OBJECTIVE_COMPLETED':
                        setQuests(prev => prev.map(q => {
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
        let finalStory = cleanStory.trim();
        
        // Append Chronicle turn content if any
        if (chronicleTurnContent && applySideEffects) {
            finalStory += (finalStory ? '\n\n' : '') + chronicleTurnContent;
        }
        
        if (unprocessedTags.length > 0 && applySideEffects) {
             console.warn("Unprocessed Tags:", unprocessedTags);
        }
        return finalStory;
    };

    return {
        parseStoryAndTags
    };
};