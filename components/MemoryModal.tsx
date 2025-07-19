import React from 'react';
import type { Memory } from './types.ts';
import { PinIcon } from './Icons.tsx';

export const MemoryModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    memories: Memory[];
    onTogglePin: (index: number) => void;
}> = ({ isOpen, onClose, memories, onTogglePin }) => {
    if (!isOpen) return null;

    const MAX_UNPINNED_MEMORIES = 50;

    const memoriesWithIndex = memories.map((mem, index) => ({ ...mem, originalIndex: index }));
    const pinnedMemories = memoriesWithIndex.filter(mem => mem.pinned);
    const unpinnedMemories = memoriesWithIndex.filter(mem => !mem.pinned);

    const displayedUnpinned = unpinnedMemories.slice(-MAX_UNPINNED_MEMORIES);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white/90 dark:bg-[#252945]/90 backdrop-blur-sm border border-slate-300 dark:border-slate-700 rounded-lg shadow-xl w-full max-w-lg text-slate-900 dark:text-white" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-200 dark:border-slate-600 flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Dòng Ký Ức</h3>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <div className="p-4 max-h-96 overflow-y-auto">
                    {(pinnedMemories.length > 0 || displayedUnpinned.length > 0) ? (
                        <ul className="space-y-3">
                            {/* Pinned Memories */}
                            {pinnedMemories.map((mem) => (
                                <li key={mem.originalIndex} className="flex items-start justify-between gap-3 text-sm text-slate-700 dark:text-gray-300 border-l-4 border-yellow-400 pl-3 py-1 bg-yellow-400/10 rounded-r-md">
                                    <span>{mem.text}</span>
                                    <button 
                                        onClick={() => onTogglePin(mem.originalIndex)}
                                        className="p-1 rounded-full transition-colors bg-yellow-400 text-slate-800"
                                        aria-label="Bỏ ghim"
                                    >
                                        <PinIcon className="w-4 h-4" />
                                    </button>
                                </li>
                            ))}

                            {/* Separator */}
                            {pinnedMemories.length > 0 && displayedUnpinned.length > 0 && (
                                <hr className="my-3 border-slate-300 dark:border-slate-600" />
                            )}
                            
                            {/* Unpinned Memories */}
                            {displayedUnpinned.map((mem) => (
                                <li key={mem.originalIndex} className="flex items-start justify-between gap-3 text-sm text-slate-700 dark:text-gray-300 border-l-2 border-purple-500 pl-3 py-1">
                                    <span>{mem.text}</span>
                                    <button 
                                        onClick={() => onTogglePin(mem.originalIndex)}
                                        className="p-1 rounded-full transition-colors bg-slate-500 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500 text-white"
                                        aria-label="Ghim"
                                    >
                                        <PinIcon className="w-4 h-4" />
                                    </button>
                                </li>
                            ))}

                            {/* Hidden memories notice */}
                            {unpinnedMemories.length > MAX_UNPINNED_MEMORIES && (
                                <p className="text-xs text-center text-slate-500 dark:text-slate-400 pt-2">
                                    ...và {unpinnedMemories.length - MAX_UNPINNED_MEMORIES} ký ức cũ hơn đã bị ẩn. Ghim lại ký ức quan trọng để chúng luôn hiển thị.
                                </p>
                            )}

                        </ul>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">Chưa có ký ức mới.</p>
                    )}
                </div>
            </div>
        </div>
    );
};
