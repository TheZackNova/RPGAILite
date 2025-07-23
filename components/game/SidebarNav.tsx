

import React from 'react';
import { HomeIcon, ArchiveIcon, BrainIcon, MemoryIcon, RefreshIcon, DocumentAddIcon, CrossIcon, UserIcon, ExclamationIcon } from '../Icons.tsx';
import * as GameIcons from '../GameIcons.tsx';
import type { GameHistoryEntry } from '../types.ts';

interface SidebarNavProps {
    isOpen: boolean;
    onClose: () => void;
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
    currentTurnTokens: number;
    totalTokens: number;
    historyStats: {
        totalEntriesProcessed: number;
        totalTokensSaved: number;
        compressionCount: number;
    };
    compressedSegments: number;
    gameHistory: GameHistoryEntry[];
    cleanupStats: {
        totalCleanupsPerformed: number;
        totalTokensSavedFromCleanup: number;
        lastCleanupTurn: number;
    };
    onManualCleanup?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({ 
    isOpen, onClose, onHome, onSave, onMap, onRules, onKnowledge, onMemory, onRestart, 
    onPCInfo, onParty, onQuests, hasActiveQuests, currentTurnTokens, totalTokens,
    historyStats, compressedSegments, gameHistory, cleanupStats, onManualCleanup
}) => {
    const handleNavigation = (action: () => void) => {
        action();
        onClose();
    };

    return (
        <>
            <div className={`fixed inset-0 bg-black/60 z-[80] transition-opacity md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={onClose}></div>
            <div className={`fixed top-0 left-0 bottom-0 w-64 bg-slate-100 dark:bg-[#1f2238] shadow-2xl z-[90] p-4 flex flex-col transform transition-transform md:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h3 className="text-lg font-bold text-purple-600 dark:text-purple-400">Menu</h3>
                    <button onClick={onClose}><CrossIcon className="w-6 h-6"/></button>
                </div>
                <nav className="flex-grow overflow-y-auto pr-2 flex flex-col space-y-3">
                    <button onClick={() => handleNavigation(onHome)} className="flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded"><HomeIcon className="w-5 h-5 mr-3" /> Home</button>
                    <button onClick={() => handleNavigation(onSave)} className="flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded"><ArchiveIcon className="w-5 h-5 mr-3" /> Lưu Trữ</button>
                    <button onClick={() => handleNavigation(onMap)} className="flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded"><GameIcons.MapPinIcon className="w-5 h-5 mr-3" /> Bản Đồ</button>
                    <button onClick={() => handleNavigation(onRules)} className="flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded"><DocumentAddIcon className="w-5 h-5 mr-3" /> Nạp Tri Thức</button>
                    <button onClick={() => handleNavigation(onKnowledge)} className="flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded"><BrainIcon className="w-5 h-5 mr-3" /> Tri Thức</button>
                    <button onClick={() => handleNavigation(onMemory)} className="flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded"><MemoryIcon className="w-5 h-5 mr-3" /> Ký Ức</button>
                    <button onClick={() => handleNavigation(onRestart)} className="flex items-center text-left w-full px-3 py-2 bg-red-600/80 hover:bg-red-500 rounded text-white"><RefreshIcon className="w-5 h-5 mr-3" /> Bắt Đầu Lại</button>
                    <div className="border-t border-slate-300 dark:border-slate-700 pt-4 mt-4 space-y-3">
                        <button onClick={() => handleNavigation(onPCInfo)} className="flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded"><UserIcon className="w-5 h-5 mr-3" /> Thông tin</button>
                        <button onClick={() => handleNavigation(onParty)} className="flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded"><GameIcons.NpcIcon className="w-5 h-5 mr-3" /> Tổ đội</button>
                        <button onClick={() => handleNavigation(onQuests)} className="relative flex items-center text-left w-full px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded">
                            <GameIcons.ScrollIcon className="w-5 h-5 mr-3" /> Nhiệm vụ
                            {hasActiveQuests && <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded-full bg-yellow-500 text-white"><ExclamationIcon className="w-3 h-3" /></span>}
                        </button>
                    </div>
                </nav>
                <div className="mt-2 pt-2 border-t border-slate-400 dark:border-slate-600">
    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
        <div className="flex justify-between">
            <span>Cleanup:</span>
            <span className="font-mono text-green-400">{cleanupStats.totalCleanupsPerformed}x</span>
        </div>
        
        {cleanupStats.totalTokensSavedFromCleanup > 0 && (
            <div className="flex justify-between">
                <span>Saved:</span>
                <span className="font-mono text-green-400">
                    {Math.round(cleanupStats.totalTokensSavedFromCleanup / 1000)}k
                </span>
            </div>
        )}
        
        {onManualCleanup && (
            <button 
                onClick={onManualCleanup}
                className="w-full mt-1 px-2 py-1 bg-orange-600 hover:bg-orange-500 text-white text-xs rounded"
            >
                🧹 Manual Cleanup
            </button>
        )}
    </div>
</div>
                <div className="flex-shrink-0 text-center space-y-2 mt-auto pt-4 border-t border-slate-300 dark:border-slate-700">
                    <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Lượt:</span>
                        <span className={`font-mono font-semibold ${
                            currentTurnTokens > 80000 ? 'text-red-400' :
                            currentTurnTokens > 70000 ? 'text-orange-400' :
                            currentTurnTokens > 60000 ? 'text-yellow-400' : 'text-green-400'
                        }`}>
                            {currentTurnTokens.toLocaleString()}
                        </span>
                    </div>
                    
                    <div className="w-full bg-slate-600 rounded-full h-1.5">
                        <div 
                            className={`h-1.5 rounded-full transition-all duration-500 ${
                                currentTurnTokens > 80000 ? 'bg-red-400' :
                                currentTurnTokens > 70000 ? 'bg-orange-400' :
                                currentTurnTokens > 60000 ? 'bg-yellow-400' : 'bg-green-400'
                            }`}
                            style={{ width: `${Math.min(100, (currentTurnTokens / 80000) * 100)}%` }}
                        ></div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-400 dark:border-slate-600">
                        <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
                            <div className="flex justify-between">
                                <span>History:</span>
                                <span className="font-mono">{gameHistory.length} entries</span>
                            </div>
                            
                            {compressedSegments > 0 && (
                                <>
                                    <div className="flex justify-between">
                                        <span>Compressed:</span>
                                        <span className="font-mono text-green-400">{compressedSegments} segments</span>
                                    </div>
                                    
                                    <div className="flex justify-between">
                                        <span>Saved:</span>
                                        <span className="font-mono text-green-400">
                                            {Math.round(historyStats.totalTokensSaved / 1000)}k tokens
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};