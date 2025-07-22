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

// Gesture Support Types
interface TouchPosition {
    x: number;
    y: number;
    timestamp: number;
}

interface SwipeGesture {
    direction: 'left' | 'right' | 'up' | 'down' | null;
    distance: number;
    velocity: number;
}

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
    
    // 3. Separate the target owner's statuses by type.
    const ownerStatusesOfOtherTypes = ownerStatuses.filter(s => s.type !== newStatusType);
    let ownerStatusesOfType = ownerStatuses.filter(s => s.type === newStatusType);
    
    // 4. Apply the limit for the specific type (max 2 per type).
    const maxStatusesPerType = 2;
    if (ownerStatusesOfType.length >= maxStatusesPerType) {
        // Keep only the newest (maxStatusesPerType - 1) statuses.
        // The oldest ones are at the beginning of the array.
        ownerStatusesOfType = ownerStatusesOfType.slice(ownerStatusesOfType.length - (maxStatusesPerType - 1));
    }
    
    // 5. Create the new status object to add.
    const newStatusToAdd: Status = { ...newStatusAttributes, owner: owner };
    
    // 6. Reconstruct and return the new status list.
    return [
        ...otherOwnersStatuses, 
        ...ownerStatusesOfOtherTypes,
        ...ownerStatusesOfType, 
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
    
    // Gesture Support State
    const [touchStart, setTouchStart] = useState<TouchPosition | null>(null);
    const [touchEnd, setTouchEnd] = useState<TouchPosition | null>(null);
    const [isGestureActive, setIsGestureActive] = useState(false);
    const [gestureDirection, setGestureDirection] = useState<string | null>(null);
    const [isMobile, setIsMobile] = useState(false);
    
    // Map State
    const [locationDiscoveryOrder, setLocationDiscoveryOrder] = useState<string[]>(() => {
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
        return order;
    });

    // Rule change tracking
    const [ruleChanges, setRuleChanges] = useState<{ activated: CustomRule[], deactivated: CustomRule[], updated: { oldRule: CustomRule, newRule: CustomRule }[] } | null>(null);
    const previousRulesRef = useRef<CustomRule[]>(initialGameState.customRules);

    const storyContainerRef = useRef<HTMLDivElement>(null);

    const pcEntity = useMemo(() => Object.values(knownEntities).find(e => e.type === 'pc'), [knownEntities]);
    const pcName = pcEntity?.name;
    
    // --- UPDATED Data Rehydration Logic WITH SAVE FIX ---
    const { rehydratedLog, rehydratedChoices } = useMemo(() => {
        const typedInitialState = initialGameState as any;
        
        // *** FIX: ƯU TIÊN choices và storyLog đã được save trực tiếp ***
        if (typedInitialState.choices !== undefined && typedInitialState.storyLog !== undefined) {
            console.log("Loading from saved choices and storyLog");
            return { 
                rehydratedLog: typedInitialState.storyLog, 
                rehydratedChoices: typedInitialState.choices 
            };
        }
        
        // *** FALLBACK: Parse từ gameHistory như trước ***
        if (typedInitialState.storyLog?.length > 0) {
            return { 
                rehydratedLog: typedInitialState.storyLog, 
                rehydratedChoices: typedInitialState.choices || [] 
            };
        }
        
        console.log("Rebuilding from gameHistory");
        const log: string[] = [];
        let lastChoices: string[] = [];
    
        initialGameState.gameHistory.forEach((entry, index) => {
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
                    
                    // *** FIX: Lưu choices của entry này ***
                    const currentChoices = jsonResponse.choices || [];
                    if (currentChoices.length > 0) {
                        lastChoices = currentChoices;
                    }
                    
                    console.log(`Entry ${index}: found ${currentChoices.length} choices`);
                    
                } catch (e) {
                    const cleanText = entry.parts[0].text.replace(/\[([A-Z_]+):\s*([^\]]+)\]/g, '').trim();
                    if (cleanText) {
                        log.push(cleanText);
                    }
                    // Nếu parse lỗi, có thể choices đã mất
                    console.warn(`Failed to parse entry ${index}:`, e);
                }
            }
        });
        
        console.log(`Rehydration complete: ${log.length} story entries, ${lastChoices.length} choices`);
        return { rehydratedLog: log, rehydratedChoices: lastChoices };
    }, [initialGameState]); 
    
    const [storyLog, setStoryLog] = useState<string[]>(rehydratedLog);
    const [choices, setChoices] = useState<string[]>(rehydratedChoices);

    // *** DEBUG LOG ***
    useEffect(() => {
        console.log(`GameScreen initialized with ${storyLog.length} story entries and ${choices.length} choices`);
        if (choices.length > 0) {
            console.log("Available choices:", choices);
        }
    }, []);

    // Gesture Support Configuration
    const GESTURE_CONFIG = {
        MIN_SWIPE_DISTANCE: 50,
        MAX_SWIPE_TIME: 500,
        MIN_VELOCITY: 0.3,
        VERTICAL_THRESHOLD: 100,
        HORIZONTAL_THRESHOLD: 100
    };

    // Check if device is mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Gesture Detection Functions
    const calculateSwipeGesture = useCallback((start: TouchPosition, end: TouchPosition): SwipeGesture => {
        const deltaX = start.x - end.x;
        const deltaY = start.y - end.y;
        const deltaTime = end.timestamp - start.timestamp;
        
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const velocity = distance / deltaTime;
        
        let direction: SwipeGesture['direction'] = null;
        
        // Determine primary direction
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Horizontal swipe
            if (Math.abs(deltaX) > GESTURE_CONFIG.HORIZONTAL_THRESHOLD) {
                direction = deltaX > 0 ? 'left' : 'right';
            }
        } else {
            // Vertical swipe
            if (Math.abs(deltaY) > GESTURE_CONFIG.VERTICAL_THRESHOLD) {
                direction = deltaY > 0 ? 'up' : 'down';
            }
        }
        
        return { direction, distance, velocity };
    }, []);

    // Touch Event Handlers
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        const touch = e.touches[0];
        setTouchStart({
            x: touch.clientX,
            y: touch.clientY,
            timestamp: Date.now()
        });
        setTouchEnd(null);
    }, []);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!touchStart) return;
        
        const touch = e.touches[0];
        setTouchEnd({
            x: touch.clientX,
            y: touch.clientY,
            timestamp: Date.now()
        });
    }, [touchStart]);

    const handleTouchEnd = useCallback((e: React.TouchEvent) => {
        if (!touchStart || !touchEnd) return;
        
        const gesture = calculateSwipeGesture(touchStart, touchEnd);
        
        if (gesture.direction && gesture.distance > GESTURE_CONFIG.MIN_SWIPE_DISTANCE && gesture.velocity > GESTURE_CONFIG.MIN_VELOCITY) {
            setIsGestureActive(true);
            setGestureDirection(gesture.direction);
            
            // Handle gesture actions
            switch (gesture.direction) {
                case 'left':
                    setIsSidebarOpen(true);
                    break;
                case 'right':
                    setIsSidebarOpen(false);
                    break;
                case 'up':
                    if (isMobile && choices.length > 0) {
                        setIsChoicesModalOpen(true);
                    }
                    break;
            }
            
            // Clear gesture indicators
            setTimeout(() => {
                setIsGestureActive(false);
                setGestureDirection(null);
            }, 300);
        }
        
        setTouchStart(null);
        setTouchEnd(null);
    }, [touchStart, touchEnd, calculateSwipeGesture, isMobile, choices.length]);

    // Parse story text and extract game tags
    const parseStoryAndTags = (storyText: string, updateGameState: boolean = true) => {
        let cleanText = storyText;
        const tagRegex = /\[([A-Z_]+):\s*([^\]]+)\]/g;
        let match;

        while ((match = tagRegex.exec(storyText)) !== null) {
            const [fullMatch, tagName, tagContent] = match;
            
            if (!updateGameState) {
                cleanText = cleanText.replace(fullMatch, '');
                continue;
            }

            try {
                switch (tagName) {
                    case 'TIME_ELAPSED':
                        const timeMatch = tagContent.match(/hours=(\d+)(?:, days=(\d+))?(?:, months=(\d+))?(?:, years=(\d+))?/);
                        if (timeMatch) {
                            const elapsed = {
                                hours: parseInt(timeMatch[1]) || 0,
                                days: parseInt(timeMatch[2]) || 0,
                                months: parseInt(timeMatch[3]) || 0,
                                years: parseInt(timeMatch[4]) || 0
                            };
                            setGameTime(prev => calculateNewTime(prev, elapsed));
                        }
                        break;

                    case 'CHRONICLE_TURN':
                        const turnMatch = tagContent.match(/text="([^"]+)"/);
                        if (turnMatch) {
                            setChronicle(prev => ({
                                ...prev,
                                turn: [...prev.turn, turnMatch[1]]
                            }));
                        }
                        break;

                    case 'CHRONICLE_CHAPTER':
                        const chapterMatch = tagContent.match(/text="([^"]+)"/);
                        if (chapterMatch) {
                            setChronicle(prev => ({
                                ...prev,
                                chapter: [...prev.chapter, chapterMatch[1]]
                            }));
                        }
                        break;

                    case 'CHRONICLE_MEMOIR':
                        const memoirMatch = tagContent.match(/text="([^"]+)"/);
                        if (memoirMatch) {
                            setChronicle(prev => ({
                                ...prev,
                                memoir: [...prev.memoir, memoirMatch[1]]
                            }));
                        }
                        break;

                    case 'LORE_ENTITY':
                        const entityData = parseEntityData(tagContent);
                        if (entityData.name) {
                            setKnownEntities(prev => {
                                const existing = prev[entityData.name];
                                return {
                                    ...prev,
                                    [entityData.name]: existing 
                                        ? { ...existing, ...entityData, lastMentioned: turnCount + 1 }
                                        : { ...entityData, lastMentioned: turnCount + 1 }
                                };
                            });
                        }
                        break;

                    case 'LORE_LOCATION':
                        const locationData = parseEntityData(tagContent);
                        if (locationData.name) {
                            locationData.type = 'location';
                            setKnownEntities(prev => {
                                const existing = prev[locationData.name];
                                if (!existing) {
                                    setLocationDiscoveryOrder(prevOrder => {
                                        if (!prevOrder.includes(locationData.name)) {
                                            return [...prevOrder, locationData.name];
                                        }
                                        return prevOrder;
                                    });
                                }
                                return {
                                    ...prev,
                                    [locationData.name]: existing 
                                        ? { ...existing, ...locationData, lastMentioned: turnCount + 1 }
                                        : { ...locationData, lastMentioned: turnCount + 1 }
                                };
                            });
                        }
                        break;

                    case 'APPLY_STATUS':
                        const statusData = parseStatusData(tagContent);
                        if (statusData.name && statusData.owner) {
                            setStatuses(prev => applyStatusWithLimit(prev, statusData, statusData.owner));
                        }
                        break;

                    case 'REMOVE_STATUS':
                        const removeStatusMatch = tagContent.match(/name="([^"]+)", owner="([^"]+)"/);
                        if (removeStatusMatch) {
                            const [, statusName, owner] = removeStatusMatch;
                            setStatuses(prev => prev.filter(s => !(s.name === statusName && s.owner === owner)));
                        }
                        break;

                    case 'ADD_MEMORY':
                        const memoryMatch = tagContent.match(/text="([^"]+)"/);
                        if (memoryMatch) {
                            setMemories(prev => [...prev, { text: memoryMatch[1], pinned: false }]);
                        }
                        break;

                    case 'UPDATE_QUEST':
                        const questData = parseQuestData(tagContent);
                        if (questData.title) {
                            setQuests(prev => {
                                const existingIndex = prev.findIndex(q => q.title === questData.title);
                                if (existingIndex >= 0) {
                                    const updated = [...prev];
                                    updated[existingIndex] = { ...updated[existingIndex], ...questData };
                                    return updated;
                                } else {
                                    return [...prev, questData as Quest];
                                }
                            });
                        }
                        break;
                }
            } catch (error) {
                console.error(`Error parsing tag ${tagName}:`, error);
            }

            cleanText = cleanText.replace(fullMatch, '');
        }

        return cleanText.trim();
    };

    // Helper functions for parsing
    const parseEntityData = (tagContent: string) => {
        const data: any = {};
        const patterns = {
            name: /name="([^"]+)"/,
            type: /type="([^"]+)"/,
            description: /description="([^"]+)"/,
            location: /location="([^"]+)"/,
            relationship: /relationship="([^"]+)"/,
            gender: /gender="([^"]+)"/,
            age: /age="([^"]+)"/,
            appearance: /appearance="([^"]+)"/,
            personality: /personality="([^"]+)"/,
            motivation: /motivation="([^"]+)"/,
            fame: /fame="([^"]+)"/,
            owner: /owner="([^"]+)"/,
            uses: /uses=(\d+)/,
            realm: /realm="([^"]+)"/,
            durability: /durability=(\d+)/,
            usable: /usable=(true|false)/,
            equippable: /equippable=(true|false)/,
            equipped: /equipped=(true|false)/,
            consumable: /consumable=(true|false)/,
            learnable: /learnable=(true|false)/,
        };

        Object.entries(patterns).forEach(([key, pattern]) => {
            const match = tagContent.match(pattern);
            if (match) {
                if (key === 'uses' || key === 'durability') {
                    data[key] = parseInt(match[1]);
                } else if (key === 'usable' || key === 'equippable' || key === 'equipped' || key === 'consumable' || key === 'learnable') {
                    data[key] = match[1] === 'true';
                } else {
                    data[key] = match[1];
                }
            }
        });

        return data;
    };

    const parseStatusData = (tagContent: string) => {
        const data: any = {};
        const patterns = {
            name: /name="([^"]+)"/,
            description: /description="([^"]+)"/,
            type: /type="([^"]+)"/,
            source: /source="([^"]+)"/,
            duration: /duration="([^"]+)"/,
            effects: /effects="([^"]+)"/,
            owner: /owner="([^"]+)"/,
        };

        Object.entries(patterns).forEach(([key, pattern]) => {
            const match = tagContent.match(pattern);
            if (match) {
                data[key] = match[1];
            }
        });

        return data;
    };

    const parseQuestData = (tagContent: string) => {
        const data: any = { objectives: [] };
        const titleMatch = tagContent.match(/title="([^"]+)"/);
        const statusMatch = tagContent.match(/status="([^"]+)"/);
        const objectivesMatch = tagContent.match(/objectives=\[([^\]]+)\]/);

        if (titleMatch) data.title = titleMatch[1];
        if (statusMatch) data.status = statusMatch[1];
        
        if (objectivesMatch) {
            const objectiveStrings = objectivesMatch[1].split(',').map(s => s.trim().replace(/"/g, ''));
            data.objectives = objectiveStrings.map((obj: string) => {
                const [description, completed] = obj.split(':').map(s => s.trim());
                return {
                    description,
                    completed: completed === 'true'
                };
            });
        }

        return data;
    };

    // Auto-scroll to bottom when new story content is added
    useEffect(() => {
        if (storyContainerRef.current && !isLoading) {
            storyContainerRef.current.scrollTop = storyContainerRef.current.scrollHeight;
        }
    }, [storyLog]);

    // Auto-scroll when story log changes due to loading
    useEffect(() => {
        if (!isAiReady && storyLog.length === 0) {
            setStoryLog(["AI chưa sẵn sàng. Vui lòng kiểm tra API Key và quay về trang chủ."])
            setIsLoading(false);
        } else {
            if (storyContainerRef.current) {
                storyContainerRef.current.scrollTop = storyContainerRef.current.scrollHeight;
            }
        }
    }, [gameHistory, isAiReady]); 

    // Automatic cleanup and history management effect
    useEffect(() => {
        if (turnCount === 0 || (cleanupStats && turnCount <= cleanupStats.lastCleanupTurn)) return;

        const currentState: SaveData = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory,
            lastCompressionTurn: historyStats.compressionCount, // This seems to be used as an indicator, not a turn number
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
                totalEntriesProcessed: prev.totalEntriesProcessed + historyResult.stats.savedEntries,
                totalTokensSaved: prev.totalTokensSaved + (historyResult.compressedSegment!.tokenCount || 0),
                compressionCount: prev.compressionCount + 1,
            }));
        }
    }, [turnCount]);
    
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        story: { type: Type.STRING, description: "Phần văn bản tường thuật của câu chuyện, bao gồm các định dạng đặc biệt và các thẻ lệnh ẩn." },
        choices: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Một mảng gồm 4-5 lựa chọn cho người chơi."
        },
      },
      required: ['story', 'choices']
    };

    const parseApiResponse = (text: string) => {
        try {
            const jsonResponse = JSON.parse(text);
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

        const prompt = `
--- HỆ THỐNG ---
Bạn đang bắt đầu một trò chơi nhập vai mới với thông tin sau:

**Thể loại:** ${worldData.genre}
**Mô tả thế giới:** ${worldData.worldDetail}
**Phong cách viết:** ${writingStyleText}
**Độ khó:** ${worldData.difficulty}
**NSFW:** ${nsfwInstruction}

**Nhân vật chính:**
- Tên: ${worldData.characterName}
- Giới tính: ${worldData.gender}
- Tiểu sử: ${worldData.bio}
- Tính cách: ${finalPersonality}
- Kỹ năng bắt đầu: ${worldData.startSkill || 'Không có kỹ năng đặc biệt'}

${worldData.addGoal ? '**Mục tiêu:** Tạo ra một mục tiêu chính thú vị cho nhân vật.' : ''}

--- LUẬT LỆ TÙY CHỈNH ---
${customRules.filter(rule => rule.isActive).map(rule => rule.content).join('\n')}

--- YÊU CẦU ---
Tạo ra lời mở đầu hấp dẫn và 4-5 lựa chọn hành động đầu tiên. Sử dụng các thẻ lệnh để thiết lập thông tin ban đầu.`;

        try {
            const result = await ai.models.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: prompt,
                generationConfig: {
                    temperature: 0.9,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });

            if (result?.response?.text()) {
                setCurrentTurnTokens(result.response.usageMetadata?.totalTokenCount || 0);
                setTotalTokens(prev => prev + (result.response.usageMetadata?.totalTokenCount || 0));
                
                parseApiResponse(result.response.text());
                setTurnCount(1);
                
                const newGameHistory: GameHistoryEntry = {
                    role: 'model',
                    parts: [{ text: result.response.text() }]
                };
                setGameHistory([newGameHistory]);
            }
        } catch (error) {
            console.error('Error generating initial story:', error);
            setStoryLog(prev => [...prev, "Lỗi: Không thể tạo câu chuyện ban đầu. Vui lòng thử lại."]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isAiReady && gameHistory.length === 0) {
            generateInitialStory();
        }
    }, [isAiReady]);

    const handleAction = async (action: string) => {
        if (isLoading || !ai) return;
        
        setIsLoading(true);
        setStoryLog(prev => [...prev, `> ${action}`]);
        setCustomAction('');
        
        try {
            const playerNsfwRequest = action.toLowerCase().includes('nsfw') ? action : '';
            const ruleChangeContext = ruleChanges ? buildRuleChangeContext(ruleChanges) : '';
            
            const currentGameState: SaveData = {
                worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, historyStats, cleanupStats
            };
            
            const prompt = buildEnhancedRagPrompt(action, currentGameState, ruleChangeContext, playerNsfwRequest);
            
            const result = await ai.models.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: prompt,
                generationConfig: {
                    temperature: 0.85,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                },
            });

            if (result?.response?.text()) {
                setCurrentTurnTokens(result.response.usageMetadata?.totalTokenCount || 0);
                setTotalTokens(prev => prev + (result.response.usageMetadata?.totalTokenCount || 0));
                
                parseApiResponse(result.response.text());
                setTurnCount(prev => prev + 1);
                
                const userEntry: GameHistoryEntry = {
                    role: 'user',
                    parts: [{ text: prompt }]
                };
                const modelEntry: GameHistoryEntry = {
                    role: 'model',
                    parts: [{ text: result.response.text() }]
                };
                
                setGameHistory(prev => [...prev, userEntry, modelEntry]);
                setRuleChanges(null);
            }
        } catch (error: any) {
            console.error('Error calling AI:', error);
            if (error?.message?.includes('429') || error?.message?.includes('rate')) {
                rotateKey();
                setStoryLog(prev => [...prev, "**⭐ Đã tự động chuyển sang API Key tiếp theo. Vui lòng thử lại hành động của bạn. ⭐**"]);
            } else {
                 setStoryLog(prev => [...prev, "Lỗi: AI không thể xử lý yêu cầu. Vui lòng thử một hành động khác."]);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const buildRuleChangeContext = (changes: typeof ruleChanges) => {
        if (!changes) return '';
        
        const parts = [];
        if (changes.activated.length > 0) {
            parts.push(`ACTIVATED RULES: ${changes.activated.map(r => r.content).join('; ')}`);
        }
        if (changes.deactivated.length > 0) {
            parts.push(`DEACTIVATED RULES: ${changes.deactivated.map(r => r.content).join('; ')}`);
        }
        if (changes.updated.length > 0) {
            parts.push(`UPDATED RULES: ${changes.updated.map(u => `${u.oldRule.content} -> ${u.newRule.content}`).join('; ')}`);
        }
        
        return parts.join('\n');
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
                model: 'gemini-2.0-flash-exp',
                contents: `Bối cảnh: "${storyLog.slice(-1)[0]}". Gợi ý một hành động sáng tạo.`,
            });
            setCustomAction(response.response.text().trim());
        } catch (error) {
            console.error("Error suggesting action:", error);
            setCustomAction("Không thể nhận gợi ý lúc này.");
        } finally {
            setIsLoading(false);
        }
    };

    // *** UPDATED handleSaveGame WITH SAVE FIX ***
    const handleSaveGame = () => {
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
    
        // *** FIX: Thêm choices và storyLog vào saveData ***
        const currentGameState: SaveData = { 
            worldData, 
            knownEntities, 
            statuses, 
            quests, 
            gameHistory, 
            memories, 
            party, 
            customRules, 
            systemInstruction, 
            turnCount, 
            totalTokens, 
            gameTime, 
            chronicle, 
            compressedHistory, 
            historyStats, 
            cleanupStats,
            choices,        // *** LƯU CHOICES HIỆN TẠI ***
            storyLog        // *** LƯU STORY LOG HIỆN TẠI ***
        };
        
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
        setTurnCount(0);
        setTotalTokens(0);
        setGameTime({ year: 1, month: 1, day: 1, hour: 8 });
        setChronicle({ memoir: [], chapter: [], turn: [] });
        setRuleChanges(null);
        previousRulesRef.current = initialGameState.customRules;
        setGameHistory([]);
    };

    const handleManualCleanup = useCallback(() => {
        console.log('Triggering manual cleanup...');
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

        setNotification(`🧹 Cleanup complete! Saved ~${Math.round(result.stats.totalTokensSaved / 1000)}k tokens.`);
        setTimeout(() => setNotification(null), 3000);
    }, [worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, historyStats, cleanupStats]);

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
            className="bg-transparent w-full h-full p-0 md:p-4 flex flex-col font-sans text-slate-900 dark:text-white relative" 
            style={{maxHeight: '98vh', height: '98vh'}}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <GameNotifications 
                notification={notification} 
                showSaveSuccess={showSaveSuccess} 
                showRulesSavedSuccess={showRulesSavedSuccess} 
            />
            
            {isMobile && isGestureActive && gestureDirection && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[200] pointer-events-none">
                    <div className="bg-black/80 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                        {gestureDirection === 'left' && '← Swipe Left'}
                        {gestureDirection === 'right' && '→ Swipe Right'}
                        {gestureDirection === 'up' && '↑ Swipe Up'}
                        {gestureDirection === 'down' && '↓ Swipe Down'}
                    </div>
                </div>
            )}
            
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
                    storyContainerRef={storyContainerRef}
                    isLoading={isLoading}
                    isAiReady={isAiReady}
                    storyLength={storyLog.length}
                >
                    {storyLog.map((line, index) => (
                        <OptimizedInteractiveText
                            key={`${index}-${line.substring(0, 10)}`}
                            text={line}
                            onEntityClick={handleEntityClick}
                            knownEntities={knownEntities}
                        />
                    ))}
                </StoryPanel>
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