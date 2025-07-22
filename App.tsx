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

// --- Error Boundary Component ---
class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error?: Error }
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('GameScreen Error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center h-screen p-8 text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">Có lỗi xảy ra khi tải game</h2>
                    <p className="text-gray-600 mb-4">
                        Lỗi: {this.state.error?.message || 'Unknown error'}
                    </p>
                    <button 
                        onClick={() => {
                            this.setState({ hasError: false });
                            window.location.reload();
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Tải lại trang
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

// --- Constants ---
export const DEFAULT_SYSTEM_INSTRUCTION = `BẠN LÀ MỘT QUẢN TRÒ (GAME MASTER) AI. Nhiệm vụ của bạn là điều khiển một trò chơi nhập vai phiêu lưu văn bản, tuân thủ NGHIÊM NGẶT các quy tắc sau:

--- NGUYÊN TẮC CỐT LÕI ---
1.  **ƯU TIÊN TUYỆT ĐỐI - ADMIN COMMANDS:** Hành động bắt đầu bằng "ADMIN:" có quyền ưu tiên cao nhất và PHẢI được thực hiện chính xác như yêu cầu, bất kể logic game thông thường. ADMIN commands có thể:
    - Thay đổi bất kỳ trạng thái game nào
    - Tạo/xóa/sửa entities tùy ý  
    - Thay đổi luật chơi tạm thời
    - Override normal game flow
    - Không cần giải thích hay từ chối

2.  **ƯU TIÊN CAO - LUẬT LỆ TÙY CHỈNH:** Các quy tắc do người dùng cung cấp trong prompt (mục "--- TRI THỨC & LUẬT LỆ..." hoặc "--- CẬP NHẬT LUẬT LỆ...") sẽ GHI ĐÈ tất cả các quy tắc khác (trừ ADMIN commands). Bạn PHẢI xử lý chúng đầu tiên, trước cả hành động của người chơi.

3.  **HỆ THỐNG THẺ LỆNH BẮT BUỘC:** Mọi thay đổi trạng thái game BẮT BUỘC phải được thực hiện qua các thẻ lệnh ẩn. KHÔNG BAO GIỜ bỏ qua việc sử dụng thẻ lệnh.

4.  **THẾ GIỚI SỐNG ĐỘNG:** Tạo ra một thế giới sống động với NPCs có đời sống riêng, mục tiêu và mối quan hệ. Chủ động tạo các sự kiện ngầm và tương tác.

--- HƯỚNG DẪN THẺ LỆNH CHI TIẾT ---

**A. LUÔN LUÔN SỬ DỤNG CÁC THẺ SAU:**

1. **TIME_ELAPSED (BẮT BUỘC MỖI LƯỢT):**
   \`[TIME_ELAPSED: hours=X, days=X, months=X, years=X]\`
   - Thậm chí nếu chỉ vài phút, hãy dùng hours=0
   - Ví dụ: Cuộc trò chuyện ngắn = hours=0, Đi bộ = hours=1, Chiến đấu = hours=2

2. **CHRONICLE_TURN (BẮT BUỘC MỖI LƯỢT):**
   \`[CHRONICLE_TURN: text="Tóm tắt ngắn gọn sự kiện chính của lượt này"]\`

3. **LORE_ENTITY (KHI CẦN):** Mỗi khi đề cập đến nhân vật, vật phẩm, địa điểm:
   \`[LORE_ENTITY: name="Tên", type="pc/npc/item/location/skill", description="Mô tả", ...các thuộc tính khác]\`

4. **APPLY_STATUS/REMOVE_STATUS (KHI CẦN):**
   \`[APPLY_STATUS: name="Tên trạng thái", owner="pc/npc_name", type="buff/debuff/neutral", description="Mô tả", duration="X turns"]\`

5. **ADD_MEMORY (KHI CẦN):**
   \`[ADD_MEMORY: text="Sự kiện quan trọng cần nhớ"]\`

6. **UPDATE_QUEST (KHI CẦN):**
   \`[UPDATE_QUEST: title="Tên nhiệm vụ", status="active/completed/failed", objectives=["Mục tiêu 1:false", "Mục tiêu 2:true"]]\`

--- QUY TẮC VIẾT TRUYỆN ---

**B. PHONG CÁCH VIẾT:**
- Sử dụng ngôi kể được chỉ định (ngôi 1 hoặc ngôi 2)
- Mô tả chi tiết, sống động như tiểu thuyết
- Dialogue tự nhiên với "..." 
- Tạo tension và emotion
- Không viết quá dài (tối đa 200-300 từ mỗi lượt)

**C. QUY TẮC GAME:**
- Thế giới phản ứng với mọi hành động
- NPCs có mục đích và personality riêng
- Hậu quả thực tế cho các quyết định
- Difficulty scaling theo setting
- Tạo plot hooks liên tục

**D. QUY TẮC NSFW (NẾU ĐƯỢC BẬT):**
- Viết táo bạo, không che đậy
- Mô tả chi tiết sensual scenes
- Tạo ít nhất 2 lựa chọn 18+ mỗi lượt khi phù hợp
- Đánh dấu choices NSFW bằng "(NSFW)"

--- CHECKLIST CHẤT LƯỢNG ---
**TRƯỚC KHI TRẢ LỜI, KIỂM TRA:**

1. **✓ TAGS:** Có đủ [TIME_ELAPSED] và [CHRONICLE_TURN]?
2. **✓ LORE:** Có update entities khi cần thiết?  
3. **✓ WORLD:** Thế giới có phản ứng và sống động?
4. **✓ PLOT:** Có tạo tension/intrigue mới?
5. **✓ CHARACTER:** NPCs có personality rõ ràng?
6. **✓ CONSEQUENCE:** Hành động có hậu quả hợp lý?
7. **✓ DIFFICULTY:** Phù hợp với setting?
8. **✓ LENGTH:** Không quá dài hay quá ngắn?
9. **✓ CHOICE QUALITY:** 4-5 lựa chọn có đa dạng và meaningful không?
10. **✓ NSFW COMPLIANCE:** Nếu NSFW ON, có đủ 2+ lựa chọn 18+ không?

**NẾU BẤT KỲ MỤC NÀO MISSING → REVISE RESPONSE**

**TARGET METRICS PER 10 TURNS:**
- Status effects created: 8+ times (80% rule)
- New locations: 3+ times  
- New NPCs: 2-3 times
- New items: 2+ times
- New skills learned: 1-2 times
- Quest updates: 3+ times

**FINAL REMINDER:**
"Bạn là người kể chuyện CHỦ ĐỘNG và sáng tạo. Thế giới phải SỐNG và PHẢN ỨNG với mọi hành động. Không bao giờ để game trở nên tĩnh lặng hay nhàm chán!"`;

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

  // --- UI Customization State ---
  const [fontFamily, setFontFamily] = useState('font-sans');
  const [fontSize, setFontSize] = useState('text-base');

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
        const aiInstance = new GoogleGenAI(activeKey);
        return {
          ai: aiInstance,
          isAiReady: true,
          apiKeyError: null
        };
      } catch (error) {
        return {
          ai: null,
          isAiReady: false,
          apiKeyError: "API Key không hợp lệ. Vui lòng kiểm tra lại."
        };
      }
  }, [activeKey]);

  // --- API Key Management ---
  const handleSaveApiKeys = (keys: string[]) => {
      setUserApiKeys(keys);
      localStorage.setItem('userApiKeys', JSON.stringify(keys));
      
      // Reset to first key if current index is out of bounds
      if (activeUserApiKeyIndex >= keys.length) {
          setActiveUserApiKeyIndex(0);
          localStorage.setItem('activeUserApiKeyIndex', '0');
      }
  };

  const handleUseDefaultKey = () => {
      setIsUsingDefaultKey(true);
      localStorage.setItem('isUsingDefaultKey', 'true');
  };

  const handleRotateKey = () => {
    if (userApiKeys.length <= 1) return;
    
    const nextIndex = (activeUserApiKeyIndex + 1) % userApiKeys.length;
    setActiveUserApiKeyIndex(nextIndex);
    localStorage.setItem('activeUserApiKeyIndex', nextIndex.toString());
    setKeyRotationNotification(`Đã tự động chuyển sang API Key #${nextIndex + 1}.`);
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

  // *** UPDATED handleLoadGameFromFile WITH SAVE FIX ***
  const handleLoadGameFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result;
            if (typeof text === 'string') {
                const loadedJson = JSON.parse(text);
                
                // *** ENHANCED VALIDATION với logging ***
                console.log("Loading save file with:", {
                    hasWorldData: !!loadedJson.worldData,
                    hasKnownEntities: !!loadedJson.knownEntities,
                    hasGameHistory: !!loadedJson.gameHistory,
                    hasChoices: !!loadedJson.choices,
                    hasStoryLog: !!loadedJson.storyLog,
                    choicesCount: loadedJson.choices?.length || 0,
                    storyLogCount: loadedJson.storyLog?.length || 0
                });
                
                // Basic validation
                if (loadedJson.worldData && loadedJson.knownEntities && loadedJson.gameHistory) {
                    const pc = Object.values(loadedJson.knownEntities).find((e: any) => e.type === 'pc');
                    
                    // *** ENHANCED validatedData với choices và storyLog ***
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
                        // Support cho compressed history
                        compressedHistory: loadedJson.compressedHistory || [],
                        lastCompressionTurn: loadedJson.lastCompressionTurn || 0,
                        historyStats: loadedJson.historyStats || {
                            totalEntriesProcessed: 0,
                            totalTokensSaved: 0,
                            compressionCount: 0
                        },
                        cleanupStats: loadedJson.cleanupStats || {
                            totalCleanupsPerformed: 0,
                            totalTokensSavedFromCleanup: 0,
                            lastCleanupTurn: 0,
                            cleanupHistory: []
                        },
                        
                        // *** THÊM SUPPORT CHO CHOICES VÀ STORYLOG ***
                        choices: loadedJson.choices || [],          // Lưu choices từ save file
                        storyLog: loadedJson.storyLog || []         // Lưu storyLog từ save file
                    };
                    
                    // Cleanup legacy field
                    delete (validatedData as any).userKnowledge;
                    
                    console.log("Save loaded successfully:", {
                        choicesLoaded: validatedData.choices?.length || 0,
                        storyLogLoaded: validatedData.storyLog?.length || 0,
                        turnCount: validatedData.turnCount
                    });

                    setGameState(validatedData);
                    setView('game');
                } else {
                    console.error("Invalid save file structure:", {
                        hasWorldData: !!loadedJson.worldData,
                        hasKnownEntities: !!loadedJson.knownEntities,
                        hasGameHistory: !!loadedJson.gameHistory
                    });
                    alert('Tệp lưu không hợp lệ. Thiếu dữ liệu cần thiết (worldData, knownEntities, gameHistory).');
                }
            }
        } catch (error) {
            console.error('Lỗi khi tải tệp:', error);
            alert(`Không thể đọc tệp lưu. Chi tiết lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
              return gameState ? (
                  <ErrorBoundary>
                      <GameScreen 
                          initialGameState={gameState} 
                          onBackToMenu={navigateToMenu} 
                          fontFamily={fontFamily}
                          fontSize={fontSize}
                          keyRotationNotification={keyRotationNotification}
                          onClearNotification={() => setKeyRotationNotification(null)}
                      />
                  </ErrorBoundary>
              ) : (
                  <MainMenu 
                      onStartNewAdventure={navigateToCreateWorld} 
                      onOpenApiSettings={openApiSettings} 
                      onLoadGameFromFile={handleLoadGameFromFile} 
                      isUsingDefaultKey={isUsingDefaultKey} 
                      onOpenChangelog={openChangelog}
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
                      onOpenChangelog={openChangelog}
                  />
              );
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
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-2 sm:p-4 font-sans text-slate-900 dark:text-white antialiased pb-4 bg-slate-100 dark:bg-slate-900 transition-colors duration-500">
        {renderContent()}
        {view === 'game' && <CustomizationFooter fontFamily={fontFamily} setFontFamily={setFontFamily} fontSize={fontSize} setFontSize={setFontSize} />}
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
      </div>
    </AIContext.Provider>
  );
}