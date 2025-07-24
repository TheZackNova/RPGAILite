import React from 'react';
import { SaveData } from '../../types';
import { 
    HomeIcon, 
    ArchiveIcon, 
    DocumentAddIcon, 
    BrainIcon, 
    MemoryIcon, 
    RefreshIcon 
} from '../../../components/Icons';

interface TopNavigationProps {
    worldData: SaveData['worldData'];
    onRestart: () => void;
    onSave: () => void;
    onOpenKnowledge: () => void;
    onOpenMemory: () => void;
    onOpenRules: () => void;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
    worldData,
    onRestart,
    onSave,
    onOpenKnowledge,
    onOpenMemory,
    onOpenRules
}) => {
    return (
        <div className="flex justify-between items-center bg-white/70 dark:bg-[#252945]/80 backdrop-blur-sm p-3 rounded-t-lg shadow-lg flex-shrink-0 border-b border-slate-300/20 dark:border-slate-600/20">
            <button 
                onClick={onRestart} 
                className="flex items-center text-sm px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 rounded shadow-sm border border-slate-300 dark:border-slate-500 transition-colors text-slate-800 dark:text-white"
            >
                <HomeIcon className="w-4 h-4 mr-2" /> Home
            </button>
            
            <div className="text-center flex-1 min-w-0 mx-4">
                <div 
                    className="text-lg font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider truncate" 
                    title={worldData.genre || "Phiêu Lưu Ký"}
                >
                    {worldData.genre || "Phiêu Lưu Ký"}
                </div>
                <div 
                    className="text-xs text-slate-600 dark:text-slate-300 capitalize truncate" 
                    title={`Tính cách: ${worldData.customPersonality || worldData.personalityFromList}`}
                >
                    Tính cách: {worldData.customPersonality || worldData.personalityFromList}
                </div>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-white">
                <button 
                    onClick={onSave} 
                    className="flex items-center px-3 py-1.5 bg-slate-600 dark:bg-slate-700 hover:bg-slate-500 dark:hover:bg-slate-600 rounded shadow-sm border border-slate-500/50 transition-colors"
                >
                    <ArchiveIcon className="w-4 h-4 mr-1.5" /> Lưu Trữ
                </button>
                <button 
                    onClick={onOpenRules} 
                    className="flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded shadow-sm border border-purple-500/50 transition-colors"
                >
                    <DocumentAddIcon className="w-4 h-4 mr-1.5" /> Nạp Tri Thức
                </button>
                <button 
                    onClick={onOpenKnowledge} 
                    className="flex items-center px-3 py-1.5 bg-slate-600 dark:bg-slate-700 hover:bg-slate-500 dark:hover:bg-slate-600 rounded shadow-sm border border-slate-500/50 transition-colors"
                >
                    <BrainIcon className="w-4 h-4 mr-1.5" /> Tri Thức
                </button>
                <button 
                    onClick={onOpenMemory} 
                    className="flex items-center px-3 py-1.5 bg-slate-600 dark:bg-slate-700 hover:bg-slate-500 dark:hover:bg-slate-600 rounded shadow-sm border border-slate-500/50 transition-colors"
                >
                    <MemoryIcon className="w-4 h-4 mr-1.5" /> Ký Ức
                </button>
                <button 
                    onClick={onRestart} 
                    className="flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded shadow-sm border border-red-500/50 transition-colors"
                >
                    <RefreshIcon className="w-4 h-4 mr-1.5" /> Bắt Đầu Lại
                </button>
            </div>
        </div>
    );
};