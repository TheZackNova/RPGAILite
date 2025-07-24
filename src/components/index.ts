// Barrel export file for all components
// Organized by category for better maintainability

// === COMMON COMPONENTS ===
export { default as MenuButton } from '../../components/MenuButton';
export { ConfirmationModal, SuggestionModal, FormLabel, SuggestButton, CustomSelect } from './common';
export { InteractiveText } from './common';

// === ICONS ===
export {
    PlayIcon, SaveIcon, FileIcon, ChartIcon, SettingsIcon, ArrowLeftIcon, BookOpenIcon,
    UserIcon, PencilIcon, DiamondIcon, TargetIcon, BuildingLibraryIcon, PlusIcon,
    SpinnerIcon, HomeIcon, ArchiveIcon, BrainIcon, MemoryIcon, InfoIcon, RefreshIcon, SparklesIcon,
    PinIcon, ExclamationIcon, CrossIcon, DocumentAddIcon
} from '../../components/Icons';
export * as GameIcons from '../../components/GameIcons';

// === MODALS ===
export {
    ApiSettingsModal,
    EntityInfoModal,
    StatusDetailModal,
    MemoryModal,
    QuestDetailModal,
    KnowledgeBaseModal,
    CustomRulesModal
} from './modals';

// === MENUS ===
export { MainMenu, CreateWorld } from './menus';

// === GAME COMPONENTS ===
export { GameScreen } from './game';

// === LAYOUT COMPONENTS ===
export { CustomizationFooter } from './layout';
export { TopNavigation, TabNavigation } from './layout';

// === CONTEXTS ===
export { AIContext } from '../contexts';

// === HOOKS ===
export { useLocalStorage } from './hooks';
export { useAI, useGameState } from '../hooks';