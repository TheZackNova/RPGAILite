import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import { Type } from '@google/genai';
import { 
    SaveData, 
    KnownEntities, 
    Status, 
    Quest, 
    GameHistoryEntry, 
    Memory, 
    Entity, 
    CustomRule,
    QuestObjective,
    EntityType
} from '../../types';
import { AIContext } from '../../contexts/AIContext';
import { parseStoryAndTags } from '../../utils/StoryParser';
import { ConfirmationModal } from '../common';
import { StoryDisplay } from './StoryDisplay';
import { ChoicesPanel } from './ChoicesPanel';
import { TopNavigation } from '../layout/TopNavigation';
import { TabNavigation } from '../layout/TabNavigation';
// TODO: Import these modal components when they are created
// import { EntityInfoModal } from '../modals/EntityInfoModal';
// import { StatusDetailModal } from '../modals/StatusDetailModal';
// import { MemoryModal } from '../modals/MemoryModal';
// import { QuestDetailModal } from '../modals/QuestDetailModal';
// import { KnowledgeBaseModal } from '../modals/KnowledgeBaseModal';
// import { CustomRulesModal } from '../modals/CustomRulesModal';

interface GameScreenProps {
    initialGameState: SaveData;
    onBackToMenu: () => void;
    fontFamily: string;
    fontSize: string;
}

export const GameScreen: React.FC<GameScreenProps> = ({ 
    initialGameState, 
    onBackToMenu, 
    fontFamily, 
    fontSize 
}) => {
    const { ai, isAiReady, apiKeyError } = useContext(AIContext);
    const [worldData, setWorldData] = useState(initialGameState.worldData);
    const [storyLog, setStoryLog] = useState(initialGameState.storyLog);
    const [choices, setChoices] = useState(initialGameState.choices);
    const [isLoading, setIsLoading] = useState(initialGameState.gameHistory.length === 0 && isAiReady);
    const [customAction, setCustomAction] = useState('');
    const [isRestartModalOpen, setIsRestartModalOpen] = useState(false);
    
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

    // Modal & Notification States
    const [activeEntity, setActiveEntity] = useState<Entity | null>(null);
    const [activeStatus, setActiveStatus] = useState<Status | null>(null);
    const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
    const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);
    const [isCustomRulesModalOpen, setIsCustomRulesModalOpen] = useState(false);
    const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    const [showRulesSavedSuccess, setShowRulesSavedSuccess] = useState(false);

    // Rule change tracking
    const [ruleChanges, setRuleChanges] = useState<{ 
        activated: CustomRule[], 
        deactivated: CustomRule[], 
        updated: { oldRule: CustomRule, newRule: CustomRule }[] 
    } | null>(null);
    const previousRulesRef = useRef<CustomRule[]>(initialGameState.customRules);

    const storyContainerRef = useRef<HTMLDivElement>(null);

    const pcName = useMemo(() => Object.values(knownEntities).find(e => e.type === 'pc')?.name, [knownEntities]);

    const isCustomActionLocked = useMemo(() => {
        return customRules.some(rule =>
            rule.isActive && rule.content.toUpperCase().includes('KHÓA HÀNH ĐỘNG TÙY Ý')
        );
    }, [customRules]);

    const [activeTab, setActiveTab] = useState('status');
    const hasActiveQuests = quests.some(q => q.status === 'active');

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
            const cleanStory = parseStoryAndTags(
                jsonResponse.story,
                setMemories,
                setStatuses,
                setKnownEntities,
                setQuests
            );

            setStoryLog(prev => [...prev, cleanStory]);
            setChoices(jsonResponse.choices || []);

        } catch (e) {
            console.error("Failed to parse AI response:", e);
            console.error("Raw response text:", text);
            setStoryLog(prev => [...prev, "Lỗi: AI trả về dữ liệu không hợp lệ. Hãy thử lại."]);
            setChoices([]);
        }
    };

    const generateKnowledgeContext = (): string => {
        let context = "--- BÁO CÁO TÌNH HÌNH HIỆN TẠI (DỮ LIỆU CỐT LÕI) ---\n";
        const pc = Object.values(knownEntities).find(e => e.type === 'pc');

        if (pc) {
            context += `**Nhân vật chính:** ${pc.name} (Lượt: ${turnCount}, Cảnh giới: ${pc.realm || 'Chưa có'})\n`;

            const pcStatuses = statuses.filter(s => s.owner === 'pc' || s.owner === pc.name);
            if (pcStatuses.length > 0) {
                context += `**Trạng thái nhân vật:**\n${pcStatuses.map(s => `- ${s.name}: ${s.effects || s.description} (Thời gian: ${s.duration || 'không rõ'})`).join('\n')}\n`;
            } else {
                context += `**Trạng thái nhân vật:** Bình thường.\n`;
            }

            const inventoryItems = Object.values(knownEntities).filter(e => e.type === 'item' && e.owner === 'pc');
            if (inventoryItems.length > 0) {
                context += `**Vật phẩm trong túi:**\n${inventoryItems.map(i => {
                    let itemDetails = [];
                    if (i.equipped) itemDetails.push('đang trang bị');
                    if (i.learnable) itemDetails.push('có thể học');
                    if (typeof i.uses === 'number') itemDetails.push(`còn ${i.uses} lần dùng`);
                    if (typeof i.durability === 'number') itemDetails.push(`độ bền ${i.durability}/100`);
                    return `- ${i.name}` + (itemDetails.length > 0 ? ` (${itemDetails.join(', ')})` : '');
                }).join('\n')}\n`;
            }

            const skills = Object.values(knownEntities).filter(e => e.type === 'skill');
            if (skills.length > 0) {
                context += `**Kỹ năng đã học:**\n${skills.map(s => `- ${s.name}` + (s.realm ? ` (Cảnh giới: ${s.realm})` : '')).join('\n')}\n`;
            }
        }

        const activeQuests = quests.filter(q => q.status === 'active');
        if (activeQuests.length > 0) {
            context += `**Nhiệm vụ đang làm:**\n${activeQuests.map(q => `- ${q.title}: Mục tiêu - ${q.objectives.filter(o => !o.completed).map(o => o.description).join(', ')}`).join('\n')}\n`;
        }

        const companions = party.filter(p => p.type === 'companion' || (p.type === 'pc' && p.name !== pc?.name));
        if (companions.length > 0) {
            context += `**Đồng hành:**\n${companions.map(p => `- ${p.name}`).join('\n')}\n`;
        }

        const npcs = Object.values(knownEntities).filter(e => e.type === 'npc' && e.name !== pc?.name);
        if (npcs.length > 0) {
            context += `**NPC đã gặp:**\n${npcs.map(n => {
                let details = [];
                if (n.relationship) details.push(`Quan hệ: ${n.relationship}`);
                if (n.realm) details.push(`Cảnh giới: ${n.realm}`);
                const npcStatuses = statuses.filter(s => s.owner === n.name);
                if (npcStatuses.length > 0) details.push(`Trạng thái: ${npcStatuses.map(s => s.name).join(', ')}`);
                return `- ${n.name}` + (details.length > 0 ? ` (${details.join('; ')})` : '');
            }).join('\n')}\n`;
        }

        context += "--- KẾT THÚC BÁO CÁO ---\n";
        return context;
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
1.  Bắt đầu câu chuyện bằng cách giới thiệu nhân vật chính trong bối cảnh đã cho.
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
            personality: finalPersonality
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

        const knowledgeContext = generateKnowledgeContext();
        
        const pinnedMemories = memories.filter(m => m.pinned).map(m => `- ${m.text}`).join('\n');
        let memoryContext = '';
        if (pinnedMemories) {
            memoryContext = `\n--- KÝ ỨC ĐÃ GHIM (QUAN TRỌNG) ---\n${pinnedMemories}\n`;
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
        
        const lastStoryPart = storyLog.slice(-2)[0] || ''; // Get the last AI narrative part

        const userPrompt = `${ruleChangeContext}${customRulesContext}${knowledgeContext}
--- Diễn biến gần nhất ---
${lastStoryPart}
${memoryContext}
--- HÀNH ĐỘNG CỦA NGƯỜI CHƠI ---
"${originalAction}"
${nsfwInstructionPart}
YÊU CẦU: Dựa trên hành động của người chơi và TOÀN BỘ bối cảnh đã cung cấp (bao gồm cả luật lệ tùy chỉnh), hãy tiếp tục câu chuyện một cách logic.`;

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

    useEffect(() => {
        if (storyContainerRef.current) {
            storyContainerRef.current.scrollTop = storyContainerRef.current.scrollHeight;
        }
    }, [storyLog]);

    useEffect(() => {
        // Only generate story if history is empty (i.e., it's a new game)
        if (gameHistory.length === 0 && isAiReady) {
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
    }, [isAiReady]); // Re-run if AI readiness changes

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

    const renderActiveTabContent = () => {
        switch (activeTab) {
            case 'status':
                const pcStatuses = statuses.filter(s => s.owner === 'pc' || (pcName && s.owner === pcName));
                return <div>StatusDisplay placeholder</div>; // TODO: Import StatusDisplay component
            case 'quests':
                return <div>QuestLog placeholder</div>; // TODO: Import QuestLog component
            case 'party':
                const displayParty = party.filter(p => p.name !== pcName);
                return <div>PartyMemberTab placeholder</div>; // TODO: Import PartyMemberTab component
            default:
                return null;
        }
    };

    return (
        <div className="bg-transparent w-full h-full p-4 flex flex-col font-sans text-slate-900 dark:text-white relative" style={{maxHeight: '98vh', height: '98vh'}}>
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
            
            <TopNavigation
                worldData={worldData}
                onRestart={() => setIsRestartModalOpen(true)}
                onSave={handleSaveGame}
                onOpenKnowledge={() => setIsKnowledgeModalOpen(true)}
                onOpenMemory={() => setIsMemoryModalOpen(true)}
                onOpenRules={() => setIsCustomRulesModalOpen(true)}
            />

            <TabNavigation
                activeTab={activeTab as 'status' | 'party' | 'quests'}
                onTabChange={setActiveTab}
                hasActiveQuests={hasActiveQuests}
            />
            
            <div className="bg-white/70 dark:bg-[#2a2f4c]/80 backdrop-blur-sm rounded-b-lg flex-shrink-0 h-40 overflow-hidden shadow-lg border-x border-b border-slate-300/20 dark:border-slate-600/20">
                {renderActiveTabContent()}
            </div>
            
            {/* Main Content */}
            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 overflow-hidden">
                <StoryDisplay
                    storyLog={storyLog}
                    isLoading={isLoading}
                    isAiReady={isAiReady}
                    apiKeyError={apiKeyError}
                    knownEntities={knownEntities}
                    onEntityClick={handleEntityClick}
                    fontFamily={fontFamily}
                    fontSize={fontSize}
                />

                <ChoicesPanel
                    choices={choices}
                    isLoading={isLoading}
                    isAiReady={isAiReady}
                    customAction={customAction}
                    setCustomAction={setCustomAction}
                    onAction={handleAction}
                    onSuggestAction={handleSuggestAction}
                    isCustomActionLocked={isCustomActionLocked}
                    fontSize={fontSize}
                />
            </div>
            
            <ConfirmationModal
                isOpen={isRestartModalOpen}
                onClose={() => setIsRestartModalOpen(false)}
                onConfirm={onBackToMenu}
                title="Xác nhận Quay Về Trang Chủ"
                message={<p>Toàn bộ tiến trình chưa lưu sẽ bị mất. Bạn có chắc chắn muốn quay về trang chủ không?</p>}
            />
            
            {/* TODO: Enable these modals when components are created */}
            {/*
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
                pc={Object.values(knownEntities).find(p => p.type === 'pc')}
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
            */}
        </div>
    );
};

export default GameScreen;