
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
import { InteractiveText } from './InteractiveText.tsx';
import { QuestLog } from './QuestLog.tsx';
import { PartyMemberTab } from './PartyMemberTab.tsx';
import * as GameIcons from './GameIcons.tsx';
import { getIconForEntity, getIconForStatus, getStatusBorderColor, getStatusTextColor, getStatusFontWeight } from './utils.ts';


import { 
    SpinnerIcon, HomeIcon, ArchiveIcon, BrainIcon, MemoryIcon, RefreshIcon, SparklesIcon,
    ExclamationIcon, DocumentAddIcon, CrossIcon, UserIcon, MenuIcon,
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

export const GameScreen: React.FC<{ 
    initialGameState: SaveData, 
    onBackToMenu: () => void,
    fontFamily: string,
    fontSize: string
}> = ({ initialGameState, onBackToMenu, fontFamily, fontSize }) => {
    const { ai, isAiReady, apiKeyError } = useContext(AIContext);
    const [worldData, setWorldData] = useState(initialGameState.worldData);
    const [storyLog, setStoryLog] = useState(initialGameState.storyLog);
    const [choices, setChoices] = useState(initialGameState.choices);
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
    const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    const [showRulesSavedSuccess, setShowRulesSavedSuccess] = useState(false);
    const [isPcInfoModalOpen, setIsPcInfoModalOpen] = useState(false);
    const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
    const [isQuestLogModalOpen, setIsQuestLogModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isChoicesModalOpen, setIsChoicesModalOpen] = useState(false);

    // Rule change tracking
    const [ruleChanges, setRuleChanges] = useState<{ activated: CustomRule[], deactivated: CustomRule[], updated: { oldRule: CustomRule, newRule: CustomRule }[] } | null>(null);
    const previousRulesRef = useRef<CustomRule[]>(initialGameState.customRules);

    const storyContainerRef = useRef<HTMLDivElement>(null);

    const pcEntity = useMemo(() => Object.values(knownEntities).find(e => e.type === 'pc'), [knownEntities]);
    const pcName = pcEntity?.name;

    const isCustomActionLocked = useMemo(() => {
        return customRules.some(rule =>
            rule.isActive && rule.content.toUpperCase().includes('KHÓA HÀNH ĐỘNG TÙY Ý')
        );
    }, [customRules]);

    useEffect(() => {
        if (storyContainerRef.current) {
            storyContainerRef.current.scrollTop = storyContainerRef.current.scrollHeight;
        }
    }, [storyLog]);
    
    useEffect(() => {
        // Only generate story if history is empty (i.e., it's a new game or a restart)
        if (gameHistory.length === 0 && isAiReady) {
            setIsLoading(true); // Ensure loading state is active
            generateInitialStory();
        } else if (!isAiReady) {
            setStoryLog([apiKeyError || "AI chưa sẵn sàng. Vui lòng kiểm tra API Key và quay về trang chủ."])
            setIsLoading(false);
        } else {
             // For loaded games, still need to scroll to bottom on initial load
            if (storyContainerRef.current) {
                storyContainerRef.current.scrollTop = storyContainerRef.current.scrollHeight;
            }
        }
    }, [gameHistory, isAiReady]);
    
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

    const parseStoryAndTags = (storyText: string): string => {
        if (!storyText) return '';
    
        const tagRegex = /\[([A-Z_]+):\s*([^\]]+)\]/g;
        let cleanStory = storyText;
    
        const parseAttributes = (attrString: string): { [key: string]: any } => {
            const attributes: { [key: string]: any } = {};
            const attrRegex = /(\w+)\s*=\s*"([^"]*)"/g;
            let match;
            while ((match = attrRegex.exec(attrString)) !== null) {
                const key = match[1];
                let value: string | boolean | number | { description: string, completed: boolean }[] = match[2];
    
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
            cleanStory = cleanStory.replace(match[0], ''); // Remove tag from displayed story
            const tagType = match[1];
            const rawContent = match[2];
            
            const attributes = parseAttributes(rawContent);
            if (tagType === 'MEMORY_ADD' && attributes.text) {
                setMemories(prev => [...prev, { text: attributes.text, pinned: false }]);
                continue;
            }
            if (Object.keys(attributes).length === 0) {
                 unprocessedTags.push(match[0]);
                 continue;
            }
    
            switch (tagType) {
                case 'TIME_ELAPSED':
                    const elapsed = {
                        years: Number(attributes.years) || 0,
                        months: Number(attributes.months) || 0,
                        days: Number(attributes.days) || 0,
                        hours: Number(attributes.hours) || 0
                    };
                    if (Object.values(elapsed).some(v => v > 0)) {
                        setGameTime(prevTime => calculateNewTime(prevTime, elapsed));
                    }
                    break;
                case 'CHRONICLE_TURN':
                    if (attributes.text) {
                        setChronicle(prev => ({ ...prev, turn: [...prev.turn, attributes.text] }));
                    }
                    break;
                case 'CHRONICLE_CHAPTER':
                    if (attributes.text) {
                        setChronicle(prev => ({ ...prev, chapter: [...prev.chapter, attributes.text] }));
                    }
                    break;
                case 'CHRONICLE_MEMOIR':
                     if (attributes.text) {
                        setChronicle(prev => ({ ...prev, memoir: [...prev.memoir, attributes.text] }));
                    }
                    break;
                case 'STATUS_APPLIED_SELF':
                    setStatuses(prev => [...prev.filter(s => s.name !== attributes.name || s.owner !== 'pc'), { ...attributes, owner: 'pc' } as Status]);
                    break;
                case 'STATUS_APPLIED_NPC':
                    setStatuses(prev => [...prev.filter(s => !(s.name === attributes.name && s.owner === attributes.npcName)), { ...attributes, owner: attributes.npcName } as Status]);
                    break;
                case 'STATUS_CURED_SELF':
                    setStatuses(prev => prev.filter(s => !(s.name === attributes.name && s.owner === 'pc')));
                    break;
                case 'STATUS_CURED_NPC':
                    setStatuses(prev => prev.filter(s => !(s.name === attributes.name && s.owner === attributes.npcName)));
                    break;
                case 'SKILL_LEARNED':
                    setKnownEntities(prev => {
                        const newEntities = { ...prev };
                        const { name, description, ...rest } = attributes;
                        if (name && description) {
                            const newSkill: Entity = {
                                type: 'skill',
                                name: name,
                                description: description,
                                ...rest
                            };
                            newEntities[name] = newSkill;
                    
                            const pc = Object.values(newEntities).find(e => e.type === 'pc');
                            if (pc) {
                                const pcName = pc.name;
                                const updatedPc = { ...newEntities[pcName] };
                                if (!updatedPc.learnedSkills) {
                                    updatedPc.learnedSkills = [];
                                }
                                if (!updatedPc.learnedSkills.includes(name)) {
                                    updatedPc.learnedSkills.push(name);
                                }
                                newEntities[pcName] = updatedPc;
                            }
                        } else {
                            console.warn('SKILL_LEARNED tag is missing required attributes (name, description)', attributes);
                        }
                        return newEntities;
                    });
                    break;
                case 'LORE_NPC':
                    setKnownEntities(prev => {
                        const newAttributes = { ...attributes };
                        if (typeof newAttributes.skills === 'string') {
                            newAttributes.skills = newAttributes.skills.split(',').map((s: string) => s.trim()).filter(Boolean);
                        }
                        return { ...prev, [attributes.name]: { type: 'npc', ...newAttributes } };
                    });
                    break;
                case 'LORE_ITEM':
                    setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'item', ...attributes } }));
                    break;
                case 'LORE_LOCATION':
                    setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'location', ...attributes } }));
                    break;
                case 'LORE_FACTION':
                     setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'faction', ...attributes } }));
                     break;
                case 'LORE_CONCEPT':
                     setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'concept', ...attributes } }));
                     break;
                case 'ENTITY_UPDATE':
                    setKnownEntities(prev => {
                        const newEntities = { ...prev };
                        const targetName = attributes.name;
                        if (newEntities[targetName]) {
                            // Use newDescription and remove it from attributes to avoid overwriting description with undefined
                            const { name, newDescription, ...updateData } = attributes;
                            const finalUpdateData = { ...updateData };
                            if (newDescription) {
                                finalUpdateData.description = newDescription;
                            }
                            
                            // Handle renaming
                            if (attributes.newName && attributes.newName !== targetName) {
                                const oldEntity = newEntities[targetName];
                                delete newEntities[targetName];
                                newEntities[attributes.newName] = {
                                    ...oldEntity,
                                    ...finalUpdateData,
                                    name: attributes.newName
                                };
                            } else {
                                newEntities[targetName] = { ...newEntities[targetName], ...finalUpdateData };
                            }
                        } else {
                            console.warn(`Attempted to update non-existent entity: ${targetName}`);
                        }
                        return newEntities;
                    });
                    break;
                case 'ITEM_AQUIRED':
                    setKnownEntities(prev => ({ ...prev, [attributes.name]: { type: 'item', owner: 'pc', ...attributes } }));
                    break;
                 case 'ITEM_CONSUMED':
                    setKnownEntities(prev => {
                        const newEntities = { ...prev };
                        const itemToConsume = newEntities[attributes.name];

                        if (itemToConsume && itemToConsume.type === 'item' && itemToConsume.owner === 'pc') {
                            if (typeof itemToConsume.uses === 'number' && itemToConsume.uses > 1) {
                                newEntities[attributes.name] = {
                                    ...itemToConsume,
                                    uses: itemToConsume.uses - 1,
                                };
                            } else {
                                const { owner, equipped, ...restOfItem } = itemToConsume;
                                newEntities[attributes.name] = restOfItem;
                            }
                        }
                        return newEntities;
                    });
                    break;
                case 'ITEM_EQUIPPED':
                    setKnownEntities(prev => {
                        const newEntities = { ...prev };
                        const item = newEntities[attributes.name];
                        if (item && item.owner === 'pc' && item.equippable) {
                            item.equipped = true;
                        }
                        return newEntities;
                    });
                    break;
                case 'ITEM_UNEQUIPPED':
                    setKnownEntities(prev => {
                        const newEntities = { ...prev };
                        const item = newEntities[attributes.name];
                        if (item && item.owner === 'pc') {
                            item.equipped = false;
                        }
                        return newEntities;
                    });
                    break;
                case 'ITEM_TRANSFORMED':
                    setKnownEntities(prev => {
                        const { oldName, newName, description, ...rest } = attributes;
                        if (!oldName || !newName) {
                            console.warn("ITEM_TRANSFORMED tag missing oldName or newName", attributes);
                            return prev;
                        }

                        const newEntities = { ...prev };
                        const oldItem = newEntities[oldName];
                        
                        if (oldItem) {
                            delete newEntities[oldName];
                        } else {
                             console.warn(`Attempted to transform non-existent item: ${oldName}`);
                        }
                        
                        const newItem: Entity = {
                            ...rest,
                            name: newName,
                            type: 'item',
                            owner: oldItem?.owner || 'pc',
                            description: description || `Vật phẩm được biến đổi từ ${oldName}.`,
                        };

                        newEntities[newName] = newItem;
                        
                        return newEntities;
                    });
                    break;
                case 'ITEM_UPDATED':
                     setKnownEntities(prev => {
                        const newEntities = { ...prev };
                        if (newEntities[attributes.name] && newEntities[attributes.name].owner === 'pc') {
                             newEntities[attributes.name] = { ...newEntities[attributes.name], ...attributes };
                        }
                        return newEntities;
                    });
                    break;
                 case 'ITEM_DAMAGED':
                    setKnownEntities(prev => {
                        const newEntities = { ...prev };
                        const item = newEntities[attributes.name];
                        if (item && typeof item.durability === 'number') {
                            item.durability = Math.max(0, item.durability - (attributes.damage || 0));
                        }
                        return newEntities;
                    });
                    break;
                case 'ITEM_REPAIRED':
                    setKnownEntities(prev => {
                        const newEntities = { ...prev };
                        const item = newEntities[attributes.name];
                        if (item && typeof item.durability === 'number') {
                            item.durability = Math.min(100, item.durability + (attributes.repairedAmount || 0));
                        }
                        return newEntities;
                    });
                    break;
                case 'REALM_UPDATE':
                    setKnownEntities(prev => {
                        const newEntities = { ...prev };
                        const targetEntity = Object.values(newEntities).find(e => e.name === attributes.target);
                        if (targetEntity) {
                            newEntities[targetEntity.name].realm = attributes.realm;
                        }
                        return newEntities;
                    });
                    break;
                case 'COMPANION':
                     const newCompanion = { type: 'companion', ...attributes } as Entity;
                     if (newCompanion.name && newCompanion.description) {
                        setParty(prev => [...prev.filter(p => p.name !== newCompanion.name), newCompanion]);
                        setKnownEntities(prev => ({ ...prev, [newCompanion.name]: newCompanion }));
                     } else {
                        console.warn('COMPANION tag is missing required attributes (name, description)', attributes);
                     }
                     break;
                case 'RELATIONSHIP_CHANGED':
                    setKnownEntities(prev => {
                        const newEntities = { ...prev };
                        if (newEntities[attributes.npcName]) {
                            newEntities[attributes.npcName].relationship = attributes.relationship;
                        }
                        return newEntities;
                    });
                    break;
                case 'QUEST_ASSIGNED':
                    const newQuest: Quest = {
                         title: attributes.title,
                         description: attributes.description,
                         objectives: attributes.objectives || [],
                         giver: attributes.giver,
                         reward: attributes.reward,
                         isMainQuest: attributes.isMainQuest || false,
                         status: 'active'
                    };
                    setQuests(prev => [...prev.filter(q => q.title !== newQuest.title), newQuest]);
                    break;
                case 'QUEST_UPDATED':
                    setQuests(prev => prev.map(q => q.title === attributes.title ? { ...q, status: attributes.status } : q));
                    break;
                case 'QUEST_OBJECTIVE_COMPLETED':
                    setQuests(prev => prev.map(q => {
                        if (q.title === attributes.questTitle) {
                            const newObjectives = q.objectives.map(obj => 
                                obj.description === attributes.objectiveDescription ? { ...obj, completed: true } : obj
                            );
                            const allCompleted = newObjectives.every(obj => obj.completed);
                            return {
                                ...q,
                                objectives: newObjectives,
                                status: allCompleted ? 'completed' : q.status
                            };
                        }
                        return q;
                    }));
                    break;
                 default:
                    if (tagType !== 'DEFINE_REALM_SYSTEM') {
                       unprocessedTags.push(match[0]);
                    }
            }
        }
        const finalStory = cleanStory.trim();
        if (unprocessedTags.length > 0) {
             console.warn("Unprocessed Tags:", unprocessedTags);
        }
        return finalStory;
    };
    

    const parseApiResponse = (text: string) => {
        try {
            const jsonResponse = JSON.parse(text);
            const cleanStory = parseStoryAndTags(jsonResponse.story);

            setStoryLog(prev => [...prev, cleanStory]);
            setChoices(jsonResponse.choices || []);

        } catch (e) {
            console.error("Failed to parse AI response:", e);
            console.error("Raw response text:", text);
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
            
            const activeRules = customRules.filter(r => r.isActive);
            let customRulesContext = '';
            if (activeRules.length > 0) {
                customRulesContext = `\n--- TRI THỨC & LUẬT LỆ TÙY CHỈNH (ĐANG ÁP DỤNG) ---\n${activeRules.map(r => `- ${r.content}`).join('\n')}\n--- KẾT THÚC ---\n`;
            }

            const userPrompt = `${customRulesContext}BẠN LÀ QUẢN TRÒ. Hãy bắt đầu một câu chuyện phiêu lưu mới dựa trên các thông tin sau:
- Thể loại: '${worldData.genre}'
- Phong cách viết: '${writingStyleText}'
- Bối cảnh: ${worldData.worldDetail}
- Độ khó: ${worldData.difficulty}
- Nhân vật chính (PC):
  - Tên: ${worldData.characterName || 'Vô Danh'}
  - Giới tính: ${worldData.gender}
  - Tiểu sử: ${worldData.bio}
  - Tính cách CỐT LÕI: "${finalPersonality}"
- Kỹ năng khởi đầu mong muốn: ${worldData.startSkill || 'Không có'}
- NSFW: ${nsfwInstruction}

YÊU CẦU:
1.  Bắt đầu câu chuyện bằng cách giới thiệu nhân vật chính. Sử dụng thẻ \`[ENTITY_UPDATE]\` để thiết lập các thông số ban đầu cho nhân vật chính (PC) bao gồm tuổi tác, dung mạo, và danh vọng ban đầu (VD: danh vọng="Vô danh tiểu tốt").
2.  Dùng thẻ \`[DEFINE_REALM_SYSTEM]\` để tạo hệ thống sức mạnh cho thế giới (nếu có).
3.  Tạo và định nghĩa kỹ năng khởi đầu cho nhân vật bằng thẻ \`[SKILL_LEARNED]\`. Nếu là công pháp, hãy thêm thuộc tính \`realm\`.
4.  Dùng các thẻ lệnh phù hợp khác để thiết lập trạng thái ban đầu (nếu có vật phẩm, hãy dùng \`[ITEM_AQUIRED]\`).
5.  Giao cho người chơi một nhiệm vụ đầu tiên đơn giản bằng thẻ \`[QUEST_ASSIGNED]\`, nhiệm vụ phải có tiêu đề, mô tả và ít nhất một mục tiêu.
6.  Cung cấp phần đầu của câu chuyện và 4-5 lựa chọn đầu tiên cho người chơi.
7.  Sử dụng định dạng thông báo nổi bật \`**⭐...⭐**\` nếu cần.`;
            
            // Create the PC entity
            const pcEntity: Entity = {
                name: worldData.characterName || 'Vô Danh',
                type: 'pc',
                description: worldData.bio,
                gender: worldData.gender,
                personality: finalPersonality,
                learnedSkills: [],
            };
            setKnownEntities({ [pcEntity.name]: pcEntity });
            setParty([pcEntity]);


            const initialHistory: GameHistoryEntry[] = [{ role: 'user', parts: [{ text: userPrompt }] }];
            setGameHistory(initialHistory);

            try {
                 const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: initialHistory,
                    config: {
                        systemInstruction: systemInstruction,
                        responseMimeType: "application/json",
                        responseSchema: responseSchema,
                    }
                });
                const turnTokens = response.usageMetadata?.totalTokenCount || 0;
                setCurrentTurnTokens(turnTokens);
                setTotalTokens(prev => prev + turnTokens);

                const responseText = response.text.trim();
                parseApiResponse(responseText);
                setGameHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
            } catch (error) {
                console.error("Error generating initial story:", error);
                setStoryLog(["Có lỗi xảy ra khi bắt đầu câu chuyện. Vui lòng thử lại."]);
            } finally {
                setIsLoading(false);
            }
    };
        
    const handleAction = async (action: string) => {
        let originalAction = action.trim();
        let isNsfwRequest = false;
        
        // Check for 'nsfw' at the end, possibly separated by spaces
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
        if (ruleChanges && (ruleChanges.activated.length > 0 || ruleChanges.deactivated.length > 0 || ruleChanges.updated.length > 0)) {
            ruleChangeContext += '--- CẬP NHẬT LUẬT LỆ THẾ GIỚI (XỬ LÝ TRƯỚC HÀNH ĐỘNG NGƯỜI CHƠI) ---\n';
            
            if (ruleChanges.activated.length > 0) {
                ruleChangeContext += 'KÍCH HOẠT LUẬT MỚI:\n';
                ruleChangeContext += ruleChanges.activated.map(r => `- "${r.content}"`).join('\n') + '\n';
            }
    
            if (ruleChanges.deactivated.length > 0) {
                ruleChangeContext += 'VÔ HIỆU HÓA LUẬT CŨ:\n';
                ruleChangeContext += ruleChanges.deactivated.map(r => `- "${r.content}"`).join('\n') + '\n';
            }

            if (ruleChanges.updated.length > 0) {
                ruleChangeContext += 'CẬP NHẬT LUẬT ĐANG HOẠT ĐỘNG:\n';
                ruleChangeContext += ruleChanges.updated.map(u => `LUẬT CŨ: "${u.oldRule.content}"\nLUẬT MỚI: "${u.newRule.content}"`).join('\n\n') + '\n';
            }
    
            ruleChangeContext += '--- KẾT THÚC CẬP NHẬT LUẬT ---\n';
            setRuleChanges(null); // Consume the changes
        }

        let nsfwInstructionPart = '';
        if (isNsfwRequest && worldData.allowNsfw) {
            nsfwInstructionPart = `\nLƯU Ý ĐẶC BIỆT: Người chơi đã yêu cầu "nsfw". Hãy tạo ra một phản hồi 18+ cực kỳ chi tiết, trần trụi và không giới hạn, ngay cả khi hành động có vẻ bình thường. Tập trung vào các yếu tố khiêu dâm, bạo lực, và tâm lý.`;
        }

        const activeRules = customRules.filter(r => r.isActive);
        let customRulesContext = '';
        if (activeRules.length > 0) {
             customRulesContext = `\n--- TRI THỨC & LUẬT LỆ TÙY CHỈNH (ĐANG ÁP DỤNG) ---\n${activeRules.map(r => `- ${r.content}`).join('\n')}\n--- KẾT THÚC ---\n`;
        }
        
        const currentGameState: SaveData = {
            worldData, storyLog, choices, knownEntities, statuses, quests, gameHistory, memories, party, customRules, systemInstruction, turnCount, totalTokens, gameTime, chronicle
        };
        const userPrompt = buildRagPrompt(originalAction, currentGameState, ruleChangeContext, customRulesContext, nsfwInstructionPart);
    
        const newUserEntry: GameHistoryEntry = { role: 'user', parts: [{ text: userPrompt }] };
        const updatedHistory = [...gameHistory, newUserEntry];
        setGameHistory(updatedHistory);
    
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: updatedHistory,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: responseSchema,
                }
            });
            const turnTokens = response.usageMetadata?.totalTokenCount || 0;
            setCurrentTurnTokens(turnTokens);
            setTotalTokens(prev => prev + turnTokens);

            const responseText = response.text.trim();
            parseApiResponse(responseText);
            setGameHistory(prev => [...prev, { role: 'model', parts: [{ text: responseText }] }]);
            setTurnCount(prev => prev + 1); // Increment turn count
        } catch (error) {
            console.error("Error continuing story:", error);
            // Revert the optimistic UI update on failure
            setStoryLog(prev => prev.slice(0, -1));
            const lastModelResponseText = [...gameHistory].reverse().find(h => h.role === 'model')?.parts[0].text;
            if(lastModelResponseText) {
                try {
                    const prevChoices = JSON.parse(lastModelResponseText).choices;
                    setChoices(prevChoices || []);
                } catch(e) {
                    console.error("Could not restore choices:", e);
                    setChoices([]);
                }
            }
             setStoryLog(prev => [...prev, "Lỗi: AI không thể xử lý yêu cầu. Vui lòng thử một hành động khác."]);
        } finally {
            setIsLoading(false);
        }
    };
    
    
    const handleEntityClick = (entityName: string) => {
        const entity = knownEntities[entityName];
        if (entity) {
            setActiveEntity(entity);
        }
    };

    const handleUseItem = (itemName: string) => {
        setActiveEntity(null); // Close modal
        // A short delay to prevent the modal from re-opening if the layout shifts
        setTimeout(() => {
            handleAction(`Sử dụng vật phẩm: ${itemName}`);
        }, 100);
    };

    const handleLearnItem = (itemName: string) => {
        setActiveEntity(null);
        setTimeout(() => {
            handleAction(`Học công pháp: ${itemName}`);
        }, 100);
    };

    const handleEquipItem = (itemName: string) => {
        setActiveEntity(null);
        setTimeout(() => {
            handleAction(`Trang bị ${itemName}`);
        }, 100);
    };
    
    const handleUnequipItem = (itemName: string) => {
        setActiveEntity(null);
        setTimeout(() => {
            handleAction(`Tháo ${itemName}`);
        }, 100);
    };

    const handleStatusClick = (status: Status) => {
        setActiveStatus(status);
    };

    const handleToggleMemoryPin = (index: number) => {
        setMemories(prev => prev.map((mem, i) => i === index ? { ...mem, pinned: !mem.pinned } : mem));
    };

    const handleQuestClick = (quest: Quest) => {
        setActiveQuest(quest);
    };
    
     const handleSuggestAction = async () => {
        if (isLoading || !ai) return;
        setIsLoading(true);
        const finalPersonality = worldData.customPersonality || worldData.personalityFromList;
        const suggestionPrompt = `Bối cảnh: "${storyLog.slice(-1)[0]}". Tính cách NV: "${finalPersonality}". Gợi ý một hành động sáng tạo hoặc hợp lý tiếp theo cho người chơi. Chỉ trả về một câu hành động ngắn gọn.`;
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: suggestionPrompt,
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
    
        const currentGameState: SaveData = {
          worldData,
          storyLog,
          choices,
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
        
        const jsonString = JSON.stringify(currentGameState, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        const charName = worldData.characterName.replace(/\s+/g, '_') || 'NhanVat';
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `AI-RolePlay-${charName}-${timestamp}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleSaveRules = (newRules: CustomRule[]) => {
        const oldRules = previousRulesRef.current;
        
        const activated: CustomRule[] = [];
        const deactivated: CustomRule[] = [];
        const updated: { oldRule: CustomRule, newRule: CustomRule }[] = [];
    
        const newRulesMap = new Map(newRules.map(r => [r.id, r]));
        const oldRulesMap = new Map(oldRules.map(r => [r.id, r]));
    
        // Check for new, updated, and activated/deactivated rules
        for (const [id, newRule] of newRulesMap.entries()) {
            const oldRule = oldRulesMap.get(id);
            if (!oldRule) {
                // Brand new rule
                if (newRule.isActive && newRule.content.trim()) {
                    activated.push(newRule);
                }
            } else {
                // Existing rule, check for changes
                if (newRule.isActive && !oldRule.isActive) {
                    // Was inactive, now active
                    if (newRule.content.trim()) {
                        activated.push(newRule);
                    }
                } else if (!newRule.isActive && oldRule.isActive) {
                    // Was active, now inactive
                    deactivated.push(oldRule);
                } else if (newRule.isActive && oldRule.isActive && newRule.content !== oldRule.content) {
                    // Is active and content changed -> treat as update
                    if (newRule.content.trim()) {
                        updated.push({ oldRule, newRule });
                    } else {
                        // Content was deleted, treat as deactivation
                        deactivated.push(oldRule);
                    }
                }
            }
        }
    
        // Check for deleted rules that were active
        for (const [id, oldRule] of oldRulesMap.entries()) {
            if (!newRulesMap.has(id) && oldRule.isActive) {
                deactivated.push(oldRule);
            }
        }
        
        if (activated.length > 0 || deactivated.length > 0 || updated.length > 0) {
            setRuleChanges({ activated, deactivated, updated });
            setStoryLog(prev => [...prev, `**⭐ [HỆ THỐNG]: Đã ghi nhận thay đổi luật lệ. Thay đổi sẽ được áp dụng vào lượt đi tiếp theo. ⭐**`]);
        }
        
        setCustomRules(newRules);
        // Use deep copy to prevent mutation issues
        previousRulesRef.current = JSON.parse(JSON.stringify(newRules));
    
        setShowRulesSavedSuccess(true);
        setTimeout(() => setShowRulesSavedSuccess(false), 3500);
    };

    const handleRestartGame = () => {
        setIsRestartModalOpen(false);
        
        // Give immediate visual feedback
        setIsLoading(true);
        setChoices([]);
        setStoryLog([]);
        
        // Reset all game data to initial state
        setStatuses([]);
        setQuests([]);
        setMemories([]);
        setTurnCount(0);
        setTotalTokens(0);
        setGameTime({ year: 1, month: 1, day: 1, hour: 8 });
        setChronicle({ memoir: [], chapter: [], turn: [] });
        setRuleChanges(null);
        previousRulesRef.current = initialGameState.customRules;

        // Trigger the re-generation by clearing history.
        // The useEffect hook watching `gameHistory` will then call `generateInitialStory`.
        setGameHistory([]);
    };
    
    const hasActiveQuests = quests.some(q => q.status === 'active');
    const pcStatuses = statuses.filter(s => s.owner === 'pc' || (pcName && s.owner === pcName));
    const displayParty = party.filter(p => p.name !== pcName);

    const SidebarNav = () => (
        <>
            <div className={`fixed inset-0 bg-black/60 z-[80] transition-opacity md:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)}></div>
            <div className={`fixed top-0 left-0 bottom-0 w-64 bg-slate-100 dark:bg-[#1f2238] shadow-2xl z-[90] p-4 transform transition-transform md:hidden ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-bold text-purple-600 dark:text-purple-400">Menu</h3>
                     <button onClick={() => setIsSidebarOpen(false)}><CrossIcon className="w-6 h-6"/></button>
                 </div>
                <nav className="flex flex-col space-y-3">
                    <button onClick={() => { setIsHomeModalOpen(true); setIsSidebarOpen(false); }} className="flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded"><HomeIcon className="w-5 h-5 mr-3" /> Home</button>
                    <button onClick={() => { handleSaveGame(); setIsSidebarOpen(false); }} className="flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded"><ArchiveIcon className="w-5 h-5 mr-3" /> Lưu Trữ</button>
                    <button onClick={() => { setIsCustomRulesModalOpen(true); setIsSidebarOpen(false); }} className="flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded"><DocumentAddIcon className="w-5 h-5 mr-3" /> Nạp Tri Thức</button>
                    <button onClick={() => { setIsKnowledgeModalOpen(true); setIsSidebarOpen(false); }} className="flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded"><BrainIcon className="w-5 h-5 mr-3" /> Tri Thức</button>
                    <button onClick={() => { setIsMemoryModalOpen(true); setIsSidebarOpen(false); }} className="flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded"><MemoryIcon className="w-5 h-5 mr-3" /> Ký Ức</button>
                    <button onClick={() => { setIsRestartModalOpen(true); setIsSidebarOpen(false); }} className="flex items-center text-left w-full px-3 py-2 bg-red-600/80 hover:bg-red-500 rounded text-white"><RefreshIcon className="w-5 h-5 mr-3" /> Bắt Đầu Lại</button>
                     <div className="border-t border-slate-300 dark:border-slate-700 pt-4 mt-4 space-y-3">
                        <button onClick={() => { setIsPcInfoModalOpen(true); setIsSidebarOpen(false); }} className="flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded"><UserIcon className="w-5 h-5 mr-3" /> Thông tin</button>
                        <button onClick={() => { setIsPartyModalOpen(true); setIsSidebarOpen(false); }} className="flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded"><GameIcons.NpcIcon className="w-5 h-5 mr-3" /> Tổ đội</button>
                        <button onClick={() => { setIsQuestLogModalOpen(true); setIsSidebarOpen(false); }} className="relative flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded">
                            <GameIcons.ScrollIcon className="w-5 h-5 mr-3" /> Nhiệm vụ
                            {hasActiveQuests && <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full bg-yellow-500 text-white"><ExclamationIcon className="w-3 h-3" /></span>}
                        </button>
                     </div>
                </nav>
            </div>
        </>
    );

    return (
        <div className="bg-transparent w-full h-full p-0 md:p-4 flex flex-col font-sans text-slate-900 dark:text-white relative" style={{maxHeight: '98vh', height: '98vh'}}>
            {showSaveSuccess && (
                <div className="absolute top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
                    Lưu trữ thành công!
                </div>
            )}
            {showRulesSavedSuccess && (
                <div className="absolute top-20 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
                    Lưu luật lệ thành công! Sẽ có hiệu lực ở lượt sau.
                </div>
            )}
            
            <SidebarNav />

            {/* Mobile Header */}
            <div className="flex md:hidden justify-between items-center bg-white/70 dark:bg-[#252945]/80 backdrop-blur-sm p-3 rounded-b-lg shadow-lg flex-shrink-0 border-b border-slate-300/20 dark:border-slate-600/20">
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2">
                    <MenuIcon className="w-6 h-6" />
                </button>
                <h1 className="text-lg font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider truncate mx-2">
                    {worldData.genre || "MANH MUONG TAM QUỐC"}
                </h1>
                 <div className="w-6 h-6 p-2 -mr-2" />
            </div>

            {/* Desktop Header */}
            <div className="hidden md:block">
                <div className="flex justify-between items-center bg-white/70 dark:bg-[#252945]/80 backdrop-blur-sm p-3 rounded-t-lg shadow-lg flex-shrink-0 border-b border-slate-300/20 dark:border-slate-600/20">
                    <button onClick={() => setIsHomeModalOpen(true)} className="flex items-center text-sm px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 rounded shadow-sm border border-slate-300 dark:border-slate-500 transition-colors text-slate-800 dark:text-white"><HomeIcon className="w-4 h-4 mr-2" /> Home</button>
                    <div className="text-center flex-1 min-w-0 mx-4">
                        <div className="text-lg font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider truncate" title={worldData.genre || "Phiêu Lưu Ký"}>{worldData.genre || "Phiêu Lưu Ký"}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 capitalize truncate" title={`Tính cách: ${worldData.customPersonality || worldData.personalityFromList}`}>Tính cách: {worldData.customPersonality || worldData.personalityFromList}</div>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-white">
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-200 dark:bg-slate-800/70 px-2 py-1.5 rounded-md hidden sm:block">
                            <span>Lượt: {currentTurnTokens.toLocaleString()}</span>
                            <span className="mx-1.5">|</span>
                            <span>Tổng: {totalTokens.toLocaleString()}</span>
                        </div>
                        <button onClick={handleSaveGame} className="flex items-center px-3 py-1.5 bg-slate-600 dark:bg-slate-700 hover:bg-slate-500 dark:hover:bg-slate-600 rounded shadow-sm border border-slate-500/50 transition-colors"><ArchiveIcon className="w-4 h-4 mr-1.5" /> Lưu Trữ</button>
                        <button onClick={() => setIsCustomRulesModalOpen(true)} className="flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded shadow-sm border border-purple-500/50 transition-colors"><DocumentAddIcon className="w-4 h-4 mr-1.5" /> Nạp Tri Thức</button>
                        <button onClick={() => setIsKnowledgeModalOpen(true)} className="flex items-center px-3 py-1.5 bg-slate-600 dark:bg-slate-700 hover:bg-slate-500 dark:hover:bg-slate-600 rounded shadow-sm border border-slate-500/50 transition-colors"><BrainIcon className="w-4 h-4 mr-1.5" /> Tri Thức</button>
                        <button onClick={() => setIsMemoryModalOpen(true)} className="flex items-center px-3 py-1.5 bg-slate-600 dark:bg-slate-700 hover:bg-slate-500 dark:hover:bg-slate-600 rounded shadow-sm border border-slate-500/50 transition-colors"><MemoryIcon className="w-4 h-4 mr-1.5" /> Ký Ức</button>
                        <button onClick={() => setIsRestartModalOpen(true)} className="flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded shadow-sm border border-red-500/50 transition-colors"><RefreshIcon className="w-4 h-4 mr-1.5" /> Bắt Đầu Lại</button>
                    </div>
                </div>
                <div className="flex justify-center items-center gap-3 bg-white/70 dark:bg-[#252945]/80 backdrop-blur-sm p-2 rounded-b-lg shadow-lg flex-shrink-0 border-x border-b border-slate-300/20 dark:border-slate-600/20">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700/50 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 whitespace-nowrap">
                        Thời Gian: Năm {gameTime.year} Tháng {gameTime.month} Ngày {gameTime.day}, {gameTime.hour} giờ
                    </div>
                    <button onClick={() => setIsPcInfoModalOpen(true)} className="flex items-center text-sm px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md shadow-sm border border-slate-300 dark:border-slate-600 transition-colors text-slate-800 dark:text-white">
                        <UserIcon className="w-5 h-5 mr-2" /> Thông tin
                    </button>
                    <button onClick={() => setIsPartyModalOpen(true)} className="flex items-center text-sm px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md shadow-sm border border-slate-300 dark:border-slate-600 transition-colors text-slate-800 dark:text-white">
                         <GameIcons.NpcIcon className="w-5 h-5 mr-2" /> Tổ đội
                    </button>
                    <button onClick={() => setIsQuestLogModalOpen(true)} className="relative flex items-center text-sm px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md shadow-sm border border-slate-300 dark:border-slate-600 transition-colors text-slate-800 dark:text-white">
                        <GameIcons.ScrollIcon className="w-5 h-5 mr-2" /> Nhiệm vụ
                         {hasActiveQuests && <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-yellow-500 text-white"><ExclamationIcon className="w-3 h-3" /></span>}
                    </button>
                </div>
            </div>

            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 overflow-hidden p-4 md:p-0">
                {/* Story Panel */}
                <div className="md:col-span-1 flex flex-col bg-white/70 dark:bg-[#252945]/80 backdrop-blur-sm rounded-lg shadow-inner border border-slate-300/20 dark:border-slate-600/20 overflow-hidden">
                    <h2 className="text-xl font-semibold mb-3 text-pink-700 dark:text-pink-400 flex-shrink-0 p-4 pb-0">Diễn Biến Câu Chuyện:</h2>
                    <div ref={storyContainerRef} className={`flex-grow min-h-0 overflow-y-auto pr-2 space-y-4 p-4 md:pb-4 pb-32 ${fontFamily} ${fontSize}`}>
                       {storyLog.map((line, index) => (
                           line.trim() === '' ? null : line.startsWith('>') 
                            ? <p key={index} className='text-cyan-700 dark:text-cyan-300 italic pl-4'>{line}</p>
                            : <InteractiveText key={index} text={line} onEntityClick={handleEntityClick} knownEntities={knownEntities} />
                       ))}
                       {isLoading && isAiReady && storyLog.length > 0 && <div className="flex justify-center p-4"><SpinnerIcon className="w-8 h-8 text-slate-700 dark:text-white"/></div>}
                    </div>
                </div>

                {/* Choices Panel - DESKTOP ONLY */}
                 <div className="hidden md:flex flex-col bg-white/70 dark:bg-[#252945]/80 backdrop-blur-sm p-4 rounded-lg shadow-inner border border-slate-300/20 dark:border-slate-600/20 overflow-hidden">
                    <h2 className="text-xl font-semibold mb-3 text-cyan-600 dark:text-cyan-400 flex-shrink-0">Lựa Chọn Của Ngươi:</h2>
                    <div className="overflow-y-auto pr-2 flex-grow">
                        {!isAiReady ? (
                             <div className="flex items-center justify-center h-full text-red-600 dark:text-red-400 text-center p-4">
                                {apiKeyError || "AI chưa sẵn sàng. Vui lòng kiểm tra API Key và quay về trang chủ."}
                            </div>
                        ) : isLoading && choices.length === 0 ? (
                            <div className="flex items-center justify-center h-full py-4">
                                <SpinnerIcon className="w-10 h-10 text-slate-700 dark:text-white" />
                            </div>
                        ) : (
                           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {choices.map((choice, index) => (
                                    <button 
                                        key={index}
                                        onClick={() => handleAction(choice)}
                                        className={`w-full h-full text-left p-3 bg-slate-200 dark:bg-slate-700 hover:bg-purple-600 dark:hover:bg-purple-600 text-slate-800 dark:text-gray-200 hover:text-white rounded-md transition-colors duration-200 shadow-sm border border-slate-300 dark:border-slate-600 ${fontSize}`}
                                    >
                                        {choice.match(/^\d+\.\s/) ? choice : `${index + 1}. ${choice}`}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-300 dark:border-slate-700 flex-shrink-0">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Hoặc, nhập hành động tùy ý (thêm "nsfw" ở cuối để có nội dung 18+):</p>
                        <div className="flex items-center">
                            <input 
                                type="text"
                                value={customAction}
                                onChange={(e) => setCustomAction(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleAction(customAction)}
                                disabled={isLoading || !isAiReady || isCustomActionLocked}
                                placeholder={isCustomActionLocked ? "Hành động tùy ý đã bị khóa bởi một luật lệ." : "Ví dụ: nhặt hòn đá lên..."}
                                className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-l-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 dark:placeholder-gray-400 disabled:bg-slate-500"
                            />
                            <button 
                                onClick={handleSuggestAction}
                                disabled={isLoading || !isAiReady}
                                className="px-3 py-2 bg-yellow-500 dark:bg-yellow-600 hover:bg-yellow-400 dark:hover:bg-yellow-500 text-white font-semibold transition-colors disabled:bg-slate-500"
                                aria-label="Gợi ý hành động"
                            >
                                <SparklesIcon className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => handleAction(customAction)}
                                disabled={isLoading || !isAiReady || isCustomActionLocked}
                                className="px-4 py-2 bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-400 dark:hover:bg-cyan-500 text-white font-semibold rounded-r-md transition-colors disabled:bg-slate-500"
                            >
                                Gửi
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Mobile Bottom Bar - Fixed */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-[#1f2238]/90 backdrop-blur-md p-3 border-t border-slate-300 dark:border-slate-700 z-40 space-y-2">
                {choices.length > 0 && !isLoading && (
                    <button
                        onClick={() => setIsChoicesModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 text-white font-semibold py-3 px-4 rounded-lg shadow-lg bg-purple-600 hover:bg-purple-700 transition-all duration-300 transform hover:scale-105"
                    >
                        <SparklesIcon className="w-5 h-5" />
                        Hiển thị Lựa chọn ({choices.length})
                    </button>
                )}
                 <div className="flex items-center">
                    <input 
                        type="text"
                        value={customAction}
                        onChange={(e) => setCustomAction(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAction(customAction)}
                        disabled={isLoading || !isAiReady || isCustomActionLocked}
                        placeholder={isCustomActionLocked ? "Hành động tùy ý đã bị khóa." : "Nhập hành động..."}
                        className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-l-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 dark:placeholder-gray-400 disabled:bg-slate-500"
                    />
                    <button 
                        onClick={handleSuggestAction}
                        disabled={isLoading || !isAiReady}
                        className="px-3 py-2 bg-yellow-500 dark:bg-yellow-600 hover:bg-yellow-400 dark:hover:bg-yellow-500 text-white font-semibold transition-colors disabled:bg-slate-500"
                        aria-label="Gợi ý hành động"
                    >
                        <SparklesIcon className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => handleAction(customAction)}
                        disabled={isLoading || !isAiReady || isCustomActionLocked}
                        className="px-4 py-2 bg-cyan-500 dark:bg-cyan-600 hover:bg-cyan-400 dark:hover:bg-cyan-500 text-white font-semibold rounded-r-md transition-colors disabled:bg-slate-500"
                    >
                        Gửi
                    </button>
                </div>
            </div>

            <ConfirmationModal
                isOpen={isHomeModalOpen}
                onClose={() => setIsHomeModalOpen(false)}
                onConfirm={onBackToMenu}
                title="Xác nhận Quay Về Trang Chủ"
                message={<p>Toàn bộ tiến trình chưa lưu sẽ bị mất. Bạn có chắc chắn muốn quay về trang chủ không?</p>}
            />
            <ConfirmationModal
                isOpen={isRestartModalOpen}
                onClose={() => setIsRestartModalOpen(false)}
                onConfirm={handleRestartGame}
                title="Xác nhận Bắt Đầu Lại"
                message={<p>Hành động này sẽ xóa toàn bộ tiến trình hiện tại và bắt đầu một cuộc phiêu lưu mới với cùng bối cảnh và luật lệ ban đầu. Bạn có chắc chắn không?</p>}
            />
            <EntityInfoModal 
                entity={activeEntity} 
                onClose={() => setActiveEntity(null)} 
                onUseItem={handleUseItem} 
                onLearnItem={handleLearnItem}
                onEquipItem={handleEquipItem}
                onUnequipItem={handleUnequipItem}
                statuses={statuses} 
                onStatusClick={handleStatusClick} 
            />
            <StatusDetailModal status={activeStatus} onClose={() => setActiveStatus(null)} />
            <MemoryModal isOpen={isMemoryModalOpen} onClose={() => setIsMemoryModalOpen(false)} memories={memories} onTogglePin={handleToggleMemoryPin} />
            <QuestDetailModal quest={activeQuest} onClose={() => setActiveQuest(null)} />
            <KnowledgeBaseModal 
                isOpen={isKnowledgeModalOpen} 
                onClose={() => setIsKnowledgeModalOpen(false)} 
                pc={pcEntity}
                knownEntities={knownEntities}
                onEntityClick={handleEntityClick}
                turnCount={turnCount}
            />
            <CustomRulesModal
                isOpen={isCustomRulesModalOpen}
                onClose={() => setIsCustomRulesModalOpen(false)}
                onSave={handleSaveRules}
                currentRules={customRules}
            />
            <MobileChoicesModal 
                isOpen={isChoicesModalOpen}
                onClose={() => setIsChoicesModalOpen(false)}
                choices={choices}
                onAction={handleAction}
            />

            {/* Info Panel Modals */}
             <InfoPanelModal
                isOpen={isPcInfoModalOpen}
                onClose={() => setIsPcInfoModalOpen(false)}
                title="Thông tin Nhân vật"
                icon={<UserIcon className="w-6 h-6" />}
            >
                <PlayerCharacterSheet 
                    pc={pcEntity}
                    statuses={pcStatuses}
                    knownEntities={knownEntities}
                    onStatusClick={(status) => { setIsPcInfoModalOpen(false); handleStatusClick(status); }}
                    onEntityClick={(entityName) => { setIsPcInfoModalOpen(false); handleEntityClick(entityName); }}
                />
            </InfoPanelModal>

            <InfoPanelModal
                isOpen={isPartyModalOpen}
                onClose={() => setIsPartyModalOpen(false)}
                title="Thành viên Tổ đội"
                icon={<GameIcons.NpcIcon className="w-6 h-6" />}
            >
                <PartyMemberTab party={displayParty} onMemberClick={(name) => { setIsPartyModalOpen(false); handleEntityClick(name); }} />
            </InfoPanelModal>

            <InfoPanelModal
                isOpen={isQuestLogModalOpen}
                onClose={() => setIsQuestLogModalOpen(false)}
                title="Nhật ký Nhiệm vụ"
                icon={<GameIcons.ScrollIcon className="w-6 h-6" />}
            >
                <QuestLog quests={quests} onQuestClick={(quest) => { setIsQuestLogModalOpen(false); handleQuestClick(quest); }} />
            </InfoPanelModal>

        </div>
    );
};
