import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { AIContext } from '../App.tsx';
import type { SaveData, FormData, KnownEntities, Status, Quest, GameHistoryEntry, Memory, Entity, CustomRule, Chronicle } from './types.ts';
import { buildRagPrompt } from './promptBuilder.ts';

import { ConfirmationModal } from './ConfirmationModal.tsx';
import { EntityInfoModal } from './EntityInfoModal.tsx';
import { StatusDetailModal } from './StatusDetailModal.tsx';
import { MemoryModal } from './MemoryModal.tsx';
import { QuestDetailModal } from './QuestDetailModal.tsx';
import { KnowledgeBaseModal } from './KnowledgeBaseModal.tsx';
import { CustomRulesModal } from './CustomRulesModal.tsx';
import { MapModal } from './MapModal.tsx';
import { InteractiveText } from './InteractiveText.tsx';
import { QuestLog } from './QuestLog.tsx';
import { PartyMemberTab } from './PartyMemberTab.tsx';
import * as GameIcons from './GameIcons.tsx';
import { getIconForEntity, getIconForStatus, getStatusBorderColor, getStatusTextColor, getStatusFontWeight } from './utils.ts';


import { 
    SpinnerIcon, HomeIcon, ArchiveIcon, BrainIcon, MemoryIcon, RefreshIcon, SparklesIcon,
    ExclamationIcon, DocumentAddIcon, CrossIcon, UserIcon, MenuIcon, InfoIcon
} from './Icons.tsx';


// Reusable Info Modal for Status, Party, Quests
const InfoPanelModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    icon: React.ReactNode;
}> = ({ isOpen, onClose, title, children, icon }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[65] p-4" onClick={onClose}>
            <div 
                className="bg-white/90 dark:bg-[#2a2f4c]/90 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg shadow-2xl w-full max-w-lg text-slate-900 dark:text-white flex flex-col" 
                onClick={e => e.stopPropagation()}
                style={{maxHeight: '70vh'}}
            >
                <div className="p-4 border-b border-slate-200 dark:border-slate-600 flex justify-between items-center flex-shrink-0">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                        {icon}
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white text-3xl leading-none">
                        <CrossIcon className="w-6 h-6"/>
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
};

const PlayerCharacterSheet: React.FC<{
    pc: Entity | undefined;
    statuses: Status[];
    knownEntities: KnownEntities;
    onStatusClick: (status: Status) => void;
    onEntityClick: (entityName: string) => void;
}> = ({ pc, statuses, knownEntities, onStatusClick, onEntityClick }) => {
    if (!pc) {
        return <div className="p-4 text-center text-slate-500">Không tìm thấy thông tin nhân vật.</div>;
    }

    const learnedSkills = pc.learnedSkills || [];

    return (
        <div className="p-4 h-full flex flex-col space-y-4 text-slate-700 dark:text-gray-300">
            {/* Basic Info */}
            <div>
                <h4 className="font-semibold text-lg text-slate-800 dark:text-white mb-2 border-b border-slate-300 dark:border-slate-600 pb-1 flex items-center gap-2">
                    <UserIcon className="w-5 h-5" />
                    Thông tin cơ bản
                </h4>
                <div className="space-y-1 text-sm pl-2">
                    <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Tên:</strong> {pc.name}</p>
                    {pc.location && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Vị trí:</strong> {pc.location}</p>}
                    {pc.age && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Tuổi tác:</strong> {pc.age}</p>}
                    {pc.appearance && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Dung mạo:</strong> {pc.appearance}</p>}
                    {pc.realm && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Thực lực:</strong> {pc.realm}</p>}
                    {pc.fame && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Danh vọng:</strong> {pc.fame}</p>}
                </div>
            </div>

            {/* Skills */}
            <div>
                <h4 className="font-semibold text-lg text-slate-800 dark:text-white mb-2 border-b border-slate-300 dark:border-slate-600 pb-1 flex items-center gap-2">
                    <GameIcons.ScrollIcon className="w-5 h-5" />
                    Kỹ năng & Công pháp
                </h4>
                {learnedSkills.length > 0 ? (
                    <ul className="space-y-2 pl-2">
                        {learnedSkills.map(skillName => {
                            const skillEntity = knownEntities[skillName];
                            return (
                                <li key={skillName}>
                                    <button onClick={() => onEntityClick(skillName)} className="text-left w-full p-2 bg-slate-200/50 dark:bg-slate-800/50 rounded-md hover:bg-slate-300/50 dark:hover:bg-slate-700/50 transition-colors">
                                        <p className="font-semibold text-cyan-700 dark:text-cyan-300 flex items-center gap-2">
                                            <span className="w-4 h-4">{getIconForEntity(skillEntity || {name: skillName, type: 'skill', description: ''})}</span>
                                            {skillName} {skillEntity?.realm ? `(${skillEntity.realm})` : ''}
                                        </p>
                                        {skillEntity?.description && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 pl-6">{skillEntity.description}</p>}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ) : <p className="text-sm text-slate-600 dark:text-slate-400 italic pl-2">Chưa học được kỹ năng nào.</p>}
            </div>

            {/* Statuses */}
            <div>
                <h4 className="font-semibold text-lg text-slate-800 dark:text-white mb-2 border-b border-slate-300 dark:border-slate-600 pb-1 flex items-center gap-2">
                    <GameIcons.HeartIcon className="w-5 h-5" />
                    Trạng thái hiện tại
                </h4>
                 {statuses.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 pl-2">
                        {statuses.map(status => (
                            <button
                                key={status.name}
                                onClick={() => onStatusClick(status)}
                                className={`px-2 py-1 border rounded-md transition-colors duration-200 flex items-center gap-1.5 ${getStatusBorderColor(status)} hover:bg-slate-300/50 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 ${getStatusBorderColor(status).replace('border-', 'ring-').replace('/50', '')}`}
                            >
                                <span className="w-4 h-4">{getIconForStatus(status)}</span>
                                <span className={`${getStatusTextColor(status)} ${getStatusFontWeight(status)} text-sm`}>
                                    {status.name}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : <p className="text-sm text-slate-600 dark:text-slate-400 italic pl-2">Đang trong tình trạng bình thường.</p>}
            </div>
        </div>
    );
};

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

const MobileChoicesModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    choices: string[];
    onAction: (action: string) => void;
}> = ({ isOpen, onClose, choices, onAction }) => {
    if (!isOpen) return null;

    return (
        <div className="md:hidden fixed inset-0 bg-black/60 z-[70] flex items-end" onClick={onClose}>
            <div
                className="w-full bg-white/95 dark:bg-[#1f2238]/95 backdrop-blur-sm p-4 pt-3 rounded-t-2xl shadow-2xl transition-transform transform translate-y-0"
                style={{ animation: 'slideUp 0.3s ease-out' }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-600 rounded-full mx-auto mb-3"></div>
                <h3 className="text-lg font-semibold mb-3 text-cyan-600 dark:text-cyan-400 text-center">Lựa chọn hành động</h3>
                 <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2">
                    {choices.map((choice, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                onAction(choice);
                                onClose();
                            }}
                            className="w-full text-left p-3 bg-slate-200 dark:bg-slate-700 hover:bg-purple-600 dark:hover:bg-purple-600 text-slate-800 dark:text-gray-200 hover:text-white rounded-md transition-colors duration-200 shadow-sm border border-slate-300 dark:border-slate-600"
                        >
                             {choice.match(/^\d+\.\s/) ? choice : `${index + 1}. ${choice}`}
                        </button>
                    ))}
                </div>
                <button onClick={onClose} className="w-full mt-4 py-2.5 bg-slate-600 text-white rounded-md font-semibold">Đóng</button>
            </div>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); }
                    to { transform: translateY(0); }
                }
            `}</style>
        </div>
    );
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
    fontFamily: string,
    fontSize: string,
    keyRotationNotification: string | null;
    onClearNotification: () => void;
}> = ({ initialGameState, onBackToMenu, fontFamily, fontSize, keyRotationNotification, onClearNotification }) => {
    const { ai, isAiReady, apiKeyError, rotateKey, isUsingDefaultKey, userApiKeyCount } = useContext(AIContext);
    const [worldData, setWorldData] = useState(initialGameState.worldData);
    const [isLoading, setIsLoading] = useState(initialGameState.gameHistory.length === 0 && isAiReady);
    const [customAction, setCustomAction] = useState('');
    const [isRestartModalOpen, setIsRestartModalOpen] = useState(false);
    const [isHomeModalOpen, setIsHomeModalOpen] = useState(false);
    
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

    // Modal & Notification States
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
        // Rehydrate location order from history if possible
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

    // --- Core References & Derived State ---
    const storyEndRef = useRef<HTMLDivElement>(null);
    const pc = useMemo(() => Object.values(knownEntities).find(e => e.type === 'pc'), [knownEntities]);
    const pcStatuses = useMemo(() => statuses.filter(s => s.owner === pc?.name), [statuses, pc]);
    const currentInventory = useMemo(() => Object.values(knownEntities).filter(e => e.type === 'item' && e.owner === pc?.name), [knownEntities, pc]);
    
    const storyAndChoices = useMemo(() => {
        // This is a rehydration fix. If the component remounts or state is slow to update,
        // we use initialGameState.gameHistory as a fallback for the first render.
        const currentHistory = gameHistory.length > 0 ? gameHistory : initialGameState.gameHistory;

        if (currentHistory.length === 0) {
            // If loading (i.e., first turn is being generated), show a loading message.
            if (isLoading) {
                return { story: "Đang kiến tạo thế giới, xin chờ...", choices: [] };
            }
            // Otherwise, show the default start message.
            return { story: "Bắt đầu cuộc phiêu lưu của bạn...", choices: [] };
        }

        const lastEntry = currentHistory[currentHistory.length - 1];

        if (lastEntry.role !== 'model') {
            // This handles when the user has submitted an action and is waiting for the AI.
            return { story: "Đang chờ phản hồi từ AI...", choices: [] };
        }

        try {
            const jsonResponse = JSON.parse(lastEntry.parts[0].text);
            const storyText = jsonResponse.story || "Lỗi: Không tìm thấy nội dung truyện.";
            const choices = jsonResponse.choices || [];
            return { story: storyText, choices: choices };
        } catch (e) {
            // Fallback for non-JSON responses or parsing errors
            console.error("Lỗi phân tích phản hồi từ AI:", e);
            console.error("Phản hồi gốc:", lastEntry.parts[0].text);
            return { story: `Lỗi hiển thị: Không thể phân tích phản hồi từ AI. Hãy thử làm mới hoặc tải lại game.\n\nNội dung gốc:\n${lastEntry.parts[0].text}`, choices: [] };
        }
    }, [gameHistory, initialGameState.gameHistory, isLoading]);


    // --- Side Effects ---
    // Scroll to bottom on new story
    useEffect(() => {
        storyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [storyAndChoices.story]);

    // Show API key rotation notification
    useEffect(() => {
        if (keyRotationNotification) {
            setNotification(keyRotationNotification);
            onClearNotification(); // Clear it from App state once handled
        }
    }, [keyRotationNotification, onClearNotification]);
    
    // Clear notification after a delay
    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => {
                setNotification(null);
            }, 6000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    // This effect runs once on component mount to generate the initial story turn
    useEffect(() => {
        if (initialGameState.gameHistory.length === 0 && isAiReady) {
            setIsLoading(true);
            // The prompt for the very first turn is special
            const firstAction = "Bắt đầu. Hãy giới thiệu thế giới và tình hình hiện tại của nhân vật chính. Tạo ra một vài lựa chọn ban đầu.";
            
            let firstTurnContext = '';
            
            const initialRules = initialGameState.customRules.filter(r => r.isActive).map(r => r.content).join('\n');
            if(initialRules) {
                firstTurnContext += `--- CẬP NHẬT LUẬT LỆ ---\n${initialRules}\n--- KẾT THÚC LUẬT LỆ ---\n`;
            }

            const firstSkill = initialGameState.worldData.startSkill;
            if(firstSkill){
                firstTurnContext += `\nADMIN: Player đã chọn kỹ năng khởi đầu là "${firstSkill}". Hãy dùng thẻ [SKILL_LEARNED] để thêm kỹ năng này cho nhân vật chính.`;
            }

            if(initialGameState.worldData.addGoal){
                 firstTurnContext += `\nADMIN: Người chơi yêu cầu một mục tiêu ban đầu. Hãy dùng thẻ [QUEST_ASSIGNED] để tạo một nhiệm vụ chính đầu tiên hấp dẫn.`;
            }

            getAiResponse(firstAction, firstTurnContext, '');
        }
    }, [isAiReady]);


    // --- Tag Parsing and State Update Logic ---
    const parseStoryAndTags = (text: string): string => {
        // Regex to find all [TAG: key="value" ...]
        const tagRegex = /\[([A-Z_]+):\s*([^\]]+)\]/g;
        let match;
        const newEntities: KnownEntities = {};
        const newQuests: Quest[] = [];
        const completedQuestObjectives: { questTitle: string, objectiveDescription: string }[] = [];
        const newLearnedSkills: string[] = [];
        const newMemories: Memory[] = [];
        const updatedQuests: Quest[] = [];
        let timeElapsed = { years: 0, months: 0, days: 0, hours: 0 };
        const newChronicleEntries: { type: 'turn' | 'chapter' | 'memoir', text: string }[] = [];
        
        const textWithoutTags = text.replace(tagRegex, '').trim();

        while ((match = tagRegex.exec(text)) !== null) {
            const tagName = match[1];
            const attributesText = match[2];
            
            // Regex to parse attributes: key="value" or key=value
            const attrRegex = /(\w+)\s*=\s*(?:"([^"]*)"|([^"\s]+))/g;
            let attrMatch;
            const attributes: { [key: string]: any } = {};

            while ((attrMatch = attrRegex.exec(attributesText)) !== null) {
                attributes[attrMatch[1]] = attrMatch[2] ?? attrMatch[3]; // Use quoted value if available
            }

            try {
                switch(tagName) {
                    // --- Entity Creation ---
                    case 'LORE_NPC':
                    case 'LORE_ITEM':
                    case 'LORE_LOCATION':
                    case 'LORE_FACTION':
                    case 'LORE_CONCEPT':
                    case 'LORE_COMPANION':
                    case 'SKILL_LEARNED': {
                        const typeMap: { [key: string]: any } = {
                            LORE_NPC: 'npc', LORE_ITEM: 'item', LORE_LOCATION: 'location',
                            LORE_FACTION: 'faction', LORE_CONCEPT: 'concept', LORE_COMPANION: 'companion',
                            SKILL_LEARNED: 'skill'
                        };
                        const entityType = typeMap[tagName];
                        if (attributes.name) {
                            const newEntity: Entity = {
                                name: attributes.name,
                                type: entityType,
                                description: attributes.description || '',
                            };
                            
                            // Assign specific attributes
                            for (const key in attributes) {
                                if (key !== 'name' && key !== 'type') {
                                    if (['usable', 'equippable', 'consumable', 'learnable', 'equipped'].includes(key)) {
                                        newEntity[key] = attributes[key] === 'true';
                                    } else if (['durability', 'uses'].includes(key)) {
                                        newEntity[key] = parseInt(attributes[key], 10);
                                    } else {
                                        newEntity[key] = attributes[key];
                                    }
                                }
                            }
                            newEntities[attributes.name] = newEntity;

                            if (tagName === 'SKILL_LEARNED') {
                                newLearnedSkills.push(attributes.name);
                            }
                            if (tagName === 'LORE_COMPANION') {
                               setParty(prev => {
                                    const existing = prev.find(p => p.name === newEntity.name);
                                    return existing ? prev : [...prev, newEntity];
                               });
                            }
                             if (tagName === 'LORE_LOCATION') {
                                setLocationDiscoveryOrder(prev => {
                                    if (!prev.includes(attributes.name)) {
                                        return [...prev, attributes.name];
                                    }
                                    return prev;
                                });
                            }
                        }
                        break;
                    }
                     // --- Entity Update ---
                    case 'ENTITY_UPDATE': {
                        const { name, ...updates } = attributes;
                        if (name) {
                            setKnownEntities(prev => {
                                const entityToUpdate = prev[name];
                                if (!entityToUpdate) return prev;
                                
                                const newName = (updates as any).newName || name;
                                const newEntity = { ...entityToUpdate, ...updates, name: newName };
                                delete (newEntity as any).newName; // clean up temp field

                                for (const key in newEntity) {
                                    if(['usable', 'equippable', 'consumable', 'learnable', 'equipped'].includes(key) && typeof (newEntity as any)[key] === 'string') {
                                        (newEntity as any)[key] = (newEntity as any)[key] === 'true';
                                    }
                                }

                                const newEntitiesState = { ...prev };
                                if (name !== newName) {
                                    delete newEntitiesState[name];
                                }
                                newEntitiesState[newName] = newEntity as Entity;
                                
                                // Also update in party if exists
                                setParty(partyPrev => partyPrev.map(p => p.name === name ? newEntity as Entity : p));
                                // Also update quest givers
                                setQuests(questPrev => questPrev.map(q => q.giver === name ? {...q, giver: newName} : q));
                                // Also update item owners
                                setKnownEntities(entitiesPrev => {
                                    const updatedItemOwners = {...entitiesPrev};
                                    Object.values(updatedItemOwners).forEach(e => {
                                        if (e.owner === name) e.owner = newName;
                                    });
                                    return updatedItemOwners;
                                });
                                // Also update status owners
                                setStatuses(statusPrev => statusPrev.map(s => s.owner === name ? {...s, owner: newName} : s));

                                return newEntitiesState;
                            });
                        }
                        break;
                    }
                    // --- Statuses ---
                    case 'STATUS_APPLIED_SELF':
                    case 'STATUS_APPLIED_NPC': {
                        const owner = tagName === 'STATUS_APPLIED_SELF' ? (pc?.name || 'Vô Danh') : attributes.name;
                        const { name, ...statusAttrs } = attributes;
                        if(owner && statusAttrs.type){
                            setStatuses(prev => applyStatusWithLimit(prev, statusAttrs, owner));
                        }
                        break;
                    }
                    case 'STATUS_CURED_SELF':
                    case 'STATUS_CURED_NPC': {
                        const owner = tagName === 'STATUS_CURED_SELF' ? (pc?.name || 'Vô Danh') : attributes.name;
                        const statusName = attributes.name;
                        if (owner && statusName) {
                            setStatuses(prev => prev.filter(s => !(s.name === statusName && s.owner === owner)));
                        }
                        break;
                    }
                    // --- Quests ---
                    case 'QUEST_ASSIGNED': {
                        const objectives = attributes.objectives.split(';').map((desc: string) => ({ description: desc.trim(), completed: false }));
                        newQuests.push({
                            title: attributes.title,
                            description: attributes.description,
                            objectives: objectives,
                            giver: attributes.giver,
                            reward: attributes.reward,
                            isMainQuest: attributes.isMainQuest === 'true',
                            status: 'active'
                        });
                        break;
                    }
                    case 'QUEST_UPDATED': {
                        const { title, status } = attributes;
                        updatedQuests.push({ title, status } as any);
                        break;
                    }
                    case 'QUEST_OBJECTIVE_COMPLETED': {
                         completedQuestObjectives.push({ 
                            questTitle: attributes.questTitle, 
                            objectiveDescription: attributes.objectiveDescription 
                        });
                        break;
                    }
                    // --- Inventory ---
                     case 'ITEM_AQUIRED': {
                        setKnownEntities(prev => {
                            const item = prev[attributes.name];
                            if (item && item.type === 'item') {
                                const owner = attributes.owner || 'pc';
                                return {...prev, [attributes.name]: {...item, owner}};
                            }
                            return prev;
                        });
                        break;
                    }
                    case 'ITEM_CONSUMED': {
                        setKnownEntities(prev => {
                            const item = prev[attributes.name];
                            if(item && item.type === 'item') {
                                if (typeof item.uses === 'number' && item.uses > 1) {
                                    return { ...prev, [attributes.name]: {...item, uses: item.uses - 1} };
                                } else {
                                    // Remove item
                                    const newState = { ...prev };
                                    delete newState[attributes.name];
                                    return newState;
                                }
                            }
                            return prev;
                        });
                        break;
                    }
                    case 'ITEM_EQUIPPED': {
                        const itemName = attributes.name;
                        if (itemName) {
                            setKnownEntities(prev => {
                                // Unequip other items in the same slot if needed (future logic)
                                const updatedItem = { ...prev[itemName], equipped: true };
                                return { ...prev, [itemName]: updatedItem };
                            });
                        }
                        break;
                    }
                    case 'ITEM_UNEQUIPPED': {
                         const itemName = attributes.name;
                        if (itemName) {
                            setKnownEntities(prev => {
                                const updatedItem = { ...prev[itemName], equipped: false };
                                return { ...prev, [itemName]: updatedItem };
                            });
                        }
                        break;
                    }
                    // --- Chronicle & Memory ---
                    case 'MEMORY_ADD':
                         newMemories.push({ text: attributes.text, pinned: false });
                        break;
                    case 'CHRONICLE_TURN':
                    case 'CHRONICLE_CHAPTER':
                    case 'CHRONICLE_MEMOIR':
                        const type = tagName.split('_')[1].toLowerCase() as 'turn' | 'chapter' | 'memoir';
                        newChronicleEntries.push({type: type, text: attributes.text});
                        break;
                    // --- Time ---
                    case 'TIME_ELAPSED':
                        timeElapsed = {
                            years: parseInt(attributes.years || '0', 10),
                            months: parseInt(attributes.months || '0', 10),
                            days: parseInt(attributes.days || '0', 10),
                            hours: parseInt(attributes.hours || '0', 10),
                        };
                        break;
                    // --- Realm ---
                    case 'REALM_UPDATE': {
                        const { target, realm } = attributes;
                        if (target && realm) {
                            setKnownEntities(prev => {
                                if (prev[target]) {
                                    const updatedEntity = { ...prev[target], realm };
                                    return { ...prev, [target]: updatedEntity };
                                }
                                return prev;
                            });
                        }
                        break;
                    }
                }
            } catch (e) {
                console.error(`Error parsing tag: ${match[0]}`, e);
            }
        }
        
        // --- Batch State Updates ---
        if (Object.keys(newEntities).length > 0) {
            setKnownEntities(prev => ({ ...prev, ...newEntities }));
        }
        if (newLearnedSkills.length > 0 && pc) {
            setKnownEntities(prev => ({ 
                ...prev, 
                [pc.name]: { 
                    ...pc, 
                    learnedSkills: [...new Set([...(pc.learnedSkills || []), ...newLearnedSkills])] 
                }
            }));
        }
        if (newQuests.length > 0) {
            setQuests(prev => [...prev, ...newQuests]);
        }
        if (updatedQuests.length > 0) {
             setQuests(prev => prev.map(q => {
                const update = updatedQuests.find(uq => uq.title === q.title);
                return update ? { ...q, status: update.status as 'active' | 'completed' | 'failed' } : q;
             }));
        }
        if (completedQuestObjectives.length > 0) {
            setQuests(prev => prev.map(q => {
                const completedForThisQuest = completedQuestObjectives.filter(co => co.questTitle === q.title).map(co => co.objectiveDescription);
                if(completedForThisQuest.length === 0) return q;

                const newObjectives = q.objectives.map(obj => {
                    if (completedForThisQuest.includes(obj.description)) {
                        return { ...obj, completed: true };
                    }
                    return obj;
                });
                return { ...q, objectives: newObjectives };
            }));
        }
        if (newMemories.length > 0) {
            setMemories(prev => [...prev, ...newMemories]);
        }
        if (newChronicleEntries.length > 0) {
            setChronicle(prev => {
                const newChron = {...prev};
                newChronicleEntries.forEach(entry => {
                    newChron[entry.type] = [...newChron[entry.type], entry.text];
                });
                return newChron;
            });
        }
        if (timeElapsed.years > 0 || timeElapsed.months > 0 || timeElapsed.days > 0 || timeElapsed.hours > 0) {
            setGameTime(prev => calculateNewTime(prev, timeElapsed));
        }

        return textWithoutTags;
    };


    const handleAiResponse = (response: any) => {
        try {
            const jsonString = response.text.trim();
            const jsonResponse = JSON.parse(jsonString);

            // Parse tags, update state, and get the cleaned story text
            const cleanedStory = parseStoryAndTags(jsonResponse.story);

            // Update history with the cleaned story
            const newHistoryEntryText = JSON.stringify({
                story: cleanedStory,
                choices: jsonResponse.choices || []
            });

            setGameHistory(prev => [...prev, { role: 'model', parts: [{ text: newHistoryEntryText }] }]);
            
            // Update token count
            // const tokens = response.usageMetadata.totalTokens;
            // setCurrentTurnTokens(tokens);
            // setTotalTokens(prev => prev + tokens);

        } catch (e) {
            console.error("Lỗi phân tích JSON từ AI:", e);
            console.error("Phản hồi gốc:", response.text);
            const errorText = `Lỗi hiển thị: Không thể phân tích phản hồi từ AI. Hãy thử làm mới hoặc tải lại game.\n\nNội dung gốc:\n${response.text}`;
            setGameHistory(prev => [...prev, { role: 'model', parts: [{ text: JSON.stringify({ story: errorText, choices: [] }) }] }]);
        }
    }


    const getAiResponse = async (action: string, context: string, nsfwContext: string) => {
        if (!isAiReady || !ai) {
            console.error("AI is not ready");
            setNotification("AI chưa sẵn sàng. Vui lòng kiểm tra lại API Key.");
            return;
        }

        setIsLoading(true);

        const fullPrompt = buildRagPrompt(
            action,
            { worldData, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, chronicle, gameTime, totalTokens },
            context,
            nsfwContext
        );

        // Add user action to history
        setGameHistory(prev => [...prev, { role: 'user', parts: [{ text: `--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---\n"${action}"\n${context}` }] }]);
        setTurnCount(prev => prev + 1);

        try {
            const result = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            story: { type: Type.STRING, description: 'Phần tường thuật câu chuyện (tiếng Việt). Bắt buộc phải có.' },
                            choices: { 
                                type: Type.ARRAY, 
                                items: { type: Type.STRING },
                                description: 'Danh sách các lựa chọn hành động cho người chơi (tiếng Việt). Từ 3-5 lựa chọn.',
                                nullable: true
                            }
                        },
                        required: ['story', 'choices']
                    },
                },
            });
            handleAiResponse(result);
        } catch (error: any) {
            console.error("Lỗi gọi API Gemini:", error);
            if (error.toString().includes('429') && !isUsingDefaultKey && userApiKeyCount > 1) {
                rotateKey();
            } else {
                 setNotification(`Lỗi API: ${error.message}. Hãy thử lại hoặc kiểm tra API Key.`);
            }
             // Rollback history and turn count on error
             setGameHistory(prev => prev.slice(0, -1));
             setTurnCount(prev => prev - 1);
        } finally {
            setIsLoading(false);
            setCustomAction('');
        }
    };

    const handleAction = (action: string) => {
        if (isLoading || !isAiReady) return;
        
        let nsfwContext = '';
        if (worldData.allowNsfw && action.toLowerCase().includes('nsfw')) {
            nsfwContext = '\nLƯU Ý: Đây là một hành động NSFW. Hãy mô tả kết quả một cách chi tiết, trần trụi và không bị kiểm duyệt.';
        }

        getAiResponse(action, '', nsfwContext);
    };

    // --- User Interactions ---
    const handleCustomActionSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (customAction.trim()) {
            handleAction(customAction.trim());
        }
    };
    
    const handleSaveGame = () => {
        const saveData: SaveData = {
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
        };
        const jsonString = JSON.stringify(saveData, null, 2);
        const blob = new Blob([jsonString], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const pcName = pc?.name || 'Vô-Danh';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `AI-RPG_${pcName}_Turn-${turnCount}_${timestamp}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setShowSaveSuccess(true);
        setTimeout(() => setShowSaveSuccess(false), 3000);
    };

    const handleRestart = () => {
        // Reset all state to initial state, but keep world settings
        setKnownEntities(initialGameState.knownEntities);
        setStatuses(initialGameState.statuses);
        setQuests(initialGameState.quests);
        setGameHistory([]);
        setTurnCount(0);
        setMemories(initialGameState.memories);
        setParty(initialGameState.party);
        // Do not reset customRules, as they are part of the world setup
        setChronicle({ memoir: [], chapter: [], turn: [] });
        setGameTime({ year: 1, month: 1, day: 1, hour: 8 });
        setCurrentTurnTokens(0);
        setTotalTokens(0);
        setLocationDiscoveryOrder([]);

        setIsLoading(true);

        // Trigger the first turn generation again
        const firstAction = "Bắt đầu lại. Hãy giới thiệu thế giới và tình hình hiện tại của nhân vật chính. Tạo ra một vài lựa chọn ban đầu.";
        
        let firstTurnContext = '';
        const initialRules = customRules.filter(r => r.isActive).map(r => r.content).join('\n');
         if(initialRules) {
            firstTurnContext += `--- CẬP NHẬT LUẬT LỆ ---\n${initialRules}\n--- KẾT THÚC LUẬT LỆ ---\n`;
        }
        const firstSkill = worldData.startSkill;
        if(firstSkill){
            firstTurnContext += `\nADMIN: Player đã chọn kỹ năng khởi đầu là "${firstSkill}". Hãy dùng thẻ [SKILL_LEARNED] để thêm kỹ năng này cho nhân vật chính.`;
        }
        if(worldData.addGoal){
             firstTurnContext += `\nADMIN: Người chơi yêu cầu một mục tiêu ban đầu. Hãy dùng thẻ [QUEST_ASSIGNED] để tạo một nhiệm vụ chính đầu tiên hấp dẫn.`;
        }

        getAiResponse(firstAction, firstTurnContext, '');
        setIsRestartModalOpen(false);
    };

    const handleEntityClick = (entityName: string) => {
        const entity = knownEntities[entityName];
        if (entity) {
            setActiveEntity(entity);
        }
    };
    
    const handleStatusClick = (status: Status) => {
        setActiveStatus(status);
    };

    const handleQuestClick = (quest: Quest) => {
        setActiveQuest(quest);
    }
    
    const handleToggleMemoryPin = (index: number) => {
        setMemories(prev => {
            const newMems = [...prev];
            newMems[index].pinned = !newMems[index].pinned;
            return newMems;
        });
    };
    
    const handleSaveRules = (newRules: CustomRule[]) => {
        const rulesChanged = JSON.stringify(customRules) !== JSON.stringify(newRules);
        setCustomRules(newRules);
        
        if(rulesChanged) {
            const activeRules = newRules.filter(r => r.isActive).map(r => r.content).join('\n');
            const ruleUpdateContext = `--- CẬP NHẬT LUẬT LỆ ---\n${activeRules}\n--- KẾT THÚC LUẬT LỆ ---\n`;
            
            // Send a "no-op" action to the AI to process the rule change
            getAiResponse("Quản trò, hãy ghi nhận và áp dụng các thay đổi về luật lệ vừa được cập nhật. Tiếp tục câu chuyện.", ruleUpdateContext, '');
        
            setShowRulesSavedSuccess(true);
            setTimeout(() => setShowRulesSavedSuccess(false), 3000);
        }
    };
    
    // --- Item Interaction Handlers ---
    const handleItemAction = (itemName: string, actionType: 'use' | 'learn' | 'equip' | 'unequip') => {
        const actionMap = {
            use: "sử dụng",
            learn: "học/lĩnh ngộ",
            equip: "trang bị",
            unequip: "tháo"
        };
        const actionVerb = actionMap[actionType];
        const action = `Ta ${actionVerb} ${itemName}.`;
        handleAction(action);
        setActiveEntity(null); // Close modal
    };

    const renderActionButtons = (choices: string[]) => (
        <div className="hidden md:flex flex-wrap justify-center gap-3 mt-4">
            {choices.map((choice, index) => (
                <button
                    key={index}
                    onClick={() => handleAction(choice)}
                    className="flex-grow basis-1/3 min-w-[200px] text-left p-3 bg-slate-200 dark:bg-slate-700 hover:bg-purple-600 dark:hover:bg-purple-600 text-slate-800 dark:text-gray-200 hover:text-white rounded-md transition-colors duration-200 shadow-sm border border-slate-300 dark:border-slate-600"
                >
                    {choice.match(/^\d+\.\s/) ? choice : `${index + 1}. ${choice}`}
                </button>
            ))}
        </div>
    );
    
    const sidebarButtons = [
        { label: "Lưu Game", icon: <ArchiveIcon />, onClick: handleSaveGame, notification: showSaveSuccess ? "Đã lưu!" : undefined },
        { label: "Thông tin PC", icon: <UserIcon />, onClick: () => setIsPcInfoModalOpen(true) },
        { label: "Nhiệm vụ", icon: <GameIcons.ScrollIcon />, onClick: () => setIsQuestLogModalOpen(true) },
        { label: "Tri Thức", icon: <BrainIcon />, onClick: () => setIsKnowledgeModalOpen(true) },
        { label: "Bản Đồ", icon: <GameIcons.MapPinIcon />, onClick: () => setIsMapModalOpen(true) },
        { label: "Ký Ức", icon: <MemoryIcon />, onClick: () => setIsMemoryModalOpen(true) },
        { label: "Luật Lệ", icon: <DocumentAddIcon />, onClick: () => setIsCustomRulesModalOpen(true), notification: showRulesSavedSuccess ? "Đã lưu!" : undefined },
        { label: "Tổ Đội", icon: <GameIcons.NpcIcon/>, onClick: () => setIsPartyModalOpen(true) },
        { label: "Bắt Đầu Lại", icon: <RefreshIcon />, onClick: () => setIsRestartModalOpen(true) },
        { label: "Về Trang Chủ", icon: <HomeIcon />, onClick: () => setIsHomeModalOpen(true) }
    ];

    const mainContent = (
         <div className="relative flex-grow flex flex-col p-2 sm:p-4 md:p-6 pb-24 md:pb-6">
            <div className="flex-grow overflow-y-auto pr-2" id="story-container">
                <InteractiveText text={storyAndChoices.story} onEntityClick={handleEntityClick} knownEntities={knownEntities} />
                <div ref={storyEndRef} />
            </div>

            {isLoading && (
                <div className="absolute inset-0 bg-slate-900/50 flex flex-col items-center justify-center z-10">
                    <SpinnerIcon className="w-12 h-12 text-purple-400" />
                    <p className="mt-4 text-white font-semibold">AI đang suy nghĩ...</p>
                </div>
            )}
            
            <div className="mt-4 flex-shrink-0">
                 {/* Action buttons for Desktop */}
                {!isLoading && renderActionButtons(storyAndChoices.choices)}

                 {/* Custom Action Input */}
                <form onSubmit={handleCustomActionSubmit} className="mt-4 flex items-center">
                    <input
                        type="text"
                        value={customAction}
                        onChange={(e) => setCustomAction(e.target.value)}
                        placeholder="Hành động khác..."
                        className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-l-md py-3 px-4 text-base text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 dark:placeholder-gray-400"
                        disabled={isLoading}
                    />
                    <button type="submit" className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-r-md transition-colors duration-200 disabled:bg-slate-500" disabled={isLoading}>Gửi</button>
                </form>
            </div>
             {/* Mobile: Choices Button */}
             <div className="md:hidden fixed bottom-16 left-4 right-4 z-20">
                 {!isLoading && storyAndChoices.choices.length > 0 && (
                     <button
                         onClick={() => setIsChoicesModalOpen(true)}
                         className="w-full py-3 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg shadow-lg flex items-center justify-center text-lg"
                     >
                         <SparklesIcon className="w-6 h-6 mr-2" />
                         Hiển thị lựa chọn
                     </button>
                 )}
             </div>
        </div>
    );

    return (
      <div className={`w-full max-w-full min-h-screen h-full flex flex-col md:flex-row bg-white dark:bg-[#1f2238] shadow-2xl rounded-lg ${fontFamily} ${fontSize}`}>
        
        {/* Mobile Header */}
        <div className="md:hidden p-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-300 dark:border-slate-700 flex justify-between items-center">
             <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-slate-700 dark:text-slate-200">
                <MenuIcon className="w-6 h-6"/>
            </button>
            <h1 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-cyan-400">Nhập Vai A.I</h1>
            <div className="w-10"></div>
        </div>
        
        {/* Mobile Sidebar */}
        {isSidebarOpen && (
            <div className="fixed inset-0 bg-black/60 z-[80]" onClick={() => setIsSidebarOpen(false)}>
                 <div className="w-64 h-full bg-slate-100 dark:bg-slate-900 shadow-xl p-4 flex flex-col space-y-2" onClick={e => e.stopPropagation()}>
                     <h2 className="text-xl font-bold mb-4 text-slate-800 dark:text-white">Chức năng</h2>
                     {sidebarButtons.map(btn => (
                        <button key={btn.label} onClick={() => { btn.onClick(); setIsSidebarOpen(false); }} className="w-full flex items-center p-3 text-left bg-slate-200 dark:bg-slate-800 rounded-md hover:bg-purple-500 dark:hover:bg-purple-600 hover:text-white dark:text-white text-sm">
                           <span className="w-5 h-5 mr-3">{btn.icon}</span>
                            {btn.label}
                             {btn.notification && <span className="ml-auto text-xs font-bold text-green-500">{btn.notification}</span>}
                        </button>
                     ))}
                </div>
            </div>
        )}

        {/* --- Desktop Sidebar --- */}
        <aside className="hidden md:flex flex-col flex-shrink-0 w-64 bg-slate-100 dark:bg-slate-900 p-4 border-r border-slate-300 dark:border-slate-700 space-y-2">
            <h1 className="text-xl font-bold text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-cyan-400">Nhập Vai A.I</h1>
            <div className="text-center text-xs text-slate-500 dark:text-slate-400 mb-2">Lượt: {turnCount} | {gameTime.hour}:00, {gameTime.day}/{gameTime.month}/{gameTime.year}</div>
            
            <div className="flex-grow overflow-y-auto space-y-2 pr-1">
                {sidebarButtons.map(btn => (
                    <button
                        key={btn.label}
                        onClick={btn.onClick}
                        className="w-full flex items-center p-2 text-left bg-slate-200 dark:bg-slate-800 rounded-md hover:bg-purple-500 dark:hover:bg-purple-600 hover:text-white dark:text-white text-sm relative"
                    >
                        <span className="w-5 h-5 mr-3">{btn.icon}</span>
                        {btn.label}
                        {btn.notification && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-green-500 animate-ping-once">{btn.notification}</span>}
                    </button>
                ))}
            </div>
            
            <div className="text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-300 dark:border-slate-700 text-center">
                 <p>{isUsingDefaultKey ? 'Đang dùng Gemini AI mặc định.' : `Đang dùng API Key của bạn.`}</p>
                 <p>Dev: Bách Mật Nhất Sơ</p>
            </div>
        </aside>

        {/* --- Main Content Area --- */}
        <main className={`flex-grow flex flex-col relative ${fontFamily} ${fontSize}`}>
            {notification && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-red-100 dark:bg-red-900 border-b-2 border-red-500 dark:border-red-400 text-red-800 dark:text-red-200 p-3 text-sm font-semibold z-30 shadow-lg text-center flex items-center justify-center gap-2">
                    <ExclamationIcon className="w-5 h-5"/> {notification}
                </div>
            )}
            
            {/* For Desktop Layout */}
            <div className="hidden md:flex flex-grow">
               {mainContent}
            </div>

             {/* For Mobile Layout */}
            <div className="md:hidden flex-grow flex flex-col h-[calc(100vh-4rem-4rem)]">
                 {mainContent}
            </div>

        </main>

        {/* Modals */}
        <ConfirmationModal
            isOpen={isRestartModalOpen}
            onClose={() => setIsRestartModalOpen(false)}
            onConfirm={handleRestart}
            title="Bắt đầu lại cuộc phiêu lưu?"
            message={
                <>
                <p>Bạn có chắc chắn muốn bắt đầu lại không?</p>
                <p className="mt-2 text-sm text-yellow-600 dark:text-yellow-400">Thao tác này sẽ xóa toàn bộ tiến trình hiện tại và tạo một cốt truyện mới dựa trên thiết lập ban đầu của thế giới.</p>
                </>
            }
        />
        <ConfirmationModal
            isOpen={isHomeModalOpen}
            onClose={() => setIsHomeModalOpen(false)}
            onConfirm={onBackToMenu}
            title="Quay về Trang Chủ?"
            message="Bạn có chắc chắn muốn thoát? Toàn bộ tiến trình chưa lưu sẽ bị mất."
        />
        
        {/* Info Modals */}
        <EntityInfoModal 
            entity={activeEntity} 
            onClose={() => setActiveEntity(null)}
            onUseItem={(name) => handleItemAction(name, 'use')}
            onLearnItem={(name) => handleItemAction(name, 'learn')}
            onEquipItem={(name) => handleItemAction(name, 'equip')}
            onUnequipItem={(name) => handleItemAction(name, 'unequip')}
            statuses={statuses}
            onStatusClick={handleStatusClick}
        />
        <StatusDetailModal status={activeStatus} onClose={() => setActiveStatus(null)} />
        <QuestDetailModal quest={activeQuest} onClose={() => setActiveQuest(null)} />
        <MemoryModal isOpen={isMemoryModalOpen} onClose={() => setIsMemoryModalOpen(false)} memories={memories} onTogglePin={handleToggleMemoryPin} />
        <KnowledgeBaseModal isOpen={isKnowledgeModalOpen} onClose={() => setIsKnowledgeModalOpen(false)} pc={pc} knownEntities={knownEntities} onEntityClick={handleEntityClick} turnCount={turnCount} />
        <CustomRulesModal isOpen={isCustomRulesModalOpen} onClose={() => setIsCustomRulesModalOpen(false)} currentRules={customRules} onSave={handleSaveRules} />
        <MapModal isOpen={isMapModalOpen} onClose={() => setIsMapModalOpen(false)} locations={Object.values(knownEntities).filter(e => e.type === 'location')} currentLocationName={pc?.location || ''} discoveryOrder={locationDiscoveryOrder} />

        {/* Mobile Modals */}
        <MobileChoicesModal 
            isOpen={isChoicesModalOpen}
            onClose={() => setIsChoicesModalOpen(false)}
            choices={storyAndChoices.choices}
            onAction={handleAction}
        />

        {/* Panel Modals */}
        <InfoPanelModal isOpen={isPcInfoModalOpen} onClose={() => setIsPcInfoModalOpen(false)} title="Bảng Nhân Vật" icon={<UserIcon />}>
            <PlayerCharacterSheet pc={pc} statuses={pcStatuses} onStatusClick={handleStatusClick} knownEntities={knownEntities} onEntityClick={handleEntityClick} />
        </InfoPanelModal>
         <InfoPanelModal isOpen={isPartyModalOpen} onClose={() => setIsPartyModalOpen(false)} title="Tổ Đội" icon={<GameIcons.NpcIcon />}>
            <PartyMemberTab party={party} onMemberClick={handleEntityClick} />
        </InfoPanelModal>
        <InfoPanelModal isOpen={isQuestLogModalOpen} onClose={() => setIsQuestLogModalOpen(false)} title="Nhiệm Vụ" icon={<GameIcons.ScrollIcon />}>
            <QuestLog quests={quests} onQuestClick={handleQuestClick} />
        </InfoPanelModal>
      </div>
    );
};