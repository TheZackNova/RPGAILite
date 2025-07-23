import { 
    Entity, 
    Status, 
    Quest, 
    Memory, 
    KnownEntities,
    QuestObjective
} from '../types';

// Game state setters interface for StoryParser
interface GameStateSetters {
    setMemories: (fn: (prev: Memory[]) => Memory[]) => void;
    setStatuses: (fn: (prev: Status[]) => Status[]) => void;
    setKnownEntities: (fn: (prev: KnownEntities) => KnownEntities) => void;
    setParty: (fn: (prev: Entity[]) => Entity[]) => void;
    setQuests: (fn: (prev: Quest[]) => Quest[]) => void;
}

export class StoryParser {
    /**
     * Parses story text and processes embedded tags to update game state
     * @param storyText - The raw story text with embedded tags
     * @param gameStateSetters - Object containing all state setter functions
     * @returns Clean story text with tags removed
     */
    public static parseStoryAndTags(storyText: string, gameStateSetters?: GameStateSetters): string {
        if (!storyText) return '';
    
        const tagRegex = /\[([A-Z_]+):\s*([^\]]+)\]/g;
        let cleanStory = storyText;
    
        let match;
        const unprocessedTags: string[] = [];
        
        while ((match = tagRegex.exec(storyText)) !== null) {
            cleanStory = cleanStory.replace(match[0], ''); // Remove tag from displayed story
            
            if (gameStateSetters) {
                const tagType = match[1];
                const rawContent = match[2];
                
                const attributes = this.parseAttributes(rawContent);
                
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
                    case 'STATUS_APPLIED_SELF':
                        gameStateSetters.setStatuses(prev => [...prev.filter(s => s.name !== attributes.name || s.owner !== 'pc'), { ...attributes, owner: 'pc' } as Status]);
                        break;
                    case 'STATUS_APPLIED_NPC':
                        gameStateSetters.setStatuses(prev => [...prev.filter(s => !(s.name === attributes.name && s.owner === attributes.npcName)), { ...attributes, owner: attributes.npcName } as Status]);
                        break;
                    case 'STATUS_CURED_SELF':
                        gameStateSetters.setStatuses(prev => prev.filter(s => !(s.name === attributes.name && s.owner === 'pc')));
                        break;
                    case 'STATUS_CURED_NPC':
                        gameStateSetters.setStatuses(prev => prev.filter(s => !(s.name === attributes.name && s.owner === attributes.npcName)));
                        break;
                    case 'SKILL_LEARNED':
                        gameStateSetters.setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'skill', ...attributes } }));
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
                        gameStateSetters.setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'location', ...attributes } }));
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
                                // Use newDescription and remove it from attributes to avoid overwriting description with undefined
                                const { name, newDescription, ...updateData } = attributes;
                                const finalUpdateData = { ...updateData };
                                if (newDescription) {
                                    finalUpdateData.description = newDescription;
                                }
                                
                                // Handle renaming
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
                            } else {
                                console.warn(`Attempted to update non-existent entity: ${targetName}`);
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
                            if (!oldName || !newName) {
                                console.warn("ITEM_TRANSFORMED tag missing oldName or newName", attributes);
                                return prev;
                            }

                            const newEntities = { ...prev };
                            const oldItem = newEntities[oldName];
                            
                            if (oldItem) {
                                delete newEntities[oldName];
                            } else {
                                console.warn(`Attempted to transform non-existent item: ${oldName}`);
                            }
                            
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
                        } else {
                            console.warn('COMPANION tag is missing required attributes (name, description)', attributes);
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
        if (unprocessedTags.length > 0 && gameStateSetters) {
            console.warn("Unprocessed Tags:", unprocessedTags);
        }
        return finalStory;
    }

    /**
     * Parses attribute string from tag content into key-value pairs
     * @param attrString - Raw attribute string from tag
     * @returns Object with parsed attributes
     */
    private static parseAttributes(attrString: string): { [key: string]: any } {
        const attributes: { [key: string]: any } = {};
        const attrRegex = /(\w+)\s*=\s*"([^"]*)"/g;
        let match;
        
        while ((match = attrRegex.exec(attrString)) !== null) {
            const key = match[1];
            let value: string | boolean | number | QuestObjective[] = match[2];

            if ((key === 'isMainQuest' || key === 'equippable' || key === 'usable' || key === 'consumable' || key === 'learnable') && typeof value === 'string') {
                value = value.toLowerCase() === 'true';
            } else if (key === 'objectives' && typeof value === 'string') {
                value = value.split(';').map(desc => ({ description: desc.trim(), completed: false }));
            } else if ((key === 'uses' || key === 'durability' || key === 'damage' || key === 'repairedAmount') && typeof value === 'string' && !isNaN(Number(value))) {
                attributes[key] = Number(value);
                continue;
            }
            attributes[key] = value;
        }
        return attributes;
    }
}