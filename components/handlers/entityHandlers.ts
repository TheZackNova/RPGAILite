import type { Entity, Status, Quest } from '../types';

export interface EntityHandlersParams {
    knownEntities: { [key: string]: Entity };
    setKnownEntities: (updater: (prev: { [key: string]: Entity }) => { [key: string]: Entity }) => void;
    setActiveEntity: (entity: Entity | null) => void;
    setActiveStatus: (status: Status | null) => void;
    setActiveQuest: (quest: Quest | null) => void;
    handleAction: (action: string) => void;
}

export const createEntityHandlers = (params: EntityHandlersParams) => {
    const {
        knownEntities,
        setKnownEntities,
        setActiveEntity,
        setActiveStatus,
        setActiveQuest,
        handleAction
    } = params;

    const handleEntityClick = (entityName: string) => {
        setActiveEntity(knownEntities[entityName] || null);
    };

    const handleUseItem = (itemName: string) => {
        setActiveEntity(null);
        
        // Handle item consumption locally to ensure immediate UI update
        const item = knownEntities[itemName];
        if (item && item.type === 'item' && (item.owner === 'pc' || !item.owner)) {
            const currentQuantity = item.quantities || item.uses;
            
            if (typeof currentQuantity === 'number' && currentQuantity > 1) {
                // Decrease quantity by 1
                setKnownEntities(prev => {
                    const newEntities = { ...prev };
                    const newQuantity = currentQuantity - 1;
                    
                    if (item.quantities) {
                        newEntities[itemName] = { ...item, quantities: newQuantity };
                    } else if (item.uses) {
                        newEntities[itemName] = { ...item, uses: newQuantity };
                    }
                    
                    console.log(`📦 Item used locally: ${itemName} - now has ${newQuantity} remaining`);
                    return newEntities;
                });
            } else {
                // Remove item completely (single use or reaches 0)
                setKnownEntities(prev => {
                    const newEntities = { ...prev };
                    delete newEntities[itemName];
                    console.log(`🗑️ Item used completely: ${itemName} - removed from inventory`);
                    return newEntities;
                });
            }
        }
        
        setTimeout(() => handleAction(`Sử dụng vật phẩm: ${itemName}`), 100);
    };

    const handleLearnItem = (itemName: string) => {
        setActiveEntity(null);
        setTimeout(() => handleAction(`Học công pháp: ${itemName}`), 100);
    };

    const handleEquipItem = (itemName: string) => {
        setActiveEntity(null);
        setTimeout(() => handleAction(`Trang bị ${itemName}`), 100);
    };

    const handleUnequipItem = (itemName: string) => {
        setActiveEntity(null);
        setTimeout(() => handleAction(`Tháo ${itemName}`), 100);
    };

    const handleStatusClick = (status: Status) => {
        setActiveStatus(status);
    };

    const handleQuestClick = (quest: Quest) => {
        setActiveQuest(quest);
    };

    return {
        handleEntityClick,
        handleUseItem,
        handleLearnItem,
        handleEquipItem,
        handleUnequipItem,
        handleStatusClick,
        handleQuestClick
    };
};