

import React from 'react';
import * as GameIcons from '../GameIcons.tsx';
import { SparklesIcon } from '../Icons.tsx';

interface MobileInputFooterProps {
    onChoicesClick: () => void;
    customAction: string;
    setCustomAction: (action: string) => void;
    handleAction: (action: string) => void;
    debouncedHandleAction: (action: string) => void;
    handleSuggestAction?: () => void;
    isLoading: boolean;
    isAiReady: boolean;
    isCustomActionLocked: boolean;
}

export const MobileInputFooter: React.FC<MobileInputFooterProps> = ({
    onChoicesClick, customAction, setCustomAction, handleAction, debouncedHandleAction, handleSuggestAction, isLoading, isAiReady, isCustomActionLocked
}) => {
    return (
        <>
            <button 
                onClick={onChoicesClick}
                className="md:hidden fixed bottom-20 right-4 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-full shadow-lg z-40"
            >
               <GameIcons.SwordIcon className="w-6 h-6"/>
            </button>
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#1f2238]/95 backdrop-blur-sm p-3 border-t border-slate-300 dark:border-slate-700 shadow-lg z-30">
                 <div className="flex items-center gap-2">
                    <input 
                        type="text"
                        value={customAction}
                        onChange={(e) => setCustomAction(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && debouncedHandleAction(customAction)}
                        disabled={isLoading || !isAiReady || isCustomActionLocked}
                        placeholder={isCustomActionLocked ? "Hành động tùy ý đã bị khóa." : "Nhập hành động..."}
                        className="flex-1 bg-slate-100 dark:bg-[#373c5a] border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm text-slate-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-500"
                    />
                    {handleSuggestAction && (
                        <button 
                            onClick={handleSuggestAction}
                            disabled={isLoading || !isAiReady}
                            className="px-3 py-2 bg-gradient-to-r from-yellow-500/80 to-orange-500/80 hover:from-yellow-500 hover:to-orange-500 border border-yellow-400/60 rounded-md text-yellow-100 hover:text-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Gợi ý hành động"
                        >
                            <SparklesIcon className="w-4 h-4" />
                        </button>
                    )}
                    <button 
                        onClick={() => handleAction(customAction)}
                        disabled={isLoading || !isAiReady || isCustomActionLocked}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-md transition-colors disabled:bg-slate-500"
                    >
                        Gửi
                    </button>
                </div>
            </div>
        </>
    );
};
