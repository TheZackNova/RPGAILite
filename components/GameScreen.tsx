



import React, { useState, useEffect, useRef, useMemo, useContext, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { AIContext } from '../App.tsx';
import type { SaveData, FormData, KnownEntities, Status, Quest, GameHistoryEntry, Memory, Entity, CustomRule, Chronicle, CompressedHistorySegment } from './types.ts';
import { buildEnhancedRagPrompt } from './promptBuilder.ts';

// Extracted Handlers
import { createGameActionHandlers } from './handlers/gameActionHandlers';
import { createEntityHandlers } from './handlers/entityHandlers';
import { createGameStateHandlers } from './handlers/gameStateHandlers';
import { createCommandTagProcessor } from './utils/commandTagProcessor';
import { partyDebugger } from './utils/partyDebugger';

// Custom Hooks
import { useGameState } from './hooks/useGameState';
import { useModalState } from './hooks/useModalState';
import { useGameSettings } from './hooks/useGameSettings';
import { useHistoryCompression } from './hooks/useHistoryCompression';

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
import { UnifiedMemoryManager } from './utils/UnifiedMemoryManager';
import { MemoryAnalytics } from './utils/MemoryAnalytics';
import { QuestManagementEngine } from './utils/QuestManagementEngine';
import { useDebouncedCallback } from './hooks/useDebounce.ts';
import { OptimizedInteractiveText } from './OptimizedInteractiveText.tsx';

// Helper functions moved to extracted files

export const GameScreen: React.FC<{ 
    initialGameState: SaveData, 
    onBackToMenu: () => void,
    keyRotationNotification: string | null;
    onClearNotification: () => void;
}> = ({ initialGameState, onBackToMenu, keyRotationNotification, onClearNotification }) => {
    const { ai, isAiReady, apiKeyError, rotateKey, isUsingDefaultKey, userApiKeyCount, selectedModel } = useContext(AIContext);
    
    // Refs
    const isGeneratingRef = useRef<boolean>(false);
    const previousRulesRef = useRef<CustomRule[]>(initialGameState.customRules);

    // Rule change tracking
    const [ruleChanges, setRuleChanges] = useState<{ activated: CustomRule[], deactivated: CustomRule[], updated: { oldRule: CustomRule, newRule: CustomRule }[] } | null>(null);

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
                    // We need parseStoryAndTags here, but it's defined later, so we'll use a simplified version
                    const cleanStory = storyText.replace(/\[([A-Z_]+):\s*([^\]]+)\]/g, '').trim();
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
    }, [initialGameState]); 

    // Initialize custom hooks
    const [gameSettingsState, gameSettingsActions] = useGameSettings();
    const [historyCompressionState, historyCompressionActions] = useHistoryCompression(initialGameState);
    const [gameState, gameStateActions] = useGameState(initialGameState, isAiReady, rehydratedLog, rehydratedChoices);
    const [modalState, modalStateActions] = useModalState();

    // Extract values from hooks for easier access
    const {
        worldData, knownEntities, statuses, quests, gameHistory, memories, party,
        customRules, systemInstruction, chronicle, gameTime, turnCount, currentTurnTokens,
        totalTokens, storyLog, choices, locationDiscoveryOrder, isLoading,
        hasGeneratedInitialStory, customAction
    } = gameState;

    const {
        setWorldData, setKnownEntities, setStatuses, setQuests, setGameHistory, setMemories,
        setParty, setCustomRules, setSystemInstruction, setChronicle, setGameTime,
        setTurnCount, setCurrentTurnTokens, setTotalTokens, setStoryLog, setChoices,
        setLocationDiscoveryOrder, setIsLoading, setHasGeneratedInitialStory, setCustomAction
    } = gameStateActions;

    const {
        isHomeModalOpen, isRestartModalOpen, isMemoryModalOpen, isKnowledgeModalOpen,
        isCustomRulesModalOpen, isMapModalOpen, isPcInfoModalOpen, isPartyModalOpen,
        isQuestLogModalOpen, isSidebarOpen, isChoicesModalOpen, isGameSettingsModalOpen,
        activeEntity, activeStatus, activeQuest, showSaveSuccess, showRulesSavedSuccess,
        notification
    } = modalState;

    const {
        setIsHomeModalOpen, setIsRestartModalOpen, setIsMemoryModalOpen, setIsKnowledgeModalOpen,
        setIsCustomRulesModalOpen, setIsMapModalOpen, setIsPcInfoModalOpen, setIsPartyModalOpen,
        setIsQuestLogModalOpen, setIsSidebarOpen, setIsChoicesModalOpen, setIsGameSettingsModalOpen,
        setActiveEntity, setActiveStatus, setActiveQuest, setShowSaveSuccess, setShowRulesSavedSuccess,
        setNotification, modalCloseHandlers
    } = modalStateActions;

    const { gameSettings } = gameSettingsState;
    const { handleSettingsChange } = gameSettingsActions;

    const { compressedHistory, historyStats, cleanupStats } = historyCompressionState;
    const { setCompressedHistory, setHistoryStats, setCleanupStats } = historyCompressionActions;

    // Unified Memory Management State
    const [archivedMemories, setArchivedMemories] = useState<Memory[]>(initialGameState.archivedMemories || []);
    const [memoryStats, setMemoryStats] = useState(initialGameState.memoryStats || {
        totalMemoriesArchived: 0,
        totalMemoriesEnhanced: 0,
        averageImportanceScore: 0,
        lastMemoryCleanupTurn: 0
    });

    const pcEntity = useMemo(() => Object.values(knownEntities).find(e => e.type === 'pc'), [knownEntities]);
    const pcName = pcEntity?.name;
    
    // Initialize handlers with current state
    const commandTagProcessor = useMemo(() => createCommandTagProcessor({
        setGameTime, setChronicle, setMemories, setStatuses, setKnownEntities,
        setQuests, setParty, setLocationDiscoveryOrder,
        knownEntities, statuses, party, turnCount
    }), [knownEntities, statuses, party, turnCount]);
    
    const parseStoryAndTags = useCallback((storyText: string, applySideEffects = true): string => {
        return commandTagProcessor.parseStoryAndTags(storyText, applySideEffects);
    }, [commandTagProcessor]);

    // Define response schema
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

    // Initialize game action handlers
    const gameActionHandlers = useMemo(() => createGameActionHandlers({
        ai, selectedModel, systemInstruction, responseSchema,
        isUsingDefaultKey, userApiKeyCount, rotateKey, rehydratedChoices,
        setIsLoading, setChoices, setCustomAction, setStoryLog, setGameHistory,
        setTurnCount, setCurrentTurnTokens, setTotalTokens,
        gameHistory, customRules, ruleChanges, setRuleChanges, parseStoryAndTags
    }), [ai, selectedModel, systemInstruction, responseSchema, isUsingDefaultKey, userApiKeyCount, rotateKey, rehydratedChoices, gameHistory, customRules, ruleChanges, parseStoryAndTags]);

    // Initialize entity handlers  
    const entityHandlers = useMemo(() => createEntityHandlers({
        knownEntities,
        setActiveEntity,
        setActiveStatus,
        setActiveQuest,
        handleAction: gameActionHandlers.handleAction
    }), [knownEntities, gameActionHandlers]);

    // Initialize game state handlers
    const gameStateHandlers = useMemo(() => createGameStateHandlers({
        worldData, knownEntities, statuses, quests, gameHistory, memories, party,
        customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle,
        compressedHistory, historyStats, cleanupStats, archivedMemories, memoryStats,
        storyLog, choices, locationDiscoveryOrder,
        setShowSaveSuccess, setStoryLog, setChoices, setStatuses, setQuests, setMemories,
        setKnownEntities, setParty, setCustomRules, setTurnCount, setTotalTokens, setGameTime, setChronicle,
        setRuleChanges, setGameHistory, setHasGeneratedInitialStory, setIsLoading,
        isGeneratingRef, initialGameState, previousRulesRef
    }), [worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, historyStats, cleanupStats, archivedMemories, memoryStats, storyLog, choices, locationDiscoveryOrder]);

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

    // Monitor party changes for debugging
    useEffect(() => {
        partyDebugger.monitorPartyChanges(party, statuses, turnCount);
    }, [party, statuses, turnCount]);
    
    // Define generateInitialStory callback before using it
    const generateInitialStory = useCallback(async () => {
        if (!pcEntity) return;
        const initialHistory: GameHistoryEntry[] = [];
        await gameActionHandlers.generateInitialStory(worldData, knownEntities, pcEntity, initialHistory);
        isGeneratingRef.current = false;
    }, [gameActionHandlers, worldData, knownEntities, pcEntity]);
    
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
    }, [isAiReady, hasGeneratedInitialStory, generateInitialStory, gameHistory.length, storyLog.length, apiKeyError]); 

    // Automatic cleanup and history management effect
    useEffect(() => {
        // Add more strict conditions to prevent running during initialization
        if (turnCount === 0 || 
            !hasGeneratedInitialStory || 
            isLoading ||
            gameHistory.length === 0 ||
            (cleanupStats && turnCount <= cleanupStats.lastCleanupTurn)) {
            return;
        }

        const currentState: SaveData = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory,
            lastCompressionTurn: historyStats.compressionCount, // This seems to be used as an indicator, not a turn number
            historyStats, cleanupStats, archivedMemories, memoryStats
        };
        
        // Automatic unified cleanup logic (only if enabled in settings)
        let optimizerResult = null;
        let unifiedCleanupResult = null;
        
        if (gameSettings.memoryAutoClean || gameSettings.historyAutoCompress) {
            // Try unified cleanup first with smart memory generation
            unifiedCleanupResult = UnifiedMemoryManager.coordinatedCleanup(currentState, {
                maxActiveMemories: 50,
                memoryCleanupThreshold: 70,
                lowImportanceThreshold: 30,
                maxActiveHistoryEntries: 30,
                historyCompressionThreshold: 30,
                maxTokenBudget: 8000,
                memoryTokenRatio: 0.3,
                enableSmartMemoryGeneration: true,
                smartMemoryConfig: {
                    enableEventMemories: true,
                    enableRelationshipMemories: true,
                    enableDiscoveryMemories: true,
                    enableCombatMemories: true,
                    enableAchievementMemories: true,
                    minImportanceThreshold: 60,  // Increased from 45 to reduce memory creation
                    maxMemoriesPerTurn: 1,       // Reduced from 2 to limit growth
                    lookbackTurns: 2             // Reduced from 3 to analyze fewer turns
                }
            });
            
            if (unifiedCleanupResult.cleanupTriggered) {
                console.log("🔄 Applying unified auto cleanup...");
                
                // Update memories
                const activeMemories = [...unifiedCleanupResult.memoriesProcessed.kept, ...unifiedCleanupResult.memoriesProcessed.enhanced];
                setMemories(activeMemories);
                
                // Update archived memories
                setArchivedMemories(prev => [...prev, ...unifiedCleanupResult.memoriesProcessed.archived]);
                
                // Update memory stats
                setMemoryStats(prev => ({
                    totalMemoriesArchived: prev.totalMemoriesArchived + unifiedCleanupResult.memoriesProcessed.archived.length,
                    totalMemoriesEnhanced: prev.totalMemoriesEnhanced + unifiedCleanupResult.memoriesProcessed.enhanced.length,
                    averageImportanceScore: UnifiedMemoryManager.getOptimizationStats(activeMemories, archivedMemories).averageImportance,
                    lastMemoryCleanupTurn: turnCount
                }));
                
                // Update history
                setGameHistory(unifiedCleanupResult.historyProcessed.activeEntries);
                
                // Add compressed segment if created
                if (unifiedCleanupResult.historyProcessed.compressed) {
                    setCompressedHistory(prev => [...prev, unifiedCleanupResult.historyProcessed.compressed!]);
                    setHistoryStats(prev => ({
                        ...prev,
                        compressionCount: prev.compressionCount + 1,
                        totalTokensSaved: prev.totalTokensSaved + unifiedCleanupResult.tokensSaved,
                        lastCompressionTurn: turnCount
                    }));
                }
                
                // Run additional entity cleanup
                optimizerResult = GameStateOptimizer.performCleanup(currentState);
                if (optimizerResult.shouldRunCleanup) {
                    const { optimizedState, stats } = optimizerResult;
                    setKnownEntities(optimizedState.knownEntities);
                    setStatuses(optimizedState.statuses);
                    setQuests(optimizedState.quests);
                    setChronicle(optimizedState.chronicle);
                }
                
                setCleanupStats(prev => ({
                    totalCleanupsPerformed: (prev?.totalCleanupsPerformed || 0) + 1,
                    totalTokensSavedFromCleanup: (prev?.totalTokensSavedFromCleanup || 0) + unifiedCleanupResult.tokensSaved + (optimizerResult?.stats.totalTokensSaved || 0),
                    lastCleanupTurn: turnCount,
                    cleanupHistory: [...(prev?.cleanupHistory || []), { 
                        turn: turnCount, 
                        tokensSaved: unifiedCleanupResult.tokensSaved + (optimizerResult?.stats.totalTokensSaved || 0), 
                        itemsRemoved: unifiedCleanupResult.memoriesProcessed.archived.length + (optimizerResult?.stats.memoriesRemoved || 0) + (optimizerResult?.stats.chronicleEntriesRemoved || 0) + (optimizerResult?.stats.questsArchived || 0) + (optimizerResult?.stats.entitiesArchived || 0)
                    }]
                }));
                
                console.log("✅ Unified auto cleanup completed:", {
                    memoriesArchived: unifiedCleanupResult.memoriesProcessed.archived.length,
                    memoriesEnhanced: unifiedCleanupResult.memoriesProcessed.enhanced.length,
                    historyCompressed: !!unifiedCleanupResult.historyProcessed.compressed,
                    tokensSaved: unifiedCleanupResult.tokensSaved
                });
            } else if (gameSettings.memoryAutoClean) {
                // Fallback to legacy cleanup if unified didn't trigger but memory auto clean is enabled
                optimizerResult = GameStateOptimizer.performCleanup(currentState);
                if (optimizerResult.shouldRunCleanup) {
                    console.log("🔄 Applying legacy auto cleanup...");
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
        }

        // Legacy fallback history compression (only if unified cleanup didn't handle it)
        if (gameSettings.historyAutoCompress && (!unifiedCleanupResult || !unifiedCleanupResult.cleanupTriggered)) {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`🔄 [${timestamp}] Legacy Auto History Check:`, {
                turn: turnCount,
                autoCompressEnabled: true,
                currentHistorySize: gameHistory.length
            });
            
            const historyManagerTargetState = optimizerResult?.shouldRunCleanup ? optimizerResult.optimizedState : currentState;
            const historyResult = HistoryManager.manageHistory(historyManagerTargetState.gameHistory, turnCount);
            if (historyResult.shouldCompress && historyResult.compressedSegment) {
                console.log(`📦 [${timestamp}] Legacy Auto Compression Triggered:`, {
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
                    totalTokensSaved: prev.totalTokensSaved + (historyResult.compressedSegment!.tokenCount || 0),
                    compressionCount: prev.compressionCount + 1,
                    lastCompressionTurn: turnCount
                }));
            }
        } else if (!gameSettings.historyAutoCompress) {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`⏸️ [${timestamp}] Auto History Compression Disabled:`, {
                turn: turnCount,
                currentHistorySize: gameHistory.length,
                autoCompressEnabled: false
            });
        }
    }, [turnCount]);
    
    const parseApiResponse = useCallback((text: string) => {
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
    }, [parseStoryAndTags]);
    const handleAction = useCallback(async (action: string) => {
        if (isLoading || !ai) return;
        const currentGameState: SaveData = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory
        };
        await gameActionHandlers.handleAction(action, currentGameState);
    }, [gameActionHandlers, isLoading, ai, worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory]);

    const debouncedHandleAction = useDebouncedCallback((action: string) => {
        handleAction(action);
    }, 300);
    
    const handleEntityClick = useCallback((entityName: string) => entityHandlers.handleEntityClick(entityName), [entityHandlers]);
    const handleUseItem = useCallback((itemName: string) => entityHandlers.handleUseItem(itemName), [entityHandlers]);
    const handleLearnItem = useCallback((itemName: string) => entityHandlers.handleLearnItem(itemName), [entityHandlers]);
    const handleEquipItem = useCallback((itemName: string) => entityHandlers.handleEquipItem(itemName), [entityHandlers]);
    const handleUnequipItem = useCallback((itemName: string) => entityHandlers.handleUnequipItem(itemName), [entityHandlers]);
    const handleStatusClick = useCallback((status: Status) => entityHandlers.handleStatusClick(status), [entityHandlers]);
    const handleToggleMemoryPin = useCallback((index: number) => gameStateHandlers.handleToggleMemoryPin(index), [gameStateHandlers]);
    const handleQuestClick = useCallback((quest: Quest) => entityHandlers.handleQuestClick(quest), [entityHandlers]);
    
    const handleSuggestAction = useCallback(async () => {
        await gameActionHandlers.handleSuggestAction(storyLog);
    }, [gameActionHandlers, storyLog]);

    const handleSaveGame = useCallback(() => {
        gameStateHandlers.handleSaveGame();
    }, [gameStateHandlers]);

    const handleSaveRules = useCallback((newRules: CustomRule[]) => {
        gameStateHandlers.handleSaveRules(newRules, setShowRulesSavedSuccess);
    }, [gameStateHandlers]);

    const handleRestartGame = useCallback(() => {
        setIsRestartModalOpen(false);
        gameStateHandlers.handleRestartGame();
    }, [gameStateHandlers]);

    // Font settings are now handled in useGameSettings hook

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
        console.log(`🧹 [${timestamp}] Manual Unified Cleanup Started:`, {
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
            historyStats, cleanupStats, archivedMemories, memoryStats
        };
        
        // Use unified memory manager for coordinated cleanup with aggressive smart memory generation
        const unifiedResult = UnifiedMemoryManager.coordinatedCleanup(currentState, {
            maxActiveMemories: 40,
            memoryCleanupThreshold: 60,
            lowImportanceThreshold: 25,
            maxActiveHistoryEntries: 25,
            historyCompressionThreshold: 25,
            maxTokenBudget: 8000,
            memoryTokenRatio: 0.35,
            enableSmartMemoryGeneration: true,
            smartMemoryConfig: {
                enableEventMemories: true,
                enableRelationshipMemories: true,
                enableDiscoveryMemories: true,
                enableCombatMemories: true,
                enableAchievementMemories: true,
                minImportanceThreshold: 35, // Lower threshold for manual cleanup
                maxMemoriesPerTurn: 5,      // More memories for manual cleanup
                lookbackTurns: 10           // Longer lookback for manual cleanup
            }
        });
        
        // Apply unified cleanup results
        if (unifiedResult.cleanupTriggered) {
            // Update memories
            const activeMemories = [...unifiedResult.memoriesProcessed.kept, ...unifiedResult.memoriesProcessed.enhanced];
            setMemories(activeMemories);
            
            // Update archived memories
            setArchivedMemories(prev => [...prev, ...unifiedResult.memoriesProcessed.archived]);
            
            // Update memory stats
            setMemoryStats(prev => ({
                totalMemoriesArchived: prev.totalMemoriesArchived + unifiedResult.memoriesProcessed.archived.length,
                totalMemoriesEnhanced: prev.totalMemoriesEnhanced + unifiedResult.memoriesProcessed.enhanced.length,
                averageImportanceScore: UnifiedMemoryManager.getOptimizationStats(activeMemories, archivedMemories).averageImportance,
                lastMemoryCleanupTurn: turnCount
            }));
            
            // Update history
            setGameHistory(unifiedResult.historyProcessed.activeEntries);
            
            // Add compressed segment if created
            if (unifiedResult.historyProcessed.compressed) {
                setCompressedHistory(prev => [...prev, unifiedResult.historyProcessed.compressed!]);
                setHistoryStats(prev => ({
                    ...prev,
                    compressionCount: prev.compressionCount + 1,
                    totalTokensSaved: prev.totalTokensSaved + unifiedResult.tokensSaved,
                    lastCompressionTurn: turnCount
                }));
            }
            
            // Run additional entity cleanup
            const legacyResult = GameStateOptimizer.forceCleanup(currentState, true);
            setKnownEntities(legacyResult.optimizedState.knownEntities);
            setStatuses(legacyResult.optimizedState.statuses);
            setQuests(legacyResult.optimizedState.quests);
            setChronicle(legacyResult.optimizedState.chronicle);
            
            setCleanupStats(prev => ({
                ...prev!,
                totalCleanupsPerformed: (prev?.totalCleanupsPerformed || 0) + 1,
                totalTokensSavedFromCleanup: (prev?.totalTokensSavedFromCleanup || 0) + unifiedResult.tokensSaved + legacyResult.stats.totalTokensSaved,
                lastCleanupTurn: turnCount,
            }));

            console.log(`✅ [${timestamp}] Unified Cleanup Completed:`, {
                turn: turnCount,
                unifiedCleanup: {
                    memoriesArchived: unifiedResult.memoriesProcessed.archived.length,
                    memoriesEnhanced: unifiedResult.memoriesProcessed.enhanced.length,
                    memoriesKept: unifiedResult.memoriesProcessed.kept.length,
                    smartMemoriesGenerated: unifiedResult.smartMemoriesGenerated?.memories.length || 0,
                    historyCompressed: !!unifiedResult.historyProcessed.compressed,
                    tokensSaved: unifiedResult.tokensSaved
                },
                legacyCleanup: {
                    entitiesRemoved: Object.keys(knownEntities).length - Object.keys(legacyResult.optimizedState.knownEntities).length,
                    statusesRemoved: statuses.length - legacyResult.optimizedState.statuses.length,
                    questsRemoved: quests.length - legacyResult.optimizedState.quests.length
                },
                totalTokensSaved: unifiedResult.tokensSaved + legacyResult.stats.totalTokensSaved
            });

            setNotification(`🧹 Unified cleanup complete! Saved ~${Math.round((unifiedResult.tokensSaved + legacyResult.stats.totalTokensSaved) / 1000)}k tokens.`);
        } else {
            // Fallback to legacy cleanup if unified didn't trigger
            const result = GameStateOptimizer.forceCleanup(currentState, true);
            setKnownEntities(result.optimizedState.knownEntities);
            setStatuses(result.optimizedState.statuses);
            setQuests(result.optimizedState.quests);
            setMemories(result.optimizedState.memories);
            setChronicle(result.optimizedState.chronicle);
            
            setNotification(`🧹 Legacy cleanup complete! Saved ~${Math.round(result.stats.totalTokensSaved / 1000)}k tokens.`);
        }
        
        setTimeout(() => setNotification(null), 4000);
    }, [worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, historyStats, cleanupStats, archivedMemories, memoryStats]);

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
    }, [turnCount, gameSettings.historyAutoCompress, gameSettings.memoryAutoClean, hasGeneratedInitialStory, isLoading]);

    // Phase 4: Memory Analytics and Insights
    const analyzeMemories = useCallback(() => {
        const currentState: SaveData = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory,
            lastCompressionTurn: historyStats.compressionCount, 
            historyStats, cleanupStats, archivedMemories, memoryStats
        };
        
        const analytics = MemoryAnalytics.analyzeMemories(currentState);
        
        console.log('🔍 Memory Analytics Results:', analytics);
        
        // Show insights as notifications
        if (analytics.insights.length > 0) {
            const topInsight = analytics.insights[0];
            setNotification(`📊 Memory Insight: ${topInsight.title} - ${topInsight.description}`);
        } else {
            setNotification(`📊 Memory Analysis: ${analytics.overview.totalMemories} memories, ${analytics.overview.averageImportance.toFixed(1)} avg importance, ${analytics.overview.memoryHealth} health`);
        }
        
        setTimeout(() => setNotification(null), 6000);
    }, [worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, historyStats, cleanupStats, archivedMemories, memoryStats]);

    // Manual smart memory generation for testing
    const generateSmartMemories = useCallback(() => {
        const currentState: SaveData = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory,
            lastCompressionTurn: historyStats.compressionCount, 
            historyStats, cleanupStats, archivedMemories, memoryStats
        };
        
        const result = UnifiedMemoryManager.generateSmartMemories(currentState, {
            enableEventMemories: true,
            enableRelationshipMemories: true,
            enableDiscoveryMemories: true,
            enableCombatMemories: true,
            enableAchievementMemories: true,
            minImportanceThreshold: 30,
            maxMemoriesPerTurn: 10,
            lookbackTurns: 10
        });
        
        if (result.memories.length > 0) {
            setMemories(prev => [...prev, ...result.memories]);
            setNotification(`🧠 Generated ${result.memories.length} smart memories! ${result.insights.join(', ')}`);
            console.log('🧠 Smart Memory Generation Result:', result);
        } else {
            setNotification(`🧠 No new smart memories generated from recent events.`);
        }
        
        setTimeout(() => setNotification(null), 5000);
    }, [worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, historyStats, cleanupStats, archivedMemories, memoryStats]);

    // Phase 5: AI-Driven Quest Generation
    // Track if quest generation is in progress to prevent duplicates
    const [isGeneratingQuests, setIsGeneratingQuests] = useState(false);

    const generateQuestsFromMemories = useCallback(async () => {
        if (!ai) {
            setNotification('❌ AI không khả dụng cho quest generation');
            return;
        }

        // Prevent concurrent quest generation calls
        if (isGeneratingQuests) {
            setNotification('⏳ Quest generation đang chạy, vui lòng đợi...');
            return;
        }

        setIsGeneratingQuests(true);

        const currentState: SaveData = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory,
            lastCompressionTurn: historyStats.compressionCount, 
            historyStats, cleanupStats, archivedMemories, memoryStats
        };

        try {
            setNotification('🎯 Đang phân tích memories để tạo quest...');
            
            const result = await QuestManagementEngine.generateQuestsFromMemories(currentState, ai, selectedModel);
            
            if (result.success && result.integration?.integratedQuests.length > 0) {
                const questCount = result.integration.integratedQuests.length;
                const questTitles = result.integration.integratedQuests.map((q: any) => q.title).join(', ');
                
                setNotification(`🎯 Đã tạo ${questCount} quest mới: ${questTitles}`);
                console.log('🎯 Quest Generation Success:', result);
                
                // Update React state with new quests
                console.log('🔄 Updating React state with new quests:', result.integration.integratedQuests.map((q: any) => q.title));
                setQuests(prev => {
                    // Deduplicate by uniqueId to prevent React key conflicts
                    const existingIds = new Set(prev.map((q: any) => 
                        q.generationMetadata?.uniqueId || `${q.title}_${q.description.slice(0, 20)}`
                    ));
                    
                    const newUniqueQuests = result.integration.integratedQuests.filter((q: any) => {
                        const questId = q.generationMetadata?.uniqueId || `${q.title}_${q.description.slice(0, 20)}`;
                        return !existingIds.has(questId);
                    });
                    
                    console.log('🔄 New unique quests to add:', newUniqueQuests.length);
                    console.log('🔄 Filtered out duplicates:', result.integration.integratedQuests.length - newUniqueQuests.length);
                    
                    const newQuests = [...prev, ...newUniqueQuests];
                    console.log('🔄 Total quest count after update:', newQuests.length);
                    return newQuests;
                });
                
                // Update memories if new ones were created with deduplication
                if (result.integration.createdMemories.length > 0) {
                    console.log('🔄 Updating React state with new memories:', result.integration.createdMemories.length);
                    setMemories(prev => {
                        // Create a map of existing memory texts for fast lookup
                        const existingTexts = new Set(prev.map(m => m.text));
                        
                        // Filter out duplicate memories by text content
                        const uniqueMemories = result.integration.createdMemories.filter((memory: any) => 
                            !existingTexts.has(memory.text)
                        );
                        
                        console.log('🔄 New unique memories to add:', uniqueMemories.length);
                        console.log('🔄 Filtered out duplicate memories:', result.integration.createdMemories.length - uniqueMemories.length);
                        
                        return [...prev, ...uniqueMemories];
                    });
                }
                
            } else if (result.warnings.length > 0) {
                setNotification(`⚠️ Quest Generation: ${result.warnings[0]}`);
            } else if (result.errors.length > 0) {
                setNotification(`❌ Quest Generation Error: ${result.errors[0]}`);
            } else {
                setNotification('ℹ️ Không tìm thấy cơ hội quest từ memories hiện tại');
            }
            
            setTimeout(() => setNotification(null), 8000);
            
        } catch (error) {
            console.error('Quest generation error:', error);
            setNotification('❌ Lỗi khi tạo quest. Xem console để biết chi tiết.');
            setTimeout(() => setNotification(null), 5000);
        } finally {
            setIsGeneratingQuests(false);
        }
    }, [ai, selectedModel, worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, historyStats, cleanupStats, archivedMemories, memoryStats, isGeneratingQuests]);

    const analyzeQuestOpportunities = useCallback(() => {
        const currentState: SaveData = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory,
            lastCompressionTurn: historyStats.compressionCount, 
            historyStats, cleanupStats, archivedMemories, memoryStats
        };

        const analysis = QuestManagementEngine.analyzeQuestOpportunities(currentState);
        
        console.log('🔍 Quest Opportunity Analysis:', analysis);
        
        if (analysis.seeds.length > 0) {
            const highPrioritySeeds = analysis.seeds.filter(s => s.priority === 'high').length;
            const questTypes = [...new Set(analysis.seeds.map(s => s.type))].join(', ');
            
            setNotification(`🔍 Tìm thấy ${analysis.seeds.length} cơ hội quest (${highPrioritySeeds} ưu tiên cao). Loại: ${questTypes}`);
        } else {
            setNotification('🔍 Không tìm thấy cơ hội quest nào từ memories hiện tại');
        }
        
        setTimeout(() => setNotification(null), 6000);
    }, [worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, historyStats, cleanupStats, archivedMemories, memoryStats]);

    const generateQuickQuest = useCallback(async (questType?: 'consequence' | 'mystery' | 'exploration' | 'character_arc') => {
        if (!ai) {
            setNotification('❌ AI không khả dụng cho quest generation');
            return;
        }

        // Prevent concurrent quest generation calls
        if (isGeneratingQuests) {
            setNotification('⏳ Quest generation đang chạy, vui lòng đợi...');
            return;
        }

        setIsGeneratingQuests(true);

        const currentState: SaveData = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory,
            lastCompressionTurn: historyStats.compressionCount, 
            historyStats, cleanupStats, archivedMemories, memoryStats
        };

        try {
            setNotification(`🚀 Đang tạo quest nhanh${questType ? ` loại ${questType}` : ''}...`);
            
            const result = await QuestManagementEngine.generateQuickQuest(currentState, ai, selectedModel, questType);
            
            if (result.success && result.integration?.integratedQuests.length > 0) {
                const quest = result.integration.integratedQuests[0];
                setNotification(`🚀 Quest nhanh đã tạo: "${quest.title}"`);
            } else {
                setNotification('❌ Không thể tạo quest nhanh. Xem console để biết chi tiết.');
            }
            
        } catch (error) {
            console.error('Quick quest generation error:', error);
            setNotification('❌ Lỗi khi tạo quest nhanh');
        } finally {
            setIsGeneratingQuests(false);
        }
        
        setTimeout(() => setNotification(null), 5000);
    }, [ai, selectedModel, worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, historyStats, cleanupStats, archivedMemories, memoryStats, isGeneratingQuests]);

    const generateQuestsWithModel = useCallback(async (modelName: string) => {
        if (!ai) {
            setNotification('❌ AI không khả dụng cho quest generation');
            return;
        }

        // Prevent concurrent quest generation calls
        if (isGeneratingQuests) {
            setNotification('⏳ Quest generation đang chạy, vui lòng đợi...');
            return;
        }

        setIsGeneratingQuests(true);

        const currentState: SaveData = {
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory,
            lastCompressionTurn: historyStats.compressionCount, 
            historyStats, cleanupStats, archivedMemories, memoryStats
        };

        try {
            setNotification(`🎯 Đang tạo quest với model ${modelName}...`);
            
            const result = await QuestManagementEngine.generateQuestsFromMemories(currentState, ai, modelName);
            
            if (result.success && result.integration?.integratedQuests.length > 0) {
                const questCount = result.integration.integratedQuests.length;
                const quest = result.integration.integratedQuests[0];
                const modelUsed = quest.generationMetadata?.modelUsed || modelName;
                
                setNotification(`🎯 Đã tạo ${questCount} quest với ${modelUsed}: "${quest.title}"`);
                console.log('🎯 Quest Generation Success with model:', modelUsed, result);
                
                // Update React state with new quests
                // Update React state with deduplication
                setQuests(prev => {
                    const existingIds = new Set(prev.map((q: any) => 
                        q.generationMetadata?.uniqueId || `${q.title}_${q.description.slice(0, 20)}`
                    ));
                    
                    const newUniqueQuests = result.integration.integratedQuests.filter((q: any) => {
                        const questId = q.generationMetadata?.uniqueId || `${q.title}_${q.description.slice(0, 20)}`;
                        return !existingIds.has(questId);
                    });
                    
                    return [...prev, ...newUniqueQuests];
                });
                
                // Update memories if new ones were created
                if (result.integration.createdMemories.length > 0) {
                    // Update memories with deduplication
                    setMemories(prev => {
                        const existingTexts = new Set(prev.map(m => m.text));
                        const uniqueMemories = result.integration.createdMemories.filter((memory: any) => 
                            !existingTexts.has(memory.text)
                        );
                        return [...prev, ...uniqueMemories];
                    });
                }
                
            } else if (result.warnings.length > 0) {
                setNotification(`⚠️ Quest Generation: ${result.warnings[0]}`);
            } else if (result.errors.length > 0) {
                setNotification(`❌ Quest Generation Error: ${result.errors[0]}`);
            }
            
            setTimeout(() => setNotification(null), 8000);
            
        } catch (error) {
            console.error('Quest generation error:', error);
            setNotification(`❌ Lỗi khi tạo quest với ${modelName}`);
            setTimeout(() => setNotification(null), 5000);
        } finally {
            setIsGeneratingQuests(false);
        }
    }, [ai, worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, historyStats, cleanupStats, archivedMemories, memoryStats, isGeneratingQuests]);

    // Expose debug functions to window for manual testing
    React.useEffect(() => {
        (window as any).debugGameSystems = debugSystemStatus;
        (window as any).generateSmartMemories = generateSmartMemories;
        (window as any).analyzeMemories = analyzeMemories;
        (window as any).generateQuestsFromMemories = generateQuestsFromMemories;
        
        // Debug function to clean duplicate quests
        (window as any).cleanDuplicateQuests = () => {
            setQuests(prev => {
                const uniqueQuests = [];
                const seenIds = new Set();
                
                for (const quest of prev) {
                    const questId = quest.generationMetadata?.uniqueId || `${quest.title}_${quest.description.slice(0, 20)}`;
                    if (!seenIds.has(questId)) {
                        seenIds.add(questId);
                        uniqueQuests.push(quest);
                    }
                }
                
                console.log(`🧹 Cleaned duplicate quests: ${prev.length} → ${uniqueQuests.length}`);
                setNotification(`🧹 Đã xóa ${prev.length - uniqueQuests.length} quest trùng lặp`);
                setTimeout(() => setNotification(null), 3000);
                
                return uniqueQuests;
            });
        };

        // Debug function to clean duplicate memories
        (window as any).cleanDuplicateMemories = () => {
            setMemories(prev => {
                const uniqueMemories = [];
                const seenTexts = new Set();
                
                for (const memory of prev) {
                    if (!seenTexts.has(memory.text)) {
                        seenTexts.add(memory.text);
                        uniqueMemories.push(memory);
                    }
                }
                
                console.log(`🧹 Cleaned duplicate memories: ${prev.length} → ${uniqueMemories.length}`);
                setNotification(`🧹 Đã xóa ${prev.length - uniqueMemories.length} memory trùng lặp`);
                setTimeout(() => setNotification(null), 3000);
                
                return uniqueMemories;
            });
        };
        (window as any).analyzeQuestOpportunities = analyzeQuestOpportunities;
        (window as any).generateQuickQuest = generateQuickQuest;
        (window as any).generateQuestsWithModel = generateQuestsWithModel;
        return () => {
            delete (window as any).debugGameSystems;
            delete (window as any).generateSmartMemories;
            delete (window as any).analyzeMemories;
            delete (window as any).generateQuestsFromMemories;
            delete (window as any).cleanDuplicateQuests;
            delete (window as any).cleanDuplicateMemories;
            delete (window as any).analyzeQuestOpportunities;
            delete (window as any).generateQuickQuest;
            delete (window as any).generateQuestsWithModel;
        };
    }, [debugSystemStatus, generateSmartMemories, analyzeMemories, generateQuestsFromMemories, analyzeQuestOpportunities, generateQuickQuest, generateQuestsWithModel]);

    
    const hasActiveQuests = quests.some(q => q.status === 'active');
    const pcStatuses = statuses.filter(s => s.owner === 'pc' || (pcName && s.owner === pcName));
    const displayParty = party.filter(p => p.name !== pcName);
    const isCustomActionLocked = useMemo(() => customRules.some(rule => rule.isActive && rule.content.toUpperCase().includes('KHÓA HÀNH ĐỘNG TÙY Ý')), [customRules]);
    
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