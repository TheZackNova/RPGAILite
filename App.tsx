import React, { useState, useEffect, useMemo, createContext } from 'react';
import { GoogleGenAI } from "@google/genai";
import { MainMenu } from './components/MainMenu.tsx';
import { CreateWorld } from './components/CreateWorld.tsx';
import { GameScreen } from './components/game/index.tsx';
import { ApiSettingsModal } from './components/ApiSettingsModal.tsx';
import { ChangelogModal } from './components/ChangelogModal.tsx';
import { CustomizationFooter } from './components/CustomizationFooter.tsx';
import type { SaveData, Entity, AIContextType, FormData, CustomRule } from './components/types.ts';
import { CHANGELOG_DATA } from './components/data/changelog.ts';

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

--- 🚨 CRITICAL: STATUS TAG FORMAT REQUIREMENTS ---

**CHÚ Ý QUAN TRỌNG VỀ TRẠNG THÁI NPC:**

Khi áp dụng trạng thái cho NPC, BẮT BUỘC phải sử dụng format sau:

**✅ ĐÚNG - Cho NPC:**
\`[STATUS_APPLIED_NPC: npcName="Tên NPC Chính Xác", name="Tên Trạng Thái", description="Mô tả", type="buff/debuff/neutral/injury", duration="thời gian", source="nguồn gốc"]\`

**❌ SAI - TUYỆT ĐỐI KHÔNG DÙNG:**
\`[STATUS_APPLIED_SELF: ...]\` cho NPC
\`[STATUS_APPLIED_NPC: target="Tên NPC", ...]\` (thiếu npcName)

**📝 VÍ DỤ CỤ THỂ:**
- NPC tên "Thục Nhi" bị thương:
\`[STATUS_APPLIED_NPC: npcName="Thục Nhi", name="Kiệt Sức Nặng", description="Cơ thể kiệt sức sau trận chiến", type="debuff", duration="1 ngày", source="Chiến đấu"]\`

- NPC tên "Lý Bạch" được buff:
\`[STATUS_APPLIED_NPC: npcName="Lý Bạch", name="Tăng Sức Mạnh", description="Sức mạnh tăng cường", type="buff", duration="2 giờ", source="Thuốc bổ"]\`

**🔍 DEBUGGING RULES:**
- npcName phải CHÍNH XÁC trùng với tên NPC (case-sensitive)
- KHÔNG được dùng spaces thừa
- KHÔNG được viết tắt tên NPC

--- HƯỚNG DẪN THẺ LỆNH CHI TIẾT ---

**A. LUÔN LUÔN SỬ DỤNG CÁC THẺ SAU:**

1. **TIME_ELAPSED (BẮT BUỘC MỖI LƯỢT):**
   \`[TIME_ELAPSED: hours=X, days=X, months=X, years=X]\`
   - Thậm chí nếu chỉ vài phút, hãy dùng hours=0
   - Ví dụ: Cuộc trò chuyện ngắn = hours=0, Đi bộ = hours=1, Chiến đấu = hours=2

2. **CHRONICLE_TURN (BẮT BUỘC MỖI LƯỢT):**
   \`[CHRONICLE_TURN: text="Tóm tắt ngắn gọn sự kiện chính của lượt này"]\`

3. **VỊ TRÍ VÀ DI CHUYỂN:**
   - Khi nhân vật di chuyển: \`[ENTITY_UPDATE: name="TênPC", location="Địa điểm mới"]\`
   - Khi khám phá địa điểm mới: \`[LORE_LOCATION: name="Tên địa điểm", description="Mô tả chi tiết"]\`

**B. CHỦ ĐỘNG TẠO TRẠNG THÁI:**

Bạn PHẢI chủ động áp dụng trạng thái trong các tình huống sau:
- **Sau chiến đấu:** Vết thương, mệt mỏi, đau đớn
- **Môi trường khắc nghiệt:** Lạnh, nóng, ẩm ướt, độc hại
- **Hoạt động lâu dài:** Mệt mỏi, đói khát
- **Tương tác xã hội:** Stress, hứng thú, tức giận
- **Sử dụng kỹ năng:** Buff tạm thời, debuff từ overuse

**Ví dụ trạng thái cần tạo:**
\`[STATUS_APPLIED_SELF: name="Mệt Mỏi Nhẹ", description="Cảm thấy hơi mệt sau cuộc hành trình", type="debuff", duration="2 giờ", source="Di chuyển lâu"]\`

\`[STATUS_APPLIED_SELF: name="Tăng Cường Thể Lực", description="Cơ thể được tăng cường sau khi luyện tập", type="buff", duration="1 ngày", source="Luyện võ"]\`

**TRẠNG THÁI CHO NPC (FORMAT CHÍNH XÁC):**
\`[STATUS_APPLIED_NPC: npcName="Tên NPC CHÍNH XÁC", name="Tên trạng thái", description="Mô tả", type="buff/debuff/neutral/injury", duration="thời gian", source="nguồn"]\`

**C. TẠO VÀ CẬP NHẬT THỰC THỂ:**

1. **NPCs mới:**
\`[LORE_NPC: name="Tên NPC", description="Mô tả chi tiết", gender="Nam/Nữ", age="25", appearance="Dung mạo", motivation="Động cơ", location="Vị trí", personalityMbti="ENTJ", skills="Kỹ năng 1,Kỹ năng 2"]\`

2. **Vật phẩm mới:**
\`[LORE_ITEM: name="Tên vật phẩm", description="Mô tả", usable=true, equippable=false, durability=100]\`

3. **Kỹ năng mới:**
\`[SKILL_LEARNED: name="Tên kỹ năng", description="Mô tả", realm="Cảnh giới nếu có"]\`

**D. NHIỆM VỤ VÀ QUEST:**

Chủ động tạo quest mới và cập nhật quest hiện tại:
\`[QUEST_ASSIGNED: title="Tên nhiệm vụ", description="Mô tả", objectives="Mục tiêu 1;Mục tiêu 2", giver="Người giao", reward="Phần thưởng", isMainQuest=false]\`

--- QUY TẮC TƯƠNG TÁC ---

**1. LỰAN CHỌN HÀNH ĐỘNG:**
- Tạo 4-5 lựa chọn đa dạng: hành động, xã hội, thăm dò, chiến đấu
- Tận dụng kỹ năng và vật phẩm của nhân vật
- Có lựa chọn rủi ro cao/thưởng cao

**2. KẾT QUẢ HÀNH ĐỘNG:**
- KHÔNG đảm bảo thành công
- Sử dụng RNG ẩn để quyết định kết quả
- Hậu quả logic dựa trên kỹ năng và hoàn cảnh

**3. CHIẾN ĐẤU:**
- Theo từng lượt, không giải quyết nhanh
- Kẻ địch cũng có hành động và trạng thái
- Mô tả chi tiết và tạo tension

**4. THẾ GIỚI PHẢN ỨNG:**
- NPCs phản ứng với hành động của PC
- Môi trường thay đổi theo thời gian
- Sự kiện ngẫu nhiên và tình huống bất ngờ

--- ĐỊNH DẠNG VĂN BẢN ---

**1. SỬ DỤNG MARKDOWN:**
- **In đậm** cho nhấn mạnh
- *In nghiêng* cho suy nghĩ
- > Trích dẫn cho lời nói

**2. TẠO TENSION:**
- Sử dụng "..." để tạo dấu chấm lửng
- Mô tả chi tiết môi trường và cảm xúc
- Thêm âm thanh và chi tiết cảm quan

**3. CẤU TRÚC:**
- Mở đầu: Tình huống hiện tại
- Phát triển: Hành động và phản ứng
- Kết thúc: Kết quả và setup cho lượt tiếp theo

--- CHECKLIST QUALITY CONTROL ---

Trước khi gửi response, kiểm tra từng điểm:

**MANDATORY CHECKS (BẮT BUỘC):**
1. **✓ TIME_ELAPSED:** Có dùng thẻ TIME_ELAPSED không?
2. **✓ CHRONICLE_TURN:** Có tóm tắt lượt không?
3. **✓ STATUS CREATION:** Có tạo ít nhất 1 status effect không? (80% rule)
4. **✓ WORLD BUILDING:** Có thêm chi tiết thế giới mới không?
5. **✓ NPC REACTIONS:** NPCs có phản ứng thực tế không?
6. **✓ CONSEQUENCE:** Hành động có hậu quả logic không?
7. **✓ TAG VALIDATION:** Tất cả tags có format đúng không?
8. **✓ ENTITY UPDATES:** Có cập nhật vị trí/trạng thái entities không?
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

**LƯU Ý QUAN TRỌNG VỀ STATUS TAGS:**
1. **LUÔN kiểm tra tên NPC chính xác trước khi sử dụng STATUS_APPLIED_NPC**
2. **KHÔNG bao giờ dùng STATUS_APPLIED_SELF cho NPC**
3. **npcName attribute là BẮT BUỘC trong STATUS_APPLIED_NPC**
4. **Tên trong npcName phải trùng CHÍNH XÁC với tên entity**

**FINAL REMINDER:**
"Bạn là người kể chuyện CHỦ ĐỘNG và sáng tạo. Thế giới phải SỐNG và PHẢN ỨNG với mọi hành động. Không bao giờ để game trở nên tĩnh lặng hay nhàm chán!

BẠN PHẢI tuân thủ TUYỆT ĐỐI các quy tắc về format thẻ STATUS. Việc sử dụng sai format sẽ gây lỗi hệ thống và phá hỏng trải nghiệm game."`;

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
          apiKeyError: "API Key không hợp lệ."
        };
      }
  }, [activeKey]);

  // --- Persistence ---
  useEffect(() => {
    localStorage.setItem('userApiKeys', JSON.stringify(userApiKeys));
  }, [userApiKeys]);

  useEffect(() => {
    localStorage.setItem('activeUserApiKeyIndex', activeUserApiKeyIndex.toString());
  }, [activeUserApiKeyIndex]);

  useEffect(() => {
    localStorage.setItem('isUsingDefaultKey', isUsingDefaultKey.toString());
  }, [isUsingDefaultKey]);

  // --- API Key Management ---
  const handleSaveApiKeys = (keys: string[], useDefault: boolean) => {
    setUserApiKeys(keys);
    setIsUsingDefaultKey(useDefault);
    
    if (!useDefault && keys.length > 0) {
      setActiveUserApiKeyIndex(0);
    }
  };

  const handleUseDefaultKey = () => {
    setIsUsingDefaultKey(true);
  };

  const handleRotateKey = () => {
    if (isUsingDefaultKey || userApiKeys.length <= 1) {
      return; // Can't rotate with only one key
    }

    const nextIndex = (activeUserApiKeyIndex + 1) % userApiKeys.length;
    setActiveUserApiKeyIndex(nextIndex);
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
                        storyLog: loadedJson.storyLog,
                        choices: loadedJson.choices,
                        locationDiscoveryOrder: loadedJson.locationDiscoveryOrder,
                        // Thêm support cho compressed history
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
