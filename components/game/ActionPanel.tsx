
import React from 'react';
import { SpinnerIcon, SparklesIcon } from '../Icons.tsx';

interface ActionPanelProps {
    isAiReady: boolean;
    apiKeyError: string | null;
    isLoading: boolean;
    choices: string[];
    handleAction: (action: string) => void;
    debouncedHandleAction: (action: string) => void;
    customAction: string;
    setCustomAction: (action: string) => void;
    handleSuggestAction: () => void;
    isCustomActionLocked: boolean;
}

export const ActionPanel: React.FC<ActionPanelProps> = ({
    isAiReady,
    apiKeyError,
    isLoading,
    choices,
    handleAction,
    debouncedHandleAction,
    customAction,
    setCustomAction,
    handleSuggestAction,
    isCustomActionLocked,
}) => {
    return (
        <div className="hidden md:flex flex-col bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden h-full">
            {/* Header */}
            <div className="flex-shrink-0 p-6 border-b border-white/10">
                <h2 className="text-xl font-bold bg-gradient-to-r from-cyan-200 via-blue-200 to-cyan-200 bg-clip-text text-transparent">
                    ⚔️ Lựa Chọn Của Ngươi
                </h2>
            </div>

            {/* Content */}
            <div className="flex-grow p-6">
            <div className="overflow-y-auto flex-grow">
                {!isAiReady ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center bg-red-500/10 backdrop-blur-sm border border-red-400/20 rounded-2xl p-8">
                            <div className="text-red-300 mb-4 text-4xl">⚠️</div>
                            <p className="text-white/80 text-lg font-medium">
                                AI chưa sẵn sàng
                            </p>
                            <p className="text-white/60 text-sm mt-2">
                                {apiKeyError || "Vui lòng kiểm tra API Key và quay về trang chủ"}
                            </p>
                        </div>
                    </div>
                ) : isLoading && choices.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex items-center gap-3 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 backdrop-blur-xl border border-cyan-400/30 px-6 py-4 rounded-2xl">
                            <SpinnerIcon className="w-8 h-8 text-cyan-300" />
                            <span className="text-white font-medium">Đang tải lựa chọn...</span>
                        </div>
                    </div>
                ) : (
                   <div className="grid grid-cols-1 gap-4">
                        {choices.map((choice, index) => (
                            <button 
                                key={index}
                                onClick={() => handleAction(choice)}
                                className="group w-full text-left p-4 bg-white/5 hover:bg-gradient-to-r hover:from-cyan-500/20 hover:to-blue-500/20 backdrop-blur-sm border border-white/20 hover:border-cyan-400/40 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:scale-[1.02]"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 rounded-xl flex items-center justify-center text-white font-bold text-sm group-hover:from-cyan-500/50 group-hover:to-blue-500/50 transition-all duration-300">
                                        {index + 1}
                                    </div>
                                    <div className="flex-grow">
                                        <p className="text-white/90 group-hover:text-white transition-colors duration-300">
                                            {choice.match(/^\d+\.\s/) ? choice.replace(/^\d+\.\s/, '') : choice}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
            </div>

            {/* Custom Action Footer */}
            <div className="flex-shrink-0 p-6 border-t border-white/10">
                <div className="mb-4">
                    <p className="text-sm text-white/70 font-medium mb-2">
                        💭 Hành động tùy ý
                    </p>
                    <p className="text-xs text-white/50">
                        Nhập hành động của riêng bạn (thêm "nsfw" ở cuối để có nội dung 18+)
                    </p>
                </div>
                <div className="flex gap-2">
                    <input 
                        type="text"
                        value={customAction}
                        onChange={(e) => setCustomAction(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && debouncedHandleAction(customAction)}
                        disabled={isLoading || !isAiReady || isCustomActionLocked}
                        placeholder={isCustomActionLocked ? "Hành động tùy ý đã bị khóa bởi một luật lệ" : "Ví dụ: nhặt hòn đá lên..."}
                        className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl py-3 px-4 text-white placeholder-white/50 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button 
                        onClick={handleSuggestAction}
                        disabled={isLoading || !isAiReady}
                        className="px-4 py-3 bg-gradient-to-r from-yellow-500/30 to-orange-500/30 hover:from-yellow-500/40 hover:to-orange-500/40 border border-yellow-400/40 rounded-xl text-yellow-200 hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                        aria-label="Gợi ý hành động"
                    >
                        <SparklesIcon className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={() => handleAction(customAction)}
                        disabled={isLoading || !isAiReady || isCustomActionLocked}
                        className="px-6 py-3 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 hover:from-cyan-500/40 hover:to-blue-500/40 border border-cyan-400/40 rounded-xl text-white font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                        aria-label="Gửi hành động"
                    >
                        Gửi
                    </button>
                </div>
            </div>
        </div>
    );
};
