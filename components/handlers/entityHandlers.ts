import type { Entity, Status, Quest } from '../types';

export interface EntityHandlersParams {
    knownEntities: { [key: string]: Entity };
    setActiveEntity: (entity: Entity | null) => void;
    setActiveStatus: (status: Status | null) => void;
    setActiveQuest: (quest: Quest | null) => void;
    handleAction: (action: string) => void;
}

export const createEntityHandlers = (params: EntityHandlersParams) => {
    const {
        knownEntities,
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