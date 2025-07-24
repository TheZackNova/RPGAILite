import React, { useRef, useEffect } from 'react';
import { KnownEntities } from '../../types';
import { InteractiveText } from '../common';
import { SpinnerIcon } from '../../../components/Icons';

interface StoryDisplayProps {
    storyLog: string[];
    isLoading: boolean;
    isAiReady: boolean;
    apiKeyError?: string;
    knownEntities: KnownEntities;
    onEntityClick: (entityName: string) => void;
    fontFamily: string;
    fontSize: string;
}

export const StoryDisplay: React.FC<StoryDisplayProps> = ({
    storyLog,
    isLoading,
    isAiReady,
    apiKeyError,
    knownEntities,
    onEntityClick,
    fontFamily,
    fontSize
}) => {
    const storyContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (storyContainerRef.current) {
            storyContainerRef.current.scrollTop = storyContainerRef.current.scrollHeight;
        }
    }, [storyLog]);

    return (
        <div className="flex flex-col bg-white/70 dark:bg-[#252945]/80 backdrop-blur-sm p-4 rounded-lg shadow-inner border border-slate-300/20 dark:border-slate-600/20 overflow-hidden">
            <h2 className="text-xl font-semibold mb-3 text-pink-700 dark:text-pink-400 flex-shrink-0">
                Diễn Biến Câu Chuyện:
            </h2>
            <div ref={storyContainerRef} className={`flex-grow overflow-y-auto pr-2 space-y-4 ${fontFamily} ${fontSize}`}>
                {!isAiReady ? (
                    <div className="flex items-center justify-center h-full text-red-600 dark:text-red-400 text-center p-4">
                        {apiKeyError || "AI chưa sẵn sàng. Vui lòng kiểm tra API Key và quay về trang chủ."}
                    </div>
                ) : (
                    <>
                        {storyLog.map((line, index) => (
                            line.trim() === '' ? null : line.startsWith('>') 
                                ? <p key={index} className='text-cyan-700 dark:text-cyan-300 italic pl-4'>{line}</p>
                                : <InteractiveText key={index} text={line} onEntityClick={onEntityClick} knownEntities={knownEntities} />
                        ))}
                        {isLoading && storyLog.length > 0 && (
                            <div className="flex justify-center p-4">
                                <SpinnerIcon className="w-8 h-8 text-slate-700 dark:text-white"/>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};