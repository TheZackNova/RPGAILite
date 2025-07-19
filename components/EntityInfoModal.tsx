

import React from 'react';
import type { Entity, Status, EntityType } from './types.ts';
import { getIconForEntity, getIconForStatus, getStatusBorderColor, getStatusTextColor, getStatusFontWeight } from './utils.ts';
import { CrossIcon } from './Icons.tsx';
import { MBTI_PERSONALITIES } from './data/mbti.ts';

export const EntityInfoModal: React.FC<{ 
    entity: Entity | null; 
    onClose: () => void; 
    onUseItem: (itemName: string) => void;
    onLearnItem: (itemName: string) => void;
    onEquipItem: (itemName: string) => void;
    onUnequipItem: (itemName: string) => void;
    statuses: Status[];
    onStatusClick: (status: Status) => void;
}> = ({ entity, onClose, onUseItem, onLearnItem, onEquipItem, onUnequipItem, statuses, onStatusClick }) => {
    if (!entity) return null;

    const typeColors: { [key in EntityType | string]: string } = {
        pc: 'text-yellow-600 dark:text-yellow-400',
        npc: 'text-blue-600 dark:text-blue-400',
        companion: 'text-blue-600 dark:text-blue-400',
        location: 'text-green-600 dark:text-green-400',
        faction: 'text-red-700 dark:text-red-500',
        item: 'text-amber-700 dark:text-amber-300',
        skill: 'text-amber-700 dark:text-amber-300',
        concept: 'text-purple-600 dark:text-purple-400'
    };
    const borderColor: { [key in EntityType | string]: string } = {
        pc: 'border-yellow-400',
        npc: 'border-blue-400',
        companion: 'border-blue-400',
        location: 'border-green-400',
        faction: 'border-red-500',
        item: 'border-amber-400',
        skill: 'border-amber-400',
        concept: 'border-purple-400'
    };

    const isPcsItem = entity.type === 'item' && entity.owner === 'pc';
    const isLearnableItem = isPcsItem && entity.learnable;
    const isUsableItem = isPcsItem && entity.usable;
    const isEquippableItem = isPcsItem && entity.equippable;
    const npcStatuses = statuses.filter(s => s.owner === entity.name);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div 
                className={`bg-white/90 dark:bg-[#2a2f4c]/90 backdrop-blur-sm border-2 ${borderColor[entity.type] || 'border-slate-600'} rounded-lg shadow-2xl w-full max-w-lg text-slate-900 dark:text-white`} 
                onClick={e => e.stopPropagation()}
            >
                <div className={`p-4 border-b-2 ${borderColor[entity.type] || 'border-slate-600'} flex justify-between items-center`}>
                    <h3 className={`text-xl font-bold ${typeColors[entity.type] || 'text-slate-900 dark:text-white'} flex items-center gap-2`}>
                        <span className="w-6 h-6">{getIconForEntity(entity)}</span>
                        {entity.name}
                        {entity.equipped && <span className="text-xs text-green-400 dark:text-green-500 font-normal italic">(Đang trang bị)</span>}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white text-3xl leading-none"><CrossIcon className="w-6 h-6"/></button>
                </div>
                <div className="p-5 space-y-3 text-slate-700 dark:text-gray-300 max-h-[60vh] overflow-y-auto">
                    <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Loại:</strong> <span className="capitalize">{entity.type}</span></p>
                    
                    {/* Character-like info */}
                    {(entity.type === 'pc' || entity.type === 'npc' || entity.type === 'companion') && (
                        <>
                            {entity.gender && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Giới tính:</strong> {entity.gender}</p>}
                            {entity.age && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Tuổi:</strong> {entity.age}</p>}
                            {entity.appearance && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Dung mạo:</strong> {entity.appearance}</p>}
                            {entity.personality && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Tính cách (Bề ngoài):</strong> {entity.personality}</p>}
                            {entity.motivation && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Động cơ:</strong> {entity.motivation}</p>}
                            {entity.type !== 'pc' && entity.personalityMbti && MBTI_PERSONALITIES[entity.personalityMbti] && (
                                <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Tính cách (Cốt lõi):</strong> 
                                    {` ${MBTI_PERSONALITIES[entity.personalityMbti].title} (${entity.personalityMbti}) - `}
                                    <span className="italic">{`"${MBTI_PERSONALITIES[entity.personalityMbti].description}"`}</span>
                                </p>
                            )}
                             {entity.relationship && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Quan hệ:</strong> {entity.relationship}</p>}
                        </>
                    )}

                    {/* Realm can apply to characters and skills */}
                    {entity.realm && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">{entity.type === 'skill' ? 'Cảnh giới Công Pháp:' : 'Cảnh giới:'}</strong> {entity.realm}</p>}

                    {/* Skills for NPCs/Companions */}
                    {(entity.type === 'npc' || entity.type === 'companion') && Array.isArray(entity.skills) && entity.skills.length > 0 && (
                        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700/60">
                            <strong className="font-semibold text-slate-800 dark:text-gray-100">Kỹ năng:</strong>
                            <ul className="list-disc list-inside pl-2 mt-1">
                                {entity.skills.map((skillName: string) => (
                                    <li key={skillName} className="text-sm">
                                        {skillName}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Statuses for NPCs/Companions */}
                    {npcStatuses.length > 0 && (
                        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700/60">
                            <strong className="font-semibold text-slate-800 dark:text-gray-100">Trạng thái hiện tại:</strong>
                            <div className="flex flex-wrap gap-2 mt-1">
                                {npcStatuses.map(status => (
                                    <button
                                        key={status.name}
                                        onClick={() => onStatusClick(status)}
                                        className={`px-2 py-1 border rounded-md transition-colors duration-200 flex items-center gap-1.5 ${getStatusBorderColor(status)} hover:bg-slate-200 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 ${getStatusBorderColor(status).replace('border-', 'ring-').replace('/50', '')}`}
                                    >
                                        <span className="w-4 h-4">{getIconForStatus(status)}</span>
                                        <span className={`${getStatusTextColor(status)} ${getStatusFontWeight(status)} text-sm`}>
                                            {status.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Item specific details */}
                     {entity.type === 'item' && (
                        <>
                            {typeof entity.durability === 'number' && 
                                <p>
                                    <strong className="font-semibold text-slate-800 dark:text-gray-100">Độ bền:</strong> 
                                    <span className={entity.durability <= 0 ? 'text-red-600 font-bold' : ''}>
                                        {` ${entity.durability} / 100 `}
                                        {entity.durability <= 0 && <span className="ml-2">(Hỏng)</span>}
                                    </span>
                                </p>
                            }
                            {typeof entity.uses === 'number' && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Số lần dùng:</strong> {entity.uses}</p>}
                        </>
                    )}

                    <p className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700/60"><strong className="font-semibold text-slate-800 dark:text-gray-100">Mô tả:</strong> {entity.description || 'Chưa có mô tả.'}</p>
                    
                     <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/60 flex flex-col space-y-2">
                        {isEquippableItem && (
                            !entity.equipped ? (
                                <button
                                    onClick={() => onEquipItem(entity.name)}
                                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded transition-colors"
                                >
                                    Trang bị
                                </button>
                            ) : (
                                <button
                                    onClick={() => onUnequipItem(entity.name)}
                                    className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded transition-colors"
                                >
                                    Tháo ra
                                </button>
                            )
                        )}
                        {isLearnableItem && (
                             <button
                                onClick={() => onLearnItem(entity.name)}
                                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-4 rounded transition-colors"
                            >
                                Học Công Pháp
                            </button>
                        )}
                        {isUsableItem && (
                            <button
                                onClick={() => onUseItem(entity.name)}
                                disabled={(typeof entity.durability === 'number' && entity.durability <= 0) || (typeof entity.uses === 'number' && entity.uses <= 0)}
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded transition-colors disabled:bg-slate-600 disabled:cursor-not-allowed"
                            >
                                Sử dụng
                            </button>
                        )}
                     </div>
                </div>
            </div>
        </div>
    );
};