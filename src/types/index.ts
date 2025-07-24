// Type definitions for the RPG AI application

export type EntityType = 'pc' | 'npc' | 'location' | 'faction' | 'item' | 'skill' | 'status_effect' | 'companion' | 'concept';

export interface Entity {
    name: string;
    type: EntityType;
    description?: string;
    gender?: string;
    age?: string;
    personality?: string;
    skills?: string[];
    realm?: string;
    relationship?: string;
    usable?: boolean;
    equippable?: boolean;
    consumable?: boolean;
    learnable?: boolean;
    durability?: number;
    uses?: number;
    owner?: string;
    equipped?: boolean;
}

export interface KnownEntities {
    [name: string]: Entity;
}

export interface FormData {
    genre: string;
    worldDetail: string;
    writingStyle: 'first_person' | 'second_person';
    difficulty: 'easy' | 'normal' | 'hard';
    allowNsfw: boolean;
    characterName: string;
    customPersonality: string;
    personalityFromList: string;
    gender: 'Nam' | 'Nữ' | 'ai_decides';
    bio: string;
    startSkill: string;
    addGoal: boolean;
}

export interface Status {
    name: string;
    description: string;
    type: 'buff' | 'debuff' | 'neutral' | 'injury';
    effects?: string;
    duration?: string;
    source?: string;
    cureConditions?: string;
    owner?: string;
}

export interface Memory {
    text: string;
    pinned: boolean;
}

export interface QuestObjective {
    description: string;
    completed: boolean;
}

export interface Quest {
    title: string;
    description: string;
    objectives: QuestObjective[];
    status: 'active' | 'completed' | 'failed';
    reward?: string;
    giver?: string;
    isMainQuest?: boolean;
}

export interface GameHistoryEntry {
    role: 'user' | 'assistant';
    parts: { text: string }[];
}

export interface CustomRule {
    id: string;
    content: string;
    isActive: boolean;
}

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

export interface AIContextType {
    ai: any; // GoogleGenAI instance
    isAiReady: boolean;
    apiKeyError?: string;
    isUsingDefaultKey?: boolean;
    userApiKeyCount?: number;
    rotateKey?: () => void;
}