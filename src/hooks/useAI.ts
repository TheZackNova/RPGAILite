import { useState, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";

interface UseAIReturn {
    ai: GoogleGenAI | null;
    isAiReady: boolean;
    apiKeyError: string | null;
    apiKey: string;
    isUsingDefaultKey: boolean;
    handleSaveApiKey: (newKey: string) => void;
    handleUseDefaultKey: () => void;
    setApiKey: (key: string) => void;
}

export const useAI = (): UseAIReturn => {
    // API Key Management State
    const [apiKey, setApiKey] = useState(() => 
        localStorage.getItem('userApiKey') || (process.env.REACT_APP_API_KEY || '')
    );
    const [isUsingDefaultKey, setIsUsingDefaultKey] = useState(() => 
        !localStorage.getItem('userApiKey')
    );

    // AI Initialization Logic with Error Handling
    const { ai, isAiReady, apiKeyError } = useMemo(() => {
        if (!apiKey) {
            return {
                ai: null,
                isAiReady: false,
                apiKeyError: "API Key chưa được thiết lập. Vui lòng vào phần Thiết Lập API Key."
            };
        }
        
        try {
            const genAI = new GoogleGenAI({ apiKey });
            return { 
                ai: genAI, 
                isAiReady: true, 
                apiKeyError: null 
            };
        } catch (e: any) {
            console.error("Failed to initialize GoogleGenAI:", e);
            return { 
                ai: null, 
                isAiReady: false, 
                apiKeyError: `Lỗi khởi tạo AI: ${e.message}` 
            };
        }
    }, [apiKey]);

    // API Key Management Functions
    const handleSaveApiKey = (newKey: string) => {
        localStorage.setItem('userApiKey', newKey);
        setApiKey(newKey);
        setIsUsingDefaultKey(false);
    };

    const handleUseDefaultKey = () => {
        localStorage.removeItem('userApiKey');
        setApiKey(process.env.REACT_APP_API_KEY || '');
        setIsUsingDefaultKey(true);
    };

    return {
        ai,
        isAiReady,
        apiKeyError,
        apiKey,
        isUsingDefaultKey,
        handleSaveApiKey,
        handleUseDefaultKey,
        setApiKey
    };
};