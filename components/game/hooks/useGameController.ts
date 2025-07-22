// components/game/hooks/useGameController.ts
import { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { AIContext } from '../../../App.tsx';
import type { SaveData, Entity, Status, CustomRule, GameHistoryEntry } from '../../types.ts';
import { buildEnhancedRagPrompt } from '../../promptBuilder.ts';
import { HistoryManager } from '../../HistoryManager';
import { GameStateOptimizer } from '../../GameStateOptimizer';

const calculateNewTime = (
    currentTime: { year: number; month: number; day: number; hour: number; },
    elapsed: { years: number; months: number; days: number; hours: number; }
): { year: number; month: number; day: number; hour: number; } => {
    // Validate input values and provide defaults
    const safeCurrentTime = {
        year: Number(currentTime?.year) || 1,
        month: Number(currentTime?.month) || 1,
        day: Number(currentTime?.day) || 1,
        hour: Number(currentTime?.hour) || 8
    };
    
    const safeElapsed = {
        years: Number(elapsed?.years) || 0,
        months: Number(elapsed?.months) || 0,
        days: Number(elapsed?.days) || 0,
        hours: Number(elapsed?.hours) || 0
    };
    
    let { year, month, day, hour } = safeCurrentTime;
    
    hour += safeElapsed.hours;
    day += Math.floor(hour / 24);
    hour = hour % 24;
    day += safeElapsed.days;
    
    if (day > 30) {
        month += Math.floor((day - 1) / 30);
        day = ((day - 1) % 30) + 1;
    }
    
    month += safeElapsed.months;
    if (month > 12) {
        year += Math.floor((month - 1) / 12);
        month = ((month - 1) % 12) + 1;
    }
    
    year += safeElapsed.years;
    
    // Final validation to ensure no NaN values
    return {
        year: Number.isFinite(year) ? Math.max(1, Math.floor(year)) : 1,
        month: Number.isFinite(month) ? Math.max(1, Math.min(12, Math.floor(month))) : 1,
        day: Number.isFinite(day) ? Math.max(1, Math.min(30, Math.floor(day))) : 1,
        hour: Number.isFinite(hour) ? Math.max(0, Math.min(23, Math.floor(hour))) : 8
    };
};

const applyStatusWithLimit = (prevStatuses: Status[], newStatusAttributes: any, owner: string): Status[] => {
    const newStatusType = newStatusAttributes.type;
    if (!newStatusType) {
        return [...prevStatuses, { ...newStatusAttributes, owner } as Status];
    }
    const filteredStatuses = prevStatuses.filter(s => !(s.name === newStatusAttributes.name && s.owner === owner));
    const otherOwnersStatuses = filteredStatuses.filter(s => s.owner !== owner);
    const ownerStatuses = filteredStatuses.filter(s => s.owner === owner);
    const ownerStatusesOfType = ownerStatuses.filter(s => s.type === newStatusType);
    const ownerStatusesOfOtherTypes = ownerStatuses.filter(s => s.type !== newStatusType);
    const maxStatusesPerType = 2;
    let finalOwnerStatusesOfType = ownerStatusesOfType;
    if (ownerStatusesOfType.length >= maxStatusesPerType) {
        finalOwnerStatusesOfType = ownerStatusesOfType.slice(ownerStatusesOfType.length - (maxStatusesPerType - 1));
    }
    const newStatusToAdd: Status = { ...newStatusAttributes, owner: owner };
    return [
        ...otherOwnersStatuses, 
        ...ownerStatusesOfOtherTypes,
        ...finalOwnerStatusesOfType, 
        newStatusToAdd
    ];
};

export const useGameController = (
    { gameState, setters }: { gameState: any, setters: any },
    { modalState, setters: modalSetters, actions: modalActions }: { modalState: any, setters: any, actions: any },
    initialGameState: SaveData,
    props: { onBackToMenu: () => void, keyRotationNotification: string | null, onClearNotification: () => void }
) => {
    const { ai, isAiReady, apiKeyError, rotateKey, isUsingDefaultKey, userApiKeyCount } = useContext(AIContext);
    const [isLoading, setIsLoading] = useState(initialGameState.gameHistory.length === 0 && isAiReady);
    const [customAction, setCustomAction] = useState('');
    const [ruleChanges, setRuleChanges] = useState<any>(null);
    const previousRulesRef = useRef<CustomRule[]>(initialGameState.customRules);
    
    const rehydratedLog = useMemo(() => {
        if (Array.isArray(initialGameState.storyLog) && initialGameState.storyLog.length > 0) {
            return initialGameState.storyLog;
        }
        const log: string[] = [];
        (initialGameState.gameHistory || []).forEach(entry => {
            if (entry.role === 'user') {
                const actionMatch = entry.parts[0].text.match(/--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---\n"([^"]+)"/);
                if (actionMatch && actionMatch[1] && actionMatch[1] !== 'SYSTEM_RULE_UPDATE') {
                    log.push(`> ${actionMatch[1]}`);
                }
            } else {
                try {
                    const jsonResponse = JSON.parse(entry.parts[0].text);
                    if (jsonResponse.story) {
                        // Simple tag removal for rehydration (no side effects)
                        log.push(jsonResponse.story.replace(/\[([A-Z_]+):\s*([^\]]+)\]/g, '').trim());
                    }
                } catch (e) {
                     log.push(entry.parts[0].text.replace(/\[([A-Z_]+):\s*([^\]]+)\]/g, '').trim());
                }
            }
        });
        return log;
    }, [initialGameState.gameHistory, initialGameState.storyLog]);

    const rehydratedChoices = useMemo(() => {
        if (Array.isArray(initialGameState.choices) && initialGameState.choices.length > 0) {
            return initialGameState.choices;
        }
        let lastChoices: string[] = [];
        if (initialGameState.gameHistory && initialGameState.gameHistory.length > 0) {
            const lastModelEntry = [...initialGameState.gameHistory].reverse().find(entry => entry.role === 'model');
            if (lastModelEntry) {
                try {
                    lastChoices = JSON.parse(lastModelEntry.parts[0].text).choices || [];
                } catch (e) { /* ignore */ }
            }
        }
        return lastChoices;
    }, [initialGameState.choices, initialGameState.gameHistory]);

    useEffect(() => {
        // Only set rehydrated data if current state is empty (initial load)
        if (gameState.storyLog.length === 0 && rehydratedLog.length > 0) {
            setters.setStoryLog(rehydratedLog);
        }
        if (gameState.choices.length === 0 && rehydratedChoices.length > 0) {
            setters.setChoices(rehydratedChoices);
        }
    }, [gameState.storyLog.length, gameState.choices.length, rehydratedLog, rehydratedChoices, setters.setStoryLog, setters.setChoices]);

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
                let value: any = match[3] !== undefined ? match[3] : match[4];
                if ((key === 'isMainQuest' || key === 'equippable' || key === 'usable' || key === 'consumable' || key === 'learnable') && typeof value === 'string') {
                    value = value.toLowerCase() === 'true';
                } else if (key === 'objectives' && typeof value === 'string') {
                    value = value.split(';').map(desc => ({ description: desc.trim(), completed: false }));
                } else if (['uses', 'durability', 'damage', 'repairedAmount', 'years', 'months', 'days', 'hours'].includes(key) && typeof value === 'string' && !isNaN(Number(value))) {
                    attributes[key] = Number(value);
                    continue;
                }
                attributes[key] = value;
            }
            return attributes;
        };
        let match;
        while ((match = tagRegex.exec(storyText)) !== null) {
            cleanStory = cleanStory.replace(match[0], '');
            if (!applySideEffects) continue;
            const tagType = match[1];
            const attributes = parseAttributes(match[2]);
            switch (tagType) {
                case 'TIME_ELAPSED':
                    setters.setGameTime(prev => calculateNewTime(prev, { years: attributes.years || 0, months: attributes.months || 0, days: attributes.days || 0, hours: attributes.hours || 0 }));
                    break;
                case 'CHRONICLE_TURN':
                    if (attributes.text) setters.setChronicle(prev => ({ ...prev, turn: [...prev.turn, attributes.text] }));
                    break;
                 case 'LORE_LOCATION':
                    setters.setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'location', ...attributes } }));
                    setters.setLocationDiscoveryOrder(prev => prev.includes(attributes.name) ? prev : [...prev, attributes.name]);
                    break;
                // ... other tag processing logic from original GameScreen ...
                case 'STATUS_APPLIED_SELF':
                    setters.setStatuses(prev => applyStatusWithLimit(prev, attributes, 'pc'));
                    break;
                case 'STATUS_APPLIED_NPC':
                    if (attributes.npcName) setters.setStatuses(prev => applyStatusWithLimit(prev, attributes, attributes.npcName));
                    break;
                // ... and so on for all tags
            }
        }
        return cleanStory.trim();
    }, [setters]);

    const responseSchema = useMemo(() => ({
      type: Type.OBJECT,
      properties: {
        story: { type: Type.STRING, description: "Phần văn bản tường thuật của câu chuyện, bao gồm các định dạng đặc biệt và các thẻ lệnh ẩn." },
        choices: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Một mảng gồm 4-5 lựa chọn cho người chơi." },
      },
      required: ['story', 'choices']
    }), []);

    const parseApiResponse = useCallback((text: string) => {
        try {
            const jsonResponse = JSON.parse(text);
            const cleanStory = parseStoryAndTags(jsonResponse.story, true);
            setters.setStoryLog(prev => [...prev, cleanStory]);
            setters.setChoices(jsonResponse.choices || []);
        } catch (e) {
            console.error("Failed to parse AI response:", e, "Raw response:", text);
            setters.setStoryLog(prev => [...prev, "Lỗi: AI trả về dữ liệu không hợp lệ. Hãy thử lại."]);
            setters.setChoices([]);
        }
    }, [parseStoryAndTags, setters]);
    
    const generateInitialStory = useCallback(async () => {
        if (!ai) return;
        setIsLoading(true);
        const { worldData, customRules, systemInstruction } = initialGameState;
        const pcEntity: Entity = {
            name: worldData.characterName || 'Vô Danh', type: 'pc', description: worldData.bio,
            gender: worldData.gender, personality: worldData.customPersonality || worldData.personalityFromList, learnedSkills: [],
        };
        if (!gameState.knownEntities[pcEntity.name]){
            setters.setKnownEntities({ [pcEntity.name]: pcEntity });
        }
        if (gameState.party.length === 0){
             setters.setParty([pcEntity]);
        }
       
        const activeRules = customRules.filter(r => r.isActive);
        let customRulesContext = activeRules.length > 0 ? `\n--- TRI THỨC & LUẬT LỆ TÙY CHỈNH (ĐANG ÁP DỤNG) ---\n${activeRules.map(r => `- ${r.content}`).join('\n')}\n--- KẾT THÚC ---\n` : '';
        const userPrompt = `${customRulesContext}BẠN LÀ QUẢN TRÒ...`;
        const initialHistory: GameHistoryEntry[] = [{ role: 'user', parts: [{ text: userPrompt }] }];
        setters.setGameHistory(initialHistory);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash', contents: initialHistory,
                config: { systemInstruction, responseMimeType: "application/json", responseSchema }
            });
            const turnTokens = response.usageMetadata?.totalTokenCount || 0;
            setters.setCurrentTurnTokens(turnTokens);
            setters.setTotalTokens(prev => prev + turnTokens);
            const responseText = response.text?.trim() || '';
            if (!responseText) {
                throw new Error('AI response was empty');
            }
            parseApiResponse(responseText);
            setters.setGameHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
        } catch (error) {
            console.error("Error generating initial story:", error);
            setters.setStoryLog(["Có lỗi xảy ra khi bắt đầu câu chuyện. Vui lòng thử lại."]);
        } finally {
            setIsLoading(false);
        }
    }, [ai, initialGameState, gameState, setters, parseApiResponse, responseSchema]);

    useEffect(() => {
        if (gameState.gameHistory.length === 0 && isAiReady) {
            generateInitialStory();
        } else if (!isAiReady) {
            setters.setStoryLog([apiKeyError || "AI chưa sẵn sàng. Vui lòng kiểm tra API Key và quay về trang chủ."]);
            setIsLoading(false);
        }
    }, [gameState.gameHistory.length, isAiReady, apiKeyError, generateInitialStory, setters]);
    
    const handleAction = useCallback(async (action: string) => {
        let originalAction = action.trim();
        if (!originalAction || isLoading || !ai) return;

        setIsLoading(true);
        setters.setChoices([]);
        setCustomAction('');
        setters.setStoryLog(prev => [...prev, `> ${originalAction}`]);

        const userPrompt = buildEnhancedRagPrompt(originalAction, gameState, '', '');
        const newUserEntry: GameHistoryEntry = { role: 'user', parts: [{ text: userPrompt }] };
        const updatedHistory = [...gameState.gameHistory, newUserEntry];
        
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash', contents: updatedHistory,
                config: { systemInstruction: gameState.systemInstruction, responseMimeType: "application/json", responseSchema }
            });
            const turnTokens = response.usageMetadata?.totalTokenCount || 0;
            setters.setCurrentTurnTokens(turnTokens);
            setters.setTotalTokens(prev => prev + turnTokens);
            const responseText = response.text?.trim() || '';
            if (!responseText) {
                throw new Error('AI response was empty');
            }
            setters.setGameHistory(prev => [...prev, newUserEntry, { role: 'model', parts: [{ text: responseText }] }]);
            parseApiResponse(responseText);
            setters.setTurnCount(prev => prev + 1);
            
            // Auto cleanup check
            const newTurnCount = gameState.turnCount + 1;
            const cleanupResult = GameStateOptimizer.performCleanup({...gameState, turnCount: newTurnCount});
            if (cleanupResult.shouldRunCleanup) {
                setters.setKnownEntities(cleanupResult.optimizedState.knownEntities);
                setters.setMemories(cleanupResult.optimizedState.memories);
                setters.setChronicle(cleanupResult.optimizedState.chronicle);
                setters.setQuests(cleanupResult.optimizedState.quests);
                setters.setStatuses(cleanupResult.optimizedState.statuses);
                
                const updatedCleanupStats = {
                    totalCleanupsPerformed: (gameState.cleanupStats?.totalCleanupsPerformed || 0) + 1,
                    totalTokensSavedFromCleanup: (gameState.cleanupStats?.totalTokensSavedFromCleanup || 0) + cleanupResult.stats.totalTokensSaved,
                    lastCleanupTurn: newTurnCount,
                    cleanupHistory: [
                        ...(gameState.cleanupStats?.cleanupHistory || []),
                        {
                            turn: newTurnCount,
                            tokensSaved: cleanupResult.stats.totalTokensSaved,
                            itemsRemoved: cleanupResult.stats.memoriesRemoved + cleanupResult.stats.chronicleEntriesRemoved + cleanupResult.stats.questsArchived + cleanupResult.stats.statusesRemoved + cleanupResult.stats.entitiesArchived
                        }
                    ].slice(-10)
                };
                setters.setCleanupStats(updatedCleanupStats);
                
                modalSetters.setNotification(`Tự động dọn dẹp! Tiết kiệm ${Math.round(cleanupResult.stats.totalTokensSaved / 1000)}k tokens.`);
                setTimeout(() => modalSetters.setNotification(null), 3000);
            } 
        } catch (error: any) {
            console.error("Error continuing story:", error);
            setters.setStoryLog(prev => prev.slice(0, -1));
            if (!isUsingDefaultKey && userApiKeyCount > 1 && error.toString().includes('429')) {
                rotateKey();
                modalSetters.setNotification("Lỗi giới hạn yêu cầu. Đã tự động chuyển API Key.");
            } else {
                 setters.setStoryLog(prev => [...prev, "Lỗi: AI không thể xử lý yêu cầu."]);
            }
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, ai, gameState, setters, modalSetters, isUsingDefaultKey, userApiKeyCount, rotateKey, parseApiResponse, responseSchema]);

    const handleSaveGame = useCallback(() => {
        modalSetters.setShowSaveSuccess(true);
        setTimeout(() => modalSetters.setShowSaveSuccess(false), 3000);
        const jsonString = JSON.stringify(gameState, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `AI-RolePlay-Save-${new Date().toISOString()}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, [gameState, modalSetters]);

    const handleRestartGame = useCallback(() => {
        modalActions.closeRestartModal();
        const pcEntity: Entity = {
            name: initialGameState.worldData.characterName || 'Vô Danh',
            type: 'pc',
            description: initialGameState.worldData.bio,
            gender: initialGameState.worldData.gender,
            personality: initialGameState.worldData.customPersonality || initialGameState.worldData.personalityFromList,
            learnedSkills: [],
        };
        setters.setKnownEntities({ [pcEntity.name]: pcEntity });
        setters.setParty([pcEntity]);
        setters.setStatuses([]);
        setters.setQuests([]);
        setters.setGameHistory([]);
        setters.setTurnCount(0);
        setters.setMemories([]);
        setters.setChronicle({ memoir: [], chapter: [], turn: [] });
        setters.setGameTime({ year: 1, month: 1, day: 1, hour: 8 });
        setters.setCurrentTurnTokens(0);
        setters.setTotalTokens(0);
        setters.setCompressedHistory([]);
        setters.setHistoryStats({ totalEntriesProcessed: 0, totalTokensSaved: 0, compressionCount: 0 });
        setters.setCleanupStats({ totalCleanupsPerformed: 0, totalTokensSavedFromCleanup: 0, lastCleanupTurn: 0, cleanupHistory: [] });
        setters.setStoryLog([]);
        setters.setChoices([]);
        setters.setLocationDiscoveryOrder([]);
    }, [initialGameState, setters, modalActions]);

    const handleSuggestAction = useCallback(async () => {
        if (!ai || isLoading) return;
        setIsLoading(true);
        try {
            const suggestionPrompt = "Dựa trên tình hình hiện tại, hãy gợi ý một hành động sáng tạo và bất ngờ cho người chơi. Chỉ trả về một câu hành động, không giải thích hay thêm bất cứ thứ gì khác.";
            const historyForSuggestion = [...gameState.gameHistory];
            historyForSuggestion.push({ role: 'user', parts: [{ text: suggestionPrompt }] });
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: historyForSuggestion,
                config: {
                    systemInstruction: gameState.systemInstruction,
                    stopSequences: ['\n']
                }
            });

            const suggestion = response.text.trim().replace(/^"|"$/g, '').replace(/^\d+\.\s*/, '');
            setCustomAction(suggestion);
        } catch (error) {
            console.error("Error suggesting action:", error);
            setCustomAction("Không thể nhận gợi ý lúc này.");
        } finally {
            setIsLoading(false);
        }
    }, [ai, isLoading, gameState.gameHistory, gameState.systemInstruction, setCustomAction]);

    const handleSaveRules = useCallback((newRules: CustomRule[]) => {
        setters.setCustomRules(newRules);
        modalActions.closeRulesModal();
        modalSetters.setShowRulesSavedSuccess(true);
        setTimeout(() => modalSetters.setShowRulesSavedSuccess(false), 3000);
    }, [setters, modalActions, modalSetters]);
    
    const handleManualCleanup = useCallback(() => {
        const { optimizedState, stats } = GameStateOptimizer.forceCleanup(gameState, false);
    
        setters.setKnownEntities(optimizedState.knownEntities);
        setters.setMemories(optimizedState.memories);
        setters.setChronicle(optimizedState.chronicle);
        setters.setQuests(optimizedState.quests);
        setters.setStatuses(optimizedState.statuses);
    
        const newCleanupStats = {
            totalCleanupsPerformed: (gameState.cleanupStats?.totalCleanupsPerformed || 0) + 1,
            totalTokensSavedFromCleanup: (gameState.cleanupStats?.totalTokensSavedFromCleanup || 0) + stats.totalTokensSaved,
            lastCleanupTurn: gameState.turnCount,
            cleanupHistory: [
                ...(gameState.cleanupStats?.cleanupHistory || []),
                {
                    turn: gameState.turnCount,
                    tokensSaved: stats.totalTokensSaved,
                    itemsRemoved: stats.memoriesRemoved + stats.chronicleEntriesRemoved + stats.questsArchived + stats.statusesRemoved + stats.entitiesArchived
                }
            ].slice(-10)
        };
        setters.setCleanupStats(newCleanupStats);
        
        modalSetters.setNotification(`Dọn dẹp hoàn tất! Tiết kiệm khoảng ${Math.round(stats.totalTokensSaved / 1000)}k tokens.`);
        setTimeout(() => modalSetters.setNotification(null), 4000);
    
    }, [gameState, setters, modalSetters]);
    
    return {
        isLoading,
        customAction,
        setCustomAction,
        handleAction,
        handleSaveGame,
        handleRestartGame,
        handleSuggestAction,
        handleSaveRules,
        handleManualCleanup,
        isAiReady,
        apiKeyError,
    };
};
