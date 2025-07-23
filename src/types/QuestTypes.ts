// Quest Types
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

export type QuestStatus = 'active' | 'completed' | 'failed';