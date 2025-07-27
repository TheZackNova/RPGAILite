import React, { useState, useRef, useContext } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { AIContext } from '../App.tsx';
import type { FormData, CustomRule } from './types.ts';
import { SuggestionModal } from './SuggestionModal.tsx';
import { FormLabel, CustomSelect, SuggestButton } from './FormControls.tsx';
import { 
    ArrowLeftIcon, BookOpenIcon, UserIcon, PencilIcon, DiamondIcon, SpinnerIcon, SparklesIcon,
    SaveIcon, FileIcon, DocumentAddIcon, PlusIcon
} from './Icons.tsx';

export const CreateWorld: React.FC<{ 
    onBack: () => void; 
    onStartGame: (data: FormData) => Promise<void>;
    isInitializing: boolean;
    initProgress: number;
    initCurrentStep: string;
    initSubStep: string;
}> = ({ onBack, onStartGame, isInitializing, initProgress, initCurrentStep, initSubStep }) => {
    const { ai, isAiReady, apiKeyError, selectedModel } = useContext(AIContext);
    const [formData, setFormData] = useState<FormData>({
        storyName: '',
        genre: '',
        worldDetail: '',
        worldTime: { day: 1, month: 1, year: 1000 },
        startLocation: '',
        customStartLocation: '',
        writingStyle: 'second_person',
        difficulty: 'normal',
        allowNsfw: false,
        characterName: '',
        characterAge: '',
        characterAppearance: '',
        customPersonality: '',
        personalityFromList: '',
        gender: 'ai_decides',
        bio: '',
        startSkill: '',
        addGoal: false,
        customRules: [],
    });
    
    const [activeTab, setActiveTab] = useState<'context' | 'knowledge'>('context');

    const [loadingStates, setLoadingStates] = useState({
        genre: false,
        worldDetail: false,
        character: false,
    });
    const [isAnySuggestionLoading, setIsAnySuggestionLoading] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);
    const suggestionLock = useRef(false);

    const [genreSuggestions, setGenreSuggestions] = useState<string[]>([]);
    const [isGenreModalOpen, setIsGenreModalOpen] = useState(false);
    const settingsFileInputRef = useRef<HTMLInputElement>(null);
    const rulesFileInputRef = useRef<HTMLInputElement>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const checked = (e.target as HTMLInputElement).checked;

        if (name === 'customPersonality') {
             setFormData(prev => ({
                ...prev,
                customPersonality: value,
                personalityFromList: '' // Clear list selection when typing custom
            }));
        } else if (name === 'personalityFromList') {
            setFormData(prev => ({
                ...prev,
                personalityFromList: value,
                customPersonality: '' // Clear custom input when selecting from list
            }));
        } else if (name === 'startLocation') {
            setFormData(prev => ({
                ...prev,
                startLocation: value,
                customStartLocation: value !== 'Tuỳ chọn' ? '' : prev.customStartLocation // Clear custom location when not "Tuỳ chọn"
            }));
        } else {
             setFormData(prev => ({
                ...prev,
                [name]: isCheckbox ? checked : value
            }));
        }
    };
    
    // --- Rule Management Functions ---
    const handleAddRule = () => {
        setFormData(prev => ({ ...prev, customRules: [...prev.customRules, { id: Date.now().toString(), content: '', isActive: true }] }));
    };

    const handleDeleteRule = (id: string) => {
        setFormData(prev => ({ ...prev, customRules: prev.customRules.filter(r => r.id !== id) }));
    };

    const handleRuleChange = (id: string, newContent: string) => {
        setFormData(prev => ({ ...prev, customRules: prev.customRules.map(r => r.id === id ? { ...r, content: newContent } : r) }));
    };

    const handleToggleActive = (id: string, newIsActive: boolean) => {
        setFormData(prev => ({ ...prev, customRules: prev.customRules.map(r => r.id === id ? { ...r, isActive: newIsActive } : r) }));
    };

    // --- Suggestion Functions ---
    const handleGenreSuggestion = async () => {
        if (!isAiReady || !ai) {
            setSuggestionError(apiKeyError || "AI chưa sẵn sàng. Vui lòng kiểm tra thiết lập API Key.");
            return;
        }
        if (suggestionLock.current) return;
        suggestionLock.current = true;
        setIsAnySuggestionLoading(true);
        setLoadingStates(prev => ({ ...prev, genre: true }));
        setSuggestionError(null);
        const prompt = 'Gợi ý 5 chủ đề/bối cảnh độc đáo (tiếng Việt) cho game phiêu lưu văn bản, phong cách tiểu thuyết mạng. Mỗi cái trên một dòng.';
        
        try {
            const response = await ai.models.generateContent({
                model: selectedModel,
                contents: prompt,
            });
            const text = response.text.trim();
            const suggestions = text.split('\n').map(s => s.replace(/^[*-]\s*/, '').trim()).filter(Boolean);
            setGenreSuggestions(suggestions);
            setIsGenreModalOpen(true);
        } catch (error) {
            console.error('Error generating genre suggestions:', error);
            setSuggestionError("Gặp lỗi khi tạo gợi ý. Vui lòng kiểm tra API Key và thử lại.");
            setGenreSuggestions([]);
        } finally {
            suggestionLock.current = false;
            setIsAnySuggestionLoading(false);
            setLoadingStates(prev => ({ ...prev, genre: false }));
        }
    };

    const handleWorldDetailSuggestion = async () => {
        if (!isAiReady || !ai) {
            setSuggestionError(apiKeyError || "AI chưa sẵn sàng. Vui lòng kiểm tra thiết lập API Key.");
            return;
        }
        if (suggestionLock.current) return;
        suggestionLock.current = true;
        setIsAnySuggestionLoading(true);
        setLoadingStates(prev => ({ ...prev, worldDetail: true }));
        setSuggestionError(null);

        const prompt = `Dựa trên thể loại "${formData.genre}" và ý tưởng "${formData.worldDetail}", hãy viết một bối cảnh thế giới chi tiết và hấp dẫn (khoảng 3-5 dòng) theo văn phong tiểu thuyết mạng Trung Quốc. Bối cảnh cần khơi gợi sự tò mò và giới thiệu một xung đột hoặc yếu tố đặc biệt của thế giới. AI tự kể tiếp. Ví dụ: "Giang Hồ hiểm ác đầy rẫy anh hùng hảo hán và ma đầu tàn bạo, nơi công pháp và bí tịch quyết định tất cả, hệ thống cho phép bạn đoạt lấy nội lực, kinh nghiệm chiến đấu từ các cao thủ chính tà, khiến bạn phải ẩn mình giữa vô vàn ân oán giang hồ và lựa chọn giữa chính đạo giả tạo hay ma đạo tàn khốc."`;
        
        try {
            const response = await ai.models.generateContent({
                model: selectedModel,
                contents: prompt,
            });
            const text = response.text.trim();
            setFormData(prev => ({ ...prev, worldDetail: text }));
        } catch (error: any) {
            console.error(`Error generating suggestion for world detail:`, error);
            if (error.toString().includes('429')) {
                setSuggestionError("Bạn đã gửi yêu cầu quá nhanh. Vui lòng chờ một lát rồi thử lại.");
            } else {
                setSuggestionError("Gặp lỗi khi tạo gợi ý. Vui lòng kiểm tra API Key và thử lại.");
            }
        } finally {
            suggestionLock.current = false;
            setIsAnySuggestionLoading(false);
            setLoadingStates(prev => ({ ...prev, worldDetail: false }));
        }
    };

    const handleCharacterSuggestion = async () => {
        if (!isAiReady || !ai) {
            setSuggestionError(apiKeyError || "AI chưa sẵn sàng. Vui lòng kiểm tra thiết lập API Key.");
            return;
        }
        if (suggestionLock.current) return;
        suggestionLock.current = true;
        setIsAnySuggestionLoading(true);
        setLoadingStates(prev => ({ ...prev, character: true }));
        setSuggestionError(null);

        const finalPersonality = formData.customPersonality || formData.personalityFromList;
        const prompt = `Dựa trên thông tin nhân vật sau, hãy tạo một tiểu sử và kỹ năng khởi đầu phù hợp cho game nhập vai văn bản:
- Tên nhân vật (do người dùng đặt): '${formData.characterName || 'Chưa có'}'
- Tuổi: '${formData.characterAge || 'Chưa có'}'
- Dung mạo: '${formData.characterAppearance || 'Chưa có'}'
- Tên truyện: '${formData.storyName || 'Chưa có'}'
- Thể loại: '${formData.genre || 'Chưa có'}'
- Bối cảnh: '${formData.worldDetail || 'Chưa có'}'
- Giới tính: '${formData.gender}'
- Tính cách: '${finalPersonality || 'Chưa có'}'
Vui lòng tạo ra một tiểu sử ngắn (2-3 câu) và một kỹ năng khởi đầu phù hợp. KHÔNG được thay đổi tên nhân vật. Văn phong cần giống tiểu thuyết mạng. Trả về kết quả dưới dạng JSON với hai khóa: "bio" và "skill".`;
        
        const characterSuggestionSchema = {
          type: Type.OBJECT,
          properties: {
            bio: { type: Type.STRING, description: 'Tiểu sử nhân vật gợi ý (2-3 câu, tiếng Việt).' },
            skill: { type: Type.STRING, description: 'Kỹ năng khởi đầu gợi ý (tiếng Việt).' }
          },
          required: ['bio', 'skill']
        };

        try {
            const response = await ai.models.generateContent({
                model: selectedModel,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: characterSuggestionSchema,
                }
            });
            const responseText = response.text.trim();
            const suggestions = JSON.parse(responseText);
            
            setFormData(prev => ({ 
                ...prev, 
                bio: suggestions.bio || '',
                startSkill: suggestions.skill || ''
            }));
        } catch (error: any) {
            console.error('Error generating character suggestions:', error);
            if (error.toString().includes('429')) {
                 setSuggestionError("Bạn đã gửi yêu cầu quá nhanh. Vui lòng chờ một lát rồi thử lại.");
            } else {
                setSuggestionError("Gặp lỗi khi tạo gợi ý nhân vật. Vui lòng kiểm tra API Key và thử lại.");
            }
        } finally {
            suggestionLock.current = false;
            setIsAnySuggestionLoading(false);
            setLoadingStates(prev => ({ ...prev, character: false }));
        }
    };
    
    // --- File I/O Functions ---
    const handleSaveSettings = () => {
        const jsonString = JSON.stringify(formData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `AI-RolePlay-WorldSetup-${timestamp}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    
    const handleLoadSettingsClick = () => {
        settingsFileInputRef.current?.click();
    };

    const handleLoadSettingsFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
    
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text === 'string') {
                    const loadedData = JSON.parse(text);
                    if (loadedData.storyName !== undefined && loadedData.characterName !== undefined && loadedData.bio !== undefined) {
                        const newFormData: FormData = {
                            ...formData, 
                            ...loadedData,
                            customRules: loadedData.customRules || [], // Ensure customRules is an array
                            startLocation: loadedData.startLocation || '', // Backward compatibility
                            customStartLocation: loadedData.customStartLocation || '', // Backward compatibility
                        };
                        setFormData(newFormData);
                        alert('Đã tải thiết lập thành công!');
                    } else {
                        throw new Error('Tệp không chứa dữ liệu thiết lập hợp lệ.');
                    }
                }
            } catch (error) {
                console.error('Lỗi khi tải tệp thiết lập:', error);
                alert('Không thể đọc tệp thiết lập. Tệp có thể bị hỏng hoặc không đúng định dạng.');
            }
        };
        reader.readAsText(file);
    
        if (event.target) {
            event.target.value = '';
        }
    };
    
    const handleSaveRulesToFile = () => {
        if (formData.customRules.length === 0) {
            alert("Không có luật nào để lưu.");
            return;
        }
        const jsonString = JSON.stringify(formData.customRules, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        link.download = `AI-RolePlay-CustomRules-${timestamp}.json`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleLoadRulesClick = () => {
        rulesFileInputRef.current?.click();
    };
    
    const handleLoadRulesFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text === 'string') {
                    const loadedRules: CustomRule[] = JSON.parse(text);
                    
                    if (Array.isArray(loadedRules) && loadedRules.every(r => typeof r === 'object' && r !== null && 'id' in r && 'content' in r && 'isActive' in r)) {
                        const existingIds = new Set(formData.customRules.map(r => r.id));
                        const rulesToAdd: CustomRule[] = [];
                        
                        loadedRules.forEach(loadedRule => {
                            if (existingIds.has(loadedRule.id)) {
                                rulesToAdd.push({ ...loadedRule, id: `${Date.now()}-${Math.random()}` });
                            } else {
                                rulesToAdd.push(loadedRule);
                            }
                        });

                        setFormData(prev => ({...prev, customRules: [...prev.customRules, ...rulesToAdd]}));
                        alert(`Đã tải và thêm thành công ${rulesToAdd.length} luật mới.`);
                    } else {
                        throw new Error('Định dạng tệp không hợp lệ.');
                    }
                }
            } catch (error) {
                console.error('Lỗi khi tải tệp luật:', error);
                alert('Không thể đọc tệp luật. Tệp có thể bị hỏng hoặc không đúng định dạng.');
            }
        };
        reader.readAsText(file);
        
        if (event.target) {
            event.target.value = '';
        }
    };

    // Wrapper function to handle start game with progress
    const handleStartGameWithProgress = async () => {
        try {
            await onStartGame(formData);
        } catch (error) {
            console.error('Error starting game:', error);
        }
    };

    const personalityOptions = ["Tùy Tâm Sở Dục","Điềm Đạm", "Nhiệt Huyết", "Vô Sỉ", "Nhẹ Nhàng", "Cơ Trí", "Lãnh Khốc", "Kiêu Ngạo", "Ngu Ngốc", "Giảo Hoạt"];
    
    const renderTabContent = () => {
        if (activeTab === 'knowledge') {
            return (
                <div className="space-y-4">
                     <p className="text-sm text-gray-600 dark:text-gray-400">
                        Thêm luật lệ, vật phẩm, nhân vật, hoặc bất kỳ thông tin nào bạn muốn AI tuân theo ngay từ đầu.
                        <br/>
                        Ví dụ: "Tạo ra một thanh kiếm tên là 'Hỏa Long Kiếm' có khả năng phun lửa."
                    </p>
                     {formData.customRules.map((rule, index) => (
                        <div key={rule.id} className="bg-slate-200/50 dark:bg-[#373c5a]/50 p-3 rounded-lg border border-slate-300 dark:border-slate-600 space-y-2">
                             <textarea
                                value={rule.content}
                                onChange={(e) => handleRuleChange(rule.id, e.target.value)}
                                placeholder={`Nội dung luật #${index + 1}...`}
                                className="w-full h-24 bg-slate-100 dark:bg-[#1f2238] border border-slate-300 dark:border-slate-500 rounded-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-y"
                            />
                            <div className="flex justify-between items-center">
                                <label htmlFor={`rule-toggle-${rule.id}`} className="flex items-center cursor-pointer">
                                    <input
                                        id={`rule-toggle-${rule.id}`}
                                        type="checkbox"
                                        checked={rule.isActive}
                                        onChange={(e) => handleToggleActive(rule.id, e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-400 bg-gray-700 text-purple-600 focus:ring-purple-500"
                                    />
                                    <span className="ml-2 text-sm text-slate-700 dark:text-gray-300">Hoạt động</span>
                                </label>
                                <button onClick={() => handleDeleteRule(rule.id)} className="px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded-md text-xs font-semibold transition-colors">
                                    Xóa
                                </button>
                            </div>
                        </div>
                    ))}
                    {formData.customRules.length === 0 && <p className="text-center text-slate-600 dark:text-slate-400 italic py-4">Chưa có luật lệ tùy chỉnh nào.</p>}
                     <button onClick={handleAddRule} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-white text-sm font-semibold transition-colors duration-200 flex items-center justify-center gap-2">
                        <PlusIcon className="w-5 h-5" /> Thêm Luật Mới
                    </button>
                    <div className="flex items-center space-x-2 pt-4 border-t border-slate-300 dark:border-slate-700">
                         <button onClick={handleSaveRulesToFile} className="px-3 py-2 bg-green-700 hover:bg-green-600 rounded-md text-white text-sm font-semibold transition-colors duration-200 flex items-center gap-2">
                            <SaveIcon className="w-4 h-4"/> Lưu Bộ Luật
                        </button>
                        <button onClick={handleLoadRulesClick} className="px-3 py-2 bg-sky-600 hover:bg-sky-500 rounded-md text-white text-sm font-semibold transition-colors duration-200 flex items-center gap-2">
                            <FileIcon className="w-4 h-4"/> Tải Bộ Luật
                        </button>
                    </div>
                </div>
            );
        }

        // Default to context tab
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4 p-4 border border-slate-300 dark:border-slate-700 rounded-lg">
                    <h2 className="text-lg font-semibold flex items-center border-b border-slate-300 dark:border-slate-700 pb-2 mb-4">
                        <BookOpenIcon className="w-5 h-5 mr-3 text-pink-600 dark:text-pink-400" /> Bối Cảnh Truyện
                    </h2>
                    <div>
                        <FormLabel htmlFor="storyName">Tên Truyện:</FormLabel>
                        <input id="storyName" name="storyName" type="text" value={formData.storyName} onChange={handleInputChange} placeholder="VD: Truyền Thuyết Thần Kiếm, Đại Đạo Tranh Phong..." className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 dark:placeholder-gray-400" />
                    </div>
                    <div>
                        <FormLabel htmlFor="genre">Thể Loại:</FormLabel>
                        <div className="flex items-center">
                            <input id="genre" name="genre" type="text" value={formData.genre} onChange={handleInputChange} placeholder="VD: Tiên hiệp, Huyền huyễn, Kiếm hiệp..." className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-l-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 dark:placeholder-gray-400" />
                            <SuggestButton onClick={handleGenreSuggestion} isLoading={loadingStates.genre} disabled={isAnySuggestionLoading} colorClass="bg-pink-500 hover:bg-pink-600" />
                        </div>
                    </div>
                    <div>
                        <FormLabel htmlFor="worldDetail">Thế Giới/Bối Cảnh Chi Tiết:</FormLabel>
                        <div className="flex items-center">
                            <textarea id="worldDetail" name="worldDetail" value={formData.worldDetail} onChange={handleInputChange} placeholder="VD: Đại Lục Phong Vân..." rows={3} className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-l-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 dark:placeholder-gray-400" />
                            <SuggestButton onClick={handleWorldDetailSuggestion} isLoading={loadingStates.worldDetail} disabled={isAnySuggestionLoading} colorClass="bg-pink-500 hover:bg-pink-600" />
                        </div>
                    </div>
                    <div>
                        <FormLabel htmlFor="worldTime">Thời Gian Bắt Đầu:</FormLabel>
                        <div className="grid grid-cols-3 gap-2">
                            <div>
                                <label className="block text-xs text-slate-600 dark:text-gray-400 mb-1">Ngày</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="30" 
                                    value={formData.worldTime.day} 
                                    onChange={(e) => setFormData(prev => ({ 
                                        ...prev, 
                                        worldTime: { ...prev.worldTime, day: parseInt(e.target.value) || 1 } 
                                    }))} 
                                    className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-600 dark:text-gray-400 mb-1">Tháng</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    max="12" 
                                    value={formData.worldTime.month} 
                                    onChange={(e) => setFormData(prev => ({ 
                                        ...prev, 
                                        worldTime: { ...prev.worldTime, month: parseInt(e.target.value) || 1 } 
                                    }))} 
                                    className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-600 dark:text-gray-400 mb-1">Năm</label>
                                <input 
                                    type="number" 
                                    min="1" 
                                    value={formData.worldTime.year} 
                                    onChange={(e) => setFormData(prev => ({ 
                                        ...prev, 
                                        worldTime: { ...prev.worldTime, year: parseInt(e.target.value) || 1000 } 
                                    }))} 
                                    className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500" 
                                />
                            </div>
                        </div>
                    </div>
                    <div>
                        <FormLabel htmlFor="startLocation">Địa điểm bắt đầu:</FormLabel>
                        <CustomSelect name="startLocation" value={formData.startLocation} onChange={handleInputChange}>
                            <option value="">Chọn địa điểm bắt đầu...</option>
                            <option value="Hoang dã ngẫu nhiên">Hoang dã</option>
                            <option value="Thôn, Làng ngẫu nhiên">Thôn, Làng</option>
                            <option value="Thành Thị ngẫu nhiên">Thành Thị</option>
                            <option value="Một địa điểm bất kì">Ngẫu Nhiên</option>
                            <option value="Tuỳ chọn">Tuỳ chọn</option>
                        </CustomSelect>
                        {formData.startLocation === 'Tuỳ chọn' && (
                            <input 
                                id="customStartLocation"
                                name="customStartLocation"
                                type="text" 
                                value={formData.customStartLocation} 
                                onChange={handleInputChange}
                                placeholder="Nhập địa điểm tùy chọn..."
                                className="w-full mt-2 bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 dark:placeholder-gray-400"
                            />
                        )}
                    </div>
                </div>

                <div className="space-y-4 p-4 border border-slate-300 dark:border-slate-700 rounded-lg">
                    <h2 className="text-lg font-semibold flex items-center border-b border-slate-300 dark:border-slate-700 pb-2 mb-4">
                        <UserIcon className="w-5 h-5 mr-3 text-sky-600 dark:text-sky-400" /> Nhân Vật Chính
                    </h2>
                    <div>
                        <FormLabel htmlFor="characterName">Danh Xưng/Tên:</FormLabel>
                        <input id="characterName" name="characterName" type="text" value={formData.characterName} onChange={handleInputChange} placeholder="VD: Diệp Phàm, Hàn Lập..." className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 dark:placeholder-gray-400" />
                    </div>
                    <div>
                        <FormLabel htmlFor="characterAge">Tuổi:</FormLabel>
                        <input id="characterAge" name="characterAge" type="text" value={formData.characterAge} onChange={handleInputChange} placeholder="VD: 20 tuổi, Thanh niên, Trung niên..." className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 dark:placeholder-gray-400" />
                    </div>
                    <div>
                        <FormLabel htmlFor="characterAppearance">Dung mạo:</FormLabel>
                        <input id="characterAppearance" name="characterAppearance" type="text" value={formData.characterAppearance} onChange={handleInputChange} placeholder="VD: Cao ráo, đôi mắt sắc sảo, tóc đen dài..." className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 dark:placeholder-gray-400" />
                    </div>
                    <div>
                        <FormLabel htmlFor="customPersonality">Tính Cách:</FormLabel>
                         {!formData.customPersonality && (
                            <CustomSelect name="personalityFromList" value={formData.personalityFromList} onChange={handleInputChange}>
                                <option value="">Chọn tính cách có sẵn...</option>
                                {personalityOptions.map(p => <option key={p} value={p}>{p}</option>)}
                            </CustomSelect>
                        )}
                        <input id="customPersonality" name="customPersonality" type="text" value={formData.customPersonality} onChange={handleInputChange} placeholder="Hoặc nhập tính cách của bạn (VD: Lạnh lùng)" className={`w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 dark:placeholder-gray-400 ${!formData.customPersonality ? 'mt-2' : ''}`} />
                    </div>
                     <div>
                        <FormLabel>Giới Tính:</FormLabel>
                        <CustomSelect name="gender" value={formData.gender} onChange={handleInputChange}>
                            <option value="ai_decides">Để AI quyết định</option>
                            <option value="Nam">Nam</option>
                            <option value="Nữ">Nữ</option>
                        </CustomSelect>
                    </div>
                     <div>
                        <FormLabel htmlFor="bio">Sơ Lược Tiểu Sử:</FormLabel>
                        <textarea id="bio" name="bio" value={formData.bio} onChange={handleInputChange} placeholder="VD: Một phế vật mang huyết mạch thượng cổ..." rows={3} className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 dark:placeholder-gray-400"></textarea>
                    </div>
                    <div>
                        <FormLabel htmlFor="startSkill">Kỹ Năng Khởi Đầu (Tùy chọn):</FormLabel>
                        <input id="startSkill" name="startSkill" type="text" value={formData.startSkill} onChange={handleInputChange} placeholder="VD: Thuật ẩn thân..." className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 dark:placeholder-gray-400" />
                         <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Gợi ý cho AI về loại kỹ năng người muốn bắt đầu.</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleCharacterSuggestion}
                        disabled={isAnySuggestionLoading || !isAiReady}
                        className="w-full mt-3 flex items-center justify-center px-4 py-2.5 bg-sky-600 text-white font-semibold rounded-md shadow-md hover:bg-sky-500 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-400 disabled:bg-slate-500 disabled:cursor-wait"
                    >
                        {loadingStates.character ? <SpinnerIcon className="w-5 h-5 mr-2" /> : <SparklesIcon className="w-5 h-5 mr-2" />}
                        Gợi Ý Tiểu sử & Kỹ năng
                    </button>
                </div>

                <div className="lg:col-span-2 p-4 border border-slate-300 dark:border-slate-700 rounded-lg">
                    <h2 className="text-lg font-semibold flex items-center pb-2 mb-4">
                        <PencilIcon className="w-5 h-5 mr-3 text-yellow-600 dark:text-yellow-400" /> Phong cách viết
                    </h2>
                    <CustomSelect name="writingStyle" value={formData.writingStyle} onChange={handleInputChange}>
                        <option value="second_person">Ngôi thứ hai - "Ngươi" là nhân vật chính</option>
                        <option value="first_person">Ngôi thứ nhất - Nhân vật chính xưng "Ta/Tôi"</option>
                    </CustomSelect>
                </div>

                <div className="lg:col-span-2 p-4 border border-slate-300 dark:border-slate-700 rounded-lg">
                     <h2 className="text-lg font-semibold flex items-center pb-2 mb-4">
                        <DiamondIcon className="w-5 h-5 mr-3 text-red-600 dark:text-red-400" /> Độ Khó & Nội Dung
                    </h2>
                    <FormLabel>Chọn Độ Khó:</FormLabel>
                    <CustomSelect name="difficulty" value={formData.difficulty} onChange={handleInputChange}>
                        <option value="easy">Dễ - Tạo ra cho đủ số thôi</option>
                        <option value="normal">Thường - Cân bằng, phù hợp đa số</option>
                        <option value="hard">Khó - Thử thách cao, Muốn ăn hành</option>
                    </CustomSelect>
                    <div className="mt-4 flex items-center">
                        <input id="allowNsfw" name="allowNsfw" type="checkbox" checked={formData.allowNsfw} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-400 bg-gray-700 text-purple-600 focus:ring-purple-500" />
                        <label htmlFor="allowNsfw" className="ml-3 text-sm text-slate-700 dark:text-gray-300">Cho phép nội dung 18+ (Cực kỳ chi tiết)</label>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-7">Khi được chọn, AI sẽ kể câu chuyện có tình tiết 18+ (có yếu tố bạo lực) và hành động tùy ý nsfw .</p>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white/80 dark:bg-[#252945]/80 backdrop-blur-md border border-slate-300 dark:border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl p-6 sm:p-8 text-slate-900 dark:text-white font-sans overflow-y-auto" style={{maxHeight: '95vh'}}>
            <input
                type="file"
                ref={settingsFileInputRef}
                onChange={handleLoadSettingsFileChange}
                accept=".json"
                className="hidden"
            />
             <input
                type="file"
                ref={rulesFileInputRef}
                onChange={handleLoadRulesFileChange}
                accept=".json"
                className="hidden"
            />
            <div className="flex justify-between items-center mb-4">
                <button onClick={onBack} className="flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors duration-200">
                    <ArrowLeftIcon className="w-4 h-4 mr-2" />
                    Về Trang Chủ
                </button>
                <div className="flex items-center space-x-2">
                    <button onClick={handleSaveSettings} className="flex items-center text-sm px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded shadow-sm border border-green-500/50 text-white transition-colors">
                        <SaveIcon className="w-4 h-4 mr-2" />
                        Lưu Thiết Lập
                    </button>
                    <button onClick={handleLoadSettingsClick} className="flex items-center text-sm px-3 py-1.5 bg-sky-600 hover:bg-sky-500 rounded shadow-sm border border-sky-500/50 text-white transition-colors">
                        <FileIcon className="w-4 h-4 mr-2" />
                        Tải Thiết Lập
                    </button>
                </div>
            </div>
            
            <h1 className="text-3xl font-bold text-center mb-6 tracking-wide">Kiến Tạo Thế Giới</h1>

            {/* Tabs */}
            <div className="flex border-b border-slate-300 dark:border-slate-700 mb-6">
                <button 
                    onClick={() => setActiveTab('context')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors duration-200 ${activeTab === 'context' ? 'border-b-2 border-purple-500 text-purple-600 dark:text-purple-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    Bối Cảnh Thế Giới
                </button>
                <button 
                    onClick={() => setActiveTab('knowledge')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors duration-200 ${activeTab === 'knowledge' ? 'border-b-2 border-purple-500 text-purple-600 dark:text-purple-400' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    Tri Thức
                </button>
            </div>
            
            {/* Tab Content */}
            {renderTabContent()}

            <div className="mt-8 flex flex-col items-center">
                {suggestionError && (
                    <p className="text-red-500 dark:text-red-400 text-sm mb-4 text-center">{suggestionError}</p>
                )}
                <button 
                    onClick={handleStartGameWithProgress}
                    disabled={!isAiReady || isInitializing}
                    className="w-full max-w-lg bg-[#2dd4bf] hover:bg-[#14b8a6] text-slate-900 font-bold py-3 px-6 rounded-lg shadow-lg text-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:bg-slate-500 disabled:cursor-not-allowed">
                    {isInitializing ? (
                        <div className="flex items-center justify-center gap-2">
                            <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
                            Đang khởi tạo...
                        </div>
                    ) : isAiReady ? 'Khởi Tạo Thế Giới' : 'AI chưa sẵn sàng'}
                </button>
            </div>

            <SuggestionModal
                isOpen={isGenreModalOpen}
                onClose={() => setIsGenreModalOpen(false)}
                suggestions={genreSuggestions}
                onSelect={(suggestion) => {
                    setFormData(prev => ({ ...prev, genre: suggestion }));
                    setIsGenreModalOpen(false);
                }}
                title="Gợi ý thể loại"
            />
        </div>
    );
}