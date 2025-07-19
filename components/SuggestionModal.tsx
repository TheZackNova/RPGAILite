import React from 'react';

export const SuggestionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    suggestions: string[];
    onSelect: (suggestion: string) => void;
    title: string;
}> = ({ isOpen, onClose, suggestions, onSelect, title }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white/90 dark:bg-[#252945]/90 backdrop-blur-sm border border-slate-300 dark:border-slate-700 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-200 dark:border-slate-600 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white text-2xl leading-none">&times;</button>
                </div>
                <div className="p-4 max-h-80 overflow-y-auto">
                    {suggestions.length > 0 ? (
                        <ul className="space-y-2">
                            {suggestions.map((s, index) => (
                                <li 
                                    key={index}
                                    onClick={() => onSelect(s)}
                                    className="p-3 bg-slate-100 dark:bg-[#373c5a] rounded-md hover:bg-purple-600 dark:hover:bg-purple-600 hover:text-white cursor-pointer transition-colors duration-200 text-sm text-slate-800 dark:text-gray-200"
                                >
                                    {s}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400 text-center">Không có gợi ý nào.</p>
                    )}
                </div>
            </div>
        </div>
    );
};
