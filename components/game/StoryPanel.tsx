

import React, { memo } from 'react';
import { SpinnerIcon } from '../Icons.tsx';

interface StoryPanelProps {
    storyContainerRef: React.RefObject<HTMLDivElement>;
    children: React.ReactNode;
    isLoading: boolean;
    isAiReady: boolean;
    storyLength: number;
}

export const StoryPanel: React.FC<StoryPanelProps> = memo(({
    storyContainerRef,
    children,
    isLoading,
    isAiReady,
    storyLength
}) => {
    return (
        <div className="md:col-span-1 flex flex-col bg-white/70 dark:bg-[#252945]/80 backdrop-blur-sm rounded-lg shadow-inner border border-slate-300/20 dark:border-slate-600/20 overflow-hidden">
            <h2 className="text-xl font-semibold mb-3 text-pink-700 dark:text-pink-400 flex-shrink-0 p-4 pb-0">Diễn Biến Câu Chuyện:</h2>
            <div ref={storyContainerRef} className={`flex-grow min-h-0 overflow-y-auto pr-2 space-y-4 p-4 md:pb-4 pb-32 ${storyLength === 0 ? 'flex items-center justify-center' : ''}`}>
               {children}
               {isLoading && isAiReady && storyLength > 0 && <div className="flex justify-center p-4"><SpinnerIcon className="w-8 h-8 text-slate-700 dark:text-white"/></div>}
            </div>
        </div>
    );
});

StoryPanel.displayName = 'StoryPanel';
