
import React, { useState, useMemo } from 'react';
import type { Entity, KnownEntities } from './types.ts';
import { getIconForEntity } from './utils.ts';
import { BrainIcon, CrossIcon, SearchIcon } from './Icons.tsx';

export const KnowledgeBaseModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    pc: Entity | undefined;
    knownEntities: KnownEntities;
    onEntityClick: (entityName: string) => void;
    turnCount: number;
}> = ({ isOpen, onClose, pc, knownEntities, onEntityClick, turnCount }) => {
    if (!isOpen) return null;

    const [searchTerm, setSearchTerm] = useState('');
    const [activeFilter, setActiveFilter] = useState<string>('all');

    const categorizedEntities = useMemo(() => {
        const categories: { [key: string]: Entity[] } = {};
        Object.values(knownEntities).forEach(entity => {
            if (entity.type === 'item') {
                if (entity.owner === 'pc') {
                    if (!categories['inventory']) categories['inventory'] = [];
                    categories['inventory'].push(entity);
                }
                if (!categories['item_encyclopedia']) categories['item_encyclopedia'] = [];
                categories['item_encyclopedia'].push(entity);
            } else {
                if (entity.type === 'npc' && entity.name === pc?.name) return;
                if (!categories[entity.type]) categories[entity.type] = [];
                categories[entity.type]?.push(entity);
            }
        });
        return categories;
    }, [knownEntities, pc?.name]);
    
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

    const categoryOrder: string[] = ['skill', 'inventory', 'npc', 'companion', 'location', 'faction', 'item_encyclopedia', 'concept'];

    const filterOptions = useMemo(() => {
        const options = [{ key: 'all', title: 'Tất cả' }];
        categoryOrder.forEach(key => {
            if (categorizedEntities[key] && categorizedEntities[key].length > 0) {
                options.push({ key, title: categoryTitles[key] });
            }
        });
        return options;
    }, [categorizedEntities]);

    const filteredAndCategorizedEntities = useMemo(() => {
        if (activeFilter === 'all' && !searchTerm) {
            return categorizedEntities;
        }
        
        const lowerSearchTerm = searchTerm.toLowerCase();
        const result: { [key: string]: Entity[] } = {};

        Object.keys(categorizedEntities).forEach(category => {
            if (activeFilter !== 'all' && category !== activeFilter) return;

            const entities = categorizedEntities[category];
            const filtered = entities.filter(entity => 
                entity.name.toLowerCase().includes(lowerSearchTerm)
            );

            if (filtered.length > 0) {
                result[category] = filtered.sort((a,b) => a.name.localeCompare(b.name));
            }
        });

        return result;
    }, [searchTerm, activeFilter, categorizedEntities]);

    const hasResults = useMemo(() => Object.keys(filteredAndCategorizedEntities).length > 0, [filteredAndCategorizedEntities]);


    const handleItemClick = (name: string) => {
        onClose();
        setTimeout(() => onEntityClick(name), 100);
    }

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
                
                <div className="p-4 border-b border-slate-200 dark:border-slate-600 flex-shrink-0 space-y-3">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="w-5 h-5 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Tìm kiếm thực thể..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-500 rounded-md py-2 pl-10 pr-4 text-sm text-slate-800 dark:text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {filterOptions.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => setActiveFilter(opt.key)}
                                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors duration-200 border ${
                                    activeFilter === opt.key 
                                        ? 'bg-purple-600 border-purple-600 text-white' 
                                        : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
                                }`}
                            >
                                {opt.title}
                            </button>
                        ))}
                    </div>
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
                    
                    {hasResults ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {categoryOrder.map(category => {
                                const entities = filteredAndCategorizedEntities[category];
                                if (!entities || entities.length === 0) return null;

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
                                                        <div className="pl-6 text-xs text-slate-600 dark:text-slate-400 space-y-0.5 mt-1">
                                                            {entity.skills.map((skillName: string) => {
                                                                const skillEntity = knownEntities[skillName];
                                                                const icon = getIconForEntity(skillEntity || { name: skillName, type: 'skill', description: '' });
                                                                return (
                                                                    <div key={skillName} className="flex items-center gap-1.5">
                                                                        <span className="w-3 h-3">{icon}</span>
                                                                        <span>{skillName} {skillEntity?.realm ? `(${skillEntity.realm})` : ''}</span>
                                                                    </div>
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
                    ) : (
                        <div className="text-center py-10 text-slate-500 dark:text-slate-400">
                            <p>Không tìm thấy kết quả nào.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
