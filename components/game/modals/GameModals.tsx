// components/game/modals/GameModals.tsx
import React, { memo } from 'react';
import { ConfirmationModal } from '../../ConfirmationModal.tsx';
import { EntityInfoModal } from '../../EntityInfoModal.tsx';
import { StatusDetailModal } from '../../StatusDetailModal.tsx';
import { QuestDetailModal } from '../../QuestDetailModal.tsx';
import { MemoryModal } from '../../MemoryModal.tsx';
import { KnowledgeBaseModal } from '../../KnowledgeBaseModal.tsx';
import { CustomRulesModal } from '../../CustomRulesModal.tsx';
import { MapModal } from '../../MapModal.tsx';
import { MobileChoicesModal } from './MobileChoicesModal.tsx';
import { PartyMemberTab } from '../ui/PartyMemberTab.tsx';
import { QuestLog } from '../ui/QuestLog.tsx';
import { MemoizedPlayerCharacterSheet } from '../ui/PlayerCharacterSheet.tsx';
import { MemoizedInfoPanelModal } from '../../modals/InfoPanelModal.tsx';


import type { Entity, Status, Quest, KnownEntities, Memory, CustomRule } from '../../types.ts';
import { UserIcon } from '../../Icons.tsx';
import * as GameIcons from '../../GameIcons.tsx';

interface GameModalsProps {
    isHomeModalOpen: boolean;
    isRestartModalOpen: boolean;
    isMemoryModalOpen: boolean;
    isKnowledgeModalOpen: boolean;
    isCustomRulesModalOpen: boolean;
    isMapModalOpen: boolean;
    isPcInfoModalOpen: boolean;
    isPartyModalOpen: boolean;
    isQuestLogModalOpen: boolean;
    isChoicesModalOpen: boolean;
    activeEntity: Entity | null;
    activeStatus: Status | null;
    activeQuest: Quest | null;
    onBackToMenu: () => void;
    handleRestartGame: () => void;
    setActiveEntity: (entity: Entity | null) => void;
    handleUseItem: (itemName: string) => void;
    handleLearnItem: (itemName:string) => void;
    handleEquipItem: (itemName: string) => void;
    handleUnequipItem: (itemName: string) => void;
    setActiveStatus: (status: Status | null) => void;
    handleStatusClick: (status: Status) => void;
    setActiveQuest: (quest: Quest | null) => void;
    handleToggleMemoryPin: (index: number) => void;
    handleEntityClick: (entityName: string) => void;
    handleSaveRules: (rules: CustomRule[]) => void;
    handleAction: (action: string) => void;
    modalCloseHandlers: {
        closeHomeModal: () => void;
        closeRestartModal: () => void;
        closeMemoryModal: () => void;
        closeKnowledgeModal: () => void;
        closeRulesModal: () => void;
        closeMapModal: () => void;
        closePcInfoModal: () => void;
        closePartyModal: () => void;
        closeQuestLogModal: () => void;
        closeChoicesModal: () => void;
    };
    memories: Memory[];
    knownEntities: KnownEntities;
    statuses: Status[];
    quests: Quest[];
    customRules: CustomRule[];
    choices: string[];
    turnCount: number;
    locationDiscoveryOrder: string[];
    entityComputations: {
        pcEntity: Entity | undefined;
        pcStatuses: Status[];
        displayParty: Entity[];
    };
}

export const GameModals = memo<GameModalsProps>(({ 
    isHomeModalOpen, isRestartModalOpen, isMemoryModalOpen, isKnowledgeModalOpen,
    isCustomRulesModalOpen, isMapModalOpen, isPcInfoModalOpen, isPartyModalOpen,
    isQuestLogModalOpen, isChoicesModalOpen, activeEntity, activeStatus, activeQuest,
    onBackToMenu, handleRestartGame, setActiveEntity, handleUseItem, handleLearnItem,
    handleEquipItem, handleUnequipItem, setActiveStatus, handleStatusClick,
    setActiveQuest, handleToggleMemoryPin, handleEntityClick, handleSaveRules,
    handleAction, modalCloseHandlers, memories, knownEntities, statuses,
    quests, customRules, choices, turnCount, locationDiscoveryOrder, entityComputations
}) => {
    return (
        <>
            <ConfirmationModal isOpen={isHomeModalOpen} onClose={modalCloseHandlers.closeHomeModal} onConfirm={onBackToMenu} title="Về Trang Chủ?" message="Bạn có chắc muốn thoát? Mọi tiến trình chưa lưu sẽ bị mất." />
            <ConfirmationModal isOpen={isRestartModalOpen} onClose={modalCloseHandlers.closeRestartModal} onConfirm={handleRestartGame} title="Bắt Đầu Lại?" message="Bạn có chắc muốn bắt đầu lại cuộc phiêu lưu? Toàn bộ tiến trình hiện tại sẽ được khởi tạo lại từ đầu với cùng thiết lập thế giới." />
            <EntityInfoModal entity={activeEntity} onClose={() => setActiveEntity(null)} onUseItem={handleUseItem} onLearnItem={handleLearnItem} onEquipItem={handleEquipItem} onUnequipItem={handleUnequipItem} statuses={statuses} onStatusClick={handleStatusClick} />
            <StatusDetailModal status={activeStatus} onClose={() => setActiveStatus(null)} />
            <QuestDetailModal quest={activeQuest} onClose={() => setActiveQuest(null)} />
            <MemoryModal isOpen={isMemoryModalOpen} onClose={modalCloseHandlers.closeMemoryModal} memories={memories} onTogglePin={handleToggleMemoryPin} />
            <KnowledgeBaseModal isOpen={isKnowledgeModalOpen} onClose={modalCloseHandlers.closeKnowledgeModal} pc={entityComputations.pcEntity} knownEntities={knownEntities} onEntityClick={handleEntityClick} turnCount={turnCount} />
            <CustomRulesModal isOpen={isCustomRulesModalOpen} onClose={modalCloseHandlers.closeRulesModal} onSave={handleSaveRules} currentRules={customRules} />
            <MapModal 
                isOpen={isMapModalOpen} 
                onClose={modalCloseHandlers.closeMapModal} 
                locations={Object.values(knownEntities).filter((e): e is Entity => e.type === 'location')} 
                currentLocationName={entityComputations.pcEntity?.location || ''} 
                discoveryOrder={locationDiscoveryOrder}
                onTravelTo={handleAction}
            />
            <MemoizedInfoPanelModal isOpen={isPcInfoModalOpen} onClose={modalCloseHandlers.closePcInfoModal} title="Thông Tin Nhân Vật" icon={<UserIcon className="w-6 h-6" />}>
                <MemoizedPlayerCharacterSheet pc={entityComputations.pcEntity} statuses={entityComputations.pcStatuses} knownEntities={knownEntities} onStatusClick={handleStatusClick} onEntityClick={handleEntityClick} />
            </MemoizedInfoPanelModal>
            <MemoizedInfoPanelModal isOpen={isPartyModalOpen} onClose={modalCloseHandlers.closePartyModal} title="Tổ Đội" icon={<GameIcons.NpcIcon className="w-6 h-6" />}>
                <PartyMemberTab party={entityComputations.displayParty} onMemberClick={handleEntityClick} />
            </MemoizedInfoPanelModal>
            <MemoizedInfoPanelModal isOpen={isQuestLogModalOpen} onClose={modalCloseHandlers.closeQuestLogModal} title="Nhật Ký Nhiệm Vụ" icon={<GameIcons.ScrollIcon className="w-6 h-6" />}>
                <QuestLog quests={quests} onQuestClick={setActiveQuest} />
            </MemoizedInfoPanelModal>
            <MobileChoicesModal isOpen={isChoicesModalOpen} onClose={modalCloseHandlers.closeChoicesModal} choices={choices} onAction={handleAction} />
        </>
    );
});

GameModals.displayName = 'GameModals';
