import React from 'react';
import { Entity, Status, EntityType } from '../../types';
import * as GameIcons from '../../../components/GameIcons';
import { BrainIcon } from '../../../components/Icons';

interface EntityInfoModalProps {
    entity: Entity | null;
    onClose: () => void;
    onUseItem: (itemName: string) => void;
    onLearnItem: (itemName: string) => void;
    onEquipItem: (itemName: string) => void;
    onUnequipItem: (itemName: string) => void;
    statuses: Status[];
    onStatusClick: (status: Status) => void;
}

// Helper functions for entity and status styling
const getIconForEntity = (entity: Entity): React.ReactNode => {
    if (!entity) return <GameIcons.SparklesIcon />;
    const name = entity.name.toLowerCase();
    const type = entity.type;

    if (type === 'item') {
        if (name.includes('kiếm')) return <GameIcons.SwordIcon />;
        if (name.includes('đao')) return <GameIcons.SaberIcon />;
        if (name.includes('thương')) return <GameIcons.SpearIcon />;
        if (name.includes('cung')) return <GameIcons.BowIcon />;
        if (name.includes('trượng')) return <GameIcons.StaffIcon />;
        if (name.includes('búa')) return <GameIcons.AxeIcon />;
        if (name.includes('chủy thủ') || name.includes('dao găm')) return <GameIcons.DaggerIcon />;
        if (name.includes('khiên')) return <GameIcons.ShieldIcon />;
        if (name.includes('giáp')) return <GameIcons.ChestplateIcon />;
        if (name.includes('nón') || name.includes('mũ')) return <GameIcons.HelmetIcon />;
        if (name.includes('ủng') || name.includes('giày')) return <GameIcons.BootsIcon />;
        if (name.includes('thuốc')) return <GameIcons.PotionIcon />;
        if (name.includes('đan')) return <GameIcons.PillIcon />;
        if (name.includes('sách') || name.includes('pháp') || name.includes('quyển')) return <GameIcons.BookIcon />;
        if (name.includes('cuốn') || name.includes('chỉ')) return <GameIcons.ScrollIcon />;
        if (name.includes('nhẫn')) return <GameIcons.RingIcon />;
        if (name.includes('dây chuyền')) return <GameIcons.AmuletIcon />;
        if (name.includes('chìa khóa')) return <GameIcons.KeyIcon />;
        if (name.includes('tiền') || name.includes('vàng') || name.includes('bạc')) return <GameIcons.CoinIcon />;
        if (name.includes('đá') || name.includes('ngọc')) return <GameIcons.GemIcon />;
        if (name.includes('thịt') || name.includes('thực')) return <GameIcons.MeatIcon />;
        return <GameIcons.ChestIcon />;
    }

    if (type === 'skill') {
        if (name.includes('kiếm')) return <GameIcons.SwordIcon />;
        if (name.includes('đao')) return <GameIcons.SaberIcon />;
        if (name.includes('quyền') || name.includes('chưởng')) return <GameIcons.FistIcon />;
        if (name.includes('cước')) return <GameIcons.BootIcon_Skill />;
        if (name.includes('thân pháp')) return <GameIcons.FeatherIcon />;
        if (name.includes('hỏa') || name.includes('lửa')) return <GameIcons.FireIcon />;
        if (name.includes('lôi') || name.includes('sét')) return <GameIcons.LightningIcon />;
        if (name.includes('thủy') || name.includes('nước')) return <GameIcons.WaterDropIcon />;
        if (name.includes('độc')) return <GameIcons.PoisonIcon />;
        if (name.includes('tâm pháp') || name.includes('công pháp') || name.includes('quyết')) return <GameIcons.BookIcon />;
        return <GameIcons.ScrollIcon />;
    }

    if (type === 'npc' || type === 'companion') return <GameIcons.NpcIcon />;
    if (type === 'location') return <GameIcons.MapIcon />;
    if (type === 'faction') return <GameIcons.FlagIcon />;
    if (type === 'concept') return <BrainIcon />;

    return <GameIcons.SparklesIcon />;
};

const getIconForStatus = (status: Status): React.ReactNode => {
    if (!status) return <GameIcons.HeartIcon />;
    const name = status.name.toLowerCase();
    const type = status.type;

    if (type === 'buff') return <GameIcons.UpArrowIcon />;
    if (name.includes('độc')) return <GameIcons.PoisonIcon />;
    if (name.includes('chảy máu')) return <GameIcons.BloodDropIcon />;
    if (name.includes('bỏng') || name.includes('hỏa')) return <GameIcons.FireIcon />;
    if (name.includes('tê liệt') || name.includes('choáng')) return <GameIcons.LightningIcon />;
    if (name.includes('gãy') || name.includes('trọng thương') || name.includes('thương tích')) return <GameIcons.BandagedHeartIcon />;
    if (name.includes('tan vỡ') || name.includes('đau khổ')) return <GameIcons.BrokenHeartIcon />;
    if (name.includes('yếu') || name.includes('suy nhược')) return <GameIcons.DownArrowIcon />;
    if (type === 'injury') return <GameIcons.BandagedHeartIcon />;
    if (type === 'debuff') return <GameIcons.DownArrowIcon />;
    
    return <GameIcons.HeartIcon />;
};

const getStatusTextColor = (status: Status): string => {
    if (status.type === 'buff') {
        return 'text-green-600 dark:text-green-400';
    }
    if (status.type === 'debuff' || status.type === 'injury') {
        if (/\b(nặng|trọng|vĩnh viễn)\b/i.test(status.name) || status.duration === 'Vĩnh viễn') {
             return 'text-red-700 dark:text-red-500';
        }
        if (/\b(nhẹ)\b/i.test(status.name)) {
            return 'text-yellow-600 dark:text-yellow-400';
        }
        return 'text-red-600 dark:text-red-400';
    }
    return 'text-slate-600 dark:text-slate-400'; // Neutral
};

const getStatusFontWeight = (status: Status): string => {
    if ((status.type === 'debuff' || status.type === 'injury') && (/\b(nặng|trọng|vĩnh viễn)\b/i.test(status.name) || status.duration === 'Vĩnh viễn')) {
        return 'font-bold';
    }
    if (status.type === 'buff' || status.type === 'debuff' || status.type === 'injury') {
        return 'font-semibold';
    }
    return 'font-normal';
};

const getStatusBorderColor = (status: Status): string => {
    if (status.type === 'buff') {
        return 'border-green-400/50';
    }
    if (status.type === 'debuff' || status.type === 'injury') {
        if (/\b(nặng|trọng|vĩnh viễn)\b/i.test(status.name) || status.duration === 'Vĩnh viễn') {
             return 'border-red-500/50';
        }
        if (/\b(nhẹ)\b/i.test(status.name)) {
            return 'border-yellow-400/50';
        }
        return 'border-red-400/50';
    }
    return 'border-slate-400 dark:border-slate-600/50';
};

export const EntityInfoModal: React.FC<EntityInfoModalProps> = ({ 
    entity, 
    onClose, 
    onUseItem, 
    onLearnItem, 
    onEquipItem, 
    onUnequipItem, 
    statuses, 
    onStatusClick 
}) => {
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
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white text-3xl leading-none">&times;</button>
                </div>
                <div className="p-5 space-y-3 text-slate-700 dark:text-gray-300 max-h-[60vh] overflow-y-auto">
                    <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Loại:</strong> <span className="capitalize">{entity.type}</span></p>
                    {entity.personality && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Tính cách:</strong> {entity.personality}</p>}

                    {entity.type === 'npc' && Array.isArray(entity.skills) && entity.skills.length > 0 && (
                        <div className="mt-2">
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

                    {npcStatuses.length > 0 && (
                        <div className="mt-2">
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
                    
                    {entity.gender && <p className="mt-2"><strong className="font-semibold text-slate-800 dark:text-gray-100">Giới tính:</strong> {entity.gender}</p>}
                    {entity.age && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Tuổi:</strong> {entity.age}</p>}
                    {entity.relationship && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Quan hệ:</strong> {entity.relationship}</p>}
                    {entity.realm && <p><strong className="font-semibold text-slate-800 dark:text-gray-100">{entity.type === 'skill' ? 'Cảnh giới Công Pháp:' : 'Cảnh giới:'}</strong> {entity.realm}</p>}
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
                    <p><strong className="font-semibold text-slate-800 dark:text-gray-100">Mô tả:</strong> {entity.description || 'Chưa có mô tả.'}</p>
                    
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