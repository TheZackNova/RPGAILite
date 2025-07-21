
import React from 'react';
import { HomeIcon, ArchiveIcon, BrainIcon, MemoryIcon, RefreshIcon, DocumentAddIcon, ExclamationIcon, UserIcon } from '../Icons.tsx';
import * as GameIcons from '../GameIcons.tsx';
import type { FormData } from '../types.ts';

interface DesktopHeaderProps {
    onHome: () => void;
    onSave: () => void;
    onMap: () => void;
    onRules: () => void;
    onKnowledge: () => void;
    onMemory: () => void;
    onRestart: () => void;
    onPCInfo: () => void;
    onParty: () => void;
    onQuests: () => void;
    hasActiveQuests: boolean;
    worldData: Partial<FormData>;
    gameTime: { year: number; month: number; day: number; hour: number; };
    turnCount: number;
    currentTurnTokens: number;
    totalTokens: number;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
    onHome, onSave, onMap, onRules, onKnowledge, onMemory, onRestart,
    onPCInfo, onParty, onQuests, hasActiveQuests,
    worldData, gameTime, turnCount, currentTurnTokens, totalTokens
}) => {
    return (
        <div className="hidden md:block">
            <div className="flex justify-between items-center bg-white/70 dark:bg-[#252945]/80 backdrop-blur-sm p-3 rounded-t-lg shadow-lg flex-shrink-0 border-b border-slate-300/20 dark:border-slate-600/20">
                <button onClick={onHome} className="flex items-center text-sm px-3 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 rounded shadow-sm border border-slate-300 dark:border-slate-500 transition-colors text-slate-800 dark:text-white"><HomeIcon className="w-4 h-4 mr-2" /> Home</button>
                <div className="text-center flex-1 min-w-0 mx-4">
                    <div className="text-lg font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider truncate" title={worldData.genre || "Phiêu Lưu Ký"}>{worldData.genre || "Phiêu Lưu Ký"}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 capitalize truncate" title={`Tính cách: ${worldData.customPersonality || worldData.personalityFromList}`}>Tính cách: {worldData.customPersonality || worldData.personalityFromList}</div>
                </div>
                <div className="flex items-center space-x-2 text-sm text-white">
                    const getTokenColor = (tokens: number) => {
    if (tokens > 80000) return 'text-red-500 bg-red-100 dark:bg-red-900/30';
    if (tokens > 70000) return 'text-orange-500 bg-orange-100 dark:bg-orange-900/30';
    if (tokens > 60000) return 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30';
    return 'text-green-500 bg-green-100 dark:bg-green-900/30';
};
                    <button onClick={onSave} className="flex items-center px-3 py-1.5 bg-slate-600 dark:bg-slate-700 hover:bg-slate-500 dark:hover:bg-slate-600 rounded shadow-sm border border-slate-500/50 transition-colors"><ArchiveIcon className="w-4 h-4 mr-1.5" /> Lưu Trữ</button>
                    <button onClick={onMap} className="flex items-center px-3 py-1.5 bg-slate-600 dark:bg-slate-700 hover:bg-slate-500 dark:hover:bg-slate-600 rounded shadow-sm border border-slate-500/50 transition-colors"><GameIcons.MapPinIcon className="w-4 h-4 mr-1.5" /> Bản Đồ</button>
                    <button onClick={onRules} className="flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded shadow-sm border border-purple-500/50 transition-colors"><DocumentAddIcon className="w-4 h-4 mr-1.5" /> Nạp Tri Thức</button>
                    <button onClick={onKnowledge} className="flex items-center px-3 py-1.5 bg-slate-600 dark:bg-slate-700 hover:bg-slate-500 dark:hover:bg-slate-600 rounded shadow-sm border border-slate-500/50 transition-colors"><BrainIcon className="w-4 h-4 mr-1.5" /> Tri Thức</button>
                    <button onClick={onMemory} className="flex items-center px-3 py-1.5 bg-slate-600 dark:bg-slate-700 hover:bg-slate-500 dark:hover:bg-slate-600 rounded shadow-sm border border-slate-500/50 transition-colors"><MemoryIcon className="w-4 h-4 mr-1.5" /> Ký Ức</button>
                    <button onClick={onRestart} className="flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded shadow-sm border border-red-500/50 transition-colors"><RefreshIcon className="w-4 h-4 mr-1.5" /> Bắt Đầu Lại</button>
                </div>
            </div>
            <div className="flex justify-center items-center gap-3 bg-white/70 dark:bg-[#252945]/80 backdrop-blur-sm p-2 rounded-b-lg shadow-lg flex-shrink-0 border-x border-b border-slate-300/20 dark:border-slate-600/20">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-200 dark:bg-slate-700/50 px-3 py-2 rounded-md border border-slate-300 dark:border-slate-600 whitespace-nowrap">
                    Thời Gian: Năm {gameTime.year} Tháng {gameTime.month} Ngày {gameTime.day}, {gameTime.hour} giờ
                </div>
                <button onClick={onPCInfo} className="flex items-center text-sm px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md shadow-sm border border-slate-300 dark:border-slate-600 transition-colors text-slate-800 dark:text-white">
                    <UserIcon className="w-5 h-5 mr-2" /> Thông tin
                </button>
                <button onClick={onParty} className="flex items-center text-sm px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md shadow-sm border border-slate-300 dark:border-slate-600 transition-colors text-slate-800 dark:text-white">
                     <GameIcons.NpcIcon className="w-5 h-5 mr-2" /> Tổ đội
                </button>
                <button onClick={onQuests} className="relative flex items-center text-sm px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-md shadow-sm border border-slate-300 dark:border-slate-600 transition-colors text-slate-800 dark:text-white">
                    <GameIcons.ScrollIcon className="w-5 h-5 mr-2" /> Nhiệm vụ
                     {hasActiveQuests && <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center rounded-full bg-yellow-500 text-white"><ExclamationIcon className="w-3 h-3" /></span>}
                </button>
            </div>
        </div>
    );
};
