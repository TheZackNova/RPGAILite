// Game Entity Types
export type EntityType = 'pc' | 'npc' | 'location' | 'faction' | 'item' | 'skill' | 'status_effect' | 'companion' | 'concept';

// Core Entity Interface
export interface Entity {
  name: string;
  type: EntityType;
  description: string;
  gender?: string;
  age?: string;
  personality?: string;
  relationship?: string;
  uses?: number;
  realm?: string;
  durability?: number;
  usable?: boolean;
  equippable?: boolean;
  equipped?: boolean;
  consumable?: boolean;
  learnable?: boolean;
  owner?: string;
  skills?: string[];
  [key: string]: any; 
}

// Known Entities Collection
export interface KnownEntities {
    [name: string]: Entity;
}

// Game Configuration Types
export type Genre = string;
export type WorldDetail = string;
export type WritingStyle = string;
export type Difficulty = string;
export type Gender = string;

// Form Data Interface
export interface FormData {
    genre: Genre;
    worldDetail: WorldDetail;
    writingStyle: WritingStyle;
    difficulty: Difficulty;
    allowNsfw: boolean;
    characterName: string;
    customPersonality: string;
    personalityFromList: string;
    gender: Gender;
    bio: string;
    startSkill: string;
    addGoal: boolean;
}

// Character-specific types
export interface Character extends Entity {
    type: 'pc' | 'npc' | 'companion';
    gender: string;
    personality: string;
    bio?: string;
    goals?: string[];
}

// Item-specific types
export interface Item extends Entity {
    type: 'item';
    uses?: number;
    durability?: number;
    usable?: boolean;
    equippable?: boolean;
    equipped?: boolean;
    consumable?: boolean;
    owner?: string;
}

// Skill-specific types
export interface Skill extends Entity {
    type: 'skill';
    learnable?: boolean;
    owner?: string;
}

// Location-specific types
export interface Location extends Entity {
    type: 'location';
    realm?: string;
}

// Memory Interface
export interface Memory {
    text: string;
    pinned: boolean;
}

// Game History Interface
export interface GameHistoryEntry {
    role: 'user' | 'model';
    parts: { text: string }[];
}

// Custom Rule Interface
export interface CustomRule {
    id: string;
    content: string;
    isActive: boolean;
}

// Additional utility types
export type UserRole = 'user' | 'model';