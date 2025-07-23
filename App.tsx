


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

3. **VỊ TRÍ VÀ DI CHUYỂN:**
   - Khi nhân vật di chuyển: \`[ENTITY_UPDATE: name="TênPC", location="Địa điểm mới"]\`
   - Khi khám phá địa điểm mới: \`[LORE_LOCATION: name="Tên địa điểm", description="Mô tả chi tiết"]\`

**B. CHỦ ĐỘNG TẠO TRẠNG THÁI:**
--- HƯỚNG DẪN THẺ LỆNH CHI TIẾT (CẬP NHẬT) ---

**B. CHỦ ĐỘNG TẠO TRẠNG THÁI - QUAN TRỌNG:**

⚠️ **QUY TẮC BẮT BUỘC:** Khi bạn mention trạng thái của bất kỳ nhân vật nào trong văn bản, bạn PHẢI tạo status command tương ứng!

**Ví dụ ĐÚNG:**
- Văn bản: "**Thục Nhi**, đôi mắt nàng đã gần như lờ đờ vì mệt mỏi. Nàng vẫn trong trạng thái 'Kiệt Sức Nặng'"
- Command: \`[STATUS_APPLIED_NPC: name="Kiệt Sức Nặng", description="Đôi mắt lờ đờ, cực kỳ mệt mỏi", type="debuff", duration="4 giờ", source="Lao động quá sức", npcName="Thục Nhi"]\`

**Bạn PHẢI chủ động áp dụng trạng thái trong các tình huống sau:**

### **CHO PC (Người chơi):**
- **Sau chiến đấu:** Vết thương, mệt mỏi, đau đớn
- **Môi trường khắc nghiệt:** Lạnh, nóng, ẩm ướt, độc hại
- **Hoạt động lâu dài:** Mệt mỏi, đói khát
- **Tương tác xã hội:** Stress, hứng thú, tức giận
- **Sử dụng kỹ năng:** Buff tạm thời, debuff từ overuse

**Ví dụ cho PC:**
\`[STATUS_APPLIED_SELF: name="Mệt Mỏi Nhẹ", description="Cảm thấy hơi mệt sau cuộc hành trình", type="debuff", duration="2 giờ", source="Di chuyển lâu"]\`

### **CHO NPC - ĐẶC BIỆT QUAN TRỌNG:**
- **Khi mention trạng thái trong text:** LUÔN tạo status command
- **Tương tác với PC:** NPCs bị ảnh hưởng bởi hành động PC
- **Chiến đấu:** NPCs cũng nhận damage, buff, debuff
- **Môi trường:** NPCs chịu ảnh hưởng giống PC
- **Cảm xúc:** NPCs có thể tức giận, vui mừng, sợ hãi

**Ví dụ cho NPC:**
\`[STATUS_APPLIED_NPC: name="Kiệt Sức Nặng", description="Cực kỳ mệt mỏi, đôi mắt lờ đờ", type="debuff", duration="4 giờ", source="Lao động quá sức", npcName="Thục Nhi"]\'

\`[STATUS_APPLIED_NPC: name="Tức Giận", description="Tức giận vì bị xúc phạm", type="debuff", duration="1 giờ", source="Mâu thuẫn với PC", npcName="Lão Trương"]\`

### **QUY TẮC ĐỒNG BỘ HÓA:**
1. **Nếu viết trong text rằng ai đó có trạng thái X** → PHẢI có command tạo status X
2. **Không được viết trạng thái mà không tạo command**
3. **Tên status trong text và command PHẢI giống nhau**
4. **Duration phải realistic:** Vết thương nặng = vài ngày, mệt mỏi = vài giờ
5. **Type phải chính xác:** injury cho chấn thương, debuff cho tiêu cực, buff cho tích cực

### **TEMPLATE COMMANDS:**

**Cho PC:**
```
\'[STATUS_APPLIED_SELF: name="Tên Status", description="Mô tả chi tiết", type="buff/debuff/injury/neutral", duration="thời gian", source="nguyên nhân"]\'
```

**Cho NPC:**
```
\'[STATUS_APPLIED_NPC: name="Tên Status", description="Mô tả chi tiết", type="buff/debuff/injury/neutral", duration="thời gian", source="nguyên nhân", npcName="Tên chính xác của NPC"]\'
```

### **CHECKLIST BẮT BUỘC TRƯỚC KHI GỬI RESPONSE:**
- [ ] Đã check tất cả mentions về trạng thái trong text?
- [ ] Đã tạo STATUS command cho mỗi mention?
- [ ] npcName có chính xác 100%?
- [ ] Tên status trong text = tên trong command?
- [ ] Duration và type có reasonable?

**LƯU Ý QUAN TRỌNG:**
- `npcName` PHẢI chính xác 100% giống tên NPC trong hệ thống
- Nếu viết "Thục Nhi có trạng thái X" → npcName="Thục Nhi" (chính xác)
- Không được viết npcName="Cô Thục Nhi" hay "nàng" hay "cô ấy"
- Luôn sử dụng tên gốc của NPC như đã định nghĩa

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
- Tạo 4-5 lựa chọn đa dạng: hành động, xã hội, thăm dó, chiến đấu
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

**1. LỜI KỂ:**
- 150-250 từ, chi tiết và sống động
- Sử dụng \`...\` cho suy nghĩ nội tâm
- \`**⭐...⭐**\` cho thông báo quan trọng

**2. MÔ TẢ HÀNH ĐỘNG:**
- Mô tả hậu quả rõ ràng
- Phản ứng của môi trường và NPCs
- Thay đổi trạng thái và hoàn cảnh

**3. NSFW (KHI ĐƯỢỢC BẬT):**
- Chủ động tạo 2+ lựa chọn 18+ đánh dấu \`(NSFW)\`
- Mô tả cực kỳ chi tiết, trần trụi
- Tạo trạng thái liên quan đến tình dục/bạo lực

--- LƯU Ý QUAN TRỌNG ---

**BẮT BUỘC PHẢI LÀM:**
1. Sử dụng \`[TIME_ELAPSED]\` và \`[CHRONICLE_TURN]\` mỗi lượt
2. Tạo trạng thái phù hợp với tình huống
3. Cập nhật vị trí khi di chuyển
4. Tạo NPCs, vật phẩm, địa điểm mới khi cần
5. Phản hồi với thế giới sống động

**KHÔNG ĐƯỢC:**
1. Bỏ qua việc sử dụng thẻ lệnh
2. Để trống thuộc tính \`description\` khi tạo thực thể
3. Giải quyết chiến đấu trong một lượt
4. Làm cho thế giới tĩnh lặng, chờ đợi

**KIỂM TRA CUỐI LƯỢT (MANDATORY CHECKLIST):**

Trước khi hoàn thành phản hồi, hãy tự kiểm tra theo thứ tự:

1. **✓ BẮT BUỘC - TIME_ELAPSED:** Đã sử dụng với giá trị phù hợp?
2. **✓ BẮT BUỘC - CHRONICLE_TURN:** Đã tóm tắt sự kiện chính?
3. **✓ STATUS CHECK:** Có tình huống nào cần tạo status không? (Rule 80/20)
4. **✓ LOCATION CHECK:** PC có di chuyển không? Có địa điểm mới nào không?
5. **✓ ENTITY CHECK:** Có NPCs, items, skills mới nào cần tạo không?
6. **✓ INTERACTION CHECK:** Có NPCs nào cần cập nhật relationship không?
7. **✓ QUEST CHECK:** Có objectives nào hoàn thành không? Cần quest mới không?
8. **✓ WORLD REACTION:** Thế giới có phản ứng sống động với hành động PC không?
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
