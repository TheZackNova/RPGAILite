import React, { useState, useEffect, useMemo } from 'react';
import { GoogleGenAI } from "@google/genai";
import './App.css';

import {
  ApiSettingsModal,
  MainMenu,
  CreateWorld,
  GameScreen,
  CustomizationFooter,
  AIContext
} from './components';

import type { SaveData, FormData, Entity } from './types';

const DEFAULT_SYSTEM_INSTRUCTION = `BẠN LÀ QUẢN TRÒ (GAME MASTER) TỐI THƯỢỢNG. Nhiệm vụ của bạn là tạo ra một trò chơi nhập vai phiêu lưu văn bản sống động, logic và tuân thủ NGHIÊM NGẶT các quy tắc sau:

1.  **LUẬT CỐT LÕI - TRÍ NHỚ & BỐI CẢNH:**
    *   **Ngôn ngữ:** Mọi giá trị (value) trong các thuộc tính của thẻ lệnh, khi có thể, PHẢI là tiếng Việt (ví dụ: \`gender="Nam"\`, không phải \`gender="male"\`).
    *   **Phân tích toàn diện:** Trước mỗi lượt kể, bạn PHẢI phân tích kỹ lưỡng TOÀN BỘ bối cảnh được cung cấp: trạng thái nhân vật (buff/debuff/hoàn cảnh), vật phẩm trong túi, kỹ năng, thành viên tổ đội, nhiệm vụ đang hoạt động, và các ký ức đã ghim.
    *   **Nhất quán tuyệt đối:** Mọi diễn biến PHẢI bám sát và logic với lịch sử đã diễn ra.

2.  **HỆ THỐNG THẺ LỆNH (BẮT BUỘC SỬ DỤNG):** Bạn CHỈ được phép thay đổi trạng thái game thông qua các thẻ lệnh này. Các thẻ phải nằm trên dòng riêng. TUYỆT ĐỐI không giải thích thẻ trong lời kể.
    *   **QUY TẮC VỀ THUỘC TÍNH:** Tất cả các thuộc tính trong thẻ lệnh BẮT BUỘC phải ở định dạng camelCase (ví dụ: \`npcName\`, \`questTitle\`, \`isComplete\`). TUYỆT ĐỐI không dùng PascalCase (Name) hoặc snake_case (npc_name).
    
[Additional game rules continue...]`;

export default function App() {
  // Navigation state
  const [view, setView] = useState('menu'); // 'menu', 'create-world', 'game'
  const [gameState, setGameState] = useState<SaveData | null>(null);
  const [isApiSettingsModalOpen, setIsApiSettingsModalOpen] = useState(false);

  // API configuration
  const [apiKey, setApiKey] = useState(() => 
    localStorage.getItem('userApiKey') || (process.env.API_KEY || '')
  );
  const [isUsingDefaultKey, setIsUsingDefaultKey] = useState(() => 
    !localStorage.getItem('userApiKey')
  );
  
  // UI preferences
  const [fontFamily, setFontFamily] = useState(() => 
    localStorage.getItem('fontFamily') || 'font-sans'
  );
  const [fontSize, setFontSize] = useState(() => 
    localStorage.getItem('fontSize') || 'text-base'
  );

  // Persist preferences
  useEffect(() => {
    localStorage.setItem('fontFamily', fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    localStorage.setItem('fontSize', fontSize);
  }, [fontSize]);

  // AI initialization
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
  
  // API key management
  const handleSaveApiKey = (newKey: string) => {
    localStorage.setItem('userApiKey', newKey);
    setApiKey(newKey);
    setIsUsingDefaultKey(false);
  };
  
  const handleUseDefaultKey = () => {
    localStorage.removeItem('userApiKey');
    setApiKey(process.env.API_KEY || '');
    setIsUsingDefaultKey(true);
  };

  // Navigation handlers
  const navigateToCreateWorld = () => setView('create-world');
  const navigateToMenu = () => {
    setGameState(null);
    setView('menu');
  };
  
  // Game management
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
              customRules: loadedJson.customRules || (loadedJson.userKnowledge ? 
                [{ id: 'imported_knowledge', content: loadedJson.userKnowledge, isActive: true }] : []
              ),
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

  // Render content based on current view
  const renderContent = () => {
    switch(view) {
      case 'create-world':
        return (
          <CreateWorld 
            onBack={navigateToMenu} 
            onStartGame={startNewGame} 
          />
        );
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