// components/MemoizedModals.tsx
import React, { memo, useMemo, useCallback } from 'react';
import { ConfirmationModal } from './ConfirmationModal.tsx';
import { EntityInfoModal } from './EntityInfoModal.tsx';
import { StatusDetailModal } from './StatusDetailModal.tsx';
import { QuestDetailModal } from './QuestDetailModal.tsx';
import { MemoryModal } from './MemoryModal.tsx';
import { KnowledgeBaseModal } from './KnowledgeBaseModal.tsx';
import { CustomRulesModal } from './CustomRulesModal.tsx';
import { MapModal } from './MapModal.tsx';
import { MobileChoicesModal } from './game/MobileChoicesModal.tsx';
import { PartyMemberTab } from './PartyMemberTab.tsx';
import { QuestLog } from './QuestLog.tsx';

import type { Entity, Status, Quest, KnownEntities, Memory, CustomRule } from './types.ts';
import { CrossIcon, UserIcon } from './Icons.tsx';
import * as GameIcons from './GameIcons.tsx';
import { getIconForEntity, getIconForStatus, getStatusBorderColor, getStatusTextColor, getStatusFontWeight } from './utils.ts';


// Props Interface
interface MemoizedModalsProps {
    // Modal visibility state
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

    // Active data for detail modals
    activeEntity: Entity | null;
    activeStatus: Status | null;
    activeQuest: Quest | null;

    // Handlers
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
    
    // onClose handlers for modals
    modalCloseHandlers: {
        home: () => void;
        restart: () => void;
        memory: () => void;
        knowledge: () => void;
        customRules: () => void;
        map: () => void;
        pcInfo: () => void;
        party: () => void;
        questLog: () => void;
        choices: () => void;
    };

    // Game state data
    memories: Memory[];
    knownEntities: KnownEntities;
    statuses: Status[];
    quests: Quest[];
    customRules: CustomRule[];
    choices: string[];
    turnCount: number;
    locationDiscoveryOrder: string[];
    
    // Computed data
    entityComputations: {
        pcEntity: Entity | undefined;
        pcStatuses: Status[];
        displayParty: Entity[];
    };
}


// ===== MEMOIZED INFO PANEL MODAL =====
export const MemoizedInfoPanelModal = memo<{
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    icon: React.ReactNode;
}>(({ isOpen, onClose, title, children, icon }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[65] p-4" onClick={onClose}>
            <div 
                className="bg-white/90 dark:bg-[#2a2f4c]/90 backdrop-blur-sm border border-slate-300 dark:border-slate-600 rounded-lg shadow-2xl w-full max-w-lg text-slate-900 dark:text-white flex flex-col" 
                onClick={e => e.stopPropagation()}
                style={{maxHeight: '70vh'}}
            >
                <div className="p-4 border-b border-slate-200 dark:border-slate-600 flex justify-between items-center flex-shrink-0">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-3">
                        {icon}
                        {title}
                    </h3>
                    <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white text-3xl leading-none">
                        <CrossIcon className="w-6 h-6"/>
                    </button>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );
});
MemoizedInfoPanelModal.displayName = 'MemoizedInfoPanelModal';


// ===== MEMOIZED PLAYER CHARACTER SHEET =====
export const MemoizedPlayerCharacterSheet = memo<{
    pc: Entity | undefined;
    statuses: Status[];
    knownEntities: KnownEntities;
    onStatusClick: (status: Status) => void;
    onEntityClick: (entityName: string) => void;
}>(({ pc, statuses, knownEntities, onStatusClick, onEntityClick }) => {
    
    const learnedSkills = useMemo(() => pc?.learnedSkills || [], [pc?.learnedSkills]);
    
    const handleStatusClick = useCallback((status: Status) => {
        onStatusClick(status);
    }, [onStatusClick]);

    const handleEntityClick = useCallback((entityName: string) => {
        onEntityClick(entityName);
    }, [onEntityClick]);

    if (!pc) {
        return <div className="p-4 text-center text-slate-500">Không tìm thấy thông tin nhân vật.</div>;
    }

    return (
        <div className="p-4 h-full flex flex-col space-y-4 text-slate-700 dark:text-gray-300">
            {/* Basic Info */}
            <div>
                <h4 className="font-semibold text-lg text-slate-800 dark:text-white mb-2 border-b border-slate-300 dark:border-slate-600 pb-1 flex items-center gap-2">
                    <UserIcon className="w-5 h-5" />
                    Thông tin cơ bản
                </h4>
                <div className="space-y-1 text-sm pl-2">
                    <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Tên:</strong> {pc.name}</p>
                    {pc.location && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Vị trí:</strong> {pc.location}</p>}
                    {pc.age && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Tuổi tác:</strong> {pc.age}</p>}
                    {pc.appearance && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Dung mạo:</strong> {pc.appearance}</p>}
                    {pc.realm && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Thực lực:</strong> {pc.realm}</p>}
                    {pc.fame && <p><strong className="font-semibold text-slate-800 dark:text-gray-100 w-24 inline-block">Danh vọng:</strong> {pc.fame}</p>}
                </div>
            </div>

            {/* Skills */}
            <MemoizedSkillsSection 
                learnedSkills={learnedSkills}
                knownEntities={knownEntities}
                onEntityClick={handleEntityClick}
            />

            {/* Statuses */}
            <MemoizedStatusesSection 
                statuses={statuses}
                onStatusClick={handleStatusClick}
            />
        </div>
    );
});
MemoizedPlayerCharacterSheet.displayName = 'MemoizedPlayerCharacterSheet';

// ===== MEMOIZED SKILLS SECTION =====
const MemoizedSkillsSection = memo<{
    learnedSkills: string[];
    knownEntities: KnownEntities;
    onEntityClick: (entityName: string) => void;
}>(({ learnedSkills, knownEntities, onEntityClick }) => {
    
    const skillButtons = useMemo(() => {
        return learnedSkills.map(skillName => {
            const skillEntity = knownEntities[skillName];
            return {
                name: skillName,
                entity: skillEntity,
                realm: skillEntity?.realm
            };
        });
    }, [learnedSkills, knownEntities]);

    return (
        <div>
            <h4 className="font-semibold text-lg text-slate-800 dark:text-white mb-2 border-b border-slate-300 dark:border-slate-600 pb-1 flex items-center gap-2">
                <GameIcons.ScrollIcon className="w-5 h-5" />
                Kỹ năng & Công pháp
            </h4>
            {skillButtons.length > 0 ? (
                <ul className="space-y-2 pl-2">
                    {skillButtons.map(skill => (
                        <SkillListItem
                            key={skill.name}
                            skill={skill}
                            onEntityClick={onEntityClick}
                        />
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400 italic pl-2">
                    Chưa học được kỹ năng nào.
                </p>
            )}
        </div>
    );
});
MemoizedSkillsSection.displayName = 'MemoizedSkillsSection';

// ===== MEMOIZED SKILL LIST ITEM =====
const SkillListItem = memo<{
    skill: { name: string; entity?: Entity; realm?: string };
    onEntityClick: (entityName: string) => void;
}>(({ skill, onEntityClick }) => {
    const handleClick = useCallback(() => {
        onEntityClick(skill.name);
    }, [skill.name, onEntityClick]);

    return (
        <li>
            <button 
                onClick={handleClick}
                className="text-left w-full p-2 bg-slate-200/50 dark:bg-slate-800/50 rounded-md hover:bg-slate-300/50 dark:hover:bg-slate-700/50 transition-colors"
            >
                <p className="font-semibold text-cyan-700 dark:text-cyan-300 flex items-center gap-2">
                    <span className="w-4 h-4">
                        {getIconForEntity(skill.entity || {name: skill.name, type: 'skill', description: ''})}
                    </span>
                    {skill.name} {skill.realm ? `(${skill.realm})` : ''}
                </p>
                {skill.entity?.description && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 pl-6">
                        {skill.entity.description}
                    </p>
                )}
            </button>
        </li>
    );
});
SkillListItem.displayName = 'SkillListItem';

// ===== MEMOIZED STATUSES SECTION =====
const MemoizedStatusesSection = memo<{
    statuses: Status[];
    onStatusClick: (status: Status) => void;
}>(({ statuses, onStatusClick }) => {
    
    const statusButtons = useMemo(() => {
        return statuses.map(status => ({
            ...status,
            borderColor: getStatusBorderColor(status),
            textColor: getStatusTextColor(status),
            fontWeight: getStatusFontWeight(status)
        }));
    }, [statuses]);

    return (
        <div>
            <h4 className="font-semibold text-lg text-slate-800 dark:text-white mb-2 border-b border-slate-300 dark:border-slate-600 pb-1 flex items-center gap-2">
                <GameIcons.HeartIcon className="w-5 h-5" />
                Trạng thái hiện tại
            </h4>
            {statusButtons.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 pl-2">
                    {statusButtons.map(status => (
                        <StatusButton
                            key={status.name}
                            status={status}
                            onStatusClick={onStatusClick}
                        />
                    ))}
                </div>
            ) : (
                <p className="text-sm text-slate-600 dark:text-slate-400 italic pl-2">
                    Đang trong tình trạng bình thường.
                </p>
            )}
        </div>
    );
});
MemoizedStatusesSection.displayName = 'MemoizedStatusesSection';

// ===== MEMOIZED STATUS BUTTON =====
const StatusButton = memo<{
    status: Status & { borderColor: string; textColor: string; fontWeight: string };
    onStatusClick: (status: Status) => void;
}>(({ status, onStatusClick }) => {
    const handleClick = useCallback(() => {
        onStatusClick(status);
    }, [status, onStatusClick]);

    return (
        <button
            onClick={handleClick}
            className={`px-2 py-1 border rounded-md transition-colors duration-200 flex items-center gap-1.5 ${status.borderColor} hover:bg-slate-300/50 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 ${status.borderColor.replace('border-', 'ring-').replace('/50', '')}`}
        >
            <span className="w-4 h-4">{getIconForStatus(status)}</span>
            <span className={`${status.textColor} ${status.fontWeight} text-sm`}>
                {status.name}
            </span>
        </button>
    );
});
StatusButton.displayName = 'StatusButton';

// ===== MEMOIZED ALL MODALS WRAPPER =====
const MemoizedModalsComponent = ({ 
    isHomeModalOpen,
    isRestartModalOpen,
    isMemoryModalOpen,
    isKnowledgeModalOpen,
    isCustomRulesModalOpen,
    isMapModalOpen,
    isPcInfoModalOpen,
    isPartyModalOpen,
    isQuestLogModalOpen,
    isChoicesModalOpen,
    activeEntity,
    activeStatus,
    activeQuest,
    onBackToMenu,
    handleRestartGame,
    setActiveEntity,
    handleUseItem,
    handleLearnItem,
    handleEquipItem,
    handleUnequipItem,
    setActiveStatus,
    handleStatusClick,
    setActiveQuest,
    handleToggleMemoryPin,
    handleEntityClick,
    handleSaveRules,
    handleAction,
    modalCloseHandlers,
    memories,
    knownEntities,
    statuses,
    quests,
    customRules,
    choices,
    turnCount,
    locationDiscoveryOrder,
    entityComputations
}: MemoizedModalsProps) => {

    return (
        <>
            {/* Confirmation Modals */}
            <ConfirmationModal
                isOpen={isHomeModalOpen}
                onClose={modalCloseHandlers.home}
                onConfirm={onBackToMenu}
                title="Về Trang Chủ?"
                message="Bạn có chắc muốn thoát? Mọi tiến trình chưa lưu sẽ bị mất."
            />
            
            <ConfirmationModal
                isOpen={isRestartModalOpen}
                onClose={modalCloseHandlers.restart}
                onConfirm={handleRestartGame}
                title="Bắt Đầu Lại?"
                message="Bạn có chắc muốn bắt đầu lại cuộc phiêu lưu? Toàn bộ tiến trình hiện tại sẽ được khởi tạo lại từ đầu với cùng thiết lập thế giới."
            />

            {/* Entity & Status Modals */}
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
            
            <StatusDetailModal 
                status={activeStatus} 
                onClose={() => setActiveStatus(null)} 
            />
            
            <QuestDetailModal 
                quest={activeQuest} 
                onClose={() => setActiveQuest(null)} 
            />

            {/* Game Content Modals */}
            <MemoryModal 
                isOpen={isMemoryModalOpen} 
                onClose={modalCloseHandlers.memory} 
                memories={memories} 
                onTogglePin={handleToggleMemoryPin} 
            />
            
            <KnowledgeBaseModal 
                isOpen={isKnowledgeModalOpen} 
                onClose={modalCloseHandlers.knowledge} 
                pc={entityComputations.pcEntity} 
                knownEntities={knownEntities} 
                onEntityClick={handleEntityClick} 
                turnCount={turnCount} 
            />
            
            <CustomRulesModal 
                isOpen={isCustomRulesModalOpen} 
                onClose={modalCloseHandlers.customRules} 
                onSave={handleSaveRules} 
                currentRules={customRules} 
            />
            
            <MapModal 
                isOpen={isMapModalOpen} 
                onClose={modalCloseHandlers.map}
                locations={Object.values(knownEntities).filter((e): e is Entity => e.type === 'location')}
                currentLocationName={entityComputations.pcEntity?.location || ''}
                discoveryOrder={locationDiscoveryOrder}
            />

            {/* Info Panel Modals */}
            <MemoizedInfoPanelModal
                isOpen={isPcInfoModalOpen}
                onClose={modalCloseHandlers.pcInfo}
                title="Thông Tin Nhân Vật"
                icon={<UserIcon className="w-6 h-6" />}
            >
                <MemoizedPlayerCharacterSheet 
                    pc={entityComputations.pcEntity} 
                    statuses={entityComputations.pcStatuses} 
                    knownEntities={knownEntities} 
                    onStatusClick={handleStatusClick} 
                    onEntityClick={handleEntityClick}
                />
            </MemoizedInfoPanelModal>

            <MemoizedInfoPanelModal
                isOpen={isPartyModalOpen}
                onClose={modalCloseHandlers.party}
                title="Tổ Đội"
                icon={<GameIcons.NpcIcon className="w-6 h-6" />}
            >
                <PartyMemberTab 
                    party={entityComputations.displayParty} 
                    onMemberClick={handleEntityClick}
                />
            </MemoizedInfoPanelModal>

            <MemoizedInfoPanelModal
                isOpen={isQuestLogModalOpen}
                onClose={modalCloseHandlers.questLog}
                title="Nhật Ký Nhiệm Vụ"
                icon={<GameIcons.ScrollIcon className="w-6 h-6" />}
            >
                <QuestLog 
                    quests={quests} 
                    onQuestClick={setActiveQuest} 
                />
            </MemoizedInfoPanelModal>

            {/* Mobile Choices Modal */}
            <MobileChoicesModal 
                isOpen={isChoicesModalOpen}
                onClose={modalCloseHandlers.choices}
                choices={choices}
                onAction={handleAction}
            />
        </>
    );
};

// Export memoized version
export const MemoizedModals = memo(MemoizedModalsComponent);
MemoizedModals.displayName = 'MemoizedModals';