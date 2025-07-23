// components/game/hooks/useGameController.ts
import { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react';
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AIContext } from '../../../App.tsx';
import type { SaveData, Entity, Status, CustomRule, GameHistoryEntry } from '../../types.ts';
import { buildEnhancedRagPrompt } from '../../enhanced-rag-system';
import { HistoryManager } from '../../HistoryManager';
import { GameStateOptimizer } from '../../GameStateOptimizer';

const calculateNewTime = (
    currentTime: { year: number; month: number; day: number; hour: number; },
    elapsed: { years: number; months: number; days: number; hours: number; }
): { year: number; month: number; day: number; hour: number; } => {
    let { year, month, day, hour } = currentTime;
    
    hour += elapsed.hours;
    day += Math.floor(hour / 24);
    hour = hour % 24;
    
    day += elapsed.days;
    if (day > 30) {
        month += Math.floor((day - 1) / 30);
        day = ((day - 1) % 30) + 1;
    }
    
    month += elapsed.months;
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
        return [...prevStatuses, { ...newStatusAttributes, owner } as Status];
    }
    
    const filteredStatuses = prevStatuses.filter(s => 
        !(s.name === newStatusAttributes.name && s.owner === owner)
    );
    
    const otherOwnersStatuses = filteredStatuses.filter(s => s.owner !== owner);
    const ownerStatuses = filteredStatuses.filter(s => s.owner === owner);
    
    const ownerStatusesOfSameType = ownerStatuses.filter(s => s.type === newStatusType);
    const ownerStatusesOfOtherTypes = ownerStatuses.filter(s => s.type !== newStatusType);
    
    const statusTypeLimit = 3;
    
    if (ownerStatusesOfSameType.length >= statusTypeLimit) {
        ownerStatusesOfSameType.shift();
    }
    
    return [
        ...otherOwnersStatuses,
        ...ownerStatusesOfOtherTypes,
        ...ownerStatusesOfSameType,
        { ...newStatusAttributes, owner } as Status
    ];
};

interface GameStateManager {
    gameState: SaveData;
    setters: any;
}

interface ModalManager {
    modalState: any;
    setters: any;
    actions: any;
}

interface ExternalProps {
    onBackToMenu: () => void;
    keyRotationNotification: string | null;
    onClearNotification: () => void;
}

export const useGameController = (
    gameStateManager: GameStateManager,
    modalManager: ModalManager,
    initialGameState: SaveData,
    externalProps: ExternalProps
) => {
    const { gameState, setters } = gameStateManager;
    const { modalState, setters: modalSetters, actions: modalActions } = modalManager;
    const { onBackToMenu, keyRotationNotification, onClearNotification } = externalProps;
    
    const [isLoading, setIsLoading] = useState(false);
    const [customAction, setCustomAction] = useState('');
    
    const aiContext = useContext(AIContext);
    const abortControllerRef = useRef<AbortController | null>(null);
    const currentTurnRef = useRef(gameState.turnCount);
    // Story and tag parsing function (from original GameScreen)
    const parseStoryAndTags = useCallback((storyText: string, setters: any): string => {
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
            const tagType = match[1];
            const attributes = parseAttributes(match[2]);
            
            switch (tagType) {
                case 'TIME_ELAPSED':
                    const elapsed = {
                        years: Number(attributes.years) || 0,
                        months: Number(attributes.months) || 0,
                        days: Number(attributes.days) || 0,
                        hours: Number(attributes.hours) || 0
                    };
                    if (Object.values(elapsed).some(v => v > 0)) {
                        setters.setGameTime((prevTime: any) => calculateNewTime(prevTime, elapsed));
                    }
                    break;
                    
                case 'CHRONICLE_TURN':
                    if (attributes.text) {
                        setters.setChronicle((prev: any) => ({ 
                            ...prev, 
                            turn: [...prev.turn, attributes.text] 
                        }));
                    }
                    break;
                    
                case 'MEMORY_ADD':
                    if (attributes.text) {
                        setters.setMemories((prev: any[]) => [...prev, { text: attributes.text, pinned: false }]);
                    }
                    break;
                    
                case 'LORE_LOCATION':
                    if (attributes.name) {
                        setters.setKnownEntities((prev: any) => ({ 
                            ...prev, 
                            [attributes.name]: { type: 'location', ...attributes } 
                        }));
                        setters.setLocationDiscoveryOrder((prev: string[]) => 
                            prev.includes(attributes.name) ? prev : [...prev, attributes.name]
                        );
                    }
                    break;
                    
                case 'LORE_NPC':
                case 'LORE_ITEM':
                case 'LORE_SKILL':
                case 'LORE_FACTION':
                case 'LORE_CONCEPT':
                    if (attributes.name) {
                        const entityType = tagType.split('_')[1].toLowerCase();
                        setters.setKnownEntities((prev: any) => ({ 
                            ...prev, 
                            [attributes.name]: { type: entityType, ...attributes } 
                        }));
                    }
                    break;
                    
                case 'STATUS_APPLIED_SELF':
                    if (attributes.name) {
                        setters.setStatuses((prev: any[]) => applyStatusWithLimit(prev, attributes, 'pc'));
                    }
                    break;
                    
                case 'STATUS_APPLIED_NPC':
                    if (attributes.name && attributes.npcName) {
                        setters.setStatuses((prev: any[]) => applyStatusWithLimit(prev, attributes, attributes.npcName));
                    }
                    break;
                    
                case 'STATUS_REMOVED':
                    if (attributes.name && attributes.owner) {
                        setters.setStatuses((prev: any[]) => 
                            prev.filter(s => !(s.name === attributes.name && s.owner === attributes.owner))
                        );
                    }
                    break;
                    
                case 'ENTITY_UPDATE':
                    if (attributes.name) {
                        setters.setKnownEntities((prev: any) => ({
                            ...prev,
                            [attributes.name]: { ...prev[attributes.name], ...attributes }
                        }));
                        
                        // Update party if it's a party member
                        setters.setParty((prev: any[]) => 
                            prev.map(member => 
                                member.name === attributes.name ? { ...member, ...attributes } : member
                            )
                        );
                    }
                    break;
                    
                case 'QUEST_ASSIGNED':
                case 'QUEST_UPDATED':
                    if (attributes.title || attributes.id) {
                        const questId = attributes.id || attributes.title;
                        setters.setQuests((prev: any[]) => {
                            const existingIndex = prev.findIndex((q: any) => q.id === questId || q.title === questId);
                            const questData = { id: questId, ...attributes };
                            
                            if (existingIndex >= 0) {
                                const updated = [...prev];
                                updated[existingIndex] = { ...updated[existingIndex], ...questData };
                                return updated;
                            } else {
                                return [...prev, questData];
                            }
                        });
                    }
                    break;
                    
                case 'SKILL_LEARNED':
                    if (attributes.name) {
                        // Add to known entities
                        setters.setKnownEntities((prev: any) => ({ 
                            ...prev, 
                            [attributes.name]: { type: 'skill', ...attributes } 
                        }));
                        
                        // Update PC's learned skills
                        setters.setKnownEntities((prev: any) => {
                            const pcEntity = Object.values(prev).find((e: any) => e.type === 'pc');
                            if (pcEntity) {
                                return {
                                    ...prev,
                                    [pcEntity.name]: {
                                        ...pcEntity,
                                        learnedSkills: [...(pcEntity.learnedSkills || []), attributes.name]
                                    }
                                };
                            }
                            return prev;
                        });
                    }
                    break;
                    
                case 'ITEM_OBTAINED':
                case 'ITEM_EQUIPPED':
                case 'ITEM_UNEQUIPPED':
                case 'ITEM_USED':
                    if (attributes.name) {
                        setters.setKnownEntities((prev: any) => {
                            const item = prev[attributes.name];
                            if (item) {
                                let updates: any = {};
                                
                                switch (tagType) {
                                    case 'ITEM_OBTAINED':
                                        updates.owner = 'pc';
                                        break;
                                    case 'ITEM_EQUIPPED':
                                        updates.equipped = true;
                                        break;
                                    case 'ITEM_UNEQUIPPED':
                                        updates.equipped = false;
                                        break;
                                    case 'ITEM_USED':
                                        if (item.uses && item.uses > 0) {
                                            updates.uses = item.uses - 1;
                                        }
                                        break;
                                }
                                
                                return {
                                    ...prev,
                                    [attributes.name]: { ...item, ...updates }
                                };
                            }
                            return prev;
                        });
                    }
                    break;
                    
                default:
                    console.log(`Unhandled tag type: ${tagType}`, attributes);
                    break;
            }
        }
        
        return cleanStory.trim();
    }, []);
    
    useEffect(() => {
        currentTurnRef.current = gameState.turnCount;
    }, [gameState.turnCount]);
    
    const handleAction = useCallback(async (action: string) => {
        if (!action.trim() || isLoading) return;
        if (!aiContext?.apiKey) return;
        
        setIsLoading(true);
        setCustomAction('');
        
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        
        try {
            const genAI = new GoogleGenAI(aiContext.apiKey);
            const model = genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
                ]
            });
            
            const prompt = buildEnhancedRagPrompt(gameState, action);
            
            const result = await model.generateContent(prompt, {
                signal: abortControllerRef.current.signal
            });
            
            const response = await result.response;
            const responseText = response.text();
            const tokensUsed = response.usageMetadata?.totalTokenCount || 0;
            
            setters.setCurrentTurnTokens(tokensUsed);
            setters.setTotalTokens((prev: number) => prev + tokensUsed);
            
            let parsedResponse;
            try {
                parsedResponse = JSON.parse(responseText);
            } catch (e) {
                console.error("Failed to parse AI response:", e);
                return;
            }
            
            // Parse story content and extract tags
            let cleanStory = '';
            if (parsedResponse.story) {
                cleanStory = parseStoryAndTags(parsedResponse.story, setters);
                setters.setStoryLog((prev: string[]) => [...prev, cleanStory]);
            }
            
            // Update choices
            if (parsedResponse.choices && Array.isArray(parsedResponse.choices)) {
                setters.setChoices(parsedResponse.choices);
            }
            
            // Add to game history
            const newUserEntry: GameHistoryEntry = {
                role: 'user',
                parts: [{ text: action }]
            };
            const newModelEntry: GameHistoryEntry = {
                role: 'model',
                parts: [{ text: responseText }]
            };
            
            setters.setGameHistory((prev: GameHistoryEntry[]) => [
                ...prev,
                newUserEntry,
                newModelEntry
            ]);
            
            // Auto-optimization every 10 turns
            if (newTurnCount % 10 === 0) {
                const optimizer = new GameStateOptimizer();
                const optimizedData = optimizer.optimizeGameState({
                    ...gameState,
                    turnCount: newTurnCount
                });
                
                // Apply optimized data
                Object.keys(optimizedData).forEach(key => {
                    if (setters[`set${key.charAt(0).toUpperCase() + key.slice(1)}`]) {
                        setters[`set${key.charAt(0).toUpperCase() + key.slice(1)}`](optimizedData[key]);
                    }
                });
                
                modalSetters.setNotification('Tự động tối ưu hóa hoàn tất!');
                setTimeout(() => modalSetters.setNotification(null), 3000);
            }
            
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('Request was aborted');
            } else {
                console.error('Error calling AI:', error);
                modalSetters.setNotification('Lỗi khi gọi AI. Vui lòng thử lại.');
                setTimeout(() => modalSetters.setNotification(null), 3000);
            }
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    }, [gameState, setters, modalSetters, aiContext, isLoading]);
    
    const handleSaveGame = useCallback(() => {
        const saveData: SaveData = {
            ...gameState,
            turnCount: gameState.turnCount,
            totalTokens: gameState.totalTokens,
            gameTime: gameState.gameTime,
            compressedHistory: gameState.compressedHistory || [],
            historyStats: gameState.historyStats || { totalEntriesProcessed: 0, totalTokensSaved: 0, compressionCount: 0 },
            cleanupStats: gameState.cleanupStats || { totalCleanupsPerformed: 0, totalTokensSavedFromCleanup: 0, lastCleanupTurn: 0, cleanupHistory: [] }
        };
        
        const dataStr = JSON.stringify(saveData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `savegame_${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        
        modalSetters.setShowSaveSuccess(true);
        setTimeout(() => modalSetters.setShowSaveSuccess(false), 2000);
    }, [gameState, modalSetters]);
    
    const handleRestartGame = useCallback(() => {
        onBackToMenu();
        modalActions.closeRestartModal();
    }, [onBackToMenu, modalActions]);
    
    const handleSuggestAction = useCallback(async () => {
        if (!aiContext?.apiKey || isLoading) return;
        
        setIsLoading(true);
        
        try {
            const genAI = new GoogleGenAI(aiContext.apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
            
            const prompt = `Dựa trên tình huống hiện tại, hãy đề xuất 3 hành động thú vị mà người chơi có thể thực hiện. Chỉ trả về một mảng JSON đơn giản với 3 chuỗi hành động.
            
Tình huống hiện tại:
${gameState.storyLog?.slice(-2).join('\n') || 'Bắt đầu cuộc phiêu lưu'}`;
            
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const responseText = response.text();
            
            try {
                const suggestions = JSON.parse(responseText);
                if (Array.isArray(suggestions)) {
                    setters.setChoices(suggestions);
                }
            } catch (e) {
                console.error("Failed to parse suggestions:", e);
            }
        } catch (error) {
            console.error('Error getting suggestions:', error);
        } finally {
            setIsLoading(false);
        }
    }, [gameState, aiContext, isLoading, setters]);
    
    const handleSaveRules = useCallback((newRules: CustomRule[]) => {
        setters.setCustomRules(newRules);
        modalSetters.setShowRulesSavedSuccess(true);
        setTimeout(() => modalSetters.setShowRulesSavedSuccess(false), 2000);
    }, [setters, modalSetters]);
    
    const handleManualCleanup = useCallback(() => {
        const optimizer = new GameStateOptimizer();
        const optimizedData = optimizer.optimizeGameState(gameState);
        
        // Apply optimized data
        Object.keys(optimizedData).forEach(key => {
            const setterName = `set${key.charAt(0).toUpperCase() + key.slice(1)}`;
            if (setters[setterName]) {
                setters[setterName](optimizedData[key]);
            }
        });
        
        const stats = optimizedData.cleanupStats || gameState.cleanupStats;
        modalSetters.setNotification(`Dọn dẹp thủ công hoàn tất! 
Tiết kiệm khoảng ${Math.round((stats?.totalTokensSavedFromCleanup || 0) / 1000)}k tokens.`);
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
    };
};