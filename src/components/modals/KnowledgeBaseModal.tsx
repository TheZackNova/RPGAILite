import React from 'react';
import { Entity, KnownEntities } from '../../types';
import * as GameIcons from '../GameIcons';
import { BrainIcon, CrossIcon } from '../Icons';

interface KnowledgeBaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    pc: Entity | undefined;
    knownEntities: KnownEntities;
    onEntityClick: (entityName: string) => void;
    turnCount: number;
}

// Helper function for entity icons
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

export const KnowledgeBaseModal: React.FC<KnowledgeBaseModalProps> = ({ 
    isOpen, 
    onClose, 
    pc, 
    knownEntities, 
    onEntityClick, 
    turnCount 
}) => {
    if (!isOpen) return null;

    const categorizedEntities: { [key: string]: Entity[] } = {};
    Object.values(knownEntities).forEach(entity => {
        if (entity.type === 'item') {
            // Add to player's inventory if they own it
            if (entity.owner === 'pc') {
                if (!categorizedEntities['inventory']) {
                    categorizedEntities['inventory'] = [];
                }
                categorizedEntities['inventory'].push(entity);
            }
            
            // Add ALL items to the encyclopedia
            if (!categorizedEntities['item_encyclopedia']) {
                categorizedEntities['item_encyclopedia'] = [];
            }
            categorizedEntities['item_encyclopedia'].push(entity);
        } else {
            if (!categorizedEntities[entity.type]) {
                categorizedEntities[entity.type] = [];
            }
            // Don't add PC to the NPC list
            if (entity.type === 'npc' && entity.name === pc?.name) return;
            categorizedEntities[entity.type]?.push(entity);
        }
    });
    
    const categoryTitles: { [key: string]: string } = {
        skill: "Kỹ năng & Công pháp",
        inventory: "Hành Trang Nhân Vật",
        npc: "Nhân vật đã gặp",
        location: "Địa điểm đã biết",
        item_encyclopedia: "Bách Khoa Vật Phẩm",
        faction: "Thế lực & Tổ chức",
        companion: "Đồng hành",
        concept: "Khái Niệm & Quy Tắc"
    };

    const handleItemClick = (name: string) => {
        onClose(); // Close this modal first
        setTimeout(() => onEntityClick(name), 100); // Open the entity detail modal after a short delay
    }

    const categoryOrder: string[] = ['skill', 'inventory', 'npc', 'companion', 'location', 'faction', 'item_encyclopedia', 'concept'];


    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] p-4" onClick={onClose}>
            <div
                className="bg-white/90 dark:bg-[#2a2f4c]/90 backdrop-blur-sm border-2 border-slate-300 dark:border-slate-600 rounded-lg shadow-2xl w-full max-w-4xl h-full max-h-[85vh] text-slate-900 dark:text-white flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b-2 border-slate-200 dark:border-slate-600 flex justify-between items-center flex-shrink-0">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                        <BrainIcon className="w-6 h-6" />
                        Tri Thức Thế Giới
                    </h3>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white text-3xl leading-none"><CrossIcon className="w-6 h-6" /></button>
                </div>
                <div className="p-5 flex-grow overflow-y-auto">
                    {pc && (
                        <div className="bg-slate-200/50 dark:bg-slate-800/50 p-4 rounded-lg mb-6">
                            <h4 className="text-lg font-bold text-yellow-700 dark:text-yellow-400 flex items-center gap-2">
                                <span className="w-5 h-5">{getIconForEntity(pc)}</span>
                                {pc.name} - Lượt: {turnCount}
                            </h4>
                            <p className="text-sm text-slate-700 dark:text-slate-300 italic mt-1">"{pc.description}"</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2"><b>Tính cách:</b> {pc.personality}</p>
                            {pc.realm && <p className="text-sm text-slate-600 dark:text-slate-400 mt-1"><b>Cảnh giới:</b> {pc.realm}</p>}
                        </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {categoryOrder.map(category => {
                            const entities = categorizedEntities[category]?.sort((a,b) => a.name.localeCompare(b.name));
                            if (!entities || entities.length === 0) return null;
                            if (category === 'pc') return null; // Don't show PC as a category

                            return (
                                <div key={category}>
                                    <h5 className="font-semibold text-purple-700 dark:text-purple-300 mb-2 border-b border-purple-400/20 pb-1">{categoryTitles[category]}</h5>
                                    <ul className="space-y-1.5 max-h-60 overflow-y-auto pr-2">
                                        {entities.map(entity => (
                                            <li key={entity.name}>
                                                <button onClick={() => handleItemClick(entity.name)} className="text-left w-full text-cyan-700 dark:text-cyan-300 hover:text-cyan-800 dark:hover:text-cyan-100 hover:underline text-sm flex items-center gap-2">
                                                    <span className="w-4 h-4 flex-shrink-0">{getIconForEntity(entity)}</span>
                                                    <span>
                                                        {entity.name}
                                                        {category === 'inventory' && entity.equipped && <span className="text-xs text-green-400 dark:text-green-500 ml-2 font-normal italic">(Đang trang bị)</span>}
                                                        {(entity.type === 'skill' || entity.type === 'npc') && entity.realm ? ` (${entity.realm})` : ''}
                                                    </span>
                                                </button>
                                                {entity.type === 'npc' && Array.isArray(entity.skills) && entity.skills.length > 0 && (
                                                    <div className="pl-4 text-xs text-slate-600 dark:text-slate-400">
                                                        {entity.skills.map((skillName: string) => {
                                                            const skillEntity = knownEntities[skillName];
                                                            return (
                                                                <div key={skillName}>- {skillName} {skillEntity?.realm ? `(${skillEntity.realm})` : ''}</div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};