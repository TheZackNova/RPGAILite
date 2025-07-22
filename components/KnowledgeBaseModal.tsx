import React from 'react';
import type { Entity, KnownEntities } from './types.ts';
import { getIconForEntity } from './utils.ts';
import { BrainIcon, CrossIcon } from './Icons.tsx';

export const KnowledgeBaseModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    pc: Entity | undefined;
    knownEntities: KnownEntities;
    onEntityClick: (entityName: string) => void;
    turnCount: number;
}> = ({ isOpen, onClose, pc, knownEntities, onEntityClick, turnCount }) => {
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
