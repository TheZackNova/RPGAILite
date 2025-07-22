

import React from 'react';
import { SpinnerIcon, SparklesIcon } from '../../Icons.tsx';

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
        <div className="hidden md:flex flex-col bg-white/70 dark:bg-[#252945]/80 backdrop-blur-sm p-4 rounded-lg shadow-inner border border-slate-300/20 dark:border-slate-600/20 overflow-hidden h-full">
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
                                key={`choice-${choice.substring(0, 20)}-${index}`}
                                onClick={() => handleAction(choice)}
                                className={`w-full h-full text-left p-3 bg-slate-200 dark:bg-slate-700 hover:bg-purple-600 dark:hover:bg-purple-600 text-slate-800 dark:text-gray-200 hover:text-white rounded-md transition-colors duration-200 shadow-sm border border-slate-300 dark:border-slate-600`}
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
                        onKeyPress={(e) => e.key === 'Enter' && customAction.trim() && debouncedHandleAction(customAction.trim())}
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
                        onClick={() => customAction.trim() && handleAction(customAction.trim())}
                        disabled={isLoading || !isAiReady || isCustomActionLocked || !customAction.trim()}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-r-md transition-colors disabled:bg-slate-500"
                        aria-label="Gửi hành động"
                    >
                        Gửi
                    </button>
                </div>
            </div>
        </div>
    );
};