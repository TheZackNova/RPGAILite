// components/game/index.tsx
import React, { useMemo, useCallback } from 'react';
import type { SaveData, Entity } from '../types.ts';
import { useGameState } from './hooks/useGameState.ts';
import { useModalState } from './hooks/useModalState.ts';
import { useGameController } from './hooks/useGameController.ts';

// Panel Imports
import { DesktopHeader } from './panels/DesktopHeader.tsx';
import { MobileHeader } from './panels/MobileHeader.tsx';
import { StoryPanel } from './panels/StoryPanel.tsx';
import { ActionPanel } from './panels/ActionPanel.tsx';
import { SidebarNav } from './panels/SidebarNav.tsx';
import { MobileInputFooter } from './panels/MobileInputFooter.tsx';

// UI Imports
import { GameNotifications } from './ui/GameNotifications.tsx';
import { GameModals } from './modals/GameModals.tsx';
import { useDebouncedCallback } from '../hooks/useDebounce.ts';


export const GameScreen: React.FC<{ 
    initialGameState: SaveData, 
    onBackToMenu: () => void,
    fontFamily: string,
    fontSize: string,
    keyRotationNotification: string | null;
    onClearNotification: () => void;
}> = ({ initialGameState, onBackToMenu, fontFamily, fontSize, keyRotationNotification, onClearNotification }) => {
    
    const { gameState, setters: gameStateSetters } = useGameState(initialGameState);
    const { modalState, setters: modalSetters, actions: modalActions } = useModalState();
    
    const controller = useGameController(
        { gameState, setters: gameStateSetters },
        { modalState, setters: modalSetters, actions: modalActions },
        initialGameState,
        { onBackToMenu, keyRotationNotification, onClearNotification }
    );
    
    const debouncedHandleAction = useDebouncedCallback((action: string) => {
        controller.handleAction(action);
    }, 300);

    // Derived state for passing to UI components
    const pcEntity = useMemo(() => Object.values(gameState.knownEntities).find(e => e.type === 'pc'), [gameState.knownEntities]);
    const pcName = pcEntity?.name;
    const hasActiveQuests = useMemo(() => gameState.quests.some(q => q.status === 'active'), [gameState.quests]);
    const pcStatuses = useMemo(() => gameState.statuses.filter(s => s.owner === 'pc' || (pcName && s.owner === pcName)), [gameState.statuses, pcName]);
    const displayParty = useMemo(() => gameState.party.filter(p => p.name !== pcName), [gameState.party, pcName]);
    const isCustomActionLocked = useMemo(() => gameState.customRules.some(rule => rule.isActive && rule.content.toUpperCase().includes('KHÓA HÀNH ĐỘNG TÙY Ý')), [gameState.customRules]);
    
    // Memoized event handlers to prevent re-renders
    const handleEntityClick = useCallback((entityName: string) => {
        const entity = gameState.knownEntities[entityName];
        if (entity) modalActions.openEntityModal(entity);
    }, [gameState.knownEntities, modalActions]);

    const handleUseItem = useCallback((itemName: string) => { modalActions.closeEntityModal(); setTimeout(() => controller.handleAction(`Sử dụng vật phẩm: ${itemName}`), 100); }, [controller, modalActions]);
    const handleLearnItem = useCallback((itemName: string) => { modalActions.closeEntityModal(); setTimeout(() => controller.handleAction(`Học công pháp: ${itemName}`), 100); }, [controller, modalActions]);
    const handleEquipItem = useCallback((itemName: string) => { modalActions.closeEntityModal(); setTimeout(() => controller.handleAction(`Trang bị ${itemName}`), 100); }, [controller, modalActions]);
    const handleUnequipItem = useCallback((itemName: string) => { modalActions.closeEntityModal(); setTimeout(() => controller.handleAction(`Tháo ${itemName}`), 100); }, [controller, modalActions]);
    const handleToggleMemoryPin = useCallback((index: number) => gameStateSetters.setMemories(prev => prev.map((mem, i) => i === index ? { ...mem, pinned: !mem.pinned } : mem)), [gameStateSetters]);

    return (
        <div 
            className="bg-transparent w-full h-full p-0 md:p-4 flex flex-col font-sans text-slate-900 dark:text-white relative" 
            style={{maxHeight: '98vh', height: '98vh'}}
        >
            <GameNotifications 
                notification={modalState.notification} 
                showSaveSuccess={modalState.showSaveSuccess} 
                showRulesSavedSuccess={modalState.showRulesSavedSuccess} 
            />
            
            <SidebarNav 
                isOpen={modalState.isSidebarOpen} 
                onClose={modalActions.closeSidebar}
                onHome={modalActions.openHomeModal}
                onSave={controller.handleSaveGame}
                onMap={modalActions.openMapModal}
                onRules={modalActions.openRulesModal}
                onKnowledge={modalActions.openKnowledgeModal}
                onMemory={modalActions.openMemoryModal}
                onRestart={modalActions.openRestartModal}
                onPCInfo={modalActions.openPcInfoModal}
                onParty={modalActions.openPartyModal}
                onQuests={modalActions.openQuestLogModal}
                onManualCleanup={controller.handleManualCleanup}
                hasActiveQuests={hasActiveQuests}
                currentTurnTokens={gameState.currentTurnTokens}
                totalTokens={gameState.totalTokens}
                historyStats={gameState.historyStats!}
                compressedSegments={gameState.compressedHistory.length}
                gameHistory={gameState.gameHistory}
                cleanupStats={gameState.cleanupStats!}
            />

            <MobileHeader onOpenSidebar={modalActions.openSidebar} worldData={gameState.worldData} />

            <DesktopHeader 
                onHome={modalActions.openHomeModal}
                onSave={controller.handleSaveGame} 
                onMap={modalActions.openMapModal}
                onRules={modalActions.openRulesModal}
                onKnowledge={modalActions.openKnowledgeModal}
                onMemory={modalActions.openMemoryModal}
                onRestart={modalActions.openRestartModal}
                onPCInfo={modalActions.openPcInfoModal}
                onParty={modalActions.openPartyModal}
                onQuests={modalActions.openQuestLogModal}
                onManualCleanup={controller.handleManualCleanup}
                worldData={gameState.worldData}
                gameTime={gameState.gameTime}
                turnCount={gameState.turnCount}
                currentTurnTokens={gameState.currentTurnTokens}
                totalTokens={gameState.totalTokens}
                hasActiveQuests={hasActiveQuests}
            />

            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 overflow-hidden p-4 md:p-0">
                <StoryPanel
                    storyLog={gameState.storyLog}
                    isLoading={controller.isLoading}
                    isAiReady={controller.isAiReady}
                    knownEntities={gameState.knownEntities}
                    onEntityClick={handleEntityClick}
                />
                <ActionPanel
                    isAiReady={controller.isAiReady}
                    apiKeyError={controller.apiKeyError}
                    isLoading={controller.isLoading}
                    choices={gameState.choices}
                    handleAction={controller.handleAction}
                    debouncedHandleAction={debouncedHandleAction}
                    customAction={controller.customAction}
                    setCustomAction={controller.setCustomAction}
                    handleSuggestAction={controller.handleSuggestAction}
                    isCustomActionLocked={isCustomActionLocked}
                />
            </div>
            
            <MobileInputFooter
                onChoicesClick={modalActions.openChoicesModal}
                customAction={controller.customAction}
                setCustomAction={controller.setCustomAction}
                handleAction={controller.handleAction}
                debouncedHandleAction={debouncedHandleAction}
                isLoading={controller.isLoading}
                isAiReady={controller.isAiReady}
                isCustomActionLocked={isCustomActionLocked}
            />

            <GameModals
                isHomeModalOpen={modalState.isHomeModalOpen}
                isRestartModalOpen={modalState.isRestartModalOpen}
                isMemoryModalOpen={modalState.isMemoryModalOpen}
                isKnowledgeModalOpen={modalState.isKnowledgeModalOpen}
                isCustomRulesModalOpen={modalState.isCustomRulesModalOpen}
                isMapModalOpen={modalState.isMapModalOpen}
                isPcInfoModalOpen={modalState.isPcInfoModalOpen}
                isPartyModalOpen={modalState.isPartyModalOpen}
                isQuestLogModalOpen={modalState.isQuestLogModalOpen}
                isChoicesModalOpen={modalState.isChoicesModalOpen}
                activeEntity={modalState.activeEntity}
                activeStatus={modalState.activeStatus}
                activeQuest={modalState.activeQuest}
                onBackToMenu={onBackToMenu}
                handleRestartGame={controller.handleRestartGame}
                setActiveEntity={modalSetters.setActiveEntity}
                handleUseItem={handleUseItem}
                handleLearnItem={handleLearnItem}
                handleEquipItem={handleEquipItem}
                handleUnequipItem={handleUnequipItem}
                setActiveStatus={modalSetters.setActiveStatus}
                handleStatusClick={modalActions.openStatusModal}
                setActiveQuest={modalSetters.setActiveQuest}
                handleToggleMemoryPin={handleToggleMemoryPin}
                handleEntityClick={handleEntityClick}
                handleSaveRules={controller.handleSaveRules}
                handleAction={controller.handleAction}
                modalCloseHandlers={modalActions}
                memories={gameState.memories}
                knownEntities={gameState.knownEntities}
                statuses={gameState.statuses}
                quests={gameState.quests}
                customRules={gameState.customRules}
                choices={gameState.choices}
                turnCount={gameState.turnCount}
                locationDiscoveryOrder={gameState.locationDiscoveryOrder}
                entityComputations={{ pcEntity, pcStatuses, displayParty }}
            />
        </div>
    );
};
