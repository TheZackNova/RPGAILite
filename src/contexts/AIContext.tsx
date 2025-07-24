import React, { createContext } from 'react';

interface AIContextType {
    ai: any; // GoogleGenAI instance
    isAiReady: boolean;
    apiKeyError?: string;
    isUsingDefaultKey: boolean;
    userApiKeyCount: number;
    rotateKey: () => void;
}

export const AIContext = createContext<AIContextType>({
    ai: null,
    isAiReady: false,
    apiKeyError: undefined,
    isUsingDefaultKey: true,
    userApiKeyCount: 0,
    rotateKey: () => {}
});