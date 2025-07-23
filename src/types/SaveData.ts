import type { 
    FormData, 
    KnownEntities, 
    Entity, 
    GameHistoryEntry, 
    Memory, 
    CustomRule 
} from './GameTypes';
import type { Status } from './StatusTypes';
import type { Quest } from './QuestTypes';

// Save Data Interface
export interface SaveData {
    worldData: FormData;
    storyLog: string[];
    choices: string[];
    knownEntities: KnownEntities;
    statuses: Status[];
    quests: Quest[];
    gameHistory: GameHistoryEntry[];
    memories: Memory[];
    party: Entity[];
    customRules: CustomRule[];
    systemInstruction: string;
    turnCount: number;
}