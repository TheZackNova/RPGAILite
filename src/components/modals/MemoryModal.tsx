import React from 'react';
import { Memory } from '../../types';
import { PinIcon } from '../Icons';

interface MemoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    memories: Memory[];
    onTogglePin: (index: number) => void;
}

export const MemoryModal: React.FC<MemoryModalProps> = ({ 
    isOpen, 
    onClose, 
    memories, 
    onTogglePin 
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white/90 dark:bg-[#252945]/90 backdrop-blur-sm border border-slate-300 dark:border-slate-700 rounded-lg shadow-xl w-full max-w-lg text-slate-900 dark:text-white" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-200 dark:border-slate-600 flex justify-between items-center">
                    <h3 className="text-lg font-semibold">Dòng Ký Ức</h3>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <div className="p-4 max-h-96 overflow-y-auto">
                    {memories.length > 0 ? (
                        <ul className="space-y-3">
                            {memories.map((mem, index) => (
                                <li key={index} className="flex items-start justify-between gap-3 text-sm text-slate-700 dark:text-gray-300 border-l-2 border-purple-500 pl-3 py-1">
                                    <span>{mem.text}</span>
                                    <button 
                                        onClick={() => onTogglePin(index)}
                                        className={`p-1 rounded-full transition-colors ${mem.pinned ? 'bg-yellow-400 text-slate-800' : 'bg-slate-500 dark:bg-slate-600 hover:bg-slate-400 dark:hover:bg-slate-500 text-white'}`}
                                        aria-label={mem.pinned ? 'Bỏ ghim' : 'Ghim'}
                                    >
                                        <PinIcon className="w-4 h-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-4">Chưa có ký ức mới.</p>
                    )}
                </div>
            </div>
        </div>
    );
};