// components/game/hooks/useModalState.ts
import { useState, useCallback, useMemo } from 'react';
import type { Entity, Status, Quest } from '../../types.ts';

export const useModalState = () => {
    const [isHomeModalOpen, setIsHomeModalOpen] = useState(false);
    const [isRestartModalOpen, setIsRestartModalOpen] = useState(false);
    const [activeEntity, setActiveEntity] = useState<Entity | null>(null);
    const [activeStatus, setActiveStatus] = useState<Status | null>(null);
    const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
    const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);
    const [isCustomRulesModalOpen, setIsCustomRulesModalOpen] = useState(false);
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [activeQuest, setActiveQuest] = useState<Quest | null>(null);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);
    const [showRulesSavedSuccess, setShowRulesSavedSuccess] = useState(false);
    const [isPcInfoModalOpen, setIsPcInfoModalOpen] = useState(false);
    const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
    const [isQuestLogModalOpen, setIsQuestLogModalOpen] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isChoicesModalOpen, setIsChoicesModalOpen] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);

    const modalState = {
        isHomeModalOpen, isRestartModalOpen, activeEntity, activeStatus, isMemoryModalOpen,
        isKnowledgeModalOpen, isCustomRulesModalOpen, isMapModalOpen, activeQuest,
        showSaveSuccess, showRulesSavedSuccess, isPcInfoModalOpen, isPartyModalOpen,
        isQuestLogModalOpen, isSidebarOpen, isChoicesModalOpen, notification
    };

    const setters = {
        setIsHomeModalOpen, setIsRestartModalOpen, setActiveEntity, setActiveStatus, setIsMemoryModalOpen,
        setIsKnowledgeModalOpen, setIsCustomRulesModalOpen, setIsMapModalOpen, setActiveQuest,
        setShowSaveSuccess, setShowRulesSavedSuccess, setIsPcInfoModalOpen, setIsPartyModalOpen,
        setIsQuestLogModalOpen, setIsSidebarOpen, setIsChoicesModalOpen, setNotification
    };

    const actions = useMemo(() => ({
        openHomeModal: () => setIsHomeModalOpen(true),
        closeHomeModal: () => setIsHomeModalOpen(false),
        openRestartModal: () => setIsRestartModalOpen(true),
        closeRestartModal: () => setIsRestartModalOpen(false),
        openEntityModal: (entity: Entity) => setActiveEntity(entity),
        closeEntityModal: () => setActiveEntity(null),
        openStatusModal: (status: Status) => setActiveStatus(status),
        closeStatusModal: () => setActiveStatus(null),
        openMemoryModal: () => setIsMemoryModalOpen(true),
        closeMemoryModal: () => setIsMemoryModalOpen(false),
        openKnowledgeModal: () => setIsKnowledgeModalOpen(true),
        closeKnowledgeModal: () => setIsKnowledgeModalOpen(false),
        openRulesModal: () => setIsCustomRulesModalOpen(true),
        closeRulesModal: () => setIsCustomRulesModalOpen(false),
        openMapModal: () => setIsMapModalOpen(true),
        closeMapModal: () => setIsMapModalOpen(false),
        openQuestModal: (quest: Quest) => setActiveQuest(quest),
        closeQuestModal: () => setActiveQuest(null),
        openPcInfoModal: () => setIsPcInfoModalOpen(true),
        closePcInfoModal: () => setIsPcInfoModalOpen(false),
        openPartyModal: () => setIsPartyModalOpen(true),
        closePartyModal: () => setIsPartyModalOpen(false),
        openQuestLogModal: () => setIsQuestLogModalOpen(true),
        closeQuestLogModal: () => setIsQuestLogModalOpen(false),
        openSidebar: () => setIsSidebarOpen(true),
        closeSidebar: () => setIsSidebarOpen(false),
        openChoicesModal: () => setIsChoicesModalOpen(true),
        closeChoicesModal: () => setIsChoicesModalOpen(false),
    }), []);

    return { modalState, setters, actions };
};
