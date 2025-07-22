// components/game/hooks/useGameState.ts
import { useState, useMemo } from 'react';
import type { SaveData, KnownEntities, Status, Quest, GameHistoryEntry, Memory, Entity, CustomRule, Chronicle, CompressedHistorySegment } from '../../types.ts';

export const useGameState = (initialGameState: SaveData) => {
    const [worldData, setWorldData] = useState(initialGameState.worldData);
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
    const [compressedHistory, setCompressedHistory] = useState<CompressedHistorySegment[]>(initialGameState.compressedHistory || []);
    const [historyStats, setHistoryStats] = useState(initialGameState.historyStats || { totalEntriesProcessed: 0, totalTokensSaved: 0, compressionCount: 0 });
    const [cleanupStats, setCleanupStats] = useState<SaveData['cleanupStats']>(initialGameState.cleanupStats || { totalCleanupsPerformed: 0, totalTokensSavedFromCleanup: 0, lastCleanupTurn: 0, cleanupHistory: [] });
    const [storyLog, setStoryLog] = useState<string[]>([]);
    const [choices, setChoices] = useState<string[]>([]);
    
    const [locationDiscoveryOrder, setLocationDiscoveryOrder] = useState<string[]>(() => {
        if (Array.isArray(initialGameState.locationDiscoveryOrder)) {
            const savedOrder = [...initialGameState.locationDiscoveryOrder];
            const seen = new Set(savedOrder);
            const allKnownLocations = Object.values(initialGameState.knownEntities).filter(e => e.type === 'location').map(e => e.name);
            allKnownLocations.forEach(locName => { if (!seen.has(locName)) savedOrder.push(locName); });
            return savedOrder;
        }
        const order: string[] = [];
        const seen = new Set<string>();
        initialGameState.gameHistory.forEach(entry => {
            if (entry.role === 'model') {
                 try {
                    const tagRegex = /\[LORE_LOCATION:\s*name="([^"]+)"[^\]]*\]/g;
                    let match;
                    while ((match = tagRegex.exec(JSON.parse(entry.parts[0].text).story || '')) !== null) {
                        const locName = match[1];
                        if (!seen.has(locName)) { order.push(locName); seen.add(locName); }
                    }
                } catch (e) { /* Ignore */ }
            }
        });
        const knownLocations = Object.values(initialGameState.knownEntities).filter(e => e.type === 'location').map(e => e.name);
        knownLocations.forEach(locName => { if (!seen.has(locName)) order.push(locName); });
        return order;
    });

    const gameState = useMemo(() => ({
        worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, historyStats, cleanupStats, storyLog, choices, locationDiscoveryOrder, currentTurnTokens
    }), [worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, historyStats, cleanupStats, storyLog, choices, locationDiscoveryOrder, currentTurnTokens]);
    
    const setters = useMemo(() => ({
        setWorldData, setKnownEntities, setStatuses, setQuests, setGameHistory, setTurnCount, setMemories, setParty, setCustomRules, setSystemInstruction, setChronicle, setGameTime, setCurrentTurnTokens, setTotalTokens, setCompressedHistory, setHistoryStats, setCleanupStats, setStoryLog, setChoices, setLocationDiscoveryOrder
    }), [setWorldData, setKnownEntities, setStatuses, setQuests, setGameHistory, setTurnCount, setMemories, setParty, setCustomRules, setSystemInstruction, setChronicle, setGameTime, setCurrentTurnTokens, setTotalTokens, setCompressedHistory, setHistoryStats, setCleanupStats, setStoryLog, setChoices, setLocationDiscoveryOrder]);

    return { gameState, setters };
};
