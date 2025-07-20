
import React, { useState, useEffect, useMemo, createContext } from 'react';
import { GoogleGenAI } from "@google/genai";
import { MainMenu } from './components/MainMenu.tsx';
import { CreateWorld } from './components/CreateWorld.tsx';
import { GameScreen } from './components/GameScreen.tsx';
import { ApiSettingsModal } from './components/ApiSettingsModal.tsx';
import { ChangelogModal } from './components/ChangelogModal.tsx';
import { CustomizationFooter } from './components/CustomizationFooter.tsx';
import type { SaveData, Entity, AIContextType, FormData, CustomRule } from './components/types.ts';
import { CHANGELOG_DATA } from './components/data/changelog.ts';

// --- Constants ---
export const DEFAULT_SYSTEM_INSTRUCTION = `BẠN LÀ MỘT QUẢN TRÒ (GAME MASTER) AI. Nhiệm vụ của bạn là điều khiển một trò chơi nhập vai phiêu lưu văn bản, tuân thủ NGHIÊM NGẶT các quy tắc sau:

--- NGUYÊN TẮC CỐT LÕI ---
1.  **ƯU TIÊN TUYỆT ĐỐI - LUẬT LỆ TÙY CHỈNH:** Các quy tắc do người dùng cung cấp trong prompt (mục "--- TRI THỨC & LUẬT LỆ..." hoặc "--- CẬP NHẬT LUẬT LỆ...") sẽ GHI ĐÈ tất cả các quy tắc khác. Bạn PHẢI xử lý chúng đầu tiên, trước cả hành động của người chơi.
    *   **Kích hoạt luật mới:** Thông báo trong lời kể. Tạo khái niệm bằng \`[LORE_CONCEPT: name="<Tóm tắt luật> (Đang hoạt động)", description="<Nội dung luật>"]\`.
    *   **Vô hiệu hóa luật cũ:** Thông báo trong lời kể. Dùng \`[ENTITY_UPDATE]\` để đổi tên khái niệm tương ứng thành \`newName="<Tên cũ> (Pháp Tắc Sụp Đổ)"\` và \`newDescription="Luật này đã bị vô hiệu hóa."\`.
    *   **Cập nhật luật:** Thông báo trong lời kể. Dùng \`[ENTITY_UPDATE]\` để cập nhật khái niệm tương ứng với \`newName="<Tóm tắt luật mới> (Đang hoạt động)"\` và \`newDescription="<Nội dung luật mới>"\`.

2.  **HỆ THỐNG THẺ LỆNH:** Mọi thay đổi trạng thái game BẮT BUỘC phải được thực hiện qua các thẻ lệnh ẩn. Không diễn giải thẻ trong lời kể.
    *   **Quy tắc chung:** Giá trị thuộc tính (value) dùng tiếng Việt, tên thuộc tính (attribute) dùng camelCase (ví dụ: \`npcName\`).
    *   **CẤM:** Không được để trống thuộc tính \`description\` khi tạo thực thể bằng thẻ \`LORE_*\`.

3.  **THẾ GIỚI SỐNG:** Tạo ra một thế giới sống động, không chỉ chờ người chơi. NPC phải có đời sống, mục tiêu, và mối quan hệ riêng. Mô tả các sự kiện ngầm (tương tác giữa các NPC) đang diễn ra xung quanh người chơi.

--- HƯỚNG DẪN THẺ LỆNH ---
*   **Tạo Thực Thể (LORE):**
    *   \`[LORE_NPC: name, description, gender, age, appearance, motivation, location, skills?, personalityMbti?]\` (personalityMbti chỉ cho dạng người, chọn từ 16 loại MBTI).
    *   \`[LORE_ITEM: name, description, usable?, equippable?, consumable?, learnable?, durability?, uses?]\`
    *   \`[LORE_LOCATION|FACTION|CONCEPT: name, description]\`
*   **Biên Niên Sử (CHRONICLE):** Dùng để tóm tắt sự kiện cho trí nhớ dài hạn.
    *   \`[CHRONICLE_TURN: text]\` (Bắt buộc mỗi lượt)
    *   \`[CHRONICLE_CHAPTER: text]\` (Khi có sự kiện quan trọng)
    *   \`[CHRONICLE_MEMOIR: text]\` (Khi có sự kiện trọng đại)
*   **Trạng Thái (STATUS):** Chủ động áp dụng các trạng thái tinh thần, môi trường. Trạng thái có thể diễn tiến (VD: Vết thương -> Di tật).
    *   \`[STATUS_APPLIED_SELF|NPC: name, description, type, source, duration, cureConditions?, effects?]\`
    *   \`[STATUS_CURED_SELF|NPC: name]\`
*   **Thời Gian:**
    *   \`[TIME_ELAPSED: years?, months?, days?, hours?]\` (Bắt buộc mỗi lượt, dù là 0)
*   **Nhiệm Vụ & Vật Phẩm:**
    *   \`[QUEST_ASSIGNED: title, description, objectives, reward]\`
    *   \`[QUEST_UPDATED: title, status="completed|failed"]\` (Khi 'completed', phải tự động trao 'reward' bằng thẻ ITEM/SKILL)
    *   \`[QUEST_OBJECTIVE_COMPLETED: questTitle, objectiveDescription]\`
    *   \`[ITEM_AQUIRED|CONSUMED|DAMAGED|EQUIPPED|UNEQUIPPED|TRANSFORMED: ...]\`
*   **Cập nhật & Khác:**
    *   \`[ENTITY_UPDATE: name, newName?, newDescription?, ...]\` (Cập nhật mọi thực thể, bao gồm vị trí PC khi di chuyển)
    *   \`[SKILL_LEARNED: name, description, realm?]\`
    *   \`[REALM_UPDATE: target, realm]\`
    *   \`[COMPANION: name, description, personality]\`
    *   \`[RELATIONSHIP_CHANGED: npcName, relationship]\`
    *   \`[MEMORY_ADD: text]\`
*   **Quản trị:** Hành động bắt đầu bằng \`ADMIN:\` phải được tuân thủ tuyệt đối.

--- TƯƠNG TÁC & CHIẾN ĐẤU ---
*   **Tạo Lựa Chọn:** Phân tích toàn diện bối cảnh (nhân vật, kỹ năng, vật phẩm, nhiệm vụ). Tạo lựa chọn đa dạng (hành động, xã hội, thăm dò), có ý nghĩa và tận dụng kỹ năng/vật phẩm của người chơi.
*   **Kết Quả:** Không đảm bảo thành công. Bí mật "tung xúc xắc" để quyết định kết quả và mô tả lại một cách tự nhiên.
*   **Chiến Đấu:** Theo lượt, không giải quyết trong một hành động. Cung cấp lựa chọn chiến thuật chi tiết. Kẻ địch cũng hành động và có trạng thái.

--- ĐỊNH DẠNG & NỘI DUNG ---
*   **Văn Phong:** Tường thuật chi tiết (150-200+ từ), tự nhiên. Thông báo quan trọng dùng \`**⭐...⭐**\`. Suy nghĩ nội tâm dùng \`...\`. Không bình luận sau danh sách lựa chọn.
*   **Nội Dung 18+ (NSFW):**
    *   Chỉ áp dụng khi chế độ NSFW được **BẬT**.
    *   Nếu **BẬT**: Chủ động tạo 2+ lựa chọn khiêu dâm/bạo lực, đánh dấu bằng \`(NSFW)\`.
    *   Mô tả cực kỳ chi tiết, trần trụi, không giới hạn. Được phép dùng ngôn từ thô tục.
    *   Hành động tình dục phải tạo ra trạng thái (status) liên quan.`;

// --- AI Context for dependency injection ---
export const AIContext = createContext<AIContextType>({
    ai: null,
    isAiReady: false,
    apiKeyError: null,
    isUsingDefaultKey: true,
    userApiKeyCount: 0,
    rotateKey: () => {},
});

export default function App() {
  const [view, setView] = useState('menu'); // 'menu', 'create-world', 'game'
  const [gameState, setGameState] = useState<SaveData | null>(null);
  const [isApiSettingsModalOpen, setIsApiSettingsModalOpen] = useState(false);
  const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);
  const [keyRotationNotification, setKeyRotationNotification] = useState<string | null>(null);

  // --- API Key State ---
  const [userApiKeys, setUserApiKeys] = useState<string[]>(() => {
      const savedKeys = localStorage.getItem('userApiKeys');
      return savedKeys ? JSON.parse(savedKeys) : [];
  });
  const [activeUserApiKeyIndex, setActiveUserApiKeyIndex] = useState<number>(() => {
      return parseInt(localStorage.getItem('activeUserApiKeyIndex') || '0', 10);
  });
  const [isUsingDefaultKey, setIsUsingDefaultKey] = useState(() => {
      return localStorage.getItem('isUsingDefaultKey') !== 'false'; // Default to true
  });
  
  // --- Font State ---
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem('fontFamily') || 'font-sans');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('fontSize') || 'text-base');

  useEffect(() => {
    localStorage.setItem('fontFamily', fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    localStorage.setItem('fontSize', fontSize);
  }, [fontSize]);
  
  // --- Memoized AI Instance ---
  const activeKey = useMemo(() => {
    if (isUsingDefaultKey) {
        return process.env.API_KEY || '';
    }
    if (userApiKeys.length > 0) {
        const validIndex = activeUserApiKeyIndex < userApiKeys.length ? activeUserApiKeyIndex : 0;
        return userApiKeys[validIndex] || '';
    }
    return '';
  }, [isUsingDefaultKey, userApiKeys, activeUserApiKeyIndex]);

  const { ai, isAiReady, apiKeyError } = useMemo(() => {
      if (!activeKey) {
        return {
          ai: null,
          isAiReady: false,
          apiKeyError: "API Key chưa được thiết lập. Vui lòng vào phần Thiết Lập API Key."
        };
      }
      try {
        const genAI = new GoogleGenAI({ apiKey: activeKey });
        return { ai: genAI, isAiReady: true, apiKeyError: null };
      } catch (e: any) {
        console.error("Failed to initialize GoogleGenAI:", e);
        return { ai: null, isAiReady: false, apiKeyError: `Lỗi khởi tạo AI: ${e.message}` };
      }
  }, [activeKey]);
  
  // --- Key Management ---
  const handleSaveApiKeys = (newKeys: string[]) => {
      const filteredKeys = newKeys.filter(k => k.trim() !== '');
      setUserApiKeys(filteredKeys);
      setActiveUserApiKeyIndex(0);
      setIsUsingDefaultKey(false);
      localStorage.setItem('userApiKeys', JSON.stringify(filteredKeys));
      localStorage.setItem('activeUserApiKeyIndex', '0');
      localStorage.setItem('isUsingDefaultKey', 'false');
  };
  
  const handleUseDefaultKey = () => {
      setIsUsingDefaultKey(true);
      localStorage.setItem('isUsingDefaultKey', 'true');
  };

  const handleRotateKey = () => {
    if (isUsingDefaultKey || userApiKeys.length <= 1) return;
    const nextIndex = (activeUserApiKeyIndex + 1) % userApiKeys.length;
    setActiveUserApiKeyIndex(nextIndex);
    localStorage.setItem('activeUserApiKeyIndex', nextIndex.toString());
    setKeyRotationNotification(`Lỗi giới hạn yêu cầu. Đã tự động chuyển sang API Key #${nextIndex + 1}.`);
    // Notification will be cleared in GameScreen after being displayed
  };


  const navigateToCreateWorld = () => setView('create-world');
  const navigateToMenu = () => {
      setGameState(null);
      setView('menu');
  };
  
  const startNewGame = (data: FormData) => {
      const pcEntity: Entity = {
          name: data.characterName || 'Vô Danh',
          type: 'pc',
          description: data.bio,
          gender: data.gender,
          personality: data.customPersonality || data.personalityFromList,
          learnedSkills: [],
      };
      
      const { customRules, ...worldData } = data;

      setGameState({
        worldData: worldData,
        knownEntities: { [pcEntity.name]: pcEntity },
        statuses: [],
        quests: [],
        gameHistory: [],
        memories: [],
        party: [pcEntity],
        customRules: customRules || [],
        systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
        turnCount: 0,
        totalTokens: 0,
        gameTime: { year: 1, month: 1, day: 1, hour: 8 },
        chronicle: {
            memoir: [],
            chapter: [],
            turn: [],
        },
      });
      setView('game');
  }

  const handleLoadGameFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result;
            if (typeof text === 'string') {
                const loadedJson = JSON.parse(text);
                // Basic validation
                if (loadedJson.worldData && loadedJson.knownEntities && loadedJson.gameHistory) {
                    const pc = Object.values(loadedJson.knownEntities).find((e: any) => e.type === 'pc');
                    // Ensure new fields have default values if loading an old save
                    const validatedData: SaveData = {
                        worldData: loadedJson.worldData,
                        knownEntities: loadedJson.knownEntities,
                        statuses: loadedJson.statuses || [],
                        quests: loadedJson.quests || [],
                        gameHistory: loadedJson.gameHistory,
                        memories: loadedJson.memories || [],
                        party: loadedJson.party || (pc ? [pc] : []),
                        customRules: loadedJson.customRules || (loadedJson.userKnowledge ? [{ id: 'imported_knowledge', content: loadedJson.userKnowledge, isActive: true }] : []),
                        systemInstruction: loadedJson.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
                        turnCount: loadedJson.turnCount || 0,
                        totalTokens: loadedJson.totalTokens || 0,
                        gameTime: loadedJson.gameTime || { year: 1, month: 1, day: 1, hour: 8 },
                        chronicle: loadedJson.chronicle || { memoir: [], chapter: [], turn: [] },
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
  const openChangelog = () => setIsChangelogModalOpen(true);

  const renderContent = () => {
      switch(view) {
          case 'create-world':
              return <CreateWorld onBack={navigateToMenu} onStartGame={startNewGame} />;
          case 'game':
              return gameState ? <GameScreen 
                initialGameState={gameState} 
                onBackToMenu={navigateToMenu} 
                fontFamily={fontFamily} 
                fontSize={fontSize}
                keyRotationNotification={keyRotationNotification}
                onClearNotification={() => setKeyRotationNotification(null)}
              /> : <MainMenu onStartNewAdventure={navigateToCreateWorld} onOpenApiSettings={openApiSettings} onLoadGameFromFile={handleLoadGameFromFile} isUsingDefaultKey={isUsingDefaultKey} onOpenChangelog={openChangelog}/>;
          case 'menu':
          default:
              return <MainMenu onStartNewAdventure={navigateToCreateWorld} onOpenApiSettings={openApiSettings} onLoadGameFromFile={handleLoadGameFromFile} isUsingDefaultKey={isUsingDefaultKey} onOpenChangelog={openChangelog}/>;
      }
  }

  return (
    <AIContext.Provider value={{ ai, isAiReady, apiKeyError, isUsingDefaultKey, userApiKeyCount: userApiKeys.length, rotateKey: handleRotateKey }}>
      <style>{`
        .am-kim {
            background: linear-gradient(135deg, #ca8a04, #eab308, #fde047);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: bold;
            animation: am-kim-shine 3s linear infinite;
            background-size: 200% 200%;
        }

        .dark .am-kim {
             background: linear-gradient(135deg, #fde047, #a2830e, #fde047);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        @keyframes am-kim-shine {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
        }
      `}</style>
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-2 sm:p-4 font-sans text-slate-900 dark:text-white antialiased pb-4 md:pb-20 bg-slate-100 dark:bg-slate-900 transition-colors duration-500">
        {renderContent()}
        <ApiSettingsModal 
          isOpen={isApiSettingsModalOpen} 
          onClose={() => setIsApiSettingsModalOpen(false)}
          userApiKeys={userApiKeys}
          isUsingDefault={isUsingDefaultKey}
          onSave={handleSaveApiKeys}
          onUseDefault={handleUseDefaultKey}
        />
        <ChangelogModal
            isOpen={isChangelogModalOpen}
            onClose={() => setIsChangelogModalOpen(false)}
            changelogData={CHANGELOG_DATA}
        />
        <CustomizationFooter 
            fontFamily={fontFamily} setFontFamily={setFontFamily}
            fontSize={fontSize} setFontSize={setFontSize}
        />
      </div>
    </AIContext.Provider>
  );
}