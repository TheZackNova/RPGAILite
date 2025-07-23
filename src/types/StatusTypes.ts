// Status Types
export interface Status {
    name: string;
    description: string;
    type: 'buff' | 'debuff' | 'neutral' | 'injury';
    source: string;
    duration?: string;
    effects?: string;
    cureConditions?: string;
    owner: string;
}

export type StatusType = 'buff' | 'debuff' | 'neutral' | 'injury';