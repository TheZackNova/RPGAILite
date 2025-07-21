







import React, { useState, useEffect, useRef, useMemo, useContext, useCallback } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { AIContext } from '../App.tsx';
import type { SaveData, FormData, KnownEntities, Status, Quest, GameHistoryEntry, Memory, Entity, CustomRule, Chronicle } from './types.ts';
import { buildEnhancedRagPrompt } from './promptBuilder.ts';
import { HistoryManager, type CompressedHistorySegment } from './HistoryManager.ts';

// Modal Imports
import { ConfirmationModal } from './ConfirmationModal.tsx';
import { EntityInfoModal } from './EntityInfoModal.tsx';
import { StatusDetailModal } from './StatusDetailModal.tsx';
import { MemoryModal } from './MemoryModal.tsx';
import { QuestDetailModal } from './QuestDetailModal.tsx';
import { KnowledgeBaseModal } from './KnowledgeBaseModal.tsx';
import { CustomRulesModal } from './CustomRulesModal.tsx';
import { MapModal } from './MapModal.tsx';
import { OptimizedInteractiveText } from './OptimizedInteractiveText.tsx';
// UI Components
import { DesktopHeader } from './game/DesktopHeader.tsx';
import { MobileHeader } from './game/MobileHeader.tsx';
import { StoryPanel } from './game/StoryPanel.tsx';
import { ActionPanel } from './game/ActionPanel.tsx';
import { SidebarNav } from './game/SidebarNav.tsx';
import { GameNotifications } from './game/GameNotifications.tsx';
import { MobileChoicesModal } from './game/MobileChoicesModal.tsx';
import { MobileInputFooter } from './game/MobileInputFooter.tsx';
import { InfoPanelModal } from './game/InfoPanelModal.tsx';
import { PlayerCharacterSheet } from './game/PlayerCharacterSheet.tsx';

// Icon Imports
import { UserIcon } from './Icons.tsx';
import * as GameIcons from './GameIcons.tsx';
import { PartyMemberTab } from './PartyMemberTab.tsx';
import { QuestLog } from './QuestLog.tsx';
import { GameStateOptimizer, type CleanupStats, type CleanupConfig } from './GameStateOptimizer.ts';
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
    keyRotationNotification: string | null;
    onClearNotification: () => void;
}> = ({ initialGameState, onBackToMenu, keyRotationNotification, onClearNotification }) => {
    const { ai, isAiReady, apiKeyError, rotateKey, isUsingDefaultKey, userApiKeyCount } = useContext(AIContext);
    
    // --- State Declarations ---
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

    // --- Data Rehydration & State ---
    // The lazy initializer `() => ...` runs only once on initial render
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
                    // Simple tag stripper for rehydration, functionally equivalent to parseStoryAndTags(storyText, false)
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
    const [cleanupStats, setCleanupStats] = useState<CleanupStats>(GameStateOptimizer.getEmptyStats());
    const [totalCleanupStats, setTotalCleanupStats] = useState(initialGameState.cleanupStats || { totalCleanupsPerformed: 0, totalTokensSavedFromCleanup: 0, lastCleanupTurn: 0, cleanupHistory: [] });
    const [cleanupConfig] = useState<CleanupConfig>({ maxUnpinnedMemories: 20, maxTotalMemories: 40, maxMemoirEntries: 12, maxChapterEntries: 18, maxTurnEntries: 25, maxCompletedQuests: 8, questRetentionTurns: 40, maxStatusesPerEntity: 3, removeExpiredStatuses: true, maxInactiveEntities: 80, entityInactivityThreshold: 20, cleanupInterval: 10 });

    // History Compression State
    const [compressedHistory, setCompressedHistory] = useState<CompressedHistorySegment[]>(initialGameState.compressedHistory || []);
    const [lastCompressionTurn, setLastCompressionTurn] = useState(initialGameState.lastCompressionTurn || 0);
    const [historyStats, setHistoryStats] = useState(initialGameState.historyStats || { totalEntriesProcessed: 0, totalTokensSaved: 0, compressionCount: 0 });
    
    // Rule change tracking
    const [ruleChanges, setRuleChanges] = useState<{ activated: CustomRule[], deactivated: CustomRule[], updated: { oldRule: CustomRule, newRule: CustomRule }[] } | null>(null);
    const previousRulesRef = useRef<CustomRule[]>(initialGameState.customRules);

    const storyContainerRef = useRef<HTMLDivElement>(null);

    // --- Memoized Computations ---
    const entityComputations = useMemo(() => {
        console.log('🔄 Recomputing entity computations');
        
        const pcEntity = Object.values(knownEntities).find(e => e.type === 'pc');
        const pcName = pcEntity?.name;
        const pcStatuses = statuses.filter(s => s.owner === 'pc' || (pcName && s.owner === pcName));
        const displayParty = party.filter(p => p.name !== pcName);
        const hasActiveQuests = quests.some(q => q.status === 'active');
        
        return { pcEntity, pcName, pcStatuses, displayParty, hasActiveQuests };
    }, [knownEntities, statuses, party, quests]);

    const { pcEntity, pcName, pcStatuses, displayParty, hasActiveQuests } = entityComputations;

    const processedStoryLog = useMemo(() => {
        console.log('🔄 Reprocessing story log');
        return storyLog.map((line, index) => ({
            id: index,
            content: line.trim(),
            isUserAction: line.startsWith('>'),
            isEmpty: line.trim() === ''
        })).filter(item => !item.isEmpty);
    }, [storyLog]);

    const isCustomActionLocked = useMemo(() => customRules.some(rule => rule.isActive && rule.content.toUpperCase().includes('KHÓA HÀNH ĐỘNG TÙY Ý')), [customRules]);

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
            cleanStory = cleanStory.replace(match[0], '');
            if (applySideEffects) {
                const tagType = match[1];
                const rawContent = match[2];
                const attributes = parseAttributes(rawContent);
                if (tagType === 'MEMORY_ADD' && attributes.text) { setMemories(prev => [...prev, { text: attributes.text, pinned: false }]); continue; }
                if (Object.keys(attributes).length === 0) { unprocessedTags.push(match[0]); continue; }
                switch (tagType) {
                    case 'TIME_ELAPSED':
                        const elapsed = { years: Number(attributes.years) || 0, months: Number(attributes.months) || 0, days: Number(attributes.days) || 0, hours: Number(attributes.hours) || 0 };
                        if (Object.values(elapsed).some(v => v > 0)) { setGameTime(prevTime => calculateNewTime(prevTime, elapsed)); }
                        break;
                    case 'CHRONICLE_TURN': if (attributes.text) { setChronicle(prev => ({ ...prev, turn: [...prev.turn, attributes.text] })); } break;
                    case 'CHRONICLE_CHAPTER': if (attributes.text) { setChronicle(prev => ({ ...prev, chapter: [...prev.chapter, attributes.text] })); } break;
                    case 'CHRONICLE_MEMOIR': if (attributes.text) { setChronicle(prev => ({ ...prev, memoir: [...prev.memoir, attributes.text] })); } break;
                    case 'STATUS_APPLIED_SELF': setStatuses(prev => applyStatusWithLimit(prev, attributes, 'pc')); break;
                    case 'STATUS_APPLIED_NPC': if (attributes.npcName) { const { npcName, ...statusData } = attributes; setStatuses(prev => applyStatusWithLimit(prev, statusData, npcName)); } break;
                    case 'STATUS_CURED_SELF': setStatuses(prev => prev.filter(s => !(s.name === attributes.name && s.owner === 'pc'))); break;
                    case 'STATUS_CURED_NPC': setStatuses(prev => prev.filter(s => !(s.name === attributes.name && s.owner === attributes.npcName))); break;
                    case 'LORE_SKILL': setKnownEntities(prev => { const { name, description, ...rest } = attributes; if (name && description) { const newSkill: Entity = { type: 'skill', name, description, ...rest }; return { ...prev, [name]: newSkill }; } return prev; }); break;
                    case 'SKILL_LEARNED': setKnownEntities(prev => { const newEntities = { ...prev }; const { name, description, ...rest } = attributes; if (name && description) { const newSkill: Entity = { type: 'skill', name, description, ...rest }; newEntities[name] = newSkill; const pc = Object.values(newEntities).find(e => e.type === 'pc'); if (pc) { const pcName = pc.name; const updatedPc = { ...newEntities[pcName] }; if (!updatedPc.learnedSkills) { updatedPc.learnedSkills = []; } if (!updatedPc.learnedSkills.includes(name)) { updatedPc.learnedSkills.push(name); } newEntities[pcName] = updatedPc; } } return newEntities; }); break;
                    case 'LORE_NPC': setKnownEntities(prev => { const newAttributes = { ...attributes }; if (typeof newAttributes.skills === 'string') { newAttributes.skills = newAttributes.skills.split(',').map((s: string) => s.trim()).filter(Boolean); } return { ...prev, [attributes.name]: { type: 'npc', ...newAttributes } }; }); break;
                    case 'LORE_ITEM': setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'item', ...attributes } })); break;
                    case 'LORE_LOCATION': setKnownEntities(prev => { const newEntities = { ...prev, [attributes.name]: { type: 'location', ...attributes } }; setLocationDiscoveryOrder(prevOrder => { if (!prevOrder.includes(attributes.name)) { return [...prevOrder, attributes.name]; } return prevOrder; }); return newEntities; }); break;
                    case 'LORE_FACTION': setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'faction', ...attributes } })); break;
                    case 'LORE_CONCEPT': setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'concept', ...attributes } })); break;
                    case 'ENTITY_UPDATE': setKnownEntities(prev => { const newEntities = { ...prev }; const targetName = attributes.name; if (newEntities[targetName]) { const { name, newDescription, ...updateData } = attributes; const finalUpdateData = { ...updateData }; if (newDescription) { finalUpdateData.description = newDescription; } if (attributes.newName && attributes.newName !== targetName) { const oldEntity = newEntities[targetName]; delete newEntities[targetName]; newEntities[attributes.newName] = { ...oldEntity, ...finalUpdateData, name: attributes.newName }; } else { newEntities[targetName] = { ...newEntities[targetName], ...finalUpdateData }; } } return newEntities; }); break;
                    case 'ITEM_AQUIRED': setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'item', owner: 'pc', ...attributes } })); break;
                    case 'ITEM_CONSUMED': setKnownEntities(prev => { const newEntities = { ...prev }; const itemToConsume = newEntities[attributes.name]; if (itemToConsume && itemToConsume.type === 'item' && itemToConsume.owner === 'pc') { if (typeof itemToConsume.uses === 'number' && itemToConsume.uses > 1) { newEntities[attributes.name] = { ...itemToConsume, uses: itemToConsume.uses - 1, }; } else { const { owner, equipped, ...restOfItem } = itemToConsume; newEntities[attributes.name] = restOfItem; } } return newEntities; }); break;
                    case 'ITEM_EQUIPPED': setKnownEntities(prev => { const newEntities = { ...prev }; const item = newEntities[attributes.name]; if (item && item.owner === 'pc' && item.equippable) { item.equipped = true; } return newEntities; }); break;
                    case 'ITEM_UNEQUIPPED': setKnownEntities(prev => { const newEntities = { ...prev }; const item = newEntities[attributes.name]; if (item && item.owner === 'pc') { item.equipped = false; } return newEntities; }); break;
                    case 'ITEM_TRANSFORMED': setKnownEntities(prev => { const { oldName, newName, description, ...rest } = attributes; if (!oldName || !newName) return prev; const newEntities = { ...prev }; const oldItem = newEntities[oldName]; if (oldItem) delete newEntities[oldName]; const newItem: Entity = { ...rest, name: newName, type: 'item', owner: oldItem?.owner || 'pc', description: description || `Vật phẩm được biến đổi từ ${oldName}.`, }; newEntities[newName] = newItem; return newEntities; }); break;
                    case 'ITEM_UPDATED': setKnownEntities(prev => { const newEntities = { ...prev }; if (newEntities[attributes.name] && newEntities[attributes.name].owner === 'pc') { newEntities[attributes.name] = { ...newEntities[attributes.name], ...attributes }; } return newEntities; }); break;
                    case 'ITEM_DAMAGED': setKnownEntities(prev => { const newEntities = { ...prev }; const item = newEntities[attributes.name]; if (item && typeof item.durability === 'number') { item.durability = Math.max(0, item.durability - (attributes.damage || 0)); } return newEntities; }); break;
                    case 'ITEM_REPAIRED': setKnownEntities(prev => { const newEntities = { ...prev }; const item = newEntities[attributes.name]; if (item && typeof item.durability === 'number') { item.durability = Math.min(100, item.durability + (attributes.repairedAmount || 0)); } return newEntities; }); break;
                    case 'REALM_UPDATE': setKnownEntities(prev => { const newEntities = { ...prev }; const targetEntity = Object.values(newEntities).find(e => e.name === attributes.target); if (targetEntity) { newEntities[targetEntity.name].realm = attributes.realm; } return newEntities; }); break;
                    case 'COMPANION': const newCompanion = { type: 'companion', ...attributes } as Entity; if (newCompanion.name && newCompanion.description) { setParty(prev => [...prev.filter(p => p.name !== newCompanion.name), newCompanion]); setKnownEntities(prev => ({ ...prev, [newCompanion.name]: newCompanion })); } break;
                    case 'RELATIONSHIP_CHANGED': setKnownEntities(prev => { const newEntities = { ...prev }; if (newEntities[attributes.npcName]) { newEntities[attributes.npcName].relationship = attributes.relationship; } return newEntities; }); break;
                    case 'QUEST_ASSIGNED': const newQuest: Quest = { title: attributes.title, description: attributes.description, objectives: attributes.objectives || [], giver: attributes.giver, reward: attributes.reward, isMainQuest: attributes.isMainQuest || false, status: 'active' }; setQuests(prev => [...prev.filter(q => q.title !== newQuest.title), newQuest]); break;
                    case 'QUEST_UPDATED': setQuests(prev => prev.map(q => q.title === attributes.title ? { ...q, status: attributes.status } : q)); break;
                    case 'QUEST_OBJECTIVE_COMPLETED': setQuests(prev => prev.map(q => { if (q.title === attributes.questTitle) { const newObjectives = q.objectives.map(obj => obj.description === attributes.objectiveDescription ? { ...obj, completed: true } : obj ); const allCompleted = newObjectives.every(obj => obj.completed); return { ...q, objectives: newObjectives, status: allCompleted ? 'completed' : q.status }; } return q; })); break;
                    default: if (tagType !== 'DEFINE_REALM_SYSTEM') { unprocessedTags.push(match[0]); }
                }
            }
        }
        const finalStory = cleanStory.trim();
        if (unprocessedTags.length > 0 && applySideEffects) { console.warn("Unprocessed Tags:", unprocessedTags); }
        return finalStory;
    }, []);
    
    const responseSchema = { type: Type.OBJECT, properties: { story: { type: Type.STRING }, choices: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['story', 'choices'] };

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
    
    const generateInitialStory = useCallback(async () => {
        if (!ai) return;
        setIsLoading(true);
        const finalPersonality = worldData.customPersonality || worldData.personalityFromList;
        const writingStyleText = worldData.writingStyle === 'first_person' ? 'Ngôi thứ nhất - Nhân vật chính xưng "Ta/Tôi"' : 'Ngôi thứ hai - "Ngươi" là nhân vật chính';
        const nsfwInstruction = worldData.allowNsfw ? 'Cho phép. Kích hoạt quy tắc nội dung 18+ của Quản Trò. Viết một cách trần trụi, bạo lực, tục tĩu và không giới hạn.' : 'Không, AI phải tránh các chủ đề và mô tả 18+.';
        const activeRules = customRules.filter(r => r.isActive);
        let customRulesContext = '';
        if (activeRules.length > 0) { customRulesContext = `\n--- TRI THỨC & LUẬT LỆ TÙY CHỈNH (ĐANG ÁP DỤNG) ---\n${activeRules.map(r => `- ${r.content}`).join('\n')}\n--- KẾT THÚC ---\n`; }
        const userPrompt = `${customRulesContext}BẠN LÀ QUẢN TRÒ...`;
        const initialPcEntity: Entity = { name: worldData.characterName || 'Vô Danh', type: 'pc', description: worldData.bio, gender: worldData.gender, personality: finalPersonality, learnedSkills: [], };
        setKnownEntities({ [initialPcEntity.name]: initialPcEntity });
        setParty([initialPcEntity]);
        const initialHistory: GameHistoryEntry[] = [{ role: 'user', parts: [{ text: userPrompt }] }];
        setGameHistory(initialHistory);
        try {
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: initialHistory, config: { systemInstruction, responseMimeType: "application/json", responseSchema, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 1024 } } });
            const turnTokens = response.usageMetadata?.totalTokenCount || 0;
            setCurrentTurnTokens(turnTokens);
            setTotalTokens(prev => prev + turnTokens);
            if (turnTokens > 80000) { console.warn(`⚠️ Initial story token vượt giới hạn: ${turnTokens.toLocaleString()}/80,000`); setNotification(`🚨 Cảnh báo: Câu chuyện khởi tạo sử dụng ${turnTokens.toLocaleString()} tokens (vượt 80k)`); setTimeout(() => setNotification(null), 8000); } else if (turnTokens > 70000) { console.log(`⚠️ Initial story token gần giới hạn: ${turnTokens.toLocaleString()}/80,000`); }
            const responseText = response.text.trim();
            parseApiResponse(responseText);
            setGameHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
        } catch (error: any) {
            if (!isUsingDefaultKey && userApiKeyCount > 1 && error.toString().includes('429')) {
                rotateKey();
                setStoryLog(prev => [...prev, "**⭐ Lỗi giới hạn yêu cầu. Đã tự động chuyển sang API Key tiếp theo. Vui lòng thử lại hành động của bạn. ⭐**"]);
                setChoices(choices);
            } else {
                console.error("Error generating initial story:", error);
                setStoryLog(["Có lỗi xảy ra khi bắt đầu câu chuyện. Vui lòng thử lại."]);
            }
        } finally {
            setIsLoading(false);
        }
    }, [ai, worldData, customRules, systemInstruction, parseApiResponse, isUsingDefaultKey, userApiKeyCount, rotateKey]);
        
    const handleAction = useCallback(async (action: string) => {
        let originalAction = action.trim();
        let isNsfwRequest = false;
        const nsfwRegex = /\s+nsfw\s*$/i;
        if (nsfwRegex.test(originalAction)) { isNsfwRequest = true; originalAction = originalAction.replace(nsfwRegex, '').trim(); }
        if (!originalAction || isLoading || !ai) return;
        setIsLoading(true);
        setChoices([]);
        setCustomAction('');
        setStoryLog(prev => [...prev, `> ${originalAction}`]);
        let ruleChangeContext = '';
        if (ruleChanges) { setRuleChanges(null); }
        let nsfwInstructionPart = isNsfwRequest && worldData.allowNsfw ? `\nLƯU Ý ĐẶC BIỆT: ...` : '';
        const currentGameState: SaveData = { worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, lastCompressionTurn, historyStats };
        const userPrompt = buildEnhancedRagPrompt(originalAction, currentGameState, ruleChangeContext, nsfwInstructionPart);
        const newUserEntry: GameHistoryEntry = { role: 'user', parts: [{ text: userPrompt }] };
		const historyForApi = [...gameHistory, newUserEntry];
        try {
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: historyForApi, config: { systemInstruction, responseMimeType: "application/json", responseSchema, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 1024 } } });
            const turnTokens = response.usageMetadata?.totalTokenCount || 0;
            setCurrentTurnTokens(turnTokens);
            setTotalTokens(prev => prev + turnTokens);
            if (turnTokens > 80000) { console.warn(`⚠️ Token vượt giới hạn: ${turnTokens.toLocaleString()}/80,000`); setNotification(`🚨 Cảnh báo: Lượt này sử dụng ${turnTokens.toLocaleString()} tokens (vượt 80k)`); setTimeout(() => setNotification(null), 8000); } else if (turnTokens > 70000) { console.log(`⚠️ Token gần giới hạn: ${turnTokens.toLocaleString()}/80,000`); setNotification(`⚠️ Thông báo: Token sử dụng cao (${turnTokens.toLocaleString()}/80k)`); setTimeout(() => setNotification(null), 5000); } else if (turnTokens > 60000) { console.log(`✅ Token ở mức an toàn: ${turnTokens.toLocaleString()}/80,000`); }
            const responseText = response.text.trim();
            parseApiResponse(responseText);
            const modelEntry: GameHistoryEntry = { role: 'model', parts: [{ text: responseText }] };
            const newFullHistory = [...historyForApi, modelEntry];
            const historyResult = HistoryManager.manageHistory(newFullHistory, turnCount + 1);
            setGameHistory(historyResult.activeHistory);
            if (historyResult.shouldCompress && historyResult.compressedSegment) {
                setCompressedHistory(prev => [...prev, historyResult.compressedSegment!]);
                setLastCompressionTurn(turnCount + 1);
                setHistoryStats(prev => ({ totalEntriesProcessed: prev.totalEntriesProcessed + historyResult.stats.savedEntries, totalTokensSaved: prev.totalTokensSaved + (historyResult.compressedSegment?.tokenCount || 0), compressionCount: prev.compressionCount + 1 }));
            }
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

    const debouncedHandleAction = useDebouncedCallback(handleAction, 500);

    // --- Effects ---
    useEffect(() => {
        if (storyContainerRef.current) {
            storyContainerRef.current.scrollTop = storyContainerRef.current.scrollHeight;
        }
    }, [processedStoryLog]);

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
            setStoryLog([apiKeyError || "AI chưa sẵn sàng. Vui lòng kiểm tra thiết lập API Key và quay về trang chủ."])
            setIsLoading(false);
        } else {
            if (storyContainerRef.current) {
                storyContainerRef.current.scrollTop = storyContainerRef.current.scrollHeight;
            }
        }
    }, [gameHistory, isAiReady, generateInitialStory, apiKeyError]); 

    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            (window as any).gameDebug = {
                historyStats: () => HistoryManager.getHistoryStats(gameHistory, compressedHistory),
                compressedHistory,
                currentHistory: gameHistory,
                cleanupStats: () => GameStateOptimizer.getCleanupStatistics({ worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle } as SaveData),
                forceCleanup: (aggressive = false) => handleManualCleanup(aggressive),
                cleanupHistory: totalCleanupStats.cleanupHistory
            };
        }
    }, [gameHistory, compressedHistory, turnCount, knownEntities, statuses, quests, memories, party]);

    useEffect(() => {
        if (turnCount > 0) {
            const currentGameState: SaveData = { worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, lastCompressionTurn, historyStats, cleanupStats: totalCleanupStats };
            const cleanupResult = GameStateOptimizer.performCleanup(currentGameState, cleanupConfig);
            if (cleanupResult.shouldRunCleanup) {
                setMemories(cleanupResult.optimizedState.memories);
                setChronicle(cleanupResult.optimizedState.chronicle);
                setQuests(cleanupResult.optimizedState.quests);
                setStatuses(cleanupResult.optimizedState.statuses);
                setKnownEntities(cleanupResult.optimizedState.knownEntities);
                setCleanupStats(cleanupResult.stats);
                setTotalCleanupStats(prev => ({ totalCleanupsPerformed: prev.totalCleanupsPerformed + 1, totalTokensSavedFromCleanup: prev.totalTokensSavedFromCleanup + cleanupResult.stats.totalTokensSaved, lastCleanupTurn: turnCount, cleanupHistory: [...prev.cleanupHistory.slice(-10), { turn: turnCount, tokensSaved: cleanupResult.stats.totalTokensSaved, itemsRemoved: cleanupResult.stats.memoriesRemoved + cleanupResult.stats.chronicleEntriesRemoved + cleanupResult.stats.questsArchived + cleanupResult.stats.statusesRemoved + cleanupResult.stats.entitiesArchived }] }));
                if (cleanupResult.stats.totalTokensSaved > 1000) {
                    setNotification(`🧹 Cleanup hoàn thành: Tiết kiệm ${Math.round(cleanupResult.stats.totalTokensSaved / 1000)}k tokens`);
                    setTimeout(() => setNotification(null), 4000);
                }
            }
        }
    }, [turnCount]);

    
    // --- Event Handlers ---
    const handleManualCleanup = useCallback((aggressive: boolean = false) => {
        const currentGameState: SaveData = { worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, lastCompressionTurn, historyStats, cleanupStats: totalCleanupStats };
        const result = GameStateOptimizer.forceCleanup(currentGameState, aggressive);
        setMemories(result.optimizedState.memories);
        setChronicle(result.optimizedState.chronicle);
        setQuests(result.optimizedState.quests);
        setStatuses(result.optimizedState.statuses);
        setKnownEntities(result.optimizedState.knownEntities);
        setCleanupStats(result.stats);
        setNotification(`🧹 ${aggressive ? 'Aggressive' : 'Manual'} cleanup: ${Math.round(result.stats.totalTokensSaved / 1000)}k tokens saved`);
        setTimeout(() => setNotification(null), 5000);
    }, [worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, lastCompressionTurn, historyStats, totalCleanupStats]);

    const handleEntityClick = useCallback((entityName: string) => setActiveEntity(knownEntities[entityName] || null), [knownEntities]);
    const handleUseItem = useCallback((itemName: string) => { setActiveEntity(null); setTimeout(() => handleAction(`Sử dụng vật phẩm: ${itemName}`), 100); }, [handleAction]);
    const handleLearnItem = useCallback((itemName: string) => { setActiveEntity(null); setTimeout(() => handleAction(`Học công pháp: ${itemName}`), 100); }, [handleAction]);
    const handleEquipItem = useCallback((itemName: string) => { setActiveEntity(null); setTimeout(() => handleAction(`Trang bị ${itemName}`), 100); }, [handleAction]);
    const handleUnequipItem = useCallback((itemName: string) => { setActiveEntity(null); setTimeout(() => handleAction(`Tháo ${itemName}`), 100); }, [handleAction]);
    const handleStatusClick = useCallback((status: Status) => setActiveStatus(status), []);
    const handleToggleMemoryPin = useCallback((index: number) => setMemories(prev => prev.map((mem, i) => i === index ? { ...mem, pinned: !mem.pinned } : mem)), []);
    const handleQuestClick = useCallback((quest: Quest) => setActiveQuest(quest), []);
    
    const handleSuggestAction = useCallback(async () => {
        if (isLoading || !ai) return;
        setIsLoading(true);
        try {
            const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: `Bối cảnh: "${storyLog.slice(-1)[0]}". Gợi ý một hành động sáng tạo.` });
            setCustomAction(response.text.trim());
        } catch (error) {
            console.error("Error suggesting action:", error);
            setCustomAction("Không thể nhận gợi ý lúc này.");
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, ai, storyLog]);

    const handleSaveGame = useCallback(() => {
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
        const currentGameState: SaveData = { worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle, compressedHistory, lastCompressionTurn, historyStats, cleanupStats: totalCleanupStats };
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

    const handleSaveRules = useCallback((newRules: CustomRule[]) => {
        setCustomRules(newRules);
        previousRulesRef.current = JSON.parse(JSON.stringify(newRules));
        setShowRulesSavedSuccess(true);
        setTimeout(() => setShowRulesSavedSuccess(false), 3500);
    }, []);

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
    
    const memoizedStoryContent = useMemo(() => {
        return processedStoryLog.map((item) => (
           item.isUserAction
            ? <p key={item.id} className='text-cyan-700 dark:text-cyan-300 italic pl-4'>{item.content}</p>
            : <OptimizedInteractiveText key={item.id} text={item.content} onEntityClick={handleEntityClick} knownEntities={knownEntities} />
       ));
    }, [processedStoryLog, handleEntityClick, knownEntities]);

    return (
        <div className="bg-transparent w-full h-full p-0 md:p-4 flex flex-col font-sans text-slate-900 dark:text-white relative" style={{maxHeight: '98vh', height: '98vh'}}>
            <GameNotifications notification={notification} showSaveSuccess={showSaveSuccess} showRulesSavedSuccess={showRulesSavedSuccess} />
            
            <SidebarNav isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} onHome={() => setIsHomeModalOpen(true)} onSave={handleSaveGame} onMap={() => setIsMapModalOpen(true)} onRules={() => setIsCustomRulesModalOpen(true)} onKnowledge={() => setIsKnowledgeModalOpen(true)} onMemory={() => setIsMemoryModalOpen(true)} onRestart={() => setIsRestartModalOpen(true)} onPCInfo={() => setIsPcInfoModalOpen(true)} onParty={() => setIsPartyModalOpen(true)} onQuests={() => setIsQuestLogModalOpen(true)} historyStats={historyStats} compressedSegments={compressedHistory.length} hasActiveQuests={hasActiveQuests} currentTurnTokens={currentTurnTokens} totalTokens={totalTokens} gameHistory={gameHistory} cleanupStats={totalCleanupStats} onManualCleanup={() => handleManualCleanup(false)} />
            <MobileHeader onOpenSidebar={() => setIsSidebarOpen(true)} worldData={worldData} />
            <DesktopHeader onHome={() => setIsHomeModalOpen(true)} onSave={handleSaveGame} onMap={() => setIsMapModalOpen(true)} onRules={() => setIsCustomRulesModalOpen(true)} onKnowledge={() => setIsKnowledgeModalOpen(true)} onMemory={() => setIsMemoryModalOpen(true)} onRestart={() => setIsRestartModalOpen(true)} onPCInfo={() => setIsPcInfoModalOpen(true)} onParty={() => setIsPartyModalOpen(true)} onQuests={() => setIsQuestLogModalOpen(true)} worldData={worldData} gameTime={gameTime} turnCount={turnCount} currentTurnTokens={currentTurnTokens} totalTokens={totalTokens} hasActiveQuests={hasActiveQuests} onManualCleanup={() => handleManualCleanup(false)} />

            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 overflow-hidden p-4 md:p-0">
                <StoryPanel
                    storyContainerRef={storyContainerRef}
                    isLoading={isLoading}
                    isAiReady={isAiReady}
                    storyLength={processedStoryLog.length}
                >
                    {memoizedStoryContent}
                </StoryPanel>
                <ActionPanel isAiReady={isAiReady} apiKeyError={apiKeyError} isLoading={isLoading} choices={choices} handleAction={handleAction} debouncedHandleAction={debouncedHandleAction} customAction={customAction} setCustomAction={setCustomAction} handleSuggestAction={handleSuggestAction} isCustomActionLocked={isCustomActionLocked} />
            </div>
            
            <MobileInputFooter onChoicesClick={() => setIsChoicesModalOpen(true)} customAction={customAction} setCustomAction={setCustomAction} handleAction={handleAction} debouncedHandleAction={debouncedHandleAction} isLoading={isLoading} isAiReady={isAiReady} isCustomActionLocked={isCustomActionLocked} />

            {/* MODALS */}
            <ConfirmationModal isOpen={isHomeModalOpen} onClose={() => setIsHomeModalOpen(false)} onConfirm={onBackToMenu} title="Về Trang Chủ?" message="Bạn có chắc muốn thoát? Mọi tiến trình chưa lưu sẽ bị mất." />
            <ConfirmationModal isOpen={isRestartModalOpen} onClose={() => setIsRestartModalOpen(false)} onConfirm={handleRestartGame} title="Bắt Đầu Lại?" message="Bạn có chắc muốn bắt đầu lại cuộc phiêu lưu? Toàn bộ tiến trình hiện tại sẽ được khởi tạo lại từ đầu với cùng thiết lập thế giới." />
            <EntityInfoModal entity={activeEntity} onClose={() => setActiveEntity(null)} onUseItem={handleUseItem} onLearnItem={handleLearnItem} onEquipItem={handleEquipItem} onUnequipItem={handleUnequipItem} statuses={statuses} onStatusClick={handleStatusClick} />
            <StatusDetailModal status={activeStatus} onClose={() => setActiveStatus(null)} />
            <QuestDetailModal quest={activeQuest} onClose={() => setActiveQuest(null)} />
            <MemoryModal isOpen={isMemoryModalOpen} onClose={() => setIsMemoryModalOpen(false)} memories={memories} onTogglePin={handleToggleMemoryPin} />
            <KnowledgeBaseModal isOpen={isKnowledgeModalOpen} onClose={() => setIsKnowledgeModalOpen(false)} pc={pcEntity} knownEntities={knownEntities} onEntityClick={handleEntityClick} turnCount={turnCount} />
            <CustomRulesModal isOpen={isCustomRulesModalOpen} onClose={() => setIsCustomRulesModalOpen(false)} onSave={handleSaveRules} currentRules={customRules} />
            <MapModal isOpen={isMapModalOpen} onClose={() => setIsMapModalOpen(false)} locations={Object.values(knownEntities).filter(e => e.type === 'location')} currentLocationName={pcEntity?.location || ''} discoveryOrder={locationDiscoveryOrder} />
            <InfoPanelModal isOpen={isPcInfoModalOpen} onClose={() => setIsPcInfoModalOpen(false)} title="Thông Tin Nhân Vật" icon={<UserIcon className="w-6 h-6" />}>
                <PlayerCharacterSheet pc={pcEntity} statuses={pcStatuses} knownEntities={knownEntities} onStatusClick={handleStatusClick} onEntityClick={handleEntityClick}/>
            </InfoPanelModal>
            <InfoPanelModal isOpen={isPartyModalOpen} onClose={() => setIsPartyModalOpen(false)} title="Tổ Đội" icon={<GameIcons.NpcIcon className="w-6 h-6" />}>
                <PartyMemberTab party={displayParty} onMemberClick={handleEntityClick}/>
            </InfoPanelModal>
            <InfoPanelModal isOpen={isQuestLogModalOpen} onClose={() => setIsQuestLogModalOpen(false)} title="Nhật Ký Nhiệm Vụ" icon={<GameIcons.ScrollIcon className="w-6 h-6" />}>
                <QuestLog quests={quests} onQuestClick={handleQuestClick} />
            </InfoPanelModal>
            <MobileChoicesModal isOpen={isChoicesModalOpen} onClose={() => setIsChoicesModalOpen(false)} choices={choices} onAction={handleAction} />
        </div>
    );
};