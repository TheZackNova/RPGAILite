import React from 'react';
import { ExclamationIcon } from '../../../components/Icons';

type TabType = 'status' | 'party' | 'quests';

interface TabNavigationProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    hasActiveQuests: boolean;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({
    activeTab,
    onTabChange,
    hasActiveQuests
}) => {
    const getTabClassName = (tab: TabType) => {
        const baseClasses = "flex-1 text-center py-2 text-sm rounded transition-colors";
        const activeClasses = "bg-slate-200/60 dark:bg-slate-700/80 text-slate-900 dark:text-white font-semibold";
        const inactiveClasses = "text-slate-600 dark:text-slate-400 hover:bg-slate-200/40 dark:hover:bg-slate-700/50";
        
        return `${baseClasses} ${activeTab === tab ? activeClasses : inactiveClasses}`;
    };

    return (
        <div className="flex justify-around items-center bg-white/70 dark:bg-[#252945]/80 backdrop-blur-sm p-1 flex-shrink-0">
            <button 
                onClick={() => onTabChange('status')} 
                className={getTabClassName('status')}
            >
                Trạng thái hiện tại
            </button>
            
            <button 
                onClick={() => onTabChange('party')} 
                className={getTabClassName('party')}
            >
                Tổ Đội Thành Viên
            </button>
            
            <button 
                onClick={() => onTabChange('quests')} 
                className={`relative ${getTabClassName('quests')}`}
            >
                Nhật Ký Nhiệm Vụ
                {hasActiveQuests && (
                    <span className="absolute top-1 right-2 w-5 h-5 flex items-center justify-center text-yellow-600 dark:text-yellow-300">
                        <ExclamationIcon className="w-4 h-4" />
                    </span>
                )}
            </button>
        </div>
    );
};