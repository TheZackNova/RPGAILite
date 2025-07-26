import React from 'react';
import type { Entity, Status } from './types.ts';
import { getIconForEntity } from './utils.ts';

export const PartyMemberTab: React.FC<{
    party: Entity[];
    statuses: Status[];
    onMemberClick: (entityName: string) => void;
}> = ({ party, statuses, onMemberClick }) => {
    
    // Helper to get member status indicators
    const getMemberStatusIndicators = (member: Entity) => {
        const memberStatuses = statuses.filter(s => s.owner === member.name || (member.type === 'pc' && s.owner === 'pc'));
        
        if (memberStatuses.length === 0) return null;
        
        const buffs = memberStatuses.filter(s => s.type === 'buff').length;
        const debuffs = memberStatuses.filter(s => s.type === 'debuff').length;
        const injuries = memberStatuses.filter(s => s.type === 'injury').length;
        
        return (
            <div className="flex gap-1 text-xs">
                {buffs > 0 && <span className="text-green-500">↑{buffs}</span>}
                {debuffs > 0 && <span className="text-red-500">↓{debuffs}</span>}
                {injuries > 0 && <span className="text-orange-500">⚡{injuries}</span>}
            </div>
        );
    };
    
    // Helper to get relationship color
    const getRelationshipColor = (relationship: string) => {
        if (!relationship) return 'text-gray-500';
        const rel = relationship.toLowerCase();
        if (rel.includes('thù') || rel.includes('địch')) return 'text-red-400';
        if (rel.includes('bạn') || rel.includes('yêu') || rel.includes('tốt')) return 'text-green-400';
        if (rel.includes('trung') || rel.includes('bình')) return 'text-yellow-400';
        return 'text-blue-400';
    };
    
    return (
        <div className="p-4 h-full flex flex-col">
            <h3 className="font-semibold mb-2 flex-shrink-0 text-slate-800 dark:text-white">Thành viên tổ đội:</h3>
            <div className="flex-grow overflow-y-auto pr-2">
                {party.length > 0 ? (
                    <div className="space-y-3">
                        {party.map(member => (
                            <div key={member.name} className="bg-slate-100 dark:bg-slate-800/50 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => onMemberClick(member.name)}
                                    className="w-full text-left hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors rounded p-2"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="w-5 h-5">{getIconForEntity(member)}</span>
                                            <div>
                                                <p className="font-semibold text-slate-800 dark:text-white">{member.name}</p>
                                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                                    {member.type === 'pc' ? 'Nhân vật chính' : 'Đồng hành'}
                                                    {member.realm && ` • ${member.realm}`}
                                                </p>
                                            </div>
                                        </div>
                                        {getMemberStatusIndicators(member)}
                                    </div>
                                    
                                    {/* Enhanced info for companions */}
                                    {member.type === 'companion' && (
                                        <div className="mt-2 space-y-1">
                                            {member.relationship && (
                                                <p className={`text-xs ${getRelationshipColor(member.relationship)}`}>
                                                    ♦ {member.relationship}
                                                </p>
                                            )}
                                            {member.skills && Array.isArray(member.skills) && member.skills.length > 0 && (
                                                <p className="text-xs text-slate-600 dark:text-slate-400">
                                                    ⚔ {member.skills.slice(0, 2).join(', ')}
                                                    {member.skills.length > 2 && '...'}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-400">Tổ đội trống.</p>
                )}
            </div>
        </div>
    );
};
