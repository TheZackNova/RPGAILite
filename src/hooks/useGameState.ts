import { useState, useCallback, useRef } from 'react';
import { 
    Entity, 
    Status, 
    Quest, 
    Memory, 
    CustomRule, 
    GameHistoryEntry, 
    SaveData,
    KnownEntities,
    FormData
} from '../types';

// Import utilities (these would need to be created/imported from the actual codebase)
interface Chronicle {
    memoir: string[];
    chapter: string[];
    turn: string[];
}

interface GameTime {
    year: number;
    month: number;
    day: number;
    hour: number;
}

interface CompressedHistorySegment {
    summary: string;
    tokenCount: number;
    turnRange: { start: number; end: number };
}

interface CleanupStats {
    totalTokensSaved: number;
    totalCleanupsPerformed: number;
    lastCleanupTurn: number;
    cleanupHistory: any[];
}

interface CleanupConfig {
    maxUnpinnedMemories: number;
    maxTotalMemories: number;
    maxMemoirEntries: number;
    maxChapterEntries: number;
    maxTurnEntries: number;
    maxCompletedQuests: number;
    questRetentionTurns: number;
    maxStatusesPerEntity: number;
    removeExpiredStatuses: boolean;
    maxInactiveEntities: number;
    entityInactivityThreshold: number;
    cleanupInterval: number;
}

interface UseGameStateProps {
    initialGameState: SaveData;
    ai: any; // GoogleGenAI instance
    isAiReady: boolean;
    systemInstruction: string;
    isUsingDefaultKey: boolean;
    userApiKeyCount: number;
    rotateKey: () => void;
}

interface UseGameStateReturn {
    // Game State
    worldData: FormData;
    setWorldData: (data: FormData) => void;
    knownEntities: KnownEntities;
    setKnownEntities: (entities: KnownEntities) => void;
    statuses: Status[];
    setStatuses: (statuses: Status[]) => void;
    quests: Quest[];
    setQuests: (quests: Quest[]) => void;
    gameHistory: GameHistoryEntry[];
    setGameHistory: (history: GameHistoryEntry[]) => void;
    turnCount: number;
    setTurnCount: (count: number) => void;
    memories: Memory[];
    setMemories: (memories: Memory[]) => void;
    party: Entity[];
    setParty: (party: Entity[]) => void;
    customRules: CustomRule[];
    setCustomRules: (rules: CustomRule[]) => void;
    systemInstruction: string;
    setSystemInstruction: (instruction: string) => void;
    chronicle: Chronicle;
    setChronicle: (chronicle: Chronicle) => void;
    gameTime: GameTime;
    setGameTime: (time: GameTime) => void;
    storyLog: string[];
    setStoryLog: (log: string[]) => void;
    choices: string[];
    setChoices: (choices: string[]) => void;
    
    // UI State
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    customAction: string;
    setCustomAction: (action: string) => void;
    currentTurnTokens: number;
    setCurrentTurnTokens: (tokens: number) => void;
    totalTokens: number;
    setTotalTokens: (tokens: number) => void;
    
    // Modal States
    isHomeModalOpen: boolean;
    setIsHomeModalOpen: (open: boolean) => void;
    isRestartModalOpen: boolean;
    setIsRestartModalOpen: (open: boolean) => void;
    activeEntity: Entity | null;
    setActiveEntity: (entity: Entity | null) => void;
    activeStatus: Status | null;
    setActiveStatus: (status: Status | null) => void;
    isMemoryModalOpen: boolean;
    setIsMemoryModalOpen: (open: boolean) => void;
    isKnowledgeModalOpen: boolean;
    setIsKnowledgeModalOpen: (open: boolean) => void;
    isCustomRulesModalOpen: boolean;
    setIsCustomRulesModalOpen: (open: boolean) => void;
    isMapModalOpen: boolean;
    setIsMapModalOpen: (open: boolean) => void;
    activeQuest: Quest | null;
    setActiveQuest: (quest: Quest | null) => void;
    showSaveSuccess: boolean;
    setShowSaveSuccess: (show: boolean) => void;
    showRulesSavedSuccess: boolean;
    setShowRulesSavedSuccess: (show: boolean) => void;
    isPcInfoModalOpen: boolean;
    setIsPcInfoModalOpen: (open: boolean) => void;
    isPartyModalOpen: boolean;
    setIsPartyModalOpen: (open: boolean) => void;
    isQuestLogModalOpen: boolean;
    setIsQuestLogModalOpen: (open: boolean) => void;
    isSidebarOpen: boolean;
    setIsSidebarOpen: (open: boolean) => void;
    isChoicesModalOpen: boolean;
    setIsChoicesModalOpen: (open: boolean) => void;
    notification: string | null;
    setNotification: (notification: string | null) => void;
    
    // Advanced State
    locationDiscoveryOrder: string[];
    setLocationDiscoveryOrder: (order: string[]) => void;
    cleanupStats: CleanupStats;
    setCleanupStats: (stats: CleanupStats) => void;
    totalCleanupStats: CleanupStats;
    setTotalCleanupStats: (stats: CleanupStats) => void;
    compressedHistory: CompressedHistorySegment[];
    setCompressedHistory: (history: CompressedHistorySegment[]) => void;
    lastCompressionTurn: number;
    setLastCompressionTurn: (turn: number) => void;
    historyStats: any;
    setHistoryStats: (stats: any) => void;
    ruleChanges: any;
    setRuleChanges: (changes: any) => void;
    
    // Functions
    handleAction: (action: string) => Promise<void>;
    handleEntityClick: (entityName: string) => void;
    handleUseItem: (itemName: string) => void;
    handleLearnItem: (itemName: string) => void;
    handleEquipItem: (itemName: string) => void;
    handleUnequipItem: (itemName: string) => void;
    handleStatusClick: (status: Status) => void;
    handleQuestClick: (quest: Quest) => void;
    handleToggleMemoryPin: (index: number) => void;
    generateInitialStory: () => Promise<void>;
    handleSaveGame: () => void;
    handleRestartGame: () => void;
    handleSaveRules: (rules: CustomRule[]) => void;
    handleManualCleanup: (aggressive?: boolean) => void;
    handleSuggestAction: () => Promise<void>;
}

export const useGameState = ({
    initialGameState,
    ai,
    isAiReady,
    systemInstruction: initialSystemInstruction,
    isUsingDefaultKey,
    userApiKeyCount,
    rotateKey
}: UseGameStateProps): UseGameStateReturn => {
    
    // Basic state
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
    const [chronicle, setChronicle] = useState<Chronicle>(initialGameState.chronicle as Chronicle);
    const [gameTime, setGameTime] = useState(initialGameState.gameTime || { year: 1, month: 1, day: 1, hour: 8 });
    const [currentTurnTokens, setCurrentTurnTokens] = useState<number>(0);
    const [totalTokens, setTotalTokens] = useState<number>(initialGameState.totalTokens || 0);

    // Data Rehydration State with lazy initializers
    const [storyLog, setStoryLog] = useState<string[]>(() => {
        const typedInitialState = initialGameState as any;
        if (typedInitialState.storyLog?.length > 0) {
            return typedInitialState.storyLog;
        }

        const log: string[] = [];
        initialGameState.gameHistory.forEach(entry => {
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
                    // Simple tag stripper for rehydration
                    const cleanStory = storyText.replace(/\[([A-Z_]+):\s*([^\]]+)\]/g, '').trim();
                    if (cleanStory) {
                        log.push(cleanStory);
                    }
                } catch (e) {
                    const cleanText = entry.parts[0].text.replace(/\[([A-Z_]+):\s*([^\]]+)\]/g, '').trim();
                    log.push(cleanText);
                }
            }
        });
        return log;
    });

    const [choices, setChoices] = useState<string[]>(() => {
        const lastModelEntry = [...initialGameState.gameHistory].reverse().find(e => e.role === 'model');
        if (lastModelEntry) {
            try {
                const jsonResponse = JSON.parse(lastModelEntry.parts[0].text);
                return jsonResponse.choices || [];
            } catch (e) {
                return [];
            }
        }
        const typedInitialState = initialGameState as any;
        return typedInitialState.choices || [];
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

    // Cleanup State
    const getEmptyStats = (): CleanupStats => ({
        totalTokensSaved: 0,
        totalCleanupsPerformed: 0,
        lastCleanupTurn: 0,
        cleanupHistory: []
    });

    const [cleanupStats, setCleanupStats] = useState<CleanupStats>(getEmptyStats());
    const [totalCleanupStats, setTotalCleanupStats] = useState(initialGameState.cleanupStats || { 
        totalCleanupsPerformed: 0, 
        totalTokensSavedFromCleanup: 0, 
        lastCleanupTurn: 0, 
        cleanupHistory: [] 
    });

    // History Compression State
    const [compressedHistory, setCompressedHistory] = useState<CompressedHistorySegment[]>(
        (initialGameState as any).compressedHistory || []
    );
    const [lastCompressionTurn, setLastCompressionTurn] = useState(
        (initialGameState as any).lastCompressionTurn || 0
    );
    const [historyStats, setHistoryStats] = useState(
        (initialGameState as any).historyStats || { 
            totalEntriesProcessed: 0, 
            totalTokensSaved: 0, 
            compressionCount: 0 
        }
    );

    // Rule change tracking
    const [ruleChanges, setRuleChanges] = useState<any>(null);
    const previousRulesRef = useRef<CustomRule[]>(initialGameState.customRules);

    // Utility functions that would need to be imported from actual utilities
    const buildEnhancedRagPrompt = (action: string, gameState: SaveData, ruleContext: string, nsfwInstruction: string) => {
        // This would be implemented based on the actual utility function
        return `${ruleContext}--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---\n"${action}"${nsfwInstruction}`;
    };

    const parseStoryAndTags = useCallback((storyText: string, applySideEffects: boolean) => {
        // This would contain the actual parsing logic for AI responses
        // For now, just return cleaned story
        return storyText.replace(/\[([A-Z_]+):\s*([^\]]+)\]/g, '').trim();
    }, []);

    const parseApiResponse = useCallback((text: string) => {
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
    }, [parseStoryAndTags]);

    // Main action handler
    const handleAction = useCallback(async (action: string) => {
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
        if (ruleChanges) { setRuleChanges(null); }
        
        let nsfwInstructionPart = isNsfwRequest && worldData.allowNsfw ? `\nLƯU Ý ĐẶC BIỆT: Người chơi yêu cầu nội dung 18+` : '';
        
        const currentGameState: SaveData = { 
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, 
            systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, 
            lastCompressionTurn, historyStats 
        };
        
        const userPrompt = buildEnhancedRagPrompt(originalAction, currentGameState, ruleChangeContext, nsfwInstructionPart);
        const newUserEntry: GameHistoryEntry = { role: 'user', parts: [{ text: userPrompt }] };
        const historyForApi = [...gameHistory, newUserEntry];
        
        try {
            const response = await ai.models.generateContent({ 
                model: 'gemini-2.5-flash', 
                contents: historyForApi, 
                config: { 
                    systemInstruction, 
                    responseMimeType: "application/json", 
                    maxOutputTokens: 4096
                } 
            });
            
            const turnTokens = response.usageMetadata?.totalTokenCount || 0;
            setCurrentTurnTokens(turnTokens);
            setTotalTokens(prev => prev + turnTokens);
            
            if (turnTokens > 80000) { 
                console.warn(`⚠️ Token vượt giới hạn: ${turnTokens.toLocaleString()}/80,000`); 
                setNotification(`🚨 Cảnh báo: Lượt này sử dụng ${turnTokens.toLocaleString()} tokens (vượt 80k)`); 
                setTimeout(() => setNotification(null), 8000); 
            } else if (turnTokens > 70000) { 
                console.log(`⚠️ Token gần giới hạn: ${turnTokens.toLocaleString()}/80,000`); 
                setNotification(`⚠️ Thông báo: Token sử dụng cao (${turnTokens.toLocaleString()}/80k)`); 
                setTimeout(() => setNotification(null), 5000); 
            }
            
            const responseText = response.text.trim();
            parseApiResponse(responseText);
            const modelEntry: GameHistoryEntry = { role: 'model', parts: [{ text: responseText }] };
            const newFullHistory = [...historyForApi, modelEntry];
            
            setGameHistory(newFullHistory);
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
    }, [
        isLoading, ai, ruleChanges, worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, 
        systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, lastCompressionTurn, 
        historyStats, isUsingDefaultKey, userApiKeyCount, rotateKey, parseApiResponse
    ]);

    // Entity and item handlers
    const handleEntityClick = useCallback((entityName: string) => 
        setActiveEntity(knownEntities[entityName] || null), [knownEntities]);

    const handleUseItem = useCallback((itemName: string) => { 
        setActiveEntity(null); 
        setTimeout(() => handleAction(`Sử dụng vật phẩm: ${itemName}`), 100); 
    }, [handleAction]);

    const handleLearnItem = useCallback((itemName: string) => { 
        setActiveEntity(null); 
        setTimeout(() => handleAction(`Học công pháp: ${itemName}`), 100); 
    }, [handleAction]);

    const handleEquipItem = useCallback((itemName: string) => { 
        setActiveEntity(null); 
        setTimeout(() => handleAction(`Trang bị ${itemName}`), 100); 
    }, [handleAction]);

    const handleUnequipItem = useCallback((itemName: string) => { 
        setActiveEntity(null); 
        setTimeout(() => handleAction(`Tháo ${itemName}`), 100); 
    }, [handleAction]);

    // Status, Quest, and Memory handlers
    const handleStatusClick = useCallback((status: Status) => setActiveStatus(status), []);
    
    const handleQuestClick = useCallback((quest: Quest) => setActiveQuest(quest), []);
    
    const handleToggleMemoryPin = useCallback((index: number) => 
        setMemories(prev => prev.map((mem, i) => i === index ? { ...mem, pinned: !mem.pinned } : mem)), []);

    // Generate initial story
    const generateInitialStory = useCallback(async () => {
        if (!ai) return;
        setIsLoading(true);
        
        const finalPersonality = worldData.customPersonality || worldData.personalityFromList;
        const nsfwInstruction = worldData.allowNsfw ? 'Cho phép. Kích hoạt quy tắc nội dung 18+ của Quản Trò.' : 'Không, AI phải tránh các chủ đề và mô tả 18+.';
        
        const activeRules = customRules.filter(r => r.isActive);
        let customRulesContext = '';
        if (activeRules.length > 0) { 
            customRulesContext = `\n--- TRI THỨC & LUẬT LỆ TÙY CHỈNH (ĐANG ÁP DỤNG) ---\n${activeRules.map(r => `- ${r.content}`).join('\n')}\n--- KẾT THÚC ---\n`; 
        }
        
        const userPrompt = `${customRulesContext}BẠN LÀ QUẢN TRÒ AI. Bắt đầu câu chuyện cho ${worldData.characterName}.`;
        
        const initialPcEntity: Entity = { 
            name: worldData.characterName || 'Vô Danh', 
            type: 'pc', 
            description: worldData.bio, 
            gender: worldData.gender, 
            personality: finalPersonality
        };
        
        setKnownEntities({ [initialPcEntity.name]: initialPcEntity });
        setParty([initialPcEntity]);
        
        const initialHistory: GameHistoryEntry[] = [{ role: 'user', parts: [{ text: userPrompt }] }];
        setGameHistory(initialHistory);
        
        try {
            const response = await ai.models.generateContent({ 
                model: 'gemini-2.5-flash', 
                contents: initialHistory, 
                config: { 
                    systemInstruction, 
                    responseMimeType: "application/json", 
                    maxOutputTokens: 4096
                } 
            });
            
            const turnTokens = response.usageMetadata?.totalTokenCount || 0;
            setCurrentTurnTokens(turnTokens);
            setTotalTokens(prev => prev + turnTokens);
            
            const responseText = response.text.trim();
            parseApiResponse(responseText);
            setGameHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
        } catch (error: any) {
            if (!isUsingDefaultKey && userApiKeyCount > 1 && error.toString().includes('429')) {
                rotateKey();
                setStoryLog(["**⭐ Lỗi giới hạn yêu cầu. Đã tự động chuyển sang API Key tiếp theo. Vui lòng thử lại. ⭐**"]);
            } else {
                console.error("Error generating initial story:", error);
                setStoryLog(["Có lỗi xảy ra khi bắt đầu câu chuyện. Vui lòng thử lại."]);
            }
        } finally {
            setIsLoading(false);
        }
    }, [ai, worldData, customRules, systemInstruction, parseApiResponse, isUsingDefaultKey, userApiKeyCount, rotateKey]);

    // Save game handler
    const handleSaveGame = useCallback(() => {
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
        
        const currentGameState: SaveData = { 
            worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, 
            systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, 
            lastCompressionTurn, historyStats, cleanupStats: totalCleanupStats 
        };
        
        const jsonString = JSON.stringify(currentGameState, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `AI-RolePlay-${worldData.characterName.replace(/\s+/g, '_') || 'NhanVat'}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, lastCompressionTurn, historyStats, totalCleanupStats]);

    // Restart game handler
    const handleRestartGame = useCallback(() => {
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
    }, [initialGameState.customRules]);

    // Save rules handler
    const handleSaveRules = useCallback((newRules: CustomRule[]) => {
        setCustomRules(newRules);
        previousRulesRef.current = JSON.parse(JSON.stringify(newRules));
        setShowRulesSavedSuccess(true);
        setTimeout(() => setShowRulesSavedSuccess(false), 3500);
    }, []);

    // Manual cleanup handler
    const handleManualCleanup = useCallback((aggressive: boolean = false) => {
        // This would use actual GameStateOptimizer utility
        setNotification(`🧹 ${aggressive ? 'Aggressive' : 'Manual'} cleanup completed`);
        setTimeout(() => setNotification(null), 5000);
    }, []);

    // Suggest action handler
    const handleSuggestAction = useCallback(async () => {
        if (isLoading || !ai) return;
        setIsLoading(true);
        try {
            const response = await ai.models.generateContent({ 
                model: 'gemini-2.5-flash', 
                contents: `Bối cảnh: "${storyLog.slice(-1)[0]}". Gợi ý một hành động sáng tạo.` 
            });
            setCustomAction(response.text.trim());
        } catch (error) {
            console.error("Error suggesting action:", error);
            setCustomAction("Không thể nhận gợi ý lúc này.");
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, ai, storyLog]);

    return {
        // Game State
        worldData,
        setWorldData,
        knownEntities,
        setKnownEntities,
        statuses,
        setStatuses,
        quests,
        setQuests,
        gameHistory,
        setGameHistory,
        turnCount,
        setTurnCount,
        memories,
        setMemories,
        party,
        setParty,
        customRules,
        setCustomRules,
        systemInstruction,
        setSystemInstruction,
        chronicle,
        setChronicle,
        gameTime,
        setGameTime,
        storyLog,
        setStoryLog,
        choices,
        setChoices,
        
        // UI State
        isLoading,
        setIsLoading,
        customAction,
        setCustomAction,
        currentTurnTokens,
        setCurrentTurnTokens,
        totalTokens,
        setTotalTokens,
        
        // Modal States
        isHomeModalOpen,
        setIsHomeModalOpen,
        isRestartModalOpen,
        setIsRestartModalOpen,
        activeEntity,
        setActiveEntity,
        activeStatus,
        setActiveStatus,
        isMemoryModalOpen,
        setIsMemoryModalOpen,
        isKnowledgeModalOpen,
        setIsKnowledgeModalOpen,
        isCustomRulesModalOpen,
        setIsCustomRulesModalOpen,
        isMapModalOpen,
        setIsMapModalOpen,
        activeQuest,
        setActiveQuest,
        showSaveSuccess,
        setShowSaveSuccess,
        showRulesSavedSuccess,
        setShowRulesSavedSuccess,
        isPcInfoModalOpen,
        setIsPcInfoModalOpen,
        isPartyModalOpen,
        setIsPartyModalOpen,
        isQuestLogModalOpen,
        setIsQuestLogModalOpen,
        isSidebarOpen,
        setIsSidebarOpen,
        isChoicesModalOpen,
        setIsChoicesModalOpen,
        notification,
        setNotification,
        
        // Advanced State
        locationDiscoveryOrder,
        setLocationDiscoveryOrder,
        cleanupStats,
        setCleanupStats,
        totalCleanupStats,
        setTotalCleanupStats,
        compressedHistory,
        setCompressedHistory,
        lastCompressionTurn,
        setLastCompressionTurn,
        historyStats,
        setHistoryStats,
        ruleChanges,
        setRuleChanges,
        
        // Functions
        handleAction,
        handleEntityClick,
        handleUseItem,
        handleLearnItem,
        handleEquipItem,
        handleUnequipItem,
        handleStatusClick,
        handleQuestClick,
        handleToggleMemoryPin,
        generateInitialStory,
        handleSaveGame,
        handleRestartGame,
        handleSaveRules,
        handleManualCleanup,
        handleSuggestAction
    };
};