
import React from 'react';
import type { Entity } from '../../types.ts';
import { getIconForEntity } from '../../utils.ts';

export const PartyMemberTab: React.FC<{
    party: Entity[];
    onMemberClick: (entityName: string) => void;
}> = ({ party, onMemberClick }) => (
    <div className="p-4 h-full flex flex-col">
        <h3 className="font-semibold mb-2 flex-shrink-0 text-slate-800 dark:text-white">Thành viên tổ đội:</h3>
        <div className="flex-grow overflow-y-auto pr-2">
            {party.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {party.map(member => (
                        <button
                            key={member.name}
                            onClick={() => onMemberClick(member.name)}
                            className="px-3 py-1.5 bg-cyan-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/50 rounded-md text-sm hover:bg-blue-500/30 dark:hover:bg-blue-500/40 transition-colors flex items-center gap-2"
                        >
                            <span className="w-4 h-4">{getIconForEntity(member)}</span>
                            {member.name}
                        </button>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400">Tổ đội trống.</p>
            )}
        </div>
    </div>
);