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
    const ownerStatusesOfOtherTypes = ownerStatuses.filter(s => s.type !== newStatusType);
    const ownerStatusesOfType = ownerStatuses.filter(s => s.type === newStatusType);

    // 4. Limit the number of statuses of the same type for the owner (to prevent spam).
    const maxStatusesPerType = 8;
    let finalOwnerStatusesOfType = ownerStatusesOfType;
    if (ownerStatusesOfType.length >= maxStatusesPerType) {
        // Keep the most recent ones. Since they are added chronologically,
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
    const [isLoading, setIsLoading] = useState(false); // FIX: Initialize as false instead of conditional
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
    const [isChoicesModalOpen, setIsChoicesModalOpen] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);

    // AI Response Schema
    const responseSchema: Type = {
        type: "object",
        properties: {
            story: { type: "string", description: "Main story content" },
            choices: { type: "array", items: { type: "string" }, description: "Player choices" }
        },
        required: ["story", "choices"]
    };

    // Rehydrated state from initialGameState
    const { rehydratedLog, rehydratedChoices } = useMemo(() => {
        const log: string[] = [];
        let lastChoices: string[] = [];

        initialGameState.gameHistory.forEach(entry => {
            if (entry.role === 'user') {
                const actionMatch = entry.parts[0].text.match(/^> (.+)/);
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

    // FIX: Main useEffect for handling AI ready state and initial story generation
    useEffect(() => {
        // Only show "AI chưa sẵn sàng" message if AI is not ready
        if (!isAiReady) {
            const errorMessage = apiKeyError || "AI chưa sẵn sàng. Vui lòng kiểm tra API Key và quay về trang chủ.";
            setStoryLog([errorMessage]);
            setIsLoading(false);
            setChoices([]);
            return;
        }

        // If AI is ready and we have no game history, generate initial story
        if (isAiReady && gameHistory.length === 0) {
            setIsLoading(true);
            generateInitialStory();
        }
    }, [isAiReady, apiKeyError, gameHistory.length]); // FIX: Updated dependencies

    // Automatic cleanup and history management effect
    useEffect(() => {
        if (turnCount === 0 || (cleanupStats && turnCount <= cleanupStats.lastCleanupTurn)) return;

        const currentState: SaveData = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory,
            lastCompressionTurn: historyStats.compressionCount,
            historyStats, cleanupStats
        };
        
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
            setCleanupStats(prev => ({
                totalCleanupsPerformed: (prev?.totalCleanupsPerformed || 0) + 1,
                totalTokensSavedFromCleanup: (prev?.totalTokensSavedFromCleanup || 0) + stats.totalTokensSaved,
                lastCleanupTurn: turnCount,
                cleanupHistory: [...(prev?.cleanupHistory || []), { turn: turnCount, tokensSaved: stats.totalTokensSaved, itemsRemoved: stats.memoriesRemoved + stats.chronicleEntriesRemoved + stats.questsArchived + stats.entitiesArchived }]
            }));
        }

        // Automatic history compression logic
        const historyManagerTargetState = optimizerResult.shouldRunCleanup ? optimizerResult.optimizedState : currentState;
        const historyResult = HistoryManager.manageHistory(historyManagerTargetState.gameHistory, turnCount);
        if (historyResult.shouldCompress && historyResult.compressedSegment) {
            console.log("Compressing history...");
            setGameHistory(historyResult.activeHistory);
            setCompressedHistory(prev => [...prev, historyResult.compressedSegment!]);
            setHistoryStats(prev => ({
                totalEntriesProcessed: prev.totalEntriesProcessed + (historyResult.compressedSegment?.originalEntryCount || 0),
                totalTokensSaved: prev.totalTokensSaved + (historyResult.compressedSegment?.tokensSaved || 0),
                compressionCount: prev.compressionCount + 1
            }));
        }
    }, [turnCount]);

    // Location discovery order computation
    const locationDiscoveryOrder = useMemo(() => {
        const order: string[] = [];
        const seen = new Set<string>();
        
        initialGameState.gameHistory.forEach(entry => {
            if (entry.role === 'model') {
                try {
                    const response = JSON.parse(entry.parts[0].text);
                    if (response.discoveries?.locations) {
                        response.discoveries.locations.forEach((loc: string) => {
                            if (!seen.has(loc)) {
                                order.push(loc);
                                seen.add(loc);
                            }
                        });
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
            const attrRegex = /(\w+)=("([^"]*)"|([^\s"\]]+))/g;
            let match;
            while ((match = attrRegex.exec(attrString)) !== null) {
                const key = match[1];
                let value: string | boolean | number | { description: string, completed: boolean }[] = match[3] !== undefined ? match[3] : match[4];
                
                if (value === 'true') value = true;
                else if (value === 'false') value = false;
                else if (!isNaN(Number(value)) && value !== '') value = Number(value);
                
                attributes[key] = value;
            }
            return attributes;
        };
    
        if (!applySideEffects) {
            return cleanStory.replace(tagRegex, '').trim();
        }
    
        let match;
        const processedTags = new Set<string>();
        
        while ((match = tagRegex.exec(storyText)) !== null) {
            const [fullMatch, tagType, content] = match;
            const tagKey = `${tagType}:${content}`;
            
            if (processedTags.has(tagKey)) continue;
            processedTags.add(tagKey);
            
            cleanStory = cleanStory.replace(fullMatch, '');
            const attributes = parseAttributes(content);
    
            switch (tagType) {
                case 'TIME_ELAPSED':
                    const elapsed = {
                        years: attributes.years || 0,
                        months: attributes.months || 0,
                        days: attributes.days || 0,
                        hours: attributes.hours || 0
                    };
                    setGameTime(prev => calculateNewTime(prev, elapsed));
                    break;
                    
                case 'CHRONICLE_TURN':
                    if (attributes.text) {
                        setChronicle(prev => ({
                            ...prev,
                            turn: [...prev.turn, { turn: turnCount + 1, event: attributes.text }]
                        }));
                    }
                    break;
                    
                case 'STATUS_ADD':
                    const newStatus = {
                        name: attributes.name || 'Unknown Status',
                        description: attributes.description || '',
                        type: attributes.type || 'temporary',
                        duration: attributes.duration,
                        effect: attributes.effect || 'none',
                        severity: attributes.severity || 'minor'
                    };
                    setStatuses(prev => applyStatusWithLimit(prev, newStatus, attributes.owner || 'pc'));
                    break;
                    
                case 'STATUS_REMOVE':
                    setStatuses(prev => prev.filter(s => 
                        !(s.name === attributes.name && (s.owner === (attributes.owner || 'pc')))
                    ));
                    break;
                    
                case 'ENTITY_UPDATE':
                case 'ENTITY_ADD':
                    const entityKey = `${attributes.type}_${attributes.name}`;
                    const entityUpdate = {
                        name: attributes.name,
                        type: attributes.type || 'object',
                        description: attributes.description || '',
                        location: attributes.location,
                        category: attributes.category,
                        rarity: attributes.rarity,
                        equipped: attributes.equipped === true,
                        canUse: attributes.canUse === true,
                        canLearn: attributes.canLearn === true,
                        canEquip: attributes.canEquip === true,
                        lore: attributes.lore
                    };
                    
                    setKnownEntities(prev => ({
                        ...prev,
                        [entityKey]: { ...prev[entityKey], ...entityUpdate }
                    }));
                    break;
                    
                case 'QUEST_UPDATE':
                case 'QUEST_ADD':
                    const questUpdate = {
                        id: attributes.id || attributes.name?.toLowerCase().replace(/\s+/g, '_'),
                        name: attributes.name || 'Unnamed Quest',
                        description: attributes.description || '',
                        status: attributes.status || 'active',
                        objectives: attributes.objectives ? 
                            attributes.objectives.split(';').map((obj: string) => ({
                                description: obj.trim(),
                                completed: false
                            })) : [],
                        rewards: attributes.rewards,
                        location: attributes.location,
                        giver: attributes.giver
                    };
                    
                    setQuests(prev => {
                        const existingIndex = prev.findIndex(q => q.id === questUpdate.id);
                        if (existingIndex >= 0) {
                            const updated = [...prev];
                            updated[existingIndex] = { ...updated[existingIndex], ...questUpdate };
                            return updated;
                        } else {
                            return [...prev, questUpdate as Quest];
                        }
                    });
                    break;
                    
                case 'MEMORY_ADD':
                    if (attributes.content) {
                        const newMemory: Memory = {
                            id: Date.now().toString(),
                            content: attributes.content,
                            importance: attributes.importance || 'medium',
                            turn: turnCount + 1,
                            pinned: false
                        };
                        setMemories(prev => [...prev, newMemory]);
                    }
                    break;
                    
                case 'PARTY_ADD':
                    if (attributes.name) {
                        const partyMember: Entity = {
                            name: attributes.name,
                            type: 'npc',
                            description: attributes.description || '',
                            category: 'companion'
                        };
                        setParty(prev => {
                            if (!prev.some(p => p.name === attributes.name)) {
                                return [...prev, partyMember];
                            }
                            return prev;
                        });
                    }
                    break;
                    
                case 'PARTY_REMOVE':
                    if (attributes.name) {
                        setParty(prev => prev.filter(p => p.name !== attributes.name));
                    }
                    break;
            }
        }
    
        return cleanStory.trim();
    }, [turnCount]);

    // Generate initial story
    const generateInitialStory = useCallback(async () => {
        if (!ai || !isAiReady) {
            console.error("AI not ready for initial story generation");
            setIsLoading(false);
            return;
        }

        try {
            const currentGameState: SaveData = {
                worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory
            };
            const initialPrompt = buildEnhancedRagPrompt("Bắt đầu câu chuyện", currentGameState, '', '');
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ role: 'user', parts: [{ text: initialPrompt }] }],
                config: { 
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: responseSchema
                }
            });

            const turnTokens = response.usageMetadata?.totalTokenCount || 0;
            setCurrentTurnTokens(turnTokens);
            setTotalTokens(prev => prev + turnTokens);

            const responseText = response.text.trim();
            const initialEntry: GameHistoryEntry = { role: 'model', parts: [{ text: responseText }] };
            setGameHistory([initialEntry]);
            
            parseApiResponse(responseText);
            setTurnCount(1);
        } catch (error: any) { 
            console.error("Error generating initial story:", error);
            if (!isUsingDefaultKey && userApiKeyCount > 1 && error.toString().includes('429')) {
                rotateKey();
                setStoryLog(["**⭐ Lỗi giới hạn yêu cầu. Đã tự động chuyển sang API Key tiếp theo. Vui lòng thử lại hành động của bạn. ⭐**"]);
                setChoices(rehydratedChoices);
            } else {
                console.error("Error generating initial story:", error);
                setStoryLog(["Có lỗi xảy ra khi bắt đầu câu chuyện. Vui lòng thử lại."]);
            }
        } finally {
            setIsLoading(false);
        }
    }, [ai, isAiReady, worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, rotateKey, isUsingDefaultKey, userApiKeyCount, responseSchema, rehydratedChoices]);

    // Parse API response
    const parseApiResponse = useCallback((responseText: string) => {
        try {
            const jsonResponse = JSON.parse(responseText);
            const storyText = jsonResponse.story || '';
            const newChoices = jsonResponse.choices || [];
            
            const cleanStory = parseStoryAndTags(storyText, true);
            if (cleanStory) {
                setStoryLog(prev => [...prev, cleanStory]);
            }
            setChoices(newChoices);
        } catch (error) {
            console.error("Error parsing API response:", error);
            const cleanText = responseText.replace(/\[([A-Z_]+):\s*([^\]]+)\]/g, '').trim();
            setStoryLog(prev => [...prev, cleanText]);
            setChoices([]);
        }
    }, [parseStoryAndTags]);
        
    const handleAction = async (action: string) => {
        let originalAction = action.trim();
        let isNsfwRequest = false;
        
        const nsfwRegex = /\s+nsfw\s*$/i;
        if (nsfwRegex.test(originalAction)) {
            isNsfwRequest = true;
            originalAction = originalAction.replace(nsfwRegex, '').trim();
        }
    
        if (!originalAction || isLoading || !ai || !isAiReady) return; // FIX: Added isAiReady check
    
        setIsLoading(true);
        setChoices([]);
        setCustomAction('');
        setStoryLog(prev => [...prev, `> ${originalAction}`]);
    
        let ruleChangeContext = '';
        if (ruleChanges) {
            // Build context string from ruleChanges
            setRuleChanges(null); 
        }

        let nsfwInstructionPart = isNsfwRequest && worldData.allowNsfw ? `\nLƯU Ý ĐẶC BIỆT: Người chơi đã yêu cầu nội dung 18+. Hãy tạo nội dung phù hợp với độ tuổi trưởng thành, bao gồm các yếu tố gợi cảm hoặc bạo lực nếu phù hợp với bối cảnh. Đảm bảo có ít nhất 2 lựa chọn tiếp theo có tính chất 18+.` : '';
        
        const currentGameState: SaveData = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory
        };
        const userPrompt = buildEnhancedRagPrompt(originalAction, currentGameState, ruleChangeContext, nsfwInstructionPart);
    
        const newUserEntry: GameHistoryEntry = { role: 'user', parts: [{ text: userPrompt }] };
        const updatedHistory = [...gameHistory, newUserEntry];
    
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash', contents: updatedHistory,
                config: { systemInstruction: systemInstruction, responseMimeType: "application/json", responseSchema: responseSchema, }
            });
            const turnTokens = response.usageMetadata?.totalTokenCount || 0;
            setCurrentTurnTokens(turnTokens);
            setTotalTokens(prev => prev + turnTokens);

            const responseText = response.text.trim();
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
        if (isLoading || !ai || !isAiReady) return; // FIX: Added isAiReady check
        setIsLoading(true);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Bối cảnh: "${storyLog.slice(-1)[0]}". Gợi ý một hành động sáng tạo.`,
            });
            setCustomAction(response.text.trim());
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
        link.download = `AI-RolePlay-${worldData.characterName?.replace(/\s+/g, '_') || 'NhanVat'}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleRestartGame = () => {
        const blankGameState: SaveData = {
            worldData,
            knownEntities: {},
            statuses: [],
            quests: [],
            gameHistory: [],
            memories: [],
            party: [],
            customRules,
            systemInstruction,
            turnCount: 0,
            totalTokens: 0,
            gameTime: { year: 1, month: 1, day: 1, hour: 8 },
            chronicle: { memoir: [], chapter: [], turn: [] },
            compressedHistory: [],
            historyStats: { totalEntriesProcessed: 0, totalTokensSaved: 0, compressionCount: 0 },
            cleanupStats: { totalCleanupsPerformed: 0, totalTokensSavedFromCleanup: 0, lastCleanupTurn: 0, cleanupHistory: [] }
        };

        // Reset all state to blank
        setKnownEntities({});
        setStatuses([]);
        setQuests([]);
        setGameHistory([]);
        setMemories([]);
        setParty([]);
        setTurnCount(0);
        setTotalTokens(0);
        setGameTime({ year: 1, month: 1, day: 1, hour: 8 });
        setChronicle({ memoir: [], chapter: [], turn: [] });
        setCompressedHistory([]);
        setHistoryStats({ totalEntriesProcessed: 0, totalTokensSaved: 0, compressionCount: 0 });
        setCleanupStats({ totalCleanupsPerformed: 0, totalTokensSavedFromCleanup: 0, lastCleanupTurn: 0, cleanupHistory: [] });
        setStoryLog([]);
        setChoices([]);
        setIsRestartModalOpen(false);
        
        // FIX: Only generate initial story if AI is ready
        if (isAiReady) {
            setIsLoading(true);
            setTimeout(() => generateInitialStory(), 100);
        }
    };

    const handleSaveRules = (newRules: CustomRule[]) => {
        const prevRules = customRules;
        setCustomRules(newRules);
        
        // Track rule changes
        const activated = newRules.filter(newRule => 
            newRule.isActive && !prevRules.find(oldRule => oldRule.id === newRule.id && oldRule.isActive)
        );
        const deactivated = prevRules.filter(oldRule => 
            oldRule.isActive && !newRules.find(newRule => newRule.id === oldRule.id && newRule.isActive)
        );
        const updated = newRules.filter(newRule => {
            const oldRule = prevRules.find(r => r.id === newRule.id);
            return oldRule && oldRule.content !== newRule.content;
        }).map(newRule => ({
            oldRule: prevRules.find(r => r.id === newRule.id)!,
            newRule
        }));

        if (activated.length > 0 || deactivated.length > 0 || updated.length > 0) {
            setRuleChanges({ activated, deactivated, updated });
        }

        setShowRulesSavedSuccess(true);
        setTimeout(() => setShowRulesSavedSuccess(false), 3000);
        setIsCustomRulesModalOpen(false);
    };

    // Manual cleanup handler
    const handleManualCleanup = () => {
        const currentState: SaveData = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory,
            lastCompressionTurn: historyStats.compressionCount,
            historyStats, cleanupStats
        };
        
        const { optimizedState, stats } = GameStateOptimizer.performCleanup(currentState, true);
        
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
        
        setNotification(`Đã dọn dẹp thành công! Tiết kiệm ${stats.totalTokensSaved} token.`);
        setTimeout(() => setNotification(null), 3000);
    };

    // Computed values for UI
    const pcStatuses = useMemo(() => statuses.filter(s => s.owner === 'pc' || (pcName && s.owner === pcName)), [statuses, pcName]);
    const displayParty = useMemo(() => party.filter(p => p.name !== pcName), [party, pcName]);
    const hasActiveQuests = useMemo(() => quests.some(q => q.status === 'active'), [quests]);
    const isCustomActionLocked = useMemo(() => customRules.some(rule => rule.isActive && rule.content.toUpperCase().includes('KHÓA HÀNH ĐỘNG TỰ DO')), [customRules]);

    // Entity computations for performance
    const entityComputations = useMemo(() => {
        const entities = Object.values(knownEntities);
        return {
            locations: entities.filter(e => e.type === 'location'),
            npcs: entities.filter(e => e.type === 'npc'),
            items: entities.filter(e => e.type === 'item' || e.type === 'object'),
            skills: entities.filter(e => e.type === 'skill'),
            equippedItems: entities.filter(e => e.equipped === true),
            usableItems: entities.filter(e => e.canUse === true),
            learnableSkills: entities.filter(e => e.canLearn === true && e.type === 'skill')
        };
    }, [knownEntities]);

    // Modal close handlers
    const modalCloseHandlers = useMemo(() => ({
        setIsHomeModalOpen,
        setIsRestartModalOpen,
        setIsMemoryModalOpen,
        setIsKnowledgeModalOpen,
        setIsCustomRulesModalOpen,
        setIsMapModalOpen,
        setIsPcInfoModalOpen,
        setIsPartyModalOpen,
        setIsQuestLogModalOpen,
        setIsChoicesModalOpen
    }), []);

    return (
        <div className={`min-h-screen w-full flex flex-col transition-all duration-300 ${fontFamily} ${fontSize} bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100 dark:from-slate-900 dark:via-purple-900 dark:to-slate-800`}>
            <DesktopHeader 
                worldData={worldData}
                pcEntity={pcEntity}
                currentTurnTokens={currentTurnTokens}
                totalTokens={totalTokens}
                turnCount={turnCount}
                gameTime={gameTime}
                onHomeClick={() => setIsHomeModalOpen(true)}
                onRestartClick={() => setIsRestartModalOpen(true)}
                onSaveClick={handleSaveGame}
                cleanupStats={cleanupStats}
                historyStats={historyStats}
                onManualCleanup={handleManualCleanup}
            />
            
            <MobileHeader 
                worldData={worldData}
                pcEntity={pcEntity}
                onHomeClick={() => setIsHomeModalOpen(true)}
                onSaveClick={handleSaveGame}
            />

            <GameNotifications 
                notification={notification}
                showSaveSuccess={showSaveSuccess}
                showRulesSavedSuccess={showRulesSavedSuccess}
            />
            
            <div className="flex-grow flex overflow-hidden">
                <SidebarNav
                    hasActiveQuests={hasActiveQuests}
                    pcStatuses={pcStatuses}
                    displayParty={displayParty}
                    entityComputations={entityComputations}
                    memories={memories}
                    currentTurnTokens={currentTurnTokens}
                    totalTokens={totalTokens}
                    turnCount={turnCount}
                    cleanupStats={cleanupStats}
                    historyStats={historyStats}
                    onMemoryClick={() => setIsMemoryModalOpen(true)}
                    onKnowledgeClick={() => setIsKnowledgeModalOpen(true)}
                    onCustomRulesClick={() => setIsCustomRulesModalOpen(true)}
                    onMapClick={() => setIsMapModalOpen(true)}
                    onPcInfoClick={() => setIsPcInfoModalOpen(true)}
                    onPartyClick={() => setIsPartyModalOpen(true)}
                    onQuestLogClick={() => setIsQuestLogModalOpen(true)}
                    onManualCleanup={handleManualCleanup}
                />
                
                <StoryPanel
                    storyLog={storyLog}
                    isLoading={isLoading}
                    isAiReady={isAiReady}
                    knownEntities={knownEntities}
                    onEntityClick={handleEntityClick}
                    className="flex-grow"
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
        </div>
    );
};
