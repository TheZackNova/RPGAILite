

import React, { useState, useEffect, useRef, useMemo, useContext, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { AIContext } from '../App.tsx';
import type { SaveData, FormData, KnownEntities, Status, Quest, GameHistoryEntry, Memory, Entity, CustomRule, Chronicle, CompressedHistorySegment } from './types.ts';
import { buildEnhancedRagPrompt } from './promptBuilder.ts';

// Modal Imports
import { MemoizedModals } from './MemoizedModals.tsx';

// UI Components
import { DesktopHeader } from './game/DesktopHeader.tsx';
import { MobileHeader } from './game/MobileHeader.tsx';
import { StoryPanel } from './game/StoryPanel.tsx';
import { ActionPanel } from './game/ActionPanel.tsx';
import { SidebarNav } from './game/SidebarNav.tsx';
import { GameNotifications } from './game/GameNotifications.tsx';
import { MobileInputFooter } from './game/MobileInputFooter.tsx';

// Optimization and Management
import { HistoryManager } from './HistoryManager';
import { GameStateOptimizer, CleanupStats } from './GameStateOptimizer';
import { useDebouncedCallback } from './hooks/useDebounce.ts';

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

export const GameScreen: React.FC<{ 
    initialGameState: SaveData, 
    onBackToMenu: () => void,
    fontFamily: string,
    fontSize: string,
    keyRotationNotification: string | null;
    onClearNotification: () => void;
}> = ({ initialGameState, onBackToMenu, fontFamily, fontSize, keyRotationNotification, onClearNotification }) => {
    const { ai, isAiReady, apiKeyError, rotateKey, isUsingDefaultKey, userApiKeyCount } = useContext(AIContext);
    const [worldData, setWorldData] = useState(initialGameState.worldData);
    const [isLoading, setIsLoading] = useState(initialGameState.gameHistory.length === 0 && isAiReady);
    const [customAction, setCustomAction] = useState('');
    
    // Game State
    const [knownEntities, setKnownEntities] = useState<KnownEntities>(initialGameState.knownEntities);
    const [statuses, setStatuses] = useState<Status[]>(initialGameState.statuses);
    const [quests, setQuests] = useState<Quest[]>(initialGameState.quests);
    const [gameHistory, setGameHistory] = useState<GameHistoryEntry[]>(initialGameState.gameHistory);
    const [turnCount, setTurnCount] = useState<number>(initialGameState.turnCount);
    const [memories, setMemories] = useState<Memory[]>(initialGameState.memories);
    const [party, setParty] = useState<Entity[]>(initialGameState.party);
    const [customRules, setCustomRules] = useState<CustomRule[]>(initialGameState.customRules);
    const [systemInstruction, setSystemInstruction] = useState<string>(initialGameState.systemInstruction);
    const [chronicle, setChronicle] = useState<Chronicle>(initialGameState.chronicle);
    const [gameTime, setGameTime] = useState(initialGameState.gameTime || { year: 1, month: 1, day: 1, hour: 8 });
    const [currentTurnTokens, setCurrentTurnTokens] = useState<number>(0);
    const [totalTokens, setTotalTokens] = useState<number>(initialGameState.totalTokens || 0);

    // History and Cleanup State
    const [compressedHistory, setCompressedHistory] = useState<CompressedHistorySegment[]>(initialGameState.compressedHistory || []);
    const [historyStats, setHistoryStats] = useState(initialGameState.historyStats || { totalEntriesProcessed: 0, totalTokensSaved: 0, compressionCount: 0 });
    const [cleanupStats, setCleanupStats] = useState<SaveData['cleanupStats']>(initialGameState.cleanupStats || { totalCleanupsPerformed: 0, totalTokensSavedFromCleanup: 0, lastCleanupTurn: 0, cleanupHistory: [] });
    const [lastCompressionTurn, setLastCompressionTurn] = useState<number>(initialGameState.lastCompressionTurn || 0);

    // --- Performance Optimization: State Ref ---
    const gameStateRef = useRef<SaveData>();
    useEffect(() => {
        // Keep the ref updated with the latest state on every render
        gameStateRef.current = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory,
            lastCompressionTurn,
            historyStats, cleanupStats,
            storyLog, choices, locationDiscoveryOrder
        };
    });

    // Modal & Notification States
    const [isHomeModalOpen, setIsHomeModalOpen] = useState(false);
    const [isRestartModalOpen, setIsRestartModalOpen] = useState(false);
    const [activeEntity, setActiveEntity] = useState<Entity | null>(null);
    const [activeStatus, setActiveStatus] = useState<Status | null>(null);
    const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
    const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);
    const [isCustomRulesModalOpen, setIsCustomRulesModalOpen] = useState(false);
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    const [showRulesSavedSuccess, setShowRulesSavedSuccess] = useState(false);
    const [isPcInfoModalOpen, setIsPcInfoModalOpen] = useState(false);
    const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
    const [isQuestLogModalOpen, setIsQuestLogModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isChoicesModalOpen, setIsChoicesModalOpen] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);
    
    // Map State
    const [locationDiscoveryOrder, setLocationDiscoveryOrder] = useState<string[]>(() => {
        // Priority 1: Use directly saved order if it exists
        if (Array.isArray(initialGameState.locationDiscoveryOrder)) {
            const savedOrder = [...initialGameState.locationDiscoveryOrder];
            const seen = new Set(savedOrder);
            const allKnownLocations = Object.values(initialGameState.knownEntities)
                .filter(e => e.type === 'location')
                .map(e => e.name);

            allKnownLocations.forEach(locName => {
                if (!seen.has(locName)) {
                    savedOrder.push(locName);
                }
            });
            return savedOrder;
        }

        // Priority 2: Fallback for older saves - rehydrate from history
        const order: string[] = [];
        const seen = new Set<string>();
        initialGameState.gameHistory.forEach(entry => {
            if (entry.role === 'model') {
                 try {
                    const jsonResponse = JSON.parse(entry.parts[0].text);
                    const storyText = jsonResponse.story || '';
                    const tagRegex = /\[LORE_LOCATION:\s*name="([^"]+)"[^\]]*\]/g;
                    let match;
                    while ((match = tagRegex.exec(storyText)) !== null) {
                        const locName = match[1];
                        if (!seen.has(locName)) {
                            order.push(locName);
                            seen.add(locName);
                        }
                    }
                } catch (e) { /* Ignore non-json responses */ }
            }
        });
        
        // Final fallback: Ensure all known locations are at least present, even if order is arbitrary
        const knownLocations = Object.values(initialGameState.knownEntities)
            .filter(e => e.type === 'location')
            .map(e => e.name);
            
        knownLocations.forEach(locName => {
            if (!seen.has(locName)) {
                order.push(locName);
                seen.add(locName);
            }
        });

        return order;
    });

    // Rule change tracking
    const [ruleChanges, setRuleChanges] = useState<{ activated: CustomRule[], deactivated: CustomRule[], updated: { oldRule: CustomRule, newRule: CustomRule }[] } | null>(null);
    const previousRulesRef = useRef<CustomRule[]>(initialGameState.customRules);

    

    const pcEntity = useMemo(() => Object.values(knownEntities).find(e => e.type === 'pc'), [knownEntities]);
    const pcName = pcEntity?.name;
    
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
                    setMemories(prev => [...prev, { text: attributes.text, pinned: false }]);
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
                            setGameTime(prevTime => calculateNewTime(prevTime, elapsed));
                        }
                        break;
                    case 'CHRONICLE_TURN':
                        if (attributes.text) {
                            setChronicle(prev => ({ ...prev, turn: [...prev.turn, attributes.text] }));
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
                        setStatuses(prev => applyStatusWithLimit(prev, attributes, 'pc'));
                        break;
                    case 'STATUS_APPLIED_NPC':
                        if (attributes.npcName) {
                            const { npcName, ...statusData } = attributes;
                            setStatuses(prev => applyStatusWithLimit(prev, statusData, npcName));
                        }
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
                            setParty(prev => [...prev.filter(p => p.name !== newCompanion.name), newCompanion]);
                            setKnownEntities(prev => ({ ...prev, [newCompanion.name]: newCompanion }));
                         }
                         break;
                    case 'RELATIONSHIP_CHANGED':
                        setKnownEntities(prev => {
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
        const finalStory = cleanStory.trim();
        if (unprocessedTags.length > 0 && applySideEffects) {
             console.warn("Unprocessed Tags:", unprocessedTags);
        }
        return finalStory;
    }, []);
    
    // --- Data Rehydration Logic ---
    const { rehydratedLog, rehydratedChoices } = useMemo(() => {
        // Priority 1: Use directly saved log and choices if they exist (new save format)
        if (Array.isArray(initialGameState.storyLog) && Array.isArray(initialGameState.choices)) {
            return {
                rehydratedLog: initialGameState.storyLog,
                rehydratedChoices: initialGameState.choices,
            };
        }
    
        // Priority 2: Fallback for older saves - rehydrate from history
        const log: string[] = [];
        let lastChoices: string[] = [];
    
        (initialGameState.gameHistory || []).forEach(entry => {
            if (entry.role === 'user') {
                const fullPrompt = entry.parts[0].text;
                const actionMatch = fullPrompt.match(/--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---\n"([^"]+)"/);
                const actionText = actionMatch ? actionMatch[1] : null;
    
                if (actionText && actionText !== 'SYSTEM_RULE_UPDATE') {
                    log.push(`> ${actionText}`);
                }
            } else { // 'model' role
                try {
                    const jsonResponse = JSON.parse(entry.parts[0].text);
                    const storyText = jsonResponse.story || '';
                    const cleanStory = parseStoryAndTags(storyText, false); 
                    if (cleanStory) {
                        log.push(cleanStory);
                    }
                    lastChoices = jsonResponse.choices || [];
                } catch (e) {
                    const cleanText = entry.parts[0].text.replace(/\[([A-Z_]+):\s*([^\]]+)\]/g, '').trim();
                    log.push(cleanText);
                }
            }
        });
    
        return { rehydratedLog: log, rehydratedChoices: lastChoices };
    }, [initialGameState, parseStoryAndTags]); 
    
    const [storyLog, setStoryLog] = useState<string[]>(rehydratedLog);
    const [choices, setChoices] = useState<string[]>(rehydratedChoices);

    const sendActionToAI = useCallback(async (action: string, isSystemAction: boolean = false) => {
        if (!ai || !gameStateRef.current) return;
        setIsLoading(true);

        const currentState = gameStateRef.current;
        
        const playerNsfwRequest = action.toLowerCase().includes('nsfw') ? "LƯU Ý: Người chơi YÊU CẦU hành động NSFW. Hãy ưu tiên tạo ra các lựa chọn và mô tả 18+." : "";

        let currentRuleChanges = ruleChanges;
        let ruleChangeContext = '';
        if (currentRuleChanges) {
            ruleChangeContext += "--- CẬP NHẬT LUẬT LỆ ---\n";
            if (currentRuleChanges.activated.length > 0) ruleChangeContext += `Luật mới được kích hoạt: ${currentRuleChanges.activated.map(r => `"${r.content}"`).join(', ')}\n`;
            if (currentRuleChanges.deactivated.length > 0) ruleChangeContext += `Luật bị vô hiệu hóa: ${currentRuleChanges.deactivated.map(r => `"${r.content}"`).join(', ')}\n`;
            if (currentRuleChanges.updated.length > 0) ruleChangeContext += `Luật được cập nhật: ${currentRuleChanges.updated.map(r => `Từ "${r.oldRule.content}" thành "${r.newRule.content}"`).join(', ')}\n`;
            setRuleChanges(null); 
        }

        const prompt = buildEnhancedRagPrompt(action, currentState, ruleChangeContext, playerNsfwRequest);
        const currentTokens = Math.ceil(prompt.length / 4);
        setCurrentTurnTokens(currentTokens);
        setTotalTokens(prev => prev + currentTokens);

        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    { role: 'user', parts: [{ text: currentState.systemInstruction }] },
                    ...currentState.gameHistory,
                    { role: 'user', parts: [{ text: prompt }] }
                ],
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            story: { type: Type.STRING, description: 'Đoạn truyện kể chính, chứa các thẻ lệnh để cập nhật trạng thái game.' },
                            choices: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                                description: '4-5 lựa chọn hành động cho người chơi.'
                            },
                        },
                        required: ['story', 'choices']
                    }
                }
            });

            const responseText = response.text.trim();
            const jsonResponse = JSON.parse(responseText);

            const storyText = jsonResponse.story || '';
            const cleanStory = parseStoryAndTags(storyText);

            setGameHistory(prev => [...prev, { role: 'user', parts: [{ text: prompt }] }, { role: 'model', parts: [{ text: responseText }] }]);
            if (cleanStory) {
                setStoryLog(prev => [...prev, cleanStory]);
            }
            setChoices(jsonResponse.choices || []);
            setTurnCount(prev => prev + 1);

        } catch (error: any) {
            console.error('Lỗi khi gọi Gemini API:', error);
            if (error.toString().includes('429') && !isUsingDefaultKey && userApiKeyCount > 1) {
                rotateKey();
            } else {
                setStoryLog(prev => [...prev, `Lỗi hệ thống: ${error.message}. Vui lòng thử lại hoặc kiểm tra API Key.`]);
                setChoices([]);
            }
        } finally {
            setIsLoading(false);
        }
    }, [ai, isUsingDefaultKey, userApiKeyCount, rotateKey, parseStoryAndTags]);

    const handleAction = useCallback((action: string) => {
        if (isLoading || !isAiReady || !action.trim()) return;
        setCustomAction('');
        if (!action.startsWith("SYSTEM_")) {
           setStoryLog(prev => [...prev, `> ${action}`]);
        }
        sendActionToAI(action);
    }, [isLoading, isAiReady, sendActionToAI]);
    
    const debouncedHandleAction = useDebouncedCallback(handleAction, 300);

    const generateInitialStory = useCallback(() => {
        sendActionToAI("Bắt đầu câu chuyện.", true);
    }, [sendActionToAI]);

    // --- Handle Key Rotation Notification ---
    useEffect(() => {
        if (keyRotationNotification) {
            setNotification(keyRotationNotification);
            const timer = setTimeout(() => {
                setNotification(null);
                onClearNotification();
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [keyRotationNotification, onClearNotification]);

    
    useEffect(() => {
        if (gameHistory.length === 0 && isAiReady) {
            setIsLoading(true);
            generateInitialStory();
        } else if (!isAiReady) {
            setStoryLog([apiKeyError || "AI chưa sẵn sàng. Vui lòng kiểm tra API Key và quay về trang chủ."])
            setIsLoading(false);
        }
    }, [gameHistory.length, isAiReady, apiKeyError, generateInitialStory]); 

    // Automatic cleanup and history management effect
    useEffect(() => {
        if (!gameStateRef.current) return;
        if (turnCount === 0 || (cleanupStats && turnCount <= cleanupStats.lastCleanupTurn)) return;

        const currentState = gameStateRef.current;
        
        // Automatic cleanup logic
        const optimizerResult = GameStateOptimizer.performCleanup(currentState);
        if (optimizerResult.shouldRunCleanup) {
            console.log("Applying auto cleanup...");
            const { optimizedState, stats } = optimizerResult;
            setKnownEntities(optimizedState.knownEntities);
            setStatuses(optimizedState.statuses);
            setQuests(optimizedState.quests);
            setMemories(optimizedState.memories);
            setChronicle(optimizedState.chronicle);
            setCleanupStats(prev => {
                const newHistoryEntry = {
                    turn: optimizedState.turnCount,
                    tokensSaved: stats.totalTokensSaved,
                    itemsRemoved: stats.memoriesRemoved + stats.chronicleEntriesRemoved + stats.questsArchived + stats.statusesRemoved + stats.entitiesArchived
                };
                const newCleanupHistory = [...(prev?.cleanupHistory || []), newHistoryEntry].slice(-10); // Keep last 10

                return {
                    ...prev,
                    totalCleanupsPerformed: (prev?.totalCleanupsPerformed || 0) + 1,
                    totalTokensSavedFromCleanup: (prev?.totalTokensSavedFromCleanup || 0) + stats.totalTokensSaved,
                    lastCleanupTurn: optimizedState.turnCount,
                    cleanupHistory: newCleanupHistory,
                };
            });
        }
        
        // Automatic history compression
        const historyResult = HistoryManager.manageHistory(gameHistory, turnCount);
        if (historyResult.shouldCompress && historyResult.compressedSegment) {
            console.log("Applying history compression...");
            setGameHistory(historyResult.activeHistory);
            setCompressedHistory(prev => [...prev, historyResult.compressedSegment!]);
            setHistoryStats(prev => ({
                ...prev,
                totalEntriesProcessed: prev.totalEntriesProcessed + historyResult.stats.savedEntries,
                totalTokensSaved: prev.totalTokensSaved + ((historyResult.stats.savedEntries * 300) - historyResult.compressedSegment!.tokenCount),
                compressionCount: prev.compressionCount + 1
            }));
            setLastCompressionTurn(turnCount);
        }

    }, [turnCount]);

    // --- UI Handlers (placeholders and simple implementations) ---
    const handleSaveGame = useCallback(() => {
        if (!gameStateRef.current) return;
        const fullGameState: SaveData = gameStateRef.current;

        const jsonString = JSON.stringify(fullGameState, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `AI-RolePlay-${pcName || 'save'}-${timestamp}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
    }, [pcName]);
    
    const handleRestartGame = () => {
        const pc = Object.values(initialGameState.knownEntities).find(e => e.type === 'pc');
        const newGameState: SaveData = {
            ...initialGameState,
            turnCount: 0,
            gameHistory: [],
            statuses: [],
            quests: [],
            memories: [],
            party: pc ? [pc] : [],
            chronicle: { memoir: [], chapter: [], turn: [] },
            storyLog: [],
            choices: [],
            compressedHistory: [],
            historyStats: { totalEntriesProcessed: 0, totalTokensSaved: 0, compressionCount: 0 },
            cleanupStats: { totalCleanupsPerformed: 0, totalTokensSavedFromCleanup: 0, lastCleanupTurn: 0, cleanupHistory: [] }
        };
        // Reset all states
        setWorldData(newGameState.worldData);
        setKnownEntities(newGameState.knownEntities);
        setStatuses(newGameState.statuses);
        setQuests(newGameState.quests);
        setGameHistory(newGameState.gameHistory);
        setTurnCount(newGameState.turnCount);
        setMemories(newGameState.memories);
        setParty(newGameState.party);
        setCustomRules(newGameState.customRules);
        setChronicle(newGameState.chronicle);
        setGameTime(newGameState.gameTime);
        setCurrentTurnTokens(0);
        setTotalTokens(0);
        setCompressedHistory([]);
        setHistoryStats({ totalEntriesProcessed: 0, totalTokensSaved: 0, compressionCount: 0 });
        setCleanupStats({ totalCleanupsPerformed: 0, totalTokensSavedFromCleanup: 0, lastCleanupTurn: 0, cleanupHistory: [] });
        setStoryLog([]);
        setChoices([]);
        
        setIsRestartModalOpen(false);
        generateInitialStory();
    };

    const handleEntityClick = useCallback((entityName: string) => {
        const entity = knownEntities[entityName];
        if (entity) setActiveEntity(entity);
    }, [knownEntities]);
    
    const handleStatusClick = useCallback((status: Status) => {
        setActiveStatus(status);
    }, []);

    const handleUseItem = useCallback((itemName: string) => {
        setActiveEntity(null);
        handleAction(`Sử dụng ${itemName}.`);
    }, [handleAction]);

    const handleLearnItem = useCallback((itemName: string) => {
        setActiveEntity(null);
        handleAction(`Học ${itemName}.`);
    }, [handleAction]);
    
    const handleEquipItem = useCallback((itemName: string) => {
        setActiveEntity(null);
        handleAction(`Trang bị ${itemName}.`);
    }, [handleAction]);
    
    const handleUnequipItem = useCallback((itemName: string) => {
        setActiveEntity(null);
        handleAction(`Tháo ${itemName}.`);
    }, [handleAction]);

    const handleToggleMemoryPin = useCallback((index: number) => {
        setMemories(prev => {
            const newMemories = [...prev];
            newMemories[index].pinned = !newMemories[index].pinned;
            return newMemories;
        });
    }, []);

    const handleSaveRules = useCallback((newRules: CustomRule[]) => {
        setCustomRules(newRules);
        setShowRulesSavedSuccess(true);
        setTimeout(() => setShowRulesSavedSuccess(false), 3000);
    }, []);
    
    const handleSuggestAction = useCallback(() => {
        // This could be a future feature
        setCustomAction("AI chưa hỗ trợ gợi ý hành động tùy ý.");
    }, []);
    
    const handleManualCleanup = useCallback(() => {
        // Placeholder for manual cleanup
        setNotification("Manual cleanup completed.");
        setTimeout(() => setNotification(null), 3000);
    }, []);

    const isCustomActionLocked = useMemo(() => {
        return customRules.some(rule => rule.isActive && rule.content.toUpperCase().includes('KHÓA HÀNH ĐỘNG TÙY Ý'));
    }, [customRules]);

    const modalCloseHandlers = useMemo(() => ({
        home: () => setIsHomeModalOpen(false),
        restart: () => setIsRestartModalOpen(false),
        memory: () => setIsMemoryModalOpen(false),
        knowledge: () => setIsKnowledgeModalOpen(false),
        customRules: () => setIsCustomRulesModalOpen(false),
        map: () => setIsMapModalOpen(false),
        pcInfo: () => setIsPcInfoModalOpen(false),
        party: () => setIsPartyModalOpen(false),
        questLog: () => setIsQuestLogModalOpen(false),
        choices: () => setIsChoicesModalOpen(false),
    }), []);
    
    return (
        <div className={`w-full h-full max-w-7xl mx-auto flex flex-col ${fontFamily} ${fontSize} bg-slate-200/50 dark:bg-slate-900/50 rounded-2xl shadow-2xl overflow-hidden`}>
            <DesktopHeader
                onHome={() => setIsHomeModalOpen(true)}
                onSave={handleSaveGame}
                onMap={() => setIsMapModalOpen(true)}
                onRules={() => setIsCustomRulesModalOpen(true)}
                onKnowledge={() => setIsKnowledgeModalOpen(true)}
                onMemory={() => setIsMemoryModalOpen(true)}
                onRestart={() => setIsRestartModalOpen(true)}
                onPCInfo={() => setIsPcInfoModalOpen(true)}
                onParty={() => setIsPartyModalOpen(true)}
                onQuests={() => setIsQuestLogModalOpen(true)}
                hasActiveQuests={quests.some(q => q.status === 'active')}
                worldData={worldData}
                gameTime={gameTime}
                turnCount={turnCount}
                currentTurnTokens={currentTurnTokens}
                totalTokens={totalTokens}
                onManualCleanup={handleManualCleanup}
            />

            <MobileHeader
                onOpenSidebar={() => setIsSidebarOpen(true)}
                worldData={worldData}
            />

            <SidebarNav
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                onHome={() => setIsHomeModalOpen(true)}
                onSave={handleSaveGame}
                onMap={() => setIsMapModalOpen(true)}
                onRules={() => setIsCustomRulesModalOpen(true)}
                onKnowledge={() => setIsKnowledgeModalOpen(true)}
                onMemory={() => setIsMemoryModalOpen(true)}
                onRestart={() => setIsRestartModalOpen(true)}
                onPCInfo={() => setIsPcInfoModalOpen(true)}
                onParty={() => setIsPartyModalOpen(true)}
                onQuests={() => setIsQuestLogModalOpen(true)}
                hasActiveQuests={quests.some(q => q.status === 'active')}
                currentTurnTokens={currentTurnTokens}
                totalTokens={totalTokens}
                historyStats={historyStats}
                compressedSegments={compressedHistory.length}
                gameHistory={gameHistory}
                cleanupStats={cleanupStats}
                onManualCleanup={handleManualCleanup}
            />

            <main className="flex-grow grid md:grid-cols-3 gap-4 p-4 min-h-0">
                <StoryPanel
                    storyLog={storyLog}
                    isLoading={isLoading}
                    isAiReady={isAiReady}
                    knownEntities={knownEntities}
                    onEntityClick={handleEntityClick}
                    className="md:col-span-2"
                />
                <ActionPanel
                    isAiReady={isAiReady}
                    apiKeyError={apiKeyError}
                    isLoading={isLoading}
                    choices={choices}
                    handleAction={handleAction}
                    debouncedHandleAction={debouncedHandleAction}
                    customAction={customAction}
                    setCustomAction={setCustomAction}
                    handleSuggestAction={handleSuggestAction}
                    isCustomActionLocked={isCustomActionLocked}
                />
            </main>
            
            <MobileInputFooter 
                onChoicesClick={() => setIsChoicesModalOpen(true)}
                customAction={customAction}
                setCustomAction={setCustomAction}
                handleAction={handleAction}
                debouncedHandleAction={debouncedHandleAction}
                isLoading={isLoading}
                isAiReady={isAiReady}
                isCustomActionLocked={isCustomActionLocked}
            />
            
            <GameNotifications
                notification={notification}
                showSaveSuccess={showSaveSuccess}
                showRulesSavedSuccess={showRulesSavedSuccess}
            />

            <MemoizedModals
                isHomeModalOpen={isHomeModalOpen}
                isRestartModalOpen={isRestartModalOpen}
                isMemoryModalOpen={isMemoryModalOpen}
                isKnowledgeModalOpen={isKnowledgeModalOpen}
                isCustomRulesModalOpen={isCustomRulesModalOpen}
                isMapModalOpen={isMapModalOpen}
                isPcInfoModalOpen={isPcInfoModalOpen}
                isPartyModalOpen={isPartyModalOpen}
                isQuestLogModalOpen={isQuestLogModalOpen}
                isChoicesModalOpen={isChoicesModalOpen}
                activeEntity={activeEntity}
                activeStatus={activeStatus}
                activeQuest={activeQuest}
                onBackToMenu={onBackToMenu}
                handleRestartGame={handleRestartGame}
                setActiveEntity={setActiveEntity}
                handleUseItem={handleUseItem}
                handleLearnItem={handleLearnItem}
                handleEquipItem={handleEquipItem}
                handleUnequipItem={handleUnequipItem}
                setActiveStatus={setActiveStatus}
                handleStatusClick={handleStatusClick}
                setActiveQuest={setActiveQuest}
                handleToggleMemoryPin={handleToggleMemoryPin}
                handleEntityClick={handleEntityClick}
                handleSaveRules={handleSaveRules}
                handleAction={handleAction}
                modalCloseHandlers={modalCloseHandlers}
                memories={memories}
                knownEntities={knownEntities}
                statuses={statuses}
                quests={quests}
                customRules={customRules}
                choices={choices}
                turnCount={turnCount}
                locationDiscoveryOrder={locationDiscoveryOrder}
                entityComputations={{
                    pcEntity,
                    pcStatuses: statuses.filter(s => s.owner === pcName),
                    displayParty: party.filter(p => p.type !== 'pc'),
                }}
            />
        </div>
    );
};
