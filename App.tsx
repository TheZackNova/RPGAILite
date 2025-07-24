import React, { useState, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
    AIContext, 
    ApiSettingsModal, 
    MainMenu, 
    CreateWorld, 
    GameScreen, 
    CustomizationFooter,
    useLocalStorage 
} from './src/components';
import { FormData, SaveData, Entity } from './src/types';
import { DEFAULT_SYSTEM_INSTRUCTION } from './src/constants';
import './src/App.css';

export default function App() {
    // View state management
    const [view, setView] = useState<'menu' | 'create-world' | 'game'>('menu');
    const [gameState, setGameState] = useState<SaveData | null>(null);
    const [isApiSettingsModalOpen, setIsApiSettingsModalOpen] = useState(false);

    // Persistent settings using localStorage
    const [apiKey, setApiKey] = useLocalStorage('userApiKey', process.env.API_KEY || '');
    const [isUsingDefaultKey, setIsUsingDefaultKey] = useLocalStorage('isUsingDefaultKey', !localStorage.getItem('userApiKey'));
    const [fontFamily, setFontFamily] = useLocalStorage('fontFamily', 'font-sans');
    const [fontSize, setFontSize] = useLocalStorage('fontSize', 'text-base');

    // AI instance management
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
            return { ai: genAI, isAiReady: true, apiKeyError: null };
        } catch (e: any) {
            console.error("Failed to initialize GoogleGenAI:", e);
            return { ai: null, isAiReady: false, apiKeyError: `Lỗi khởi tạo AI: ${e.message}` };
        }
    }, [apiKey]);

    // API Key management
    const handleSaveApiKey = (newKey: string) => {
        setApiKey(newKey);
        setIsUsingDefaultKey(false);
    };
    
    const handleUseDefaultKey = () => {
        setApiKey(process.env.API_KEY || '');
        setIsUsingDefaultKey(true);
    };

    // Navigation functions
    const navigateToCreateWorld = () => setView('create-world');
    const navigateToMenu = () => {
        setGameState(null);
        setView('menu');
    };
    
    // Game state management
    const startNewGame = (data: FormData) => {
        const pcEntity: Entity = {
            name: data.characterName || 'Vô Danh',
            type: 'pc',
            description: data.bio,
            gender: data.gender,
            personality: data.customPersonality || data.personalityFromList,
        };
        
        setGameState({
            worldData: data,
            storyLog: [],
            choices: [],
            knownEntities: { [pcEntity.name]: pcEntity },
            statuses: [],
            quests: [],
            gameHistory: [],
            memories: [],
            party: [pcEntity],
            customRules: [],
            systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
            turnCount: 0,
        });
        setView('game');
    };

    // File loading logic
    const handleLoadGameFromFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text === 'string') {
                    const loadedJson = JSON.parse(text);
                    // Basic validation
                    if (loadedJson.worldData && loadedJson.gameHistory) {
                        const pc = Object.values(loadedJson.knownEntities).find((e: any) => e.type === 'pc');
                        // Ensure new fields have default values if loading an old save
                        const validatedData: SaveData = {
                            ...loadedJson,
                            customRules: loadedJson.customRules || (loadedJson.userKnowledge ? [{ id: 'imported_knowledge', content: loadedJson.userKnowledge, isActive: true }] : []),
                            party: loadedJson.party || (pc ? [pc] : []),
                            systemInstruction: loadedJson.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
                            turnCount: loadedJson.turnCount || 0,
                        };
                        delete (validatedData as any).userKnowledge;

                        setGameState(validatedData);
                        setView('game');
                    } else {
                        alert('Tệp lưu không hợp lệ.');
                    }
                }
            } catch (error) {
                console.error('Lỗi khi tải tệp:', error);
                alert('Không thể đọc tệp lưu. Tệp có thể bị hỏng hoặc không đúng định dạng.');
            }
        };
        reader.readAsText(file);
    };

    const openApiSettings = () => setIsApiSettingsModalOpen(true);

    // Main content rendering
    const renderContent = () => {
        switch (view) {
            case 'create-world':
                return <CreateWorld onBack={navigateToMenu} onStartGame={startNewGame} />;
            case 'game':
                return gameState ? (
                    <GameScreen 
                        initialGameState={gameState} 
                        onBackToMenu={navigateToMenu} 
                        fontFamily={fontFamily} 
                        fontSize={fontSize}
                    />
                ) : (
                    <MainMenu 
                        onStartNewAdventure={navigateToCreateWorld} 
                        onOpenApiSettings={openApiSettings} 
                        onLoadGameFromFile={handleLoadGameFromFile} 
                        isUsingDefaultKey={isUsingDefaultKey}
                    />
                );
            case 'menu':
            default:
                return (
                    <MainMenu 
                        onStartNewAdventure={navigateToCreateWorld} 
                        onOpenApiSettings={openApiSettings} 
                        onLoadGameFromFile={handleLoadGameFromFile} 
                        isUsingDefaultKey={isUsingDefaultKey}
                    />
                );
        }
    };

    return (
        <AIContext.Provider value={{ ai, isAiReady, apiKeyError }}>
            <div className="min-h-screen w-full flex flex-col items-center justify-center p-2 sm:p-4 font-sans text-slate-900 dark:text-white antialiased pb-20 bg-slate-100 dark:bg-slate-900 transition-colors duration-500">
                {renderContent()}
                
                <ApiSettingsModal 
                    isOpen={isApiSettingsModalOpen} 
                    onClose={() => setIsApiSettingsModalOpen(false)}
                    currentApiKey={apiKey}
                    isUsingDefault={isUsingDefaultKey}
                    onSave={handleSaveApiKey}
                    onUseDefault={handleUseDefaultKey}
                />
                
                <CustomizationFooter 
                    fontFamily={fontFamily} 
                    setFontFamily={setFontFamily}
                    fontSize={fontSize} 
                    setFontSize={setFontSize}
                />
            </div>
        </AIContext.Provider>
    );
}