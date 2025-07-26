import { useState, useEffect } from 'react';
import { GameSettings } from '../GameSettingsModal';

export interface GameSettingsState {
    gameSettings: GameSettings;
}

export interface GameSettingsActions {
    setGameSettings: (settings: GameSettings) => void;
    handleSettingsChange: (newSettings: GameSettings) => void;
}

export const useGameSettings = (): [GameSettingsState, GameSettingsActions] => {
    const [gameSettings, setGameSettings] = useState<GameSettings>(() => {
        const saved = localStorage.getItem('gameSettings');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch {
                // Fall back to defaults if parse fails
            }
        }
        return {
            fontSize: 16,
            fontFamily: 'Inter',
            memoryAutoClean: true,
            historyAutoCompress: true,
        };
    });

    const handleSettingsChange = (newSettings: GameSettings) => {
        setGameSettings(newSettings);
        localStorage.setItem('gameSettings', JSON.stringify(newSettings));
        
        // Apply font settings to document root
        document.documentElement.style.setProperty('--game-font-size', `${newSettings.fontSize}px`);
        document.documentElement.style.setProperty('--game-font-family', newSettings.fontFamily);
    };

    // Apply font settings on component mount
    useEffect(() => {
        document.documentElement.style.setProperty('--game-font-size', `${gameSettings.fontSize}px`);
        document.documentElement.style.setProperty('--game-font-family', gameSettings.fontFamily);
    }, [gameSettings.fontSize, gameSettings.fontFamily]);

    const gameSettingsState: GameSettingsState = {
        gameSettings
    };

    const gameSettingsActions: GameSettingsActions = {
        setGameSettings,
        handleSettingsChange
    };

    return [gameSettingsState, gameSettingsActions];
};