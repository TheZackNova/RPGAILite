
import React from 'react';
import type { Entity, KnownEntities, Status } from '../types.ts';
import { getIconForEntity, getIconForStatus, getStatusBorderColor, getStatusTextColor, getStatusFontWeight } from '../utils.ts';
import { UserIcon } from '../Icons.tsx';
import * as GameIcons from '../GameIcons.tsx';

export const PlayerCharacterSheet: React.FC<{
    pc: Entity | undefined;
    statuses: Status[];
    knownEntities: KnownEntities;
    onStatusClick: (status: Status) => void;
    onEntityClick: (entityName: string) => void;
}> = ({ pc, statuses, knownEntities, onStatusClick, onEntityClick }) => {
    if (!pc) {
        return <div className="p-4 text-center text-slate-500">Không tìm thấy thông tin nhân vật.</div>;
    }

    const learnedSkills = pc.learnedSkills || [];

    return (
        <div className="p-4 h-full flex flex-col space-y-4 text-slate-700 dark:text-gray-300">
            {/* Basic Info */}
            <div>
                <h4 className="font-semibold text-lg text-slate-800 dark:text-white mb-2 border-b border-slate-300 dark:border-slate-600 pb-1 flex items-center gap-2">
                    <UserIcon className="w-5 h-5" />
                    Thông tin cơ bản
                </h4>
                <div className="space-y-1 text-sm pl-2">
                    <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Tên:</strong> {pc.name}</p>
                    {pc.location && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Vị trí:</strong> {pc.location}</p>}
                    {pc.age && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Tuổi tác:</strong> {pc.age}</p>}
                    {pc.appearance && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Dung mạo:</strong> {pc.appearance}</p>}
                    {pc.realm && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Thực lực:</strong> {pc.realm}</p>}
                    {pc.fame && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Danh vọng:</strong> {pc.fame}</p>}
                </div>
            </div>

            {/* Skills */}
            <div>
                <h4 className="font-semibold text-lg text-slate-800 dark:text-white mb-2 border-b border-slate-300 dark:border-slate-600 pb-1 flex items-center gap-2">
                    <GameIcons.ScrollIcon className="w-5 h-5" />
                    Kỹ năng & Công pháp
                </h4>
                {learnedSkills.length > 0 ? (
                    <ul className="space-y-2 pl-2">
                        {learnedSkills.map(skillName => {
                            const skillEntity = knownEntities[skillName];
                            return (
                                <li key={skillName}>
                                    <button onClick={() => onEntityClick(skillName)} className="text-left w-full p-2 bg-slate-200/50 dark:bg-slate-800/50 rounded-md hover:bg-slate-300/50 dark:hover:bg-slate-700/50 transition-colors">
                                        <p className="font-semibold text-cyan-700 dark:text-cyan-300 flex items-center gap-2">
                                            <span className="w-4 h-4">{getIconForEntity(skillEntity || {name: skillName, type: 'skill', description: ''})}</span>
                                            {skillName} {skillEntity?.realm ? `(${skillEntity.realm})` : ''}
                                        </p>
                                        {skillEntity?.description && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 pl-6">{skillEntity.description}</p>}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ) : <p className="text-sm text-slate-600 dark:text-slate-400 italic pl-2">Chưa học được kỹ năng nào.</p>}
            </div>

            {/* Statuses */}
            <div>
                <h4 className="font-semibold text-lg text-slate-800 dark:text-white mb-2 border-b border-slate-300 dark:border-slate-600 pb-1 flex items-center gap-2">
                    <GameIcons.HeartIcon className="w-5 h-5" />
                    Trạng thái hiện tại
                </h4>
                 {statuses.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-2 pl-2">
                        {statuses.map(status => (
                            <button
                                key={status.name}
                                onClick={() => onStatusClick(status)}
                                className={`px-2 py-1 border rounded-md transition-colors duration-200 flex items-center gap-1.5 ${getStatusBorderColor(status)} hover:bg-slate-300/50 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 ${getStatusBorderColor(status).replace('border-', 'ring-').replace('/50', '')}`}
                            >
                                <span className="w-4 h-4">{getIconForStatus(status)}</span>
                                <span className={`${getStatusTextColor(status)} ${getStatusFontWeight(status)} text-sm`}>
                                    {status.name}
                                </span>
                            </button>
                        ))}
                    </div>
                ) : <p className="text-sm text-slate-600 dark:text-slate-400 italic pl-2">Đang trong tình trạng bình thường.</p>}
            </div>
        </div>
    );
};
