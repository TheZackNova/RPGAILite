import React, { useContext, useMemo } from 'react';
import { 
    SaveData, 
    Status, 
    Quest, 
    Entity
} from '../../types';
import { AIContext } from '../../contexts/AIContext';
import { useGameState } from '../../hooks/useGameState';
import { ConfirmationModal } from '../common';
import { StoryDisplay } from './StoryDisplay';
import { ChoicesPanel } from './ChoicesPanel';
import { TopNavigation } from '../layout/TopNavigation';
import { TabNavigation } from '../layout/TabNavigation';
import { 
    EntityInfoModal,
    StatusDetailModal,
    MemoryModal,
    QuestDetailModal,
    KnowledgeBaseModal,
    CustomRulesModal
} from '../modals';

interface GameScreenProps {
    initialGameState: SaveData;
    onBackToMenu: () => void;
    fontFamily: string;
    fontSize: string;
}

export const GameScreen: React.FC<GameScreenProps> = ({ 
    initialGameState, 
    onBackToMenu, 
    fontFamily, 
    fontSize 
}) => {
    const { ai, isAiReady, apiKeyError, isUsingDefaultKey, userApiKeyCount, rotateKey } = useContext(AIContext);
    
    // Use the comprehensive game state hook
    const gameState = useGameState({
        initialGameState,
        ai,
        isAiReady,
        apiKeyError,
        isUsingDefaultKey,
        userApiKeyCount,
        rotateKey
    });
    
    // Destructure needed values from game state
    const {
        worldData,
        storyLog,
        choices,
        isLoading,
        customAction,
        setCustomAction,
        knownEntities,
        statuses,
        quests,
        party,
        customRules,
        activeEntity,
        setActiveEntity,
        activeStatus,
        setActiveStatus,
        isMemoryModalOpen,
        setIsMemoryModalOpen,
        isKnowledgeModalOpen,
        setIsKnowledgeModalOpen,
        isCustomRulesModalOpen,
        setIsCustomRulesModalOpen,
        activeQuest,
        setActiveQuest,
        showSaveSuccess,
        showRulesSavedSuccess,
        isRestartModalOpen,
        setIsRestartModalOpen,
        handleAction,
        handleEntityClick,
        handleSuggestAction,
        handleSaveGame,
        handleSaveRules,
        memories,
        handleToggleMemoryPin,
        turnCount,
        handleStatusClick,
        handleQuestClick,
        handleUseItem,
        handleLearnItem,
        handleEquipItem,
        handleUnequipItem
    } = gameState;

    const pcName = useMemo(() => Object.values(knownEntities).find(e => e.type === 'pc')?.name, [knownEntities]);

    const isCustomActionLocked = useMemo(() => {
        return customRules.some(rule =>
            rule.isActive && rule.content.toUpperCase().includes('KHÓA HÀNH ĐỘNG TÙY Ý')
        );
    }, [customRules]);

    const [activeTab, setActiveTab] = React.useState('status');
    const hasActiveQuests = quests.some(q => q.status === 'active');

    // All the complex functions are now handled by the useGameState hook

    const renderActiveTabContent = () => {
        switch (activeTab) {
            case 'status':
                const pcStatuses = statuses.filter(s => s.owner === 'pc' || (pcName && s.owner === pcName));
                return <div>StatusDisplay placeholder</div>; // TODO: Import StatusDisplay component
            case 'quests':
                return <div>QuestLog placeholder</div>; // TODO: Import QuestLog component
            case 'party':
                const displayParty = party.filter(p => p.name !== pcName);
                return <div>PartyMemberTab placeholder</div>; // TODO: Import PartyMemberTab component
            default:
                return null;
        }
    };

    return (
        <div className="bg-transparent w-full h-full p-4 flex flex-col font-sans text-slate-900 dark:text-white relative" style={{maxHeight: '98vh', height: '98vh'}}>
            {showSaveSuccess && (
                <div className="absolute top-20 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
                    Lưu trữ thành công!
                </div>
            )}
            {showRulesSavedSuccess && (
                <div className="absolute top-20 right-4 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse">
                    Lưu luật lệ thành công! Sẽ có hiệu lực ở lượt sau.
                </div>
            )}
            
            <TopNavigation
                worldData={worldData}
                onRestart={() => setIsRestartModalOpen(true)}
                onSave={handleSaveGame}
                onOpenKnowledge={() => setIsKnowledgeModalOpen(true)}
                onOpenMemory={() => setIsMemoryModalOpen(true)}
                onOpenRules={() => setIsCustomRulesModalOpen(true)}
            />

            <TabNavigation
                activeTab={activeTab as 'status' | 'party' | 'quests'}
                onTabChange={setActiveTab}
                hasActiveQuests={hasActiveQuests}
            />
            
            <div className="bg-white/70 dark:bg-[#2a2f4c]/80 backdrop-blur-sm rounded-b-lg flex-shrink-0 h-40 overflow-hidden shadow-lg border-x border-b border-slate-300/20 dark:border-slate-600/20">
                {renderActiveTabContent()}
            </div>
            
            {/* Main Content */}
            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 overflow-hidden">
                <StoryDisplay
                    storyLog={storyLog}
                    isLoading={isLoading}
                    isAiReady={isAiReady}
                    apiKeyError={apiKeyError}
                    knownEntities={knownEntities}
                    onEntityClick={handleEntityClick}
                    fontFamily={fontFamily}
                    fontSize={fontSize}
                />

                <ChoicesPanel
                    choices={choices}
                    isLoading={isLoading}
                    isAiReady={isAiReady}
                    customAction={customAction}
                    setCustomAction={setCustomAction}
                    onAction={handleAction}
                    onSuggestAction={handleSuggestAction}
                    isCustomActionLocked={isCustomActionLocked}
                    fontSize={fontSize}
                />
            </div>
            
            <ConfirmationModal
                isOpen={isRestartModalOpen}
                onClose={() => setIsRestartModalOpen(false)}
                onConfirm={onBackToMenu}
                title="Xác nhận Quay Về Trang Chủ"
                message={<p>Toàn bộ tiến trình chưa lưu sẽ bị mất. Bạn có chắc chắn muốn quay về trang chủ không?</p>}
            />
            
            <EntityInfoModal 
                entity={activeEntity} 
                onClose={() => setActiveEntity(null)} 
                onUseItem={handleUseItem} 
                onLearnItem={handleLearnItem}
                onEquipItem={handleEquipItem}
                onUnequipItem={handleUnequipItem}
                statuses={statuses} 
                onStatusClick={handleStatusClick} 
            />
            <StatusDetailModal status={activeStatus} onClose={() => setActiveStatus(null)} />
            <MemoryModal isOpen={isMemoryModalOpen} onClose={() => setIsMemoryModalOpen(false)} memories={memories} onTogglePin={handleToggleMemoryPin} />
            <QuestDetailModal quest={activeQuest} onClose={() => setActiveQuest(null)} />
            <KnowledgeBaseModal 
                isOpen={isKnowledgeModalOpen} 
                onClose={() => setIsKnowledgeModalOpen(false)} 
                pc={Object.values(knownEntities).find(p => p.type === 'pc')}
                knownEntities={knownEntities}
                onEntityClick={handleEntityClick}
                turnCount={turnCount}
            />
            <CustomRulesModal
                isOpen={isCustomRulesModalOpen}
                onClose={() => setIsCustomRulesModalOpen(false)}
                onSave={handleSaveRules}
                currentRules={customRules}
            />
        </div>
    );
};

export default GameScreen;