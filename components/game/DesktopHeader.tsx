

import React from 'react';
import { createPortal } from 'react-dom';
import { HomeIcon, ArchiveIcon, BrainIcon, MemoryIcon, RefreshIcon, DocumentAddIcon, ExclamationIcon, UserIcon } from '../Icons.tsx';
import * as GameIcons from '../GameIcons.tsx';
import type { FormData } from '../types.ts';

interface DesktopHeaderProps {
    onHome: () => void;
    onSettings: () => void;
    onImport: () => void;
    onSave: () => void;
    onMap: () => void;
    onRules: () => void;
    onKnowledge: () => void;
    onMemory: () => void;
    onRestart: () => void;
    onPCInfo: () => void;
    onParty: () => void;
    onQuests: () => void;
    onManualCleanup: () => void;
    hasActiveQuests: boolean;
    worldData: Partial<FormData>;
    gameTime: { year: number; month: number; day: number; hour: number; };
    turnCount: number;
    currentTurnTokens: number;
    totalTokens: number;
}
const getTokenColor = (tokens: number) => {
    if (tokens > 80000) return 'text-red-500 bg-red-100 dark:bg-red-900/30';
    if (tokens > 70000) return 'text-orange-500 bg-orange-100 dark:bg-orange-900/30';
    if (tokens > 60000) return 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30';
    return 'text-green-500 bg-green-100 dark:bg-green-900/30';
};
export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
    onHome, onSettings, onImport, onSave, onMap, onRules, onKnowledge, onMemory, onRestart,
    onPCInfo, onParty, onQuests, hasActiveQuests, onManualCleanup,
    worldData, gameTime, turnCount, currentTurnTokens, totalTokens
}) => {
    const [showGameMenu, setShowGameMenu] = React.useState(false);
    const [showPlayerMenu, setShowPlayerMenu] = React.useState(false);
    const gameButtonRef = React.useRef<HTMLButtonElement>(null);
    const playerButtonRef = React.useRef<HTMLButtonElement>(null);

    React.useEffect(() => {
        const handleClickOutside = () => {
            setShowGameMenu(false);
            setShowPlayerMenu(false);
        };
        
        if (showGameMenu || showPlayerMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showGameMenu, showPlayerMenu]);

    const getDropdownPosition = (buttonRef: React.RefObject<HTMLButtonElement>, isRight = false) => {
        if (!buttonRef.current) return { top: 64, left: 16 };
        const rect = buttonRef.current.getBoundingClientRect();
        return {
            top: rect.bottom + 4,
            [isRight ? 'right' : 'left']: isRight ? window.innerWidth - rect.right : rect.left
        };
    };

    return (
        <div className="hidden md:block">
            <div className="flex justify-between items-center bg-white/90 dark:bg-[#252945]/90 backdrop-blur-sm px-4 py-3 shadow-sm border-b border-slate-200/50 dark:border-slate-600/30">
                
                {/* Left: Home & Essential Actions */}
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onHome} 
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-600 dark:text-slate-300"
                        title="Home"
                    >
                        <HomeIcon className="w-5 h-5" />
                    </button>
                    
                    <div className="relative">
                        <button 
                            ref={gameButtonRef}
                            onClick={(e) => { e.stopPropagation(); setShowGameMenu(!showGameMenu); }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border ${
                                showGameMenu 
                                    ? 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600' 
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                            } text-slate-600 dark:text-slate-300`}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                            </svg>
                            <span className="text-sm font-medium">Game</span>
                            <svg className={`w-4 h-4 transition-transform ${showGameMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        
                    </div>
                </div>

                {/* Center: Game Title & Token Counter */}
                <div className="flex items-center gap-6">
                    <div className="text-center">
                        <div className="text-lg font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[200px]" title={worldData.storyName || "Phiêu Lưu Ký"}>
                            {worldData.storyName || "Phiêu Lưu Ký"}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={worldData.genre || 'Chưa xác định'}>
                            {worldData.genre || 'Chưa xác định'}
                        </div>
                    </div>
                    
                    {/* Token Counter - Always Visible */}
                    <div className={`font-mono px-4 py-2 rounded-lg border-2 transition-all ${getTokenColor(currentTurnTokens)} shadow-sm`}>
                        <div className="flex items-center gap-3 text-sm font-semibold">
                            <span>Lượt: {currentTurnTokens.toLocaleString()}</span>
                            <div className="w-px h-4 bg-current opacity-40"></div>
                            <span>Tổng: {totalTokens.toLocaleString()}</span>
                        </div>
                        <div className="mt-1.5 w-full bg-current opacity-20 rounded-full h-1.5">
                            <div className="bg-current h-1.5 rounded-full transition-all duration-500" 
                                style={{ width: `${Math.min(100, (currentTurnTokens / 80000) * 100)}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                {/* Right: Player Actions */}
                <div className="flex items-center gap-2">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mr-2">
                        Năm {Number.isFinite(gameTime.year) ? gameTime.year : 1}, Tháng {Number.isFinite(gameTime.month) ? gameTime.month : 1}, Ngày {Number.isFinite(gameTime.day) ? gameTime.day : 1}
                    </div>
                    
                    <div className="relative">
                        <button 
                            ref={playerButtonRef}
                            onClick={(e) => { e.stopPropagation(); setShowPlayerMenu(!showPlayerMenu); }}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors border ${
                                showPlayerMenu 
                                    ? 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600' 
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-700 border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                            } text-slate-600 dark:text-slate-300`}
                        >
                            <UserIcon className="w-4 h-4" />
                            <span className="text-sm font-medium">Player</span>
                            {hasActiveQuests && <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>}
                            <svg className={`w-4 h-4 transition-transform ${showPlayerMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        
                    </div>
                </div>
            </div>
            
            {/* Portal-rendered dropdowns to escape stacking context */}
            {showGameMenu && createPortal(
                <div 
                    onClick={(e) => e.stopPropagation()} 
                    className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-600 py-1 min-w-[180px]"
                    style={{ 
                        position: 'fixed',
                        zIndex: 2147483647,
                        ...getDropdownPosition(gameButtonRef)
                    }}
                >
                    <button onClick={() => { onSettings(); setShowGameMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        ⚙️ Cài đặt
                    </button>
                    <button onClick={() => { onImport(); setShowGameMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        📥 Nhập Entity
                    </button>
                    <div className="border-t border-slate-200 dark:border-slate-600 my-1"></div>
                    <button onClick={() => { onSave(); setShowGameMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <ArchiveIcon className="w-4 h-4" /> Lưu Trữ
                    </button>
                    <button onClick={() => { onMap(); setShowGameMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <GameIcons.MapPinIcon className="w-4 h-4" /> Bản Đồ
                    </button>
                    <button onClick={() => { onRules(); setShowGameMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <DocumentAddIcon className="w-4 h-4" /> Nạp Tri Thức
                    </button>
                    <button onClick={() => { onKnowledge(); setShowGameMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <BrainIcon className="w-4 h-4" /> Tri Thức
                        <span className="ml-auto text-xs text-slate-400">K</span>
                    </button>
                    <button onClick={() => { onMemory(); setShowGameMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <MemoryIcon className="w-4 h-4" /> Ký Ức
                    </button>
                    <div className="border-t border-slate-200 dark:border-slate-600 my-1"></div>
                    <button onClick={() => { onManualCleanup(); setShowGameMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex items-center gap-2 text-orange-600 dark:text-orange-400">
                        🧹 Cleanup
                    </button>
                    <button onClick={() => { onRestart(); setShowGameMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex items-center gap-2 text-red-600 dark:text-red-400">
                        <RefreshIcon className="w-4 h-4" /> Bắt Đầu Lại
                    </button>
                </div>,
                document.body
            )}
            
            {showPlayerMenu && createPortal(
                <div 
                    onClick={(e) => e.stopPropagation()} 
                    className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-600 py-1 min-w-[150px]"
                    style={{ 
                        position: 'fixed',
                        zIndex: 2147483647,
                        ...getDropdownPosition(playerButtonRef, true)
                    }}
                >
                    <button onClick={() => { onPCInfo(); setShowPlayerMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <UserIcon className="w-4 h-4" /> Thông tin
                    </button>
                    <button onClick={() => { onParty(); setShowPlayerMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex items-center gap-2 text-slate-700 dark:text-slate-200">
                        <GameIcons.NpcIcon className="w-4 h-4" /> Tổ đội
                    </button>
                    <button onClick={() => { onQuests(); setShowPlayerMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm flex items-center gap-2 relative text-slate-700 dark:text-slate-200">
                        <GameIcons.ScrollIcon className="w-4 h-4" /> Nhiệm vụ
                        {hasActiveQuests && <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>}
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
};