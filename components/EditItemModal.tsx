import React, { useState, useEffect } from 'react';
import type { Entity } from './types';

export interface EditItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: Entity | null;
    onSaveItem: (originalItem: Entity, editedItem: Entity) => void;
}

export const EditItemModal: React.FC<EditItemModalProps> = ({
    isOpen,
    onClose,
    item,
    onSaveItem
}) => {
    const [editedItem, setEditedItem] = useState<Entity | null>(null);

    useEffect(() => {
        if (item && isOpen) {
            setEditedItem({ ...item });
        }
    }, [item, isOpen]);

    if (!isOpen || !editedItem) return null;

    const handleInputChange = (field: string, value: any) => {
        setEditedItem(prev => prev ? { ...prev, [field]: value } : null);
    };

    const handleSave = () => {
        if (editedItem && item) {
            onSaveItem(item, editedItem);
            onClose();
        }
    };

    const handleCancel = () => {
        setEditedItem(null);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[110] p-4" onClick={handleCancel}>
            <div 
                className="bg-slate-900/95 backdrop-blur-sm border-2 border-amber-400 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] text-white flex flex-col" 
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b-2 border-slate-600/80 flex justify-between items-center flex-shrink-0">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="text-purple-400">✏️</span>
                        CHỈNH SỬA VẬT PHẨM
                    </h3>
                    <button 
                        onClick={handleCancel} 
                        className="text-gray-400 hover:text-white text-3xl leading-none p-1"
                    >
                        &times;
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 overflow-y-auto space-y-4">
                    {/* Name */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Tên vật phẩm</label>
                        <input
                            type="text"
                            value={editedItem.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            placeholder="Nhập tên vật phẩm..."
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-300 mb-2">Mô tả</label>
                        <textarea
                            value={editedItem.description}
                            onChange={(e) => handleInputChange('description', e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
                            placeholder="Nhập mô tả vật phẩm..."
                        />
                    </div>

                    {/* Item Properties - Two columns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Quantities/Uses */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-300 mb-2">Số lượng/Lần sử dụng</label>
                            <input
                                type="number"
                                min="0"
                                value={editedItem.quantities || editedItem.uses || 0}
                                onChange={(e) => {
                                    const value = parseInt(e.target.value) || 0;
                                    if (editedItem.quantities !== undefined) {
                                        handleInputChange('quantities', value);
                                    } else {
                                        handleInputChange('uses', value);
                                    }
                                }}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            />
                        </div>

                        {/* Durability */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-300 mb-2">Độ bền</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={editedItem.durability || 100}
                                onChange={(e) => handleInputChange('durability', parseInt(e.target.value) || 100)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                            />
                        </div>
                    </div>

                    {/* Boolean Properties */}
                    <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                id="usable"
                                checked={editedItem.usable || false}
                                onChange={(e) => handleInputChange('usable', e.target.checked)}
                                className="w-4 h-4 text-amber-600 bg-slate-800 border-slate-600 rounded focus:ring-amber-500 focus:ring-2"
                            />
                            <label htmlFor="usable" className="text-sm font-semibold text-gray-300">Có thể sử dụng</label>
                        </div>

                        <div className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                id="equippable"
                                checked={editedItem.equippable || false}
                                onChange={(e) => handleInputChange('equippable', e.target.checked)}
                                className="w-4 h-4 text-amber-600 bg-slate-800 border-slate-600 rounded focus:ring-amber-500 focus:ring-2"
                            />
                            <label htmlFor="equippable" className="text-sm font-semibold text-gray-300">Có thể trang bị</label>
                        </div>

                        <div className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                id="learnable"
                                checked={editedItem.learnable || false}
                                onChange={(e) => handleInputChange('learnable', e.target.checked)}
                                className="w-4 h-4 text-amber-600 bg-slate-800 border-slate-600 rounded focus:ring-amber-500 focus:ring-2"
                            />
                            <label htmlFor="learnable" className="text-sm font-semibold text-gray-300">Có thể học (công pháp)</label>
                        </div>

                        <div className="flex items-center space-x-3">
                            <input
                                type="checkbox"
                                id="consumable"
                                checked={editedItem.consumable || false}
                                onChange={(e) => handleInputChange('consumable', e.target.checked)}
                                className="w-4 h-4 text-amber-600 bg-slate-800 border-slate-600 rounded focus:ring-amber-500 focus:ring-2"
                            />
                            <label htmlFor="consumable" className="text-sm font-semibold text-gray-300">Tiêu hao khi sử dụng</label>
                        </div>

                        {editedItem.equippable && (
                            <div className="flex items-center space-x-3">
                                <input
                                    type="checkbox"
                                    id="equipped"
                                    checked={editedItem.equipped || false}
                                    onChange={(e) => handleInputChange('equipped', e.target.checked)}
                                    className="w-4 h-4 text-amber-600 bg-slate-800 border-slate-600 rounded focus:ring-amber-500 focus:ring-2"
                                />
                                <label htmlFor="equipped" className="text-sm font-semibold text-gray-300">Đang được trang bị</label>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t-2 border-slate-600/80 flex justify-end gap-3 flex-shrink-0">
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-md font-semibold transition-colors"
                    >
                        HỦY
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-md font-semibold transition-colors"
                    >
                        LƯU
                    </button>
                </div>
            </div>
        </div>
    );
};