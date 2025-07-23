// components/game/ui/PlayerCharacterSheet.tsx
import React, { memo, useMemo } from 'react';
import type { Entity, KnownEntities, Status } from '../../types.ts';
import { getIconForEntity, getIconForStatus, getStatusBorderColor, getStatusTextColor, getStatusFontWeight } from '../../utils.ts';
import { UserIcon } from '../../Icons.tsx';
import * as GameIcons from '../../GameIcons.tsx';

// ===== MEMOIZED SKILLS SECTION =====
const MemoizedSkillsSection = memo<{
    learnedSkills: string[];
    knownEntities: KnownEntities;
    onEntityClick: (entityName: string) => void;
}>(({ learnedSkills, knownEntities, onEntityClick }) => {
    return (
        <div>
            <h4 className="font-semibold text-lg text-slate-800 dark:text-white mb-2 border-b border-slate-300 dark:border-slate-600 pb-1 flex items-center gap-2">
                <GameIcons.ScrollIcon className="w-5 h-5" /> Kỹ năng & Công pháp
            </h4>
            {learnedSkills.length > 0 ? (
                <ul className="space-y-2 pl-2">
                    {learnedSkills.map(skillName => (
                        <li key={skillName}>
                            <button 
                                onClick={() => onEntityClick(skillName)} 
                                className="text-left w-full p-2 bg-slate-200/50 dark:bg-slate-800/50 rounded-md hover:bg-slate-300/50 dark:hover:bg-slate-700/50 transition-colors border border-slate-300/50 dark:border-slate-600/50"
                            >
                                <p className="font-semibold text-cyan-700 dark:text-cyan-300 flex items-center gap-2">
                                    <span className="w-4 h-4">{getIconForEntity(knownEntities[skillName] || { name: skillName, type: 'skill', description: '' })}</span>
                                    {skillName} {knownEntities[skillName]?.realm ? `(${knownEntities[skillName].realm})` : ''}
                                </p>
                                {knownEntities[skillName]?.description && (
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 pl-6 line-clamp-2">
                                        {knownEntities[skillName].description}
                                    </p>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-600 dark:text-slate-400 italic text-center">Chưa học được kỹ năng nào.</p>
                </div>
            )}
        </div>
    );
});
MemoizedSkillsSection.displayName = 'MemoizedSkillsSection';

// ===== MEMOIZED STATUSES SECTION =====
const MemoizedStatusesSection = memo<{
    statuses: Status[];
    onStatusClick: (status: Status) => void;
}>(({ statuses, onStatusClick }) => {
    // Group statuses by type for better organization
    const groupedStatuses = useMemo(() => {
        const groups = {
            buff: statuses.filter(s => s.type === 'buff'),
            debuff: statuses.filter(s => s.type === 'debuff'),
            injury: statuses.filter(s => s.type === 'injury'),
            neutral: statuses.filter(s => s.type === 'neutral')
        };
        return groups;
    }, [statuses]);

    const totalStatuses = statuses.length;

    return (
        <div>
            <h4 className="font-semibold text-lg text-slate-800 dark:text-white mb-2 border-b border-slate-300 dark:border-slate-600 pb-1 flex items-center gap-2">
                <GameIcons.HeartIcon className="w-5 h-5" /> 
                Trạng thái hiện tại
                {totalStatuses > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                        {totalStatuses}
                    </span>
                )}
            </h4>
            
            {totalStatuses > 0 ? (
                <div className="space-y-3 pl-2">
                    {/* Buffs */}
                    {groupedStatuses.buff.length > 0 && (
                        <div>
                            <h5 className="text-sm font-medium text-green-700 dark:text-green-400 mb-1 flex items-center gap-1">
                                ✨ Tăng cường ({groupedStatuses.buff.length})
                            </h5>
                            <div className="flex flex-wrap gap-2">
                                {groupedStatuses.buff.map(status => (
                                    <button
                                        key={status.name}
                                        onClick={() => onStatusClick(status)}
                                        className={`px-3 py-1.5 border rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105 ${getStatusBorderColor(status)} hover:bg-slate-300/50 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 ${getStatusBorderColor(status).replace('border-', 'ring-').replace('/50', '')} shadow-sm`}
                                    >
                                        <span className="w-4 h-4">{getIconForStatus(status)}</span>
                                        <span className={`${getStatusTextColor(status)} ${getStatusFontWeight(status)} text-sm`}>
                                            {status.name}
                                        </span>
                                        {status.duration && status.duration !== 'permanent' && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                ({status.duration})
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Debuffs */}
                    {groupedStatuses.debuff.length > 0 && (
                        <div>
                            <h5 className="text-sm font-medium text-red-700 dark:text-red-400 mb-1 flex items-center gap-1">
                                💀 Suy yếu ({groupedStatuses.debuff.length})
                            </h5>
                            <div className="flex flex-wrap gap-2">
                                {groupedStatuses.debuff.map(status => (
                                    <button
                                        key={status.name}
                                        onClick={() => onStatusClick(status)}
                                        className={`px-3 py-1.5 border rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105 ${getStatusBorderColor(status)} hover:bg-slate-300/50 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 ${getStatusBorderColor(status).replace('border-', 'ring-').replace('/50', '')} shadow-sm`}
                                    >
                                        <span className="w-4 h-4">{getIconForStatus(status)}</span>
                                        <span className={`${getStatusTextColor(status)} ${getStatusFontWeight(status)} text-sm`}>
                                            {status.name}
                                        </span>
                                        {status.duration && status.duration !== 'permanent' && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                ({status.duration})
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Injuries */}
                    {groupedStatuses.injury.length > 0 && (
                        <div>
                            <h5 className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-1 flex items-center gap-1">
                                🩹 Chấn thương ({groupedStatuses.injury.length})
                            </h5>
                            <div className="flex flex-wrap gap-2">
                                {groupedStatuses.injury.map(status => (
                                    <button
                                        key={status.name}
                                        onClick={() => onStatusClick(status)}
                                        className={`px-3 py-1.5 border rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105 ${getStatusBorderColor(status)} hover:bg-slate-300/50 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 ${getStatusBorderColor(status).replace('border-', 'ring-').replace('/50', '')} shadow-sm`}
                                    >
                                        <span className="w-4 h-4">{getIconForStatus(status)}</span>
                                        <span className={`${getStatusTextColor(status)} ${getStatusFontWeight(status)} text-sm`}>
                                            {status.name}
                                        </span>
                                        {status.duration && status.duration !== 'permanent' && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                ({status.duration})
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Neutral */}
                    {groupedStatuses.neutral.length > 0 && (
                        <div>
                            <h5 className="text-sm font-medium text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1">
                                ⚪ Khác ({groupedStatuses.neutral.length})
                            </h5>
                            <div className="flex flex-wrap gap-2">
                                {groupedStatuses.neutral.map(status => (
                                    <button
                                        key={status.name}
                                        onClick={() => onStatusClick(status)}
                                        className={`px-3 py-1.5 border rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105 ${getStatusBorderColor(status)} hover:bg-slate-300/50 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 ${getStatusBorderColor(status).replace('border-', 'ring-').replace('/50', '')} shadow-sm`}
                                    >
                                        <span className="w-4 h-4">{getIconForStatus(status)}</span>
                                        <span className={`${getStatusTextColor(status)} ${getStatusFontWeight(status)} text-sm`}>
                                            {status.name}
                                        </span>
                                        {status.duration && status.duration !== 'permanent' && (
                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                ({status.duration})
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="text-center">
                        <GameIcons.HeartIcon className="w-8 h-8 mx-auto text-green-500 dark:text-green-400 mb-2" />
                        <p className="text-sm text-slate-600 dark:text-slate-400 italic">
                            Đang trong tình trạng bình thường
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                            Không có trạng thái đặc biệt nào
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
});
MemoizedStatusesSection.displayName = 'MemoizedStatusesSection';

// ===== MAIN PLAYER CHARACTER SHEET =====
export const MemoizedPlayerCharacterSheet: React.FC<{
    pc: Entity | undefined;
    statuses: Status[];
    knownEntities: KnownEntities;
    onStatusClick: (status: Status) => void;
    onEntityClick: (entityName: string) => void;
}> = memo(({ pc, statuses, knownEntities, onStatusClick, onEntityClick }) => {
    if (!pc) {
        return (
            <div className="p-4 text-center text-slate-500 h-full flex items-center justify-center">
                <div>
                    <UserIcon className="w-12 h-12 mx-auto mb-2 text-slate-400" />
                    <p>Không tìm thấy thông tin nhân vật.</p>
                </div>
            </div>
        );
    }

    const learnedSkills = pc.learnedSkills || [];

    // Helper function to get fame color based on level
    const getFameColor = (fame: string): string => {
        const fameLevel = fame.toLowerCase();
        if (fameLevel.includes('nổi tiếng') || fameLevel.includes('danh gia') || fameLevel.includes('huyền thoại')) {
            return 'text-purple-600 dark:text-purple-400 font-semibold';
        } else if (fameLevel.includes('khét tiếng') || fameLevel.includes('ác danh')) {
            return 'text-red-600 dark:text-red-400 font-semibold';
        } else if (fameLevel.includes('tốt') || fameLevel.includes('cao')) {
            return 'text-green-600 dark:text-green-400 font-semibold';
        }
        return 'text-slate-700 dark:text-gray-300';
    };

    return (
        <div className="p-4 h-full flex flex-col space-y-4 text-slate-700 dark:text-gray-300 overflow-y-auto">
            {/* Basic Information */}
            <div>
                <h4 className="font-semibold text-lg text-slate-800 dark:text-white mb-3 border-b border-slate-300 dark:border-slate-600 pb-1 flex items-center gap-2">
                    <UserIcon className="w-5 h-5" /> Thông tin cơ bản
                </h4>
                <div className="space-y-2 text-sm pl-2">
                    <div className="grid grid-cols-1 gap-2">
                        <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Tên:</strong> {pc.name}</p>
                        
                        {pc.gender && (
                            <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Giới tính:</strong> {pc.gender}</p>
                        )}
                        
                        {pc.age && (
                            <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Tuổi tác:</strong> {pc.age}</p>
                        )}
                        
                        {pc.location && (
                            <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Vị trí:</strong> {pc.location}</p>
                        )}
                        
                        {pc.realm && (
                            <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Thực lực:</strong> 
                                <span className="ml-2 text-cyan-600 dark:text-cyan-400 font-semibold">{pc.realm}</span>
                            </p>
                        )}
                        
                        {/* ENHANCED FAME DISPLAY */}
                        <div>
                            <strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Danh vọng:</strong>
                            {pc.fame ? (
                                <span className={`ml-2 ${getFameColor(pc.fame)}`}>
                                    {pc.fame}
                                </span>
                            ) : (
                                <span className="ml-2 text-gray-500 dark:text-gray-400 italic">Chưa có danh tiếng</span>
                            )}
                        </div>
                    </div>
                    
                    {/* Appearance - if exists, show in a separate section */}
