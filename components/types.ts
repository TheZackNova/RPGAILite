

import type { GoogleGenAI } from "@google/genai";

export type EntityType = 'pc' | 'npc' | 'location' | 'faction' | 'item' | 'skill' | 'status_effect' | 'companion' | 'concept';

export interface Entity {
  name: string;
  type: EntityType;
  description: string;
  gender?: string;
  age?: string;
  appearance?: string;
  fame?: string; // New: For reputation
  personality?: string;
  personalityMbti?: string;
  motivation?: string;
  location?: string;
  relationship?: string; // For relationship tracking
  uses?: number; // For consumable items
  realm?: string; // For power levels or skill levels
  durability?: number;
  usable?: boolean;
  equippable?: boolean;
  equipped?: boolean; // New: For tracking equipped status
  consumable?: boolean;
  learnable?: boolean; // For 'công pháp' items
  owner?: string; // 'pc' or npc name for items
  skills?: string[]; // For NPCs
  learnedSkills?: string[]; // For PC
  state?: 'dead' | 'broken' | 'destroyed';
  [key: string]: any;
  archived?: boolean;           // Đánh dấu entity đã được archive
    archivedAt?: number;         // Turn number khi archive
    lastMentioned?: number;      // Turn cuối cùng được nhắc đến
}

export interface KnownEntities {
    [name: string]: Entity;
}

export interface CustomRule {
  id: string;
  content: string;
  isActive: boolean;
}

export interface FormData {
    storyName: string; // Changed from 'genre' 
    genre: string; // New field for story genre
    worldDetail: string;
    worldTime: { day: number; month: number; year: number }; // New field for world start time
    startLocation: string; // New field for start location
    customStartLocation: string; // New field for custom start location when "Tuỳ chọn" is selected
    writingStyle: string;
    difficulty: string;
    allowNsfw: boolean;
    characterName: string;
    customPersonality: string;
    personalityFromList: string;
    gender: string;
    bio: string;
    startSkill: string;
    addGoal: boolean;
    customRules: CustomRule[];
}

export interface Status {
    name:string;
    description: string;
    type: 'buff' | 'debuff' | 'neutral' | 'injury';
    source: string;
    duration?: string; // e.g., '3 turns', 'permanent'
    effects?: string;
    cureConditions?: string;
    owner: string; // 'pc' or an NPC's name
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
    giver?: string;
    reward?: string;
    isMainQuest: boolean;
    status: 'active' | 'completed' | 'failed';
}

export interface GameHistoryEntry {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export interface Chronicle {
    memoir: string[];
    chapter: string[];
    turn: string[];
}

export interface ChangeItem {
  type: 'feature' | 'fix' | 'improvement';
  text: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: ChangeItem[];
}
export interface CompressedHistorySegment {
    turnRange: string;
    summary: string;
    keyActions: string[];
    importantEvents: string[];
    tokenCount: number;
    compressedAt: number;
}
// --- Save Game Data Structure ---
export interface SaveData {
    worldData: Omit<FormData, 'customRules'>;
    knownEntities: KnownEntities;
    statuses: Status[];
    quests: Quest[];
    gameHistory: GameHistoryEntry[];
    memories: Memory[];
    party: Entity[];
    customRules: CustomRule[];
    systemInstruction: string;
    turnCount: number;
    totalTokens?: number;
    gameTime: {
        year: number;
        month: number;
        day: number;
        hour: number;
    };
    chronicle: Chronicle;
    
    // Explicit state saving
    storyLog?: string[];
    choices?: string[];
    locationDiscoveryOrder?: string[];

    // Thêm fields mới cho sliding window
    compressedHistory?: CompressedHistorySegment[];
    lastCompressionTurn?: number;
    historyStats?: {
        totalEntriesProcessed: number;
        totalTokensSaved: number;
        compressionCount: number;
    };
    cleanupStats?: {
        totalCleanupsPerformed: number;
        totalTokensSavedFromCleanup: number;
        lastCleanupTurn: number;
        cleanupHistory: Array<{
            turn: number;
            tokensSaved: number;
            itemsRemoved: number;
        }>;
    };
}

export interface AIContextType {
    ai: GoogleGenAI | null;
    isAiReady: boolean;
    apiKeyError: string | null;
    isUsingDefaultKey: boolean;
    userApiKeyCount: number;
    rotateKey: () => void;
    selectedModel: string;
}