



import React, { useState, useEffect, useRef, useMemo, useContext, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { AIContext } from '../App.tsx';
import type { SaveData, FormData, KnownEntities, Status, Quest, GameHistoryEntry, Memory, Entity, CustomRule, Chronicle, CompressedHistorySegment } from './types.ts';
import { buildEnhancedRagPrompt } from './promptBuilder.ts';

// Modal Imports
import { MemoizedModals } from './MemoizedModals.tsx';
import { GameSettingsModal, GameSettings } from './GameSettingsModal.tsx';

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
import { OptimizedInteractiveText } from './OptimizedInteractiveText.tsx';

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

export const GameScreen: React.FC<{ 
    initialGameState: SaveData, 
    onBackToMenu: () => void,
    keyRotationNotification: string | null;
    onClearNotification: () => void;
}> = ({ initialGameState, onBackToMenu, keyRotationNotification, onClearNotification }) => {
    const { ai, isAiReady, apiKeyError, rotateKey, isUsingDefaultKey, userApiKeyCount, selectedModel } = useContext(AIContext);
    const [worldData, setWorldData] = useState(initialGameState.worldData);
    const [isLoading, setIsLoading] = useState(initialGameState.gameHistory.length === 0 && isAiReady);
    const [hasGeneratedInitialStory, setHasGeneratedInitialStory] = useState<boolean>(false);
    const isGeneratingRef = useRef<boolean>(false);
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
    const [isGameSettingsModalOpen, setIsGameSettingsModalOpen] = useState(false);
    
    // Game Settings State
    const [gameSettings, setGameSettings] = useState<GameSettings>(() => {
        const saved = localStorage.getItem('gameSettings');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                // Fall back to defaults if parse fails
            }
        }
        return {
            fontSize: 16,
            fontFamily: 'Inter',
            memoryAutoClean: true,
            historyAutoCompress: true,
        };
    });
    
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
                
                // Removed MEMORY_ADD auto-processing to prevent excessive memory creation
                // Only CHRONICLE_TURN will create memories automatically
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
                            // Automatically create memory from Chronicle turn content - store original content
                            setMemories(prev => [...prev, { text: attributes.text, pinned: false }]);
                        }
                        break;
                    case 'CHRONICLE_CHAPTER':
                        if (attributes.text) {
                            setChronicle(prev => ({ ...prev, chapter: [...prev.chapter, attributes.text] }));
                            // Chronicle chapter content stored but not auto-added to memories
                        }
                        break;
                    case 'CHRONICLE_MEMOIR':
                         if (attributes.text) {
                            setChronicle(prev => ({ ...prev, memoir: [...prev.memoir, attributes.text] }));
                            // Chronicle memoir content stored but not auto-added to memories
                        }
                        break;
                    case 'STATUS_APPLIED_SELF':
                        setStatuses(prev => applyStatusWithLimit(prev, attributes, 'pc'));
                        break;
                    case 'STATUS_APPLIED_NPC':
                        setStatuses(prev => applyStatusWithLimit(prev, attributes, attributes.npcName));
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
        let finalStory = cleanStory.trim();
        
        // Append Chronicle turn content if any
        if (chronicleTurnContent && applySideEffects) {
            finalStory += (finalStory ? '\n\n' : '') + chronicleTurnContent;
        }
        
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
        if (gameHistory.length === 0 && isAiReady && storyLog.length === 0 && !hasGeneratedInitialStory && !isGeneratingRef.current) {
            setIsLoading(true);
            setHasGeneratedInitialStory(true);
            isGeneratingRef.current = true;
            generateInitialStory();
        } else if (!isAiReady) {
            setStoryLog([apiKeyError || "AI chưa sẵn sàng. Vui lòng kiểm tra API Key và quay về trang chủ."])
            setIsLoading(false);
        }
    }, [isAiReady, hasGeneratedInitialStory]); 

    // Automatic cleanup and history management effect
    useEffect(() => {
        if (turnCount === 0 || (cleanupStats && turnCount <= cleanupStats.lastCleanupTurn)) return;

        const currentState: SaveData = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory,
            lastCompressionTurn: historyStats.compressionCount, // This seems to be used as an indicator, not a turn number
            historyStats, cleanupStats
        };
        
        // Automatic cleanup logic (only if enabled in settings)
        let optimizerResult = null;
        if (gameSettings.memoryAutoClean) {
            optimizerResult = GameStateOptimizer.performCleanup(currentState);
            if (optimizerResult.shouldRunCleanup) {
                console.log("Applying auto cleanup...");
                const { optimizedState, stats } = optimizerResult;
                setKnownEntities(optimizedState.knownEntities);
                setStatuses(optimizedState.statuses);
                setQuests(optimizedState.quests);
                setMemories(optimizedState.memories);
                setChronicle(optimizedState.chronicle);
                setCleanupStats(prev => ({
                    totalCleanupsPerformed: (prev?.totalCleanupsPerformed || 0) + 1,
                    totalTokensSavedFromCleanup: (prev?.totalTokensSavedFromCleanup || 0) + stats.totalTokensSaved,
                    lastCleanupTurn: turnCount,
                    cleanupHistory: [...(prev?.cleanupHistory || []), { turn: turnCount, tokensSaved: stats.totalTokensSaved, itemsRemoved: stats.memoriesRemoved + stats.chronicleEntriesRemoved + stats.questsArchived + stats.entitiesArchived }]
                }));
            }
        }

        // Automatic history compression logic (only if enabled in settings)
        if (gameSettings.historyAutoCompress) {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`🔄 [${timestamp}] Auto History Check:`, {
                turn: turnCount,
                autoCompressEnabled: true,
                currentHistorySize: gameHistory.length
            });
            
            const historyManagerTargetState = optimizerResult?.shouldRunCleanup ? optimizerResult.optimizedState : currentState;
            const historyResult = HistoryManager.manageHistory(historyManagerTargetState.gameHistory, turnCount);
            if (historyResult.shouldCompress && historyResult.compressedSegment) {
                console.log(`📦 [${timestamp}] Auto Compression Triggered:`, {
                    turn: turnCount,
                    newActiveHistorySize: historyResult.activeHistory.length,
                    compressedSegmentRange: historyResult.compressedSegment.turnRange,
                    compressedSegmentTokens: historyResult.compressedSegment.tokenCount,
                    totalCompressedSegments: compressedHistory.length + 1
                });
                
                setGameHistory(historyResult.activeHistory);
                setCompressedHistory(prev => [...prev, historyResult.compressedSegment!]);
                setHistoryStats(prev => ({
                    totalEntriesProcessed: prev.totalEntriesProcessed + historyResult.stats.savedEntries,
                    totalTokensSaved: prev.totalTokensSaved + (historyResult.compressedSegment!.tokenCount || 0), // Assuming tokenCount is a reliable measure of saved tokens for now
                    compressionCount: prev.compressionCount + 1,
                }));
            }
        } else {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`⏸️ [${timestamp}] Auto History Compression Disabled:`, {
                turn: turnCount,
                currentHistorySize: gameHistory.length,
                autoCompressEnabled: false
            });
        }
    }, [turnCount]);
    
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        story: { type: Type.STRING, description: "Phần văn bản tường thuật của câu chuyện, bao gồm các định dạng đặc biệt và các thẻ lệnh ẩn." },
        choices: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Một mảng gồm 4-6 lựa chọn cho người chơi."
        },
      },
      required: ['story', 'choices']
    };

    const parseApiResponse = (text: string) => {
        try {
            // Check if response is empty or whitespace only
            if (!text || text.trim().length === 0) {
                console.error("Empty AI response received");
                setStoryLog(prev => [...prev, "Lỗi: AI trả về phản hồi trống. Hãy thử lại."]);
                setChoices([]);
                return;
            }
            
            // Clean the response text to remove any non-JSON content
            let cleanText = text.trim();
            
            // If response starts with markdown code block, extract JSON
            if (cleanText.startsWith('```json')) {
                const jsonMatch = cleanText.match(/```json\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                    cleanText = jsonMatch[1].trim();
                }
            } else if (cleanText.startsWith('```')) {
                const jsonMatch = cleanText.match(/```\s*([\s\S]*?)\s*```/);
                if (jsonMatch) {
                    cleanText = jsonMatch[1].trim();
                }
            }
            
            // Try to find JSON object if response has extra text
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanText = jsonMatch[0];
            }
            
            // Final check if cleanText is valid before parsing
            if (!cleanText || cleanText.length === 0) {
                console.error("No valid JSON found in response");
                setStoryLog(prev => [...prev, "Lỗi: Không tìm thấy JSON hợp lệ trong phản hồi. Hãy thử lại."]);
                setChoices([]);
                return;
            }
            
            const jsonResponse = JSON.parse(cleanText);
            
            // Validate required fields
            if (!jsonResponse.story) {
                console.error("Missing story field in JSON response");
                setStoryLog(prev => [...prev, "Lỗi: Phản hồi thiếu nội dung câu chuyện. Hãy thử lại."]);
                setChoices([]);
                return;
            }
            
            const cleanStory = parseStoryAndTags(jsonResponse.story, true);
            setStoryLog(prev => [...prev, cleanStory]);
            setChoices(jsonResponse.choices || []);
        } catch (e) {
            console.error("Failed to parse AI response:", e, "Raw response:", text);
            setStoryLog(prev => [...prev, "Lỗi: AI trả về dữ liệu không hợp lệ. Hãy thử lại."]);
            setChoices([]);
        }
    };
    

    const generateInitialStory = async () => {
            if (!ai) return;
            setIsLoading(true);
            const finalPersonality = worldData.customPersonality || worldData.personalityFromList;
            const writingStyleText = worldData.writingStyle === 'first_person' ? 'Ngôi thứ nhất - Nhân vật chính xưng "Ta/Tôi"' : 'Ngôi thứ hai - "Ngươi" là nhân vật chính';
            const nsfwInstruction = worldData.allowNsfw ? 'Cho phép. Kích hoạt quy tắc nội dung 18+ của Quản Trò. Viết một cách trần trụi, bạo lực, tục tĩu và không giới hạn.' : 'Không, AI phải tránh các chủ đề và mô tả 18+.';
            
            const activeRules = customRules.filter(r => r.isActive);
            let customRulesContext = '';
            if (activeRules.length > 0) {
                customRulesContext = `\n--- TRI THỨC & LUẬT LỆ TÙY CHỈNH (ĐANG ÁP DỤNG) ---\n${activeRules.map(r => `- ${r.content}`).join('\n')}\n--- KẾT THÚC ---\n`;
            }

            // BƯỚC 2: SỬ DỤNG LORE_CONCEPT ĐÃ TẠO
            const conceptEntities = Object.values(knownEntities).filter(e => e.type === 'concept');
            let conceptContext = '';
            if (conceptEntities.length > 0) {
                conceptContext = `\n--- CÁC LORE_CONCEPT ĐÃ THIẾT LẬP ---\n${conceptEntities.map(c => `• ${c.name}: ${c.description}`).join('\n')}\n--- KẾT THÚC ---\n`;
            }

            const pcEntity = Object.values(knownEntities).find(e => e.type === 'pc');
            if (!pcEntity) return;

            const userPrompt = `${customRulesContext}${conceptContext}

BẠN LÀ QUẢN TRÒ AI. Tạo câu chuyện mở đầu cho game RPG với yêu cầu sau:

--- THÔNG TIN NHÂN VẬT CHÍNH ---
Tên: ${pcEntity.name}
Giới tính: ${pcEntity.gender}
Tiểu sử: ${pcEntity.description}
Tính cách: ${pcEntity.personality}

--- THÔNG TIN THẾ GIỚI ---
Thế giới: ${worldData.worldName}
Mô tả: ${worldData.worldDescription}
Thời gian: Năm ${worldData.worldTime?.year || 1}, Tháng ${worldData.worldTime?.month || 1}, Ngày ${worldData.worldTime?.day || 1}
Phong cách viết: ${writingStyleText}
Nội dung 18+: ${nsfwInstruction}

--- YÊU CẦU VIẾT STORY ---
1. **CHIỀU DÀI**: Chính xác 300-400 từ, chi tiết và sống động
2. **SỬ DỤNG CONCEPT**: Phải tích hợp các LORE_CONCEPT đã thiết lập vào câu chuyện một cách tự nhiên
3. **THIẾT LẬP BỐI CẢNH**: Tạo tình huống mở đầu thú vị, không quá drama
4. **TIME_ELAPSED**: Bắt buộc sử dụng [TIME_ELAPSED: hours=0] 
5. **THẺ LỆNH**: Tạo ít nhất 2-3 thẻ lệnh phù hợp (LORE_LOCATION, LORE_NPC, STATUS_APPLIED_SELF...)
6. **LỰA CHỌN**: Tạo 4-6 lựa chọn hành động đa dạng và thú vị

Hãy tạo một câu chuyện mở đầu cuốn hút!`;

            const initialHistory: GameHistoryEntry[] = [{ role: 'user', parts: [{ text: userPrompt }] }];
            setGameHistory(initialHistory);

            try {
                console.log('📖 GenerateInitialStory: Making AI request with model:', selectedModel);
                console.log('📖 GenerateInitialStory: System instruction length:', systemInstruction.length);
                console.log('📖 GenerateInitialStory: Initial history:', initialHistory);
                
                const response = await ai.models.generateContent({
                    model: selectedModel, 
                    contents: initialHistory,
                    config: { 
                        systemInstruction: systemInstruction, 
                        responseMimeType: "application/json", 
                        responseSchema: responseSchema 
                    }
                });
                
                console.log('📖 GenerateInitialStory: AI response received:', {
                    hasText: !!response.text,
                    textLength: response.text?.length || 0,
                    usageMetadata: response.usageMetadata
                });
                
                const turnTokens = response.usageMetadata?.totalTokenCount || 0;
                setCurrentTurnTokens(turnTokens);
                setTotalTokens(prev => prev + turnTokens);

                const responseText = response.text?.trim() || '';
                
                if (!responseText) {
                    console.error("📖 GenerateInitialStory: API returned empty response text");
                    setStoryLog(prev => [...prev, "Lỗi: AI không trả về nội dung. Hãy thử lại."]);
                    setChoices([]);
                    return;
                }
                
                console.log('📖 GenerateInitialStory: Response text received, length:', responseText.length);
                parseApiResponse(responseText);
                setGameHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
            } catch (error: any) {
                console.error("📖 GenerateInitialStory: Error occurred:", {
                    errorMessage: error.message,
                    errorString: error.toString(),
                    errorStack: error.stack,
                    errorType: typeof error,
                    isUsingDefaultKey,
                    userApiKeyCount
                });
                
                if (!isUsingDefaultKey && userApiKeyCount > 1 && error.toString().includes('429')) {
                    console.log("📖 GenerateInitialStory: Rate limit detected, rotating key...");
                    rotateKey();
                    setStoryLog(prev => [...prev, "**⭐ Lỗi giới hạn yêu cầu. Đã tự động chuyển sang API Key tiếp theo. Vui lòng thử lại hành động của bạn. ⭐**"]);
                    setChoices(rehydratedChoices);
                } else {
                    console.error("📖 GenerateInitialStory: Non-rate-limit error, showing error message");
                    setStoryLog(["Có lỗi xảy ra khi bắt đầu câu chuyện. Vui lòng thử lại.", `Chi tiết lỗi: ${error.message || error.toString()}`]);
                }
            } finally {
                console.log("📖 GenerateInitialStory: Cleaning up, setting loading false");
                setIsLoading(false);
                isGeneratingRef.current = false;
            }
    };
        
    const handleAction = async (action: string) => {
        let originalAction = action.trim();
        let isNsfwRequest = false;
        
        const nsfwRegex = /\s+nsfw\s*$/i;
        if (nsfwRegex.test(originalAction)) {
            isNsfwRequest = true;
            originalAction = originalAction.replace(nsfwRegex, '').trim();
        }
    
        if (!originalAction || isLoading || !ai) return;
    
        setIsLoading(true);
        setChoices([]);
        setCustomAction('');
        setStoryLog(prev => [...prev, `> ${originalAction}`]);
    
        let ruleChangeContext = '';
        if (ruleChanges) {
            // Build context string from ruleChanges
            setRuleChanges(null); 
        }

        let nsfwInstructionPart = isNsfwRequest && worldData.allowNsfw ? `\nLƯU Ý ĐẶC BIỆT: ...` : '';
        
        const currentGameState: SaveData = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory
        };
        const userPrompt = buildEnhancedRagPrompt(originalAction, currentGameState, ruleChangeContext, nsfwInstructionPart);
    
        const newUserEntry: GameHistoryEntry = { role: 'user', parts: [{ text: userPrompt }] };
        const updatedHistory = [...gameHistory, newUserEntry];
    
        try {
            const response = await ai.models.generateContent({
                model: selectedModel, contents: updatedHistory,
                config: { systemInstruction: systemInstruction, responseMimeType: "application/json", responseSchema: responseSchema, }
            });
            const turnTokens = response.usageMetadata?.totalTokenCount || 0;
            setCurrentTurnTokens(turnTokens);
            setTotalTokens(prev => prev + turnTokens);

            const responseText = response.text?.trim() || '';
            
            if (!responseText) {
                console.error("API returned empty response text in handleAction");
                setStoryLog(prev => [...prev, "Lỗi: AI không trả về nội dung. Hãy thử lại."]);
                return;
            }
            
            setGameHistory(prev => [...prev, newUserEntry, { role: 'model', parts: [{ text: responseText }] }]);
            parseApiResponse(responseText);
            setTurnCount(prev => prev + 1); 
        } catch (error: any) {
            console.error("Error continuing story:", error);
            setStoryLog(prev => prev.slice(0, -1));

            if (!isUsingDefaultKey && userApiKeyCount > 1 && error.toString().includes('429')) {
                rotateKey();
                setStoryLog(prev => [...prev, "**⭐ Lỗi giới hạn yêu cầu. Đã tự động chuyển sang API Key tiếp theo. Vui lòng thử lại hành động của bạn. ⭐**"]);
            } else {
                 setStoryLog(prev => [...prev, "Lỗi: AI không thể xử lý yêu cầu. Vui lòng thử một hành động khác."]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const debouncedHandleAction = useDebouncedCallback((action: string) => {
        handleAction(action);
    }, 300);
    
    const handleEntityClick = (entityName: string) => setActiveEntity(knownEntities[entityName] || null);
    const handleUseItem = (itemName: string) => { setActiveEntity(null); setTimeout(() => handleAction(`Sử dụng vật phẩm: ${itemName}`), 100); };
    const handleLearnItem = (itemName: string) => { setActiveEntity(null); setTimeout(() => handleAction(`Học công pháp: ${itemName}`), 100); };
    const handleEquipItem = (itemName: string) => { setActiveEntity(null); setTimeout(() => handleAction(`Trang bị ${itemName}`), 100); };
    const handleUnequipItem = (itemName: string) => { setActiveEntity(null); setTimeout(() => handleAction(`Tháo ${itemName}`), 100); };
    const handleStatusClick = (status: Status) => setActiveStatus(status);
    const handleToggleMemoryPin = (index: number) => setMemories(prev => prev.map((mem, i) => i === index ? { ...mem, pinned: !mem.pinned } : mem));
    const handleQuestClick = (quest: Quest) => setActiveQuest(quest);
    
     const handleSuggestAction = async () => {
        if (isLoading || !ai) return;
        setIsLoading(true);
        try {
            const response = await ai.models.generateContent({
                model: selectedModel,
                contents: `Bối cảnh: "${storyLog.slice(-1)[0]}". Gợi ý một hành động sáng tạo.`,
            });
            setCustomAction(response.text?.trim() || 'Không thể nhận gợi ý lúc này.');
        } catch (error) {
            console.error("Error suggesting action:", error);
            setCustomAction("Không thể nhận gợi ý lúc này.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveGame = () => {
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
    
        const currentGameState: SaveData = { worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, historyStats, cleanupStats, storyLog, choices, locationDiscoveryOrder };
        const jsonString = JSON.stringify(currentGameState, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `AI-RolePlay-${worldData.characterName?.replace(/\s+/g, '_') || 'NhanVat'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleSaveRules = (newRules: CustomRule[]) => {
        // Rule change detection logic remains the same
        setCustomRules(newRules);
        previousRulesRef.current = JSON.parse(JSON.stringify(newRules));
        setShowRulesSavedSuccess(true);
        setTimeout(() => setShowRulesSavedSuccess(false), 3500);
    };

    const handleRestartGame = () => {
        setIsRestartModalOpen(false);
        setIsLoading(true);
        setStoryLog([]);
        setChoices([]);
        setStatuses([]);
        setQuests([]);
        setMemories([]);
        setKnownEntities({});
        setParty([]);
        setTurnCount(0);
        setTotalTokens(0);
        setGameTime({ year: worldData.worldTime?.year || 1, month: worldData.worldTime?.month || 1, day: worldData.worldTime?.day || 1, hour: 8 });
        setChronicle({ memoir: [], chapter: [], turn: [] });
        setRuleChanges(null);
        previousRulesRef.current = initialGameState.customRules;
        setGameHistory([]);
        setHasGeneratedInitialStory(false);
        isGeneratingRef.current = false;
    };

    const handleSettingsChange = (newSettings: GameSettings) => {
        setGameSettings(newSettings);
        localStorage.setItem('gameSettings', JSON.stringify(newSettings));
        
        // Apply font settings to document root
        document.documentElement.style.setProperty('--game-font-size', `${newSettings.fontSize}px`);
        document.documentElement.style.setProperty('--game-font-family', newSettings.fontFamily);
    };

    // Apply font settings on component mount
    useEffect(() => {
        document.documentElement.style.setProperty('--game-font-size', `${gameSettings.fontSize}px`);
        document.documentElement.style.setProperty('--game-font-family', gameSettings.fontFamily);
    }, [gameSettings.fontSize, gameSettings.fontFamily]);

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Prevent shortcuts when typing in input fields
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Knowledge Base shortcut: K key or Ctrl+K
            if (e.key === 'k' || e.key === 'K' || (e.ctrlKey && e.key === 'k')) {
                e.preventDefault();
                setIsKnowledgeModalOpen(true);
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleManualCleanup = useCallback(() => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🧹 [${timestamp}] Manual Cleanup Started:`, {
            turn: turnCount,
            beforeCleanup: {
                entities: Object.keys(knownEntities).length,
                statuses: statuses.length,
                quests: quests.length,
                memories: memories.length,
                historyEntries: gameHistory.length,
                chronicleEntries: `memoir:${chronicle.memoir.length}, chapter:${chronicle.chapter.length}, turn:${chronicle.turn.length}`
            }
        });
        
        const currentState: SaveData = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory,
            lastCompressionTurn: historyStats.compressionCount, 
            historyStats, cleanupStats
        };
        const result = GameStateOptimizer.forceCleanup(currentState, true); // aggressive mode
        
        setKnownEntities(result.optimizedState.knownEntities);
        setStatuses(result.optimizedState.statuses);
        setQuests(result.optimizedState.quests);
        setMemories(result.optimizedState.memories);
        setChronicle(result.optimizedState.chronicle);

        setCleanupStats(prev => ({
            ...prev!,
            totalCleanupsPerformed: (prev?.totalCleanupsPerformed || 0) + 1,
            totalTokensSavedFromCleanup: (prev?.totalTokensSavedFromCleanup || 0) + result.stats.totalTokensSaved,
            lastCleanupTurn: turnCount,
        }));

        console.log(`🧹 [${timestamp}] Manual Cleanup Completed:`, {
            turn: turnCount,
            afterCleanup: {
                entities: Object.keys(result.optimizedState.knownEntities).length,
                statuses: result.optimizedState.statuses.length,
                quests: result.optimizedState.quests.length,
                memories: result.optimizedState.memories.length,
                chronicleEntries: `memoir:${result.optimizedState.chronicle.memoir.length}, chapter:${result.optimizedState.chronicle.chapter.length}, turn:${result.optimizedState.chronicle.turn.length}`
            },
            cleanupStats: {
                entitiesRemoved: Object.keys(knownEntities).length - Object.keys(result.optimizedState.knownEntities).length,
                statusesRemoved: statuses.length - result.optimizedState.statuses.length,
                questsRemoved: quests.length - result.optimizedState.quests.length,
                memoriesRemoved: memories.length - result.optimizedState.memories.length,
                tokensEstimatedSaved: result.stats.totalTokensSaved
            }
        });

        setNotification(`🧹 Cleanup complete! Saved ~${Math.round(result.stats.totalTokensSaved / 1000)}k tokens.`);
        setTimeout(() => setNotification(null), 3000);
    }, [worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, historyStats, cleanupStats]);

    // Debug function to show current system status
    const debugSystemStatus = useCallback(() => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`🔍 [${timestamp}] System Status Debug:`, {
            gameInfo: {
                currentTurn: turnCount,
                totalTokens: totalTokens,
                currentTurnTokens: currentTurnTokens
            },
            historySystem: {
                autoCompressionEnabled: gameSettings.historyAutoCompress,
                activeHistoryEntries: gameHistory.length,
                compressedSegments: compressedHistory.length,
                historyStats: historyStats,
                lastCompression: historyStats.compressionCount > 0 ? `Segment ${historyStats.compressionCount}` : 'Never'
            },
            memoryCleanup: {
                totalCleanupsPerformed: cleanupStats?.totalCleanupsPerformed || 0,
                totalTokensSaved: cleanupStats?.totalTokensSavedFromCleanup || 0,
                lastCleanupTurn: cleanupStats?.lastCleanupTurn || 'Never'
            },
            gameState: {
                entities: Object.keys(knownEntities).length,
                statuses: statuses.length,
                quests: quests.length,
                memories: memories.length,
                chronicleMemoir: chronicle.memoir.length,
                chronicleChapter: chronicle.chapter.length,
                chronicleTurn: chronicle.turn.length
            }
        });
    }, [turnCount, totalTokens, currentTurnTokens, gameSettings.historyAutoCompress, gameHistory.length, compressedHistory.length, historyStats, cleanupStats, knownEntities, statuses, quests, memories, chronicle]);

    // Expose debug function to window for manual testing
    React.useEffect(() => {
        (window as any).debugGameSystems = debugSystemStatus;
        return () => {
            delete (window as any).debugGameSystems;
        };
    }, [debugSystemStatus]);

    
    const hasActiveQuests = quests.some(q => q.status === 'active');
    const pcStatuses = statuses.filter(s => s.owner === 'pc' || (pcName && s.owner === pcName));
    const displayParty = party.filter(p => p.name !== pcName);
    const isCustomActionLocked = useMemo(() => customRules.some(rule => rule.isActive && rule.content.toUpperCase().includes('KHÓA HÀNH ĐỘNG TÙY Ý')), [customRules]);

    // --- Memoized Modal Props ---
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

    const entityComputations = useMemo(() => ({
        pcEntity,
        pcStatuses,
        displayParty,
    }), [pcEntity, pcStatuses, displayParty]);
    
    return (
        <div 
            className="bg-transparent w-full h-full p-0 md:p-4 flex flex-col text-slate-900 dark:text-white relative" 
            style={{
                maxHeight: '98vh', 
                height: '98vh',
                fontSize: 'var(--game-font-size, 16px)',
                fontFamily: 'var(--game-font-family, Inter)'
            }}
        >
            <GameNotifications 
                notification={notification} 
                showSaveSuccess={showSaveSuccess} 
                showRulesSavedSuccess={showRulesSavedSuccess} 
            />
            
            <SidebarNav 
                isOpen={isSidebarOpen} 
                onClose={() => setIsSidebarOpen(false)}
                onHome={() => setIsHomeModalOpen(true)}
                onSettings={() => setIsGameSettingsModalOpen(true)}
                onSave={handleSaveGame}
                onMap={() => setIsMapModalOpen(true)}
                onRules={() => setIsCustomRulesModalOpen(true)}
                onKnowledge={() => setIsKnowledgeModalOpen(true)}
                onMemory={() => setIsMemoryModalOpen(true)}
                onRestart={() => setIsRestartModalOpen(true)}
                onPCInfo={() => setIsPcInfoModalOpen(true)}
                onParty={() => setIsPartyModalOpen(true)}
                onQuests={() => setIsQuestLogModalOpen(true)}
                onManualCleanup={handleManualCleanup}
                hasActiveQuests={hasActiveQuests}
                currentTurnTokens={currentTurnTokens}
                totalTokens={totalTokens}
                historyStats={historyStats}
                compressedSegments={compressedHistory.length}
                gameHistory={gameHistory}
                cleanupStats={cleanupStats!}
            />

            <MobileHeader onOpenSidebar={() => setIsSidebarOpen(true)} worldData={worldData} />

            <DesktopHeader 
                onHome={() => setIsHomeModalOpen(true)} 
                onSettings={() => setIsGameSettingsModalOpen(true)}
                onSave={handleSaveGame} 
                onMap={() => setIsMapModalOpen(true)}
                onRules={() => setIsCustomRulesModalOpen(true)}
                onKnowledge={() => setIsKnowledgeModalOpen(true)}
                onMemory={() => setIsMemoryModalOpen(true)}
                onRestart={() => setIsRestartModalOpen(true)}
                onPCInfo={() => setIsPcInfoModalOpen(true)}
                onParty={() => setIsPartyModalOpen(true)}
                onQuests={() => setIsQuestLogModalOpen(true)}
                onManualCleanup={handleManualCleanup}
                worldData={worldData}
                gameTime={gameTime}
                turnCount={turnCount}
                currentTurnTokens={currentTurnTokens}
                totalTokens={totalTokens}
                hasActiveQuests={hasActiveQuests}
            />

            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 overflow-hidden p-4 md:p-0">
                <StoryPanel
                    storyLog={storyLog}
                    isLoading={isLoading}
                    isAiReady={isAiReady}
                    knownEntities={knownEntities}
                    onEntityClick={handleEntityClick}
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
            </div>
            
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
                entityComputations={entityComputations}
            />

            <GameSettingsModal
                isOpen={isGameSettingsModalOpen}
                onClose={() => setIsGameSettingsModalOpen(false)}
                settings={gameSettings}
                onSettingsChange={handleSettingsChange}
            />
        </div>
    );
};