import React, { useState, useRef, useContext } from 'react';
import { Type } from '@google/genai';
import { AIContext } from '../../contexts/AIContext';
import { FormData } from '../../types';
import { FormLabel, SuggestButton, CustomSelect, SuggestionModal } from '../common';
import { BookOpenIcon, ArrowLeftIcon, UserIcon, SpinnerIcon, SparklesIcon, PencilIcon, DiamondIcon } from '../../../components/Icons';

interface CreateWorldProps {
    onBack: () => void;
    onStartGame: (data: FormData) => void;
}

export const CreateWorld: React.FC<CreateWorldProps> = ({ onBack, onStartGame }) => {
    const { ai, isAiReady, apiKeyError } = useContext(AIContext);
    
    const personalityOptions = ["Tùy Tâm Sở Dục","Điềm Đạm", "Nhiệt Huyết", "Vô Sỉ", "Nhẹ Nhàng", "Cơ Trí", "Lãnh Khốc", "Kiêu Ngạo", "Ngu Ngốc", "Giảo Hoạt"];
    const [formData, setFormData] = useState<FormData>({
        genre: '',
        worldDetail: '',
        writingStyle: 'second_person',
        difficulty: 'normal',
        allowNsfw: false,
        characterName: '',
        customPersonality: '',
        personalityFromList: '',
        gender: 'ai_decides',
        bio: '',
        startSkill: '',
        addGoal: false,
    });

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

    const [submitError, setSubmitError] = useState<string | null>(null);

    // Input change handler
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
        } else {
             setFormData(prev => ({
                ...prev,
                [name]: isCheckbox ? checked : value
            }));
        }
    };

    // Genre suggestion handler
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
                model: 'gemini-2.5-flash',
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

    // World detail suggestion handler
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
                model: 'gemini-2.5-flash',
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

    // Character suggestion handler
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
                model: 'gemini-2.5-flash',
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

    // Handle form submission
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError(null);

        // Basic validation
        if (!formData.genre.trim()) {
            setSubmitError("Vui lòng nhập thể loại.");
            return;
        }
        if (!formData.worldDetail.trim()) {
            setSubmitError("Vui lòng nhập bối cảnh thế giới.");
            return;
        }
        if (!formData.characterName.trim()) {
            setSubmitError("Vui lòng nhập tên nhân vật.");
            return;
        }

        onStartGame(formData);
    };

    const handleGenreSelect = (suggestion: string) => {
        setFormData(prev => ({ ...prev, genre: suggestion }));
        setIsGenreModalOpen(false);
    };
    
    return (
        <div className="bg-white/80 dark:bg-[#252945]/80 backdrop-blur-md border border-slate-300 dark:border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl p-6 sm:p-8 text-slate-900 dark:text-white font-sans overflow-y-auto" style={{maxHeight: '95vh'}}>
            <button onClick={onBack} className="flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors duration-200 mb-4">
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Về Trang Chủ
            </button>
            <h1 className="text-3xl font-bold text-center mb-8 tracking-wide">Kiến Tạo Thế Giới</h1>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4 p-4 border border-slate-300 dark:border-slate-700 rounded-lg">
                    <h2 className="text-lg font-semibold flex items-center border-b border-slate-300 dark:border-slate-700 pb-2 mb-4">
                        <BookOpenIcon className="w-5 h-5 mr-3 text-pink-600 dark:text-pink-400" /> Bối Cảnh Truyện
                    </h2>
                    <div>
                        <FormLabel htmlFor="genre">Thể loại:</FormLabel>
                        <div className="flex items-center">
                            <input id="genre" name="genre" type="text" value={formData.genre} onChange={handleInputChange} placeholder="VD: Tiên hiệp, Huyền huyễn..." className="w-full bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-l-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-400 dark:placeholder-gray-400" />
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

                {/* Configuration Section */}
                <div className="col-span-1 lg:col-span-2 space-y-4 p-4 border border-slate-300 dark:border-slate-700 rounded-lg">
                    <h2 className="text-lg font-semibold flex items-center border-b border-slate-300 dark:border-slate-700 pb-2 mb-4">
                        <PencilIcon className="w-5 h-5 mr-3 text-green-600 dark:text-green-400" /> Cấu Hình Game
                    </h2>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div>
                            <FormLabel>Phong Cách Viết:</FormLabel>
                            <CustomSelect name="writingStyle" value={formData.writingStyle} onChange={handleInputChange}>
                                <option value="second_person">Ngôi thứ hai (Bạn...)</option>
                                <option value="first_person">Ngôi thứ nhất (Tôi...)</option>
                            </CustomSelect>
                        </div>
                        
                        <div>
                            <FormLabel>Độ Khó:</FormLabel>
                            <CustomSelect name="difficulty" value={formData.difficulty} onChange={handleInputChange}>
                                <option value="easy">Dễ</option>
                                <option value="normal">Bình Thường</option>
                                <option value="hard">Khó</option>
                            </CustomSelect>
                        </div>
                        
                        <div className="flex items-center">
                            <input 
                                id="allowNsfw" 
                                name="allowNsfw" 
                                type="checkbox" 
                                checked={formData.allowNsfw} 
                                onChange={handleInputChange} 
                                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded" 
                            />
                            <FormLabel htmlFor="allowNsfw" className="ml-2 text-sm">
                                Cho phép nội dung NSFW
                            </FormLabel>
                        </div>
                    </div>
                </div>
            </div>

            {/* Submit Section */}
            <div className="mt-6 text-center">
                {submitError && (
                    <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-md text-sm">
                        {submitError}
                    </div>
                )}
                {suggestionError && (
                    <div className="mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-300 rounded-md text-sm">
                        {suggestionError}
                    </div>
                )}
                <button
                    onClick={handleSubmit}
                    disabled={isAnySuggestionLoading}
                    className="w-full lg:w-auto px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold rounded-lg shadow-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed flex items-center justify-center"
                >
                    <DiamondIcon className="w-5 h-5 mr-2" />
                    Bắt Đầu Cuộc Phiêu Lưu
                </button>
            </div>

            {/* Genre Suggestion Modal */}
            <SuggestionModal
                isOpen={isGenreModalOpen}
                onClose={() => setIsGenreModalOpen(false)}
                title="Chọn Thể Loại"
                suggestions={genreSuggestions}
                onSelect={handleGenreSelect}
            />
        </div>
    );
};