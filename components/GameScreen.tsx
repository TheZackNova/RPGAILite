



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
        compressedHistory, historyStats, cleanupStats, storyLog, choices, locationDiscoveryOrder,
        setShowSaveSuccess, setStoryLog, setChoices, setStatuses, setQuests, setMemories,
        setKnownEntities, setParty, setCustomRules, setTurnCount, setTotalTokens, setGameTime, setChronicle,
        setRuleChanges, setGameHistory, setHasGeneratedInitialStory, setIsLoading,
        isGeneratingRef, initialGameState, previousRulesRef
    }), [worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, historyStats, cleanupStats, storyLog, choices, locationDiscoveryOrder]);

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
    

    const generateInitialStory = useCallback(async () => {
        if (!pcEntity) return;
        const initialHistory: GameHistoryEntry[] = [];
        await gameActionHandlers.generateInitialStory(worldData, knownEntities, pcEntity, initialHistory);
        isGeneratingRef.current = false;
    }, [gameActionHandlers, worldData, knownEntities, pcEntity]);
        
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