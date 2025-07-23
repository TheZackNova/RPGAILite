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
    
    // For PC, NPC, and Companion - get their statuses
    const characterStatuses = statuses.filter(s => s.owner === entity.name || (entity.type === 'pc' && s.owner === 'pc'));
    
    // Helper function to get relationship status color
    const getRelationshipColor = (relationship: string): string => {
        const rel = relationship.toLowerCase();
        if (rel.includes('thù') || rel.includes('địch') || rel.includes('ghét')) {
            return 'text-red-600 dark:text-red-400';
        } else if (rel.includes('bạn') || rel.includes('yêu') || rel.includes('tốt')) {
            return 'text-green-600 dark:text-green-400';
        } else if (rel.includes('trung') || rel.includes('bình')) {
            return 'text-yellow-600 dark:text-yellow-400';
        }
        return 'text-slate-700 dark:text-gray-300';
    };

    // Helper function to get fame color
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
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div 
                className={`bg-white/90 dark:bg-[#2a2f4c]/90 backdrop-blur-sm border-2 ${borderColor[entity.type] || 'border-slate-600'} rounded-lg shadow-2xl w-full max-w-lg text-slate-900 dark:text-white`} 
                onClick={e => e.stopPropagation()}
            >
                <div className={`p-4 border-b-2 ${borderColor[entity.type] || 'border-slate-600'} flex justify-between items-center`}>
                    <h3 className={`text-xl font-bold ${typeColors[entity.type] || 'text-slate-900 dark:text-white'} flex items-center gap-2`}>
                        <span className="w-6 h-6">{getIconForEntity(entity)}</span>
                        {entity.name}
                        {entity.type === 'pc' && <span className="text-xs text-yellow-400 dark:text-yellow-500 font-normal italic">(Nhân vật chính)</span>}
                        {entity.equipped && <span className="text-xs text-green-400 dark:text-green-500 font-normal italic">(Đang trang bị)</span>}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white text-3xl leading-none">
                        <CrossIcon className="w-6 h-6"/>
                    </button>
                </div>
                
                <div className="p-5 space-y-3 text-slate-700 dark:text-gray-300 max-h-[70vh] overflow-y-auto">
                    {/* Basic Information */}
                    <div className="space-y-2">
                        <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Loại:</strong> <span className="capitalize">{entity.type === 'pc' ? 'Nhân vật chính' : entity.type}</span></p>
                        
                        {/* Character-like info */}
                        {(entity.type === 'pc' || entity.type === 'npc' || entity.type === 'companion') && (
                            <>
                                {entity.gender && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Giới tính:</strong> {entity.gender}</p>}
                                {entity.age && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Tuổi:</strong> {entity.age}</p>}
                                {entity.appearance && (
                                    <div>
                                        <strong className="font-semibold text-slate-800 dark:text-gray-100">Dung mạo:</strong>
                                        <p className="pl-2 mt-1 text-sm">{entity.appearance}</p>
                                    </div>
                                )}
                                {entity.location && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Vị trí:</strong> {entity.location}</p>}
                                
                                {/* DANH VỌNG - Enhanced display for both PC and NPC */}
                                <div>
                                    <strong className="font-semibold text-slate-800 dark:text-gray-100">Danh vọng:</strong>
                                    {entity.fame ? (
                                        <span className={`ml-2 ${getFameColor(entity.fame)}`}>{entity.fame}</span>
                                    ) : (
                                        <span className="ml-2 text-gray-500 dark:text-gray-400 italic">
                                            {entity.type === 'pc' ? 'Chưa có danh tiếng' : 'Chưa xác định'}
                                        </span>
                                    )}
                                </div>
                                
                                {entity.personality && (
                                    <div>
                                        <strong className="font-semibold text-slate-800 dark:text-gray-100">Tính cách (Bề ngoài):</strong>
                                        <p className="pl-2 mt-1 text-sm">{entity.personality}</p>
                                    </div>
                                )}
                                {entity.motivation && (
                                    <div>
                                        <strong className="font-semibold text-slate-800 dark:text-gray-100">Động cơ:</strong>
                                        <p className="pl-2 mt-1 text-sm">{entity.motivation}</p>
                                    </div>
                                )}
                                {entity.type !== 'pc' && entity.personalityMbti && MBTI_PERSONALITIES[entity.personalityMbti] && (
                                    <div>
                                        <strong className="font-semibold text-slate-800 dark:text-gray-100">Tính cách (Cốt lõi):</strong>
                                        <p className="pl-2 mt-1 text-sm">
                                            {` ${MBTI_PERSONALITIES[entity.personalityMbti].title} (${entity.personalityMbti}) - `}
                                            <span className="italic">{`"${MBTI_PERSONALITIES[entity.personalityMbti].description}"`}</span>
                                        </p>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Realm can apply to characters and skills */}
                        {entity.realm && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">{entity.type === 'skill' ? 'Cảnh giới Công Pháp:' : entity.type === 'pc' ? 'Thực lực:' : 'Cảnh giới:'}</strong> <span className="text-cyan-600 dark:text-cyan-400 font-semibold">{entity.realm}</span></p>}
                    </div>

                    {/* PC specific info - Skills */}
                    {entity.type === 'pc' && entity.learnedSkills && Array.isArray(entity.learnedSkills) && entity.learnedSkills.length > 0 && (
                        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700/60">
                            <strong className="font-semibold text-slate-800 dark:text-gray-100">Kỹ năng đã học:</strong>
                            <ul className="list-disc list-inside pl-2 mt-1 space-y-1">
                                {entity.learnedSkills.map((skillName: string) => (
                                    <li key={skillName} className="text-sm text-slate-600 dark:text-gray-400">
                                        {skillName}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* NPC and Companion specific info */}
                    {(entity.type === 'npc' || entity.type === 'companion') && (
                        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700/60 space-y-3">
                            {/* QUAN HỆ - Enhanced display */}
                            <div>
                                <strong className="font-semibold text-slate-800 dark:text-gray-100">Quan hệ:</strong>
                                {entity.relationship ? (
                                    <span className={`ml-2 ${getRelationshipColor(entity.relationship)}`}>
                                        {entity.relationship}
                                    </span>
                                ) : (
                                    <span className="ml-2 text-gray-500 dark:text-gray-400 italic">Chưa xác định</span>
                                )}
                            </div>

                            {/* Skills */}
                            {Array.isArray(entity.skills) && entity.skills.length > 0 && (
                                <div>
                                    <strong className="font-semibold text-slate-800 dark:text-gray-100">Kỹ năng:</strong>
                                    <ul className="list-disc list-inside pl-2 mt-1 space-y-1">
                                        {entity.skills.map((skillName: string) => (
                                            <li key={skillName} className="text-sm text-slate-600 dark:text-gray-400">
                                                {skillName}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TRẠNG THÁI - Enhanced display for PC, NPC, and Companion */}
                    {(entity.type === 'pc' || entity.type === 'npc' || entity.type === 'companion') && (
                        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700/60">
                            <strong className="font-semibold text-slate-800 dark:text-gray-100">Trạng thái hiện tại:</strong>
                            {characterStatuses.length > 0 ? (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {characterStatuses.map(status => (
                                        <button
                                            key={status.name}
                                            onClick={() => onStatusClick(status)}
                                            className={`px-3 py-1.5 border rounded-lg transition-all duration-200 flex items-center gap-2 hover:scale-105 ${getStatusBorderColor(status)} hover:bg-slate-200 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 ${getStatusBorderColor(status).replace('border-', 'ring-').replace('/50', '')} shadow-sm`}
                                        >
                                            <span className="w-4 h-4">{getIconForStatus(status)}</span>
                                            <span className={`${getStatusTextColor(status)} ${getStatusFontWeight(status)} text-sm`}>
                                                {status.name}
                                            </span>
                                            {status.duration && status.duration !== 'permanent' && (
                                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                                    ({status.duration})
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="mt-2 p-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <p className="text-sm text-gray-500 dark:text-gray-400 italic text-center">
                                        {entity.type === 'pc' ? 'Đang trong tình trạng bình thường' : 'Không có trạng thái đặc biệt'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Item specific details */}
                    {entity.type === 'item' && (
                        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700/60 space-y-2">
                            {typeof entity.durability === 'number' && 
                                <p>
                                    <strong className="font-semibold text-slate-800 dark:text-gray-100">Độ bền:</strong> 
                                    <span className={entity.durability <= 0 ? 'text-red-600 dark:text-red-400 font-bold' : entity.durability <= 20 ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}>
                                        {` ${entity.durability} / 100 `}
                                        {entity.durability <= 0 && <span className="ml-2">(Hỏng)</span>}
                                        {entity.durability > 0 && entity.durability <= 20 && <span className="ml-2">(Sắp hỏng)</span>}
                                    </span>
                                </p>
                            }
                            {typeof entity.uses === 'number' && (
                                <p>
                                    <strong className="font-semibold text-slate-800 dark:text-gray-100">Số lần dùng:</strong> 
                                    <span className={entity.uses <= 0 ? 'text-red-600 dark:text-red-400' : entity.uses <= 2 ? 'text-yellow-600 dark:text-yellow-400' : ''}>
                                        {entity.uses}
                                        {entity.uses <= 0 && <span className="ml-2">(Đã hết)</span>}
                                        {entity.uses > 0 && entity.uses <= 2 && <span className="ml-2">(Sắp hết)</span>}
                                    </span>
                                </p>
                            )}
                            {entity.owner && (
                                <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Chủ sở hữu:</strong> {entity.owner}</p>
                            )}
                        </div>
                    )}

                    {/* Description */}
                    <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-700/60">
                        <strong className="font-semibold text-slate-800 dark:text-gray-100">Mô tả:</strong>
                        <p className="mt-2 text-sm leading-relaxed bg-slate-50 dark:bg-slate-800/30 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                            {entity.description || 'Chưa có mô tả.'}
                        </p>
                    </div>
                    
                    {/* Action buttons for items */}
                    {entity.type === 'item' && isPcsItem && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/60 flex flex-col space-y-2">
                            {isEquippableItem && (
                                !entity.equipped ? (
                                    <button 
                                        onClick={() => onEquipItem(entity.name)} 
                                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
                                    >
                                        ⚔️ Trang bị
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => onUnequipItem(entity.name)} 
                                        className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
                                    >
                                        📤 Gỡ trang bị
                                    </button>
                                )
                            )}
                            {isUsableItem && entity.uses! > 0 && (
                                <button 
                                    onClick={() => onUseItem(entity.name)} 
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
                                >
                                    🍃 Sử dụng {entity.uses && `(${entity.uses} lần)`}
                                </button>
                            )}
                            {isLearnableItem && (
                                <button 
                                    onClick={() => onLearnItem(entity.name)} 
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-semibold transition-colors duration-200 flex items-center justify-center gap-2"
                                >
                                    📚 Học công pháp
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
