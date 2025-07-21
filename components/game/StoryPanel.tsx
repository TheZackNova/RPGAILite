
import React from 'react';
import { SpinnerIcon } from '../Icons.tsx';
import { InteractiveText } from '../InteractiveText.tsx';
import type { KnownEntities } from '../types.ts';

interface StoryPanelProps {
    storyContainerRef: React.RefObject<HTMLDivElement>;
    storyLog: string[];
    fontFamily: string;
    fontSize: string;
    onEntityClick: (entityName: string) => void;
    knownEntities: KnownEntities;
    isLoading: boolean;
    isAiReady: boolean;
}

export const StoryPanel: React.FC<StoryPanelProps> = ({
    storyContainerRef,
    storyLog,
    fontFamily,
    fontSize,
    onEntityClick,
    knownEntities,
    isLoading,
    isAiReady
}) => {
    return (
        <div className="md:col-span-1 flex flex-col bg-white/70 dark:bg-[#252945]/80 backdrop-blur-sm rounded-lg shadow-inner border border-slate-300/20 dark:border-slate-600/20 overflow-hidden">
            <h2 className="text-xl font-semibold mb-3 text-pink-700 dark:text-pink-400 flex-shrink-0 p-4 pb-0">Diễn Biến Câu Chuyện:</h2>
            <div ref={storyContainerRef} className={`flex-grow min-h-0 overflow-y-auto pr-2 space-y-4 p-4 md:pb-4 pb-32 ${fontFamily} ${fontSize}`}>
               {storyLog.map((line, index) => (
                   line.trim() === '' ? null : line.startsWith('>') 
                    ? <p key={index} className='text-cyan-700 dark:text-cyan-300 italic pl-4'>{line}</p>
                    : <InteractiveText key={index} text={line} onEntityClick={onEntityClick} knownEntities={knownEntities} />
               ))}
               {isLoading && isAiReady && storyLog.length > 0 && <div className="flex justify-center p-4"><SpinnerIcon className="w-8 h-8 text-slate-700 dark:text-white"/></div>}
            </div>
        </div>
    );
};
