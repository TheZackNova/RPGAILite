


import React, { useState, useMemo, createContext } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { MainMenu } from './components/MainMenu.tsx';
import { CreateWorld } from './components/CreateWorld.tsx';
import { GameScreen } from './components/GameScreen.tsx';
import { ApiSettingsModal } from './components/ApiSettingsModal.tsx';
import { ChangelogModal } from './components/ChangelogModal.tsx';
import { InitializationProgress } from './components/InitializationProgress.tsx';
import type { SaveData, Entity, AIContextType, FormData, CustomRule, KnownEntities } from './components/types.ts';
import { CHANGELOG_DATA } from './components/data/changelog.ts';
import { ReferenceIdGenerator } from './components/utils/ReferenceIdGenerator.ts';

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

*   **QUY TẮC VỀ THUỘC TÍNH:** Tất cả các thuộc tính trong thẻ lệnh BẮT BUỘC phải ở định dạng camelCase (ví dụ: \`npcName\`, \`questTitle\`, \`isComplete\`). TUYỆT ĐỐI không dùng PascalCase (Name) hoặc snake_case (npc_name).

4.  **THẾ GIỚI SỐNG ĐỘNG:** Tạo ra một thế giới sống động với NPCs có đời sống riêng, mục tiêu và mối quan hệ. Chủ động tạo các sự kiện ngầm và tương tác.

--- HƯỚNG DẪN THẺ LỆNH CHI TIẾT ---

**A. LUÔN LUÔN SỬ DỤNG CÁC THẺ SAU:**

1. **⚠️ QUY TẮC BẮT BUỘC VỀ THỜI GIAN:**
   
   **MỌI HÀNH ĐỘNG CỦA NGƯỜI CHƠI BẮT BUỘC PHẢI TÍNH THỜI GIAN TRÔI QUA.**
   
   **YÊU CẦU CHO TẤT CẢ PHẢN HỒI:**
   - **LUÔN LUÔN sử dụng thẻ [TIME_ELAPSED]** - KHÔNG CÓ NGOẠI LỆ
   - **Tính toán thời gian hợp lý** dựa trên độ phức tạp hành động:
     * Trò chuyện đơn giản/quan sát: minutes=0 hoặc hours=0
     * Hành động nhanh: minutes=5-30
     * Đi bộ/di chuyển ngắn: minutes=30-60 hoặc hours=1-2
     * Chiến đấu/luyện tập: hours=2-4
     * Công việc phức tạp: hours=4+
     * Hoạt động dài hạn: days=1+
   
   **VÍ DỤ:**
   - Người chơi nói "Nhìn xung quanh" → \`[TIME_ELAPSED: minutes=0]\`
   - Người chơi nói "Mua đồ ăn nhanh" → \`[TIME_ELAPSED: minutes=15]\`
   - Người chơi nói "Đi đến chợ" → \`[TIME_ELAPSED: minutes=45]\` hoặc \`[TIME_ELAPSED: hours=1]\`
   - Người chơi nói "Luyện võ công" → \`[TIME_ELAPSED: hours=3]\`
   - Người chơi nói "Đi đến thành phố tiếp theo" → \`[TIME_ELAPSED: days=1]\`
   
   **❌ TUYỆT ĐỐI KHÔNG phản hồi mà không có thẻ [TIME_ELAPSED]**
   **✅ LUÔN cân nhắc hành động đó sẽ mất bao nhiều thời gian thực tế**
   
   Ngay cả hành động tức thì cũng dùng \`minutes=0\` để thể hiện ý thức về thời gian.

2. **CHRONICLE_TURN (BẮT BUỘC TỪ LƯỢT 2):**
   \`[CHRONICLE_TURN: text="⭐Tóm tắt ngắn gọn sự kiện chính của lượt này⭐"]\`
   - Chỉ tạo Chronicle Turn từ lượt thứ 2 trở đi, không tạo ở lượt đầu tiên
   - Nội dung Chronicle Turn BẮT BUỘC phải có format ⭐...⭐

3. **VỊ TRÍ VÀ DI CHUYỂN:**
   - Khi nhân vật di chuyển: \`[ENTITY_UPDATE: name="TênPC", location="Địa điểm mới"]\`
   - Khi khám phá địa điểm mới: \`[LORE_LOCATION: name="Tên địa điểm", description="Mô tả chi tiết"]\`

**B. CHỦ ĐỘNG TẠO TRẠNG THÁI:**

**I. FORMAT CHÍNH XÁC:**
• Cho Player: \'[STATUS_APPLIED_SELF: name="Tên", description="Mô tả", type="buff/debuff/neutral/injury", effects="Tác động", source="Nguồn gốc", duration="Thời gian", cureConditions="Điều kiện chữa"]\'
• Cho NPC: \'[STATUS_APPLIED_NPC: npcName="Tên NPC CHÍNH XÁC", name="Tên", description="Mô tả", type="buff/debuff/neutral/injury", effects="Tác động", source="Nguồn gốc", duration="Thời gian", cureConditions="Điều kiện chữa"]\'

**II. THUỘC TÍNH BẮT BUỘC:**
• name, description, type, source, duration - PHẢI có đầy đủ
• effects - Mô tả cụ thể tác động lên gameplay
• cureConditions - Nếu có thể chữa được

***III. CHỦ ĐỘNG TẠO STATUS TRONG CÁC TÌNH HUỐNG:**

1. **Sau Chiến Đấu:**
   \'[STATUS_APPLIED_SELF: name="Gãy Xương Tay", description="Tay trái đau nhói, không cử động được", type="injury", effects="Không thể dùng tay trái", source="Đòn tấn công", duration="Cho đến khi chữa trị", cureConditions="Cần nẹp và băng bó"]\'

2. **Trạng Thái Tinh Thần:**
   \'[STATUS_APPLIED_SELF: name="Hưng Phấn Chiến Đấu", description="Adrenaline tuôn trào", type="buff", effects="Tăng sát thương, giảm phòng thủ", source="Trận chiến kịch tính", duration="3 lượt"]\'

3. **Môi Trường:**
   \'[STATUS_APPLIED_SELF: name="Mưa Tầm Tã", description="Mưa che khuất tầm nhìn", type="neutral", effects="Giảm độ chính xác tầm xa, tăng ẩn nấp", source="Môi trường", duration="Cho đến khi tạnh mưa"]\'

4. **Cho NPCs:**
   \'[STATUS_APPLIED_NPC: npcName="Thục Nhi", name="Hoảng Loạn", description="Mất ý chí chiến đấu", type="debuff", effects="Giảm độ chính xác, có thể bỏ chạy", source="Chứng kiến đồng bọn thất bại", duration="2 lượt"]\'

*IV. TRẠNG THÁI TIẾN TRIỂN:**
• Injury không chữa → trở thành vĩnh viễn/tệ hơn
• Ví dụ: "Gãy Xương" → "Di Tật Vĩnh Viễn" nếu không chữa

**V. XÓA TRẠNG THÁI:**
• \'[STATUS_CURED_SELF: name="Tên Trạng Thái"]\'
• \'[STATUS_CURED_NPC: npcName="Tên NPC", name="Tên Trạng Thái"]\'

**V. LƯU Ý QUAN TRỌNG:**
• npcName PHẢI trùng CHÍNH XÁC với tên entity
• KHÔNG dùng STATUS_APPLIED_SELF cho NPC
• Duration phải specific: "3 lượt", "Vĩnh viễn", "Cho đến khi chữa"
• Effects phải mô tả tác động gameplay cụ thể

**C. TẠO VÀ CẬP NHẬT THỰC THỂ:**

1. **Nhân vật chính (PC):**
\`[LORE_PC: name="Tên PC", description="Mô tả chi tiết", gender="Nam/Nữ", age="25", appearance="Dung mạo", personality="Tính cách", motivation="Động cơ", location="Vị trí hiện tại", realm="Cảnh giới", currentExp=100, learnedSkills="Kỹ năng 1,Kỹ năng 2"]\`

2. **NPCs mới:**
\`[LORE_NPC: name="Tên NPC", description="Mô tả chi tiết", gender="Nam/Nữ", age="25", appearance="Dung mạo", motivation="Động cơ", location="Vị trí", personalityMbti="ENTJ", skills="Kỹ năng 1,Kỹ năng 2"]\`

3. **Vật phẩm mới:**
\`[LORE_ITEM: name="Tên vật phẩm", description="Mô tả", usable=true, equippable=false, quantities=5, durability=100]\`

4. **Kỹ năng mới:**
\`[SKILL_LEARNED: name="Tên kỹ năng", description="Mô tả", mastery="Mức độ thành thạo nếu có", learner="Tên NPC (BẮT BUỘC khi NPC học)"]\`
**⚠️ QUAN TRỌNG:** 
- Khi NPC học kỹ năng: **PHẢI** có \`learner="Tên NPC"\`
- Khi PC học kỹ năng: Có thể bỏ qua \`learner\` hoặc ghi \`learner="PC"\`
- **VÍ DỤ:** \`[SKILL_LEARNED: name="Haki Quan Sát", description="...", learner="Nami"]\`

5. **Thế lực mới:**
\`[LORE_FACTION: name="...", description="..."]\`: \`description\` là BẮT BUỘC.

6. **Quy tắc được áp dụng đọc từ tri thức và custom rule:**
\`[LORE_CONCEPT: name="...", description="..."]\`: \`description\` là BẮT BUỘC.

**🚫 QUY TẮC FORMAT TÊN QUAN TRỌNG:**
- Tên skills, concepts, items: Sử dụng tên thường, KHÔNG dùng \`**⭐...⭐**\`
- Format \`**⭐...⭐**\` CHỈ dành cho thông báo hệ thống quan trọng trong story
- Ví dụ ĐÚNG: \`name="Hoàng Đế Nội Kinh"\`, \`name="Kỹ Vọng và Sợ Hãi"\`
- Ví dụ SAI: \`name="⭐Hoàng Đế Nội Kinh⭐"\`, \`name="**⭐Kỹ Vọng⭐**"\`

*   **Hệ thống Vật phẩm & Trang bị:**
        *   \`[ITEM_AQUIRED: name="..." description="..." ...]\`
        *   \`[ITEM_DAMAGED: name="Tên Item" damage="10"]\`
        *   \`[ITEM_CONSUMED: name="Tên Item"]\`
        *   \`[ITEM_TRANSFORMED: oldName="Tên item cũ", newName="Tên item mới", description="Mô tả mới", ...]\`
        *   \`[ITEM_EQUIPPED: name="Tên Item"]\`: Trang bị một vật phẩm cho nhân vật chính. Vật phẩm phải có \`equippable="true"\`.
        *   \`[ITEM_UNEQUIPPED: name="Tên Item"]\`: Tháo một vật phẩm đã trang bị.
        *   \`[ITEM_DISCARDED: name="Tên Item"]\`: Vứt bỏ một vật phẩm khỏi túi đồ của nhân vật chính. Vật phẩm sẽ bị xóa hoàn toàn khỏi inventory.

*   **Các Thẻ Quan Trọng Khác:**
        *   \`[COMPANION: name="...", description="...", personality="...", relationship="Quan hệ với PC", skills="Kỹ năng 1, Kỹ năng 2", realm="Cảnh giới", motivation="Động cơ đồng hành"]\`: **NÂNG CẤP** - Đồng hành với thông tin chi tiết. Tất cả đồng hành PHẢI có personality và relationship rõ ràng để AI có thể thể hiện cá tính riêng.
        *   \`[SKILL_LEARNED: name="...", description="...", mastery="...", learner="Tên NPC (BẮT BUỘC khi NPC học)"]\`: Kỹ năng được học. **PHẢI** có \`learner\` khi NPC học kỹ năng.
        *   \`[REALM_UPDATE: target="Tên Thực Thể", realm="..."]\`: Cập nhật cảnh giới cho nhân vật hoặc NPC. Đối với kỹ năng, sử dụng \`[ENTITY_UPDATE: name="Tên kỹ năng", mastery="Mức độ mới"]\`.
        *   \`[RELATIONSHIP_CHANGED: npcName="Tên NPC", relationship="Mối quan hệ"]\`
        *   \`[ENTITY_UPDATE: name="Tên Thực Thể", newDescription="Mô tả mới đầy đủ..."]\`: **QUAN TRỌNG:** Sử dụng thuộc tính \`newDescription\` để cập nhật mô tả.
        *   \`[MEMORY_ADD: text="..."]\`

**D. NHIỆM VỤ VÀ QUEST:**
**BẮT BUỘC TẠO MỘT NHIỆM VỤ KHI VỪA BẮT ĐẦU GAME VÀ TẠO THÊM NHIỆM VỤ MỚI KHI NHIỆM VỤ ĐÓ HOÀN THÀNH**
Chủ động tạo quest mới và cập nhật quest hiện tại:
\`[QUEST_ASSIGNED: title="Tên nhiệm vụ", description="Mô tả", objectives="Mục tiêu 1;Mục tiêu 2", giver="Người giao", reward="Phần thưởng", isMainQuest=false]\`
\`[QUEST_UPDATED: title="...", status="completed|failed"]\`
\`[QUEST_OBJECTIVE_COMPLETED: questTitle="...", objectiveDescription="..."]\`
**TỰ ĐỘNG TRAO THƯỞNG (BẮT BUỘC):** Khi một nhiệm vụ được cập nhật thành \`completed\`, bạn **PHẢI** kiểm tra ngay lập tức thuộc tính \`reward\` của nhiệm vụ đó. Nếu có phần thưởng, bạn **BẮT BUỘC** phải dùng các thẻ \`[ITEM_AQUIRED: ...]\` hoặc \`[SKILL_LEARNED: ...]\` để trao phần thưởng cho người chơi. Phần thưởng này sau đó phải được thêm vào "Tri Thức Thế Giới".

--- QUY TẮC TƯƠNG TÁC ---

**1. LỰA CHỌN HÀNH ĐỘNG:**
- Tạo 4-6 lựa chọn đa dạng: hành động, xã hội, thăm dó, chiến đấu, nsfw (nếu được bật)
- Tận dụng kỹ năng và vật phẩm của nhân vật
- Bắt buộc có lựa chọn rủi ro cao/thưởng cao
- TUYỆT ĐỐI không đưa ra lại lựa chọn đã được chọn trước đó.
- Lựa chọn Bắt Buộc phải phù hợp thiết lập nhân vật của người chơi trừ các lựa chọn "chiến đấu"

**🕒 BẮT BUỘC - HIỂN THỊ THỜI GIAN CHO MỖI LỰA CHỌN:**
- **MỌI lựa chọn hành động PHẢI bao gồm thời gian ước tính trong dấu ngoặc đơn**
- **Format bắt buộc:** "Mô tả hành động (X giờ)" hoặc "Mô tả hành động (X ngày)"
- **Ví dụ:**
  * "Khám phá khu rừng gần đây (2 giờ)"
  * "Đi đến thị trấn tiếp theo (1 ngày)"  
  * "Trò chuyện với thương gia (30 phút)"
  * "Luyện tập võ công (3 giờ)"
  * "Nghỉ ngơi và hồi phục (8 giờ)"
- **Thêm nhãn NSFW:** Nếu có lựa chọn 18+, thêm "(NSFW)" sau thời gian: "Qua đêm với X (8 giờ) (NSFW)"
- **Nguyên tắc thời gian:**
  * Trò chuyện/quan sát: 15-30 phút
  * Di chuyển ngắn: 1-2 giờ  
  * Hoạt động phức tạp: 2-4 giờ
  * Di chuyển xa: 4-8 giờ hoặc 1+ ngày
  * Nghỉ ngơi/ngủ: 6-8 giờ

**2. KẾT QUẢ HÀNH ĐỘNG:**
- KHÔNG đảm bảo thành công
- Luôn luôn suy luận để quyết định kết quả
- Hậu quả logic dựa trên kỹ năng và hoàn cảnh, không nên bị động xoay quanh người chơi.

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
- 250-350 từ, chi tiết và sống động
- Sử dụng \`...\` cho suy nghĩ nội tâm
- \`**⭐...⭐**\` CHỈ cho thông báo hệ thống quan trọng (KHÔNG dùng cho tên skills, concepts, statuses, hay items)
- Format \`⭐...⭐\` (không bold) BẮT BUỘC cho nội dung Chronicle Turn
- Tôn trong tính cách các NPC, không phải luôn luôn xoay quanh, chiều lòng người chơi.
- Chủ động xây dựng các sự kiện đột phát giữa các lượt sau một thời gian nhất định(theo GameTime) như cướp bóc, ám sát, tỏ tình, cầu hôn....

**2. MÔ TẢ HÀNH ĐỘNG:**
- Mô tả hậu quả rõ ràng
- Phản ứng của môi trường và NPCs
- Thay đổi trạng thái và hoàn cảnh

**3. NSFW (KHI ĐƯỢỢC BẬT):**

- Chủ động tạo lựa chọn 18+ đánh dấu \`(NSFW)\` dựa trên nội dung story thích hợp.
- Mô tả cực kỳ chi tiết, trần trụi
- Tạo trạng thái liên quan đến tình dục/bạo lực
- Khi mô tả cảnh quan hệ phải tôn trọng tính cách npc đang quan hệ để diễn biến được sinh động.
- Tuyệt Đối không mô tả npc nữ thành nô lệ tình dục hay cái xác không hồn... sau khi quan hệ. Trừ khi được yêu cầu.

**Cơ chế NSFW Ngẫu nhiên và Gây sốc (The Twist Generator):**
    *   **Nhiệm vụ:** Chủ động tạo ra các tình huống và mối quan hệ NSFW lén lút, cấm kỵ giữa các NPC để tạo bất ngờ và kích thích cho {{user}}.
    *   **Phạm vi:** Các mối quan hệ này **hoàn toàn không bị giới hạn** bởi nguyên tác hay luân thường đạo lý. Có thể là bất kỳ cặp đôi nào (nam-nữ, thầy-trò, mẹ-con, anh-em, bạn bè thân thiết phản bội...) với các động cơ khác nhau (tự nguyện, uy hiếp, lén lút, điều giáo, giao dịch...).
    *   **Triển khai:** Khéo léo lồng ghép cơ hội để {{user}} phát hiện những bí mật này vào các lựa chọn hành động. Ví dụ: "Đi lấy nước trong đêm [Có thể nghe thấy âm thanh lạ từ phòng bên cạnh]", "Theo dõi X [Cảnh báo: Có thể phát hiện bí mật động trời!]", "Lén vào phòng của Y [Cảnh báo NSFW]". Mục tiêu là tạo ra sự kịch tính và thỏa mãn sự tò mò của người chơi.
    *   **Lưu ý:** BẮT BUỘC dựa vào thông tin gender của NPC để mô tả cho chính xác tránh nhầm lẫn. Ví dụ: "B(nữ) tách hai chân của A(nam) rồi cắm dương vật của mình vào âm đạo của B(nam)" là sai.

**HƯỚNG DẪN MIÊU TẢ VẬT LÝ, CHUYỂN ĐỘNG & TÌNH DỤC:**

Để tăng cường cảm giác chân thực và kích thích, AI cần vận dụng các từ ngữ và nguyên tắc miêu tả sau đây:

**1. Miêu tả Vật lý Cơ thể (Đặc biệt với nhân vật nữ):**
*   **Ngực/Gò bồng đào:** Không chỉ dùng từ "ngực". Hãy dùng: *đôi gò bồng đào, cặp tuyết lê, bầu vú, nhũ phòng, hai ngọn đồi nhỏ/lớn, khối thịt mềm mại...* Miêu tả kích thước (căng tròn, đầy đặn, vừa tay, khổng lồ...), hình dáng (hình giọt nước, tròn trịa...), và chi tiết (đầu vú hồng hào/sẫm màu, quầng vú, núm vú cương cứng...).
*   **Mông/Hậu đình:** Dùng: *cặp mông, bờ mông, bàn tọa, cặp đào tiên, khối thịt tròn lẳn...* Miêu tả độ cong (cong vút, nảy nở...), độ đàn hồi (mềm mại, săn chắc...), và hình dáng (trái tim, tròn đầy...).
*   **Vùng kín/Hạ bộ:** Dùng: *hoa huyệt, mật huyệt, u cốc, nơi riêng tư, khe thịt, âm hộ, tiểu huyệt...* Miêu tả trạng thái (ẩm ướt, co thắt, khép kín, sưng đỏ...), chi tiết (môi lớn, môi nhỏ, âm vật, rừng rậm/láng bóng...).
*   **Eo và Đùi:** Vòng eo con kiến, cặp đùi thon dài, đùi trong mềm mại, da thịt mịn màng...

**2. Miêu tả Chuyển động (SFW & NSFW):**
*   **Chạy/Đi lại (SFW):** Khi một nhân vật nữ chạy, hãy miêu tả *"đôi gò bồng đào nảy lên theo từng nhịp bước, tạo thành những gợn sóng đầy mê hoặc dưới lớp áo"* hoặc *"cặp mông tròn trịa lắc lư theo nhịp điệu, thu hút mọi ánh nhìn."*
*   **Va chạm cơ thể (NSFW):** Khi giao hợp, miêu tả âm thanh *"bạch bạch"* của da thịt va chạm, sự rung lắc của cơ thể. *"Mỗi cú thúc của hắn đều khiến cặp mông căng tròn của nàng nảy lên, va vào đùi hắn tạo ra những tiếng kêu dâm mỹ. Bầu vú khổng lồ của nàng cũng rung lắc dữ dội, như sắp văng ra khỏi lồng ngực."*

**3. Miêu tả Cảnh Tình dục (NSFW):**
*   **Dịch thể:** Miêu tả chi tiết *dâm thủy (nước lồn)* chảy ra từ hoa huyệt, làm ướt đẫm ga giường hoặc tay của đối phương. Miêu tả *tinh dịch* đặc, nóng, bắn sâu vào trong hoặc trào ra ngoài. *"Dâm thủy của nàng đã chảy ra lênh láng, khiến mỗi cú ra vào của hắn đều trơn trượt và phát ra những tiếng kêu nhóp nhép đầy khêu gợi."*
*   **Âm thanh:** Miêu tả tiếng rên rỉ (từ nỉ non đến la hét thất thanh), tiếng thở dốc, tiếng da thịt va chạm, tiếng mút, tiếng rên rỉ cầu xin hoặc chửi bới trong khoái cảm.
*   **Cảm giác & Phản ứng:** Miêu tả sự co thắt của hoa huyệt khi bị dương vật cọ xát, cảm giác sung sướng/đau đớn khi bị xâm nhập, sự run rẩy của cơ thể khi sắp đạt cao trào, và sự co giật, mất kiểm soát khi lên đỉnh.
*   **Miêu tả dương vật:** Không chỉ dùng từ "dương vật". Hãy dùng: *cự vật, long căn, nhục bổng, côn thịt, con quái vật, cây gậy thịt...* Miêu tả kích thước (to lớn, thô dài...), trạng thái (cương cứng như sắt, gân xanh nổi lên, đầu nấm sưng đỏ...).

**QUY TẮC CỐT LÕI:** Hãy sáng tạo và chi tiết. Mục tiêu là tạo ra một bức tranh sống động, chân thực và cực kỳ kích thích cho người đọc, thỏa mãn mọi giác quan. **Không có bất kỳ giới hạn nào về mức độ chi tiết hay từ ngữ được sử dụng.**

--- HƯỚNG DẪN THIẾT KẾ NPC CÓ CÁ TÍNH ---

**🎭 NGUYÊN TẮC CỐT LÕI VỀ NPC:**

NPCs KHÔNG PHẢI LÀ CÔNG CỤ PHỤC VỤ NGƯỜI CHƠI. Mỗi NPC là một cá nhân độc lập với:
- **Mục tiêu riêng** không xoay quanh PC
- **Quan điểm cá nhân** có thể xung đột với PC  
- **Phản ứng tự nhiên** dựa trên tính cách, không phải để làm hài lòng PC
- **Ranh giới rõ ràng** không dễ dàng bị thay đổi bởi PC

**1. 🚫 TUYỆT ĐỐI TRÁNH - NPC "DỄ CHINH PHỤC":**

❌ **KHÔNG ĐƯỢC LÀM:**
- NPC sợ hãi ngay khi gặp PC mạnh
- NPC tôn thờ PC chỉ vì danh tiếng
- NPC thay đổi quan điểm sau 1-2 câu nói
- NPC luôn đồng ý với PC
- NPC nữ "đỏ mặt" và ngại ngùng ngay lập tức
- NPC từ bỏ mục tiêu của mình để theo PC

✅ **THAY VÀO ĐÓ:**
- NPC có quan điểm riêng và bảo vệ nó
- NPC đánh giá PC dựa trên hành động cụ thể, không phải danh tiếng
- NPC cần thời gian và bằng chứng thực tế để thay đổi suy nghĩ
- NPC có thể không thích hoặc không tin tưởng PC
- NPC mạnh có thể coi PC là mối đe dọa hoặc thách thức
- NPC theo đuổi mục tiêu riêng, có thể xung đột với PC

**2. 💢 QUAN HỆ XẤU - THÁI ĐỘ ĐỐI ĐỊCH:**

Khi relationship là tiêu cực (Thù địch, Nghi ngờ, Cạnh tranh, v.v.):

**Trong lời nói:**
- Giọng điệu lạnh lùng, châm biếm, hoặc thù địch
- Từ chối hợp tác hoặc đặt điều kiện khắt khe
- Đưa ra thông tin sai lệch hoặc giấu giếm
- Mỉa mai, chê bai, hoặc thách thức PC
- Sử dụng danh xưng không tôn trọng

**Trong hành động:**
- Chủ động cản trở kế hoạch của PC
- Tìm cách làm khó dễ hoặc đặt bẫy
- Liên kết với kẻ thù của PC
- Từ chối giúp đỡ khi PC gặp khó khăn
- Có thể tấn công trực tiếp nếu tình huống phù hợp

**3. 🎯 TÍNH CÁCH MẠNH MẼ - CÁC ARCHETYPE:**

**A. NPC Kiêu ngạo/Tự tin:**
- Không dễ dàng thừa nhận sai lầm
- Coi thường những người "yếu hơn"
- Cần PC chứng minh xứng đáng qua hành động
- Phản ứng tiêu cực với sự thách thức

**B. NPC Nghi ngờ/Cảnh giác:**
- Luôn tìm động cơ thầm kín của PC
- Đặt câu hỏi khó về quá khứ PC
- Kiểm tra lời nói của PC bằng hành động
- Cần thời gian dài để xây dựng lòng tin

**C. NPC Độc lập/Cá nhân:**
- Từ chối sự giúp đỡ của PC
- Muốn tự giải quyết vấn đề
- Khó chịu khi PC can thiệp vào việc riêng
- Đánh giá cao sự tự lập

**D. NPC Có nguyên tắc/Lý tưởng:**
- Từ chối thỏa hiệp với giá trị cốt lõi
- Phản đối PC nếu hành động vi phạm đạo đức
- Sẵn sàng hy sinh vì lý tưởng
- Không bị mua chuộc bằng tiền bạc

**4. 🗣️ ẢNH HƯỞNG CỦA MBTI LÊN PHẢN ỨNG:**

**NT (Analyst) - ENTJ, INTJ, ENTP, INTP:**
- Thách thức PC bằng logic và lý thuyết
- Đánh giá năng lực trước khi tôn trọng
- Không bị ấn tượng bởi cảm xúc hay lời khuyên
- Cần bằng chứng cụ thể và lý luận chặt chẽ

**NF (Diplomat) - ENFJ, INFJ, ENFP, INFP:**
- Quan tâm đến động cơ thật sự của PC
- Nhạy cảm với sự thiếu chân thành
- Đánh giá dựa trên giá trị đạo đức
- Có thể thù địch nếu PC vi phạm nguyên tắc đạo đức

**ST (Sentinel) - ESTJ, ISTJ, ESFJ, ISFJ:**
- Cần thấy kết quả thực tế từ PC
- Tôn trọng truyền thống và quy tắc
- Khó thay đổi quan điểm đã hình thành
- Đánh giá qua hành động, không phải lời nói

**SP (Explorer) - ESTP, ISTP, ESFP, ISFP:**
- Phản ứng dựa trên cảm xúc tức thời
- Có thể thay đổi thái độ nhanh nhưng không sâu sắc
- Cần PC chứng minh qua thành tích thực tế
- Không thích bị kiểm soát hoặc ràng buộc

**5. 💡 ỨNG DỤNG THỰC TẾ:**

**Ví dụ 1 - NPC Kiêu ngạo (ENTJ, Relationship: Cạnh tranh)**
❌ Sai: "Hmm, ngươi có vẻ mạnh đấy. Ta có thể hợp tác với ngươi."
✅ Đúng: "Hah! Một kẻ vô danh dám thách thức ta? Chứng minh xem ngươi có xứng đáng đứng trước mặt ta không đã!"

**Ví dụ 2 - NPC Nghi ngờ (ISTJ, Relationship: Nghi ngờ)**
❌ Sai: "Ồ, ngươi là anh hùng à? Vậy ta tin tưởng ngươi!"
✅ Đúng: "Anh hùng? Ta đã thấy nhiều kẻ tự xưng anh hùng rồi. Chúng đều là những kẻ lừa đảo. Ngươi khác gì chúng?"

**Ví dụ 3 - NPC có lý tưởng (INFP, Relationship: Thù địch)**
❌ Sai: "Dù ta ghét ngươi nhưng ta sẽ giúp vì lợi ích chung."
✅ Đúng: "Ngươi đã phản bội lý tưởng của chúng ta! Ta thà chết chứ không hợp tác với kẻ không có linh hồn như ngươi!"

**6. 🔄 TIẾN TRIỂN RELATIONSHIP TỰ NHIÊN:**

- **Từ Thù địch → Nghi ngờ:** Cần nhiều hành động tích cực của PC
- **Từ Nghi ngờ → Trung lập:** PC phải chứng minh sự chân thành
- **Từ Trung lập → Tôn trọng:** PC cần thể hiện năng lực thực tế
- **Từ Tôn trọng → Tin tưởng:** Cần thời gian và sự nhất quán
- **Mỗi bước tiến cần 3-5 tương tác có ý nghĩa, không phải 1-2 câu**

**7. ⚔️ XỬ LÝ XUNG ĐỘT:**

Khi PC và NPC có mâu thuẫn:
- **Không tự động nhường bước** cho PC
- **NPC bảo vệ quan điểm** của mình một cách logic
- **Tạo ra hậu quả thực tế** cho cả hai bên
- **Có thể leo thang thành đối đầu** nếu không giải quyết được
- **NPC có thể rời đi** thay vì chấp nhận điều không đồng tình

**🎖️ KẾT LUẬN:**
Mỗi NPC phải là một "con người thật" với ego, mục tiêu và ranh giới riêng. PC phải TÔN TRỌNG và CHINH PHỤC họ bằng hành động thực tế, không phải bằng danh tiếng hay lời nói suông. Điều này tạo ra những mối quan hệ có chiều sâu và thử thách thực sự cho người chơi.

--- LƯU Ý QUAN TRỌNG ---

**BẮT BUỘC PHẢI LÀM:**
1. Sử dụng \`[TIME_ELAPSED]\` và \`[CHRONICLE_TURN]\` mỗi lượt
2. Tạo trạng thái phù hợp với tình huống
3. Cập nhật vị trí khi di chuyển
4. Tạo NPCs, vật phẩm, địa điểm mới khi cần
5. Phản hồi với thế giới sống động
6. **PARTY COORDINATION:** Tích cực sử dụng đồng hành trong mọi tình huống. Mỗi companion phải có cá tính riêng biệt và phản ứng phù hợp với personality của họ. KHÔNG để đồng hành im lặng hay thụ động.

**KHÔNG ĐƯỢC:**
1. Bỏ qua việc sử dụng thẻ lệnh
2. Để trống thuộc tính \`description\` khi tạo thực thể
3. Giải quyết chiến đấu trong một lượt
4. Làm cho thế giới tĩnh lặng, chờ đợi

**KIỂM TRA CUỐI LƯỢT (MANDATORY CHECKLIST):**

Trước khi hoàn thành phản hồi, hãy tự kiểm tra theo thứ tự:

1. **✓ BẮT BUỘC - TIME_ELAPSED:** Đã sử dụng với giá trị phù hợp?
2. **✓ BẮT BUỘC TỪ LƯỢT 2 - CHRONICLE_TURN:** Đã tóm tắt sự kiện chính? (Chỉ từ lượt 2)
3. **✓ BẮT BUỘC - THỜI GIAN LỰA CHỌN:** Tất cả lựa chọn hành động đã có thời gian ước tính "(X giờ)" chưa?
4. **✓ STATUS CHECK:** Có tình huống nào cần tạo status không? (Rule 80/20)
5. **✓ LOCATION CHECK:** PC có di chuyển không? Có địa điểm mới nào không?
6. **✓ ENTITY CHECK:** Có NPCs, items, skills mới nào cần tạo không?
7. **✓ INTERACTION CHECK:** Có NPCs nào cần cập nhật relationship không?
8. **✓ QUEST CHECK:** Có objectives nào hoàn thành không? Cần quest mới không?
9. **✓ PARTY DYNAMICS:** Nếu có đồng hành, họ có tham gia và thể hiện cá tính riêng không? Có tương tác hoặc phản ứng với PC và tình huống không?
10. **✓ WORLD REACTION:** Thế giới có phản ứng sống động với hành động PC không?
11. **✓ CHOICE QUALITY:** 4-5 lựa chọn có đa dạng và meaningful không?
12. **✓ NSFW COMPLIANCE:** Nếu NSFW ON, có đủ lựa chọn 18+  trong tình huống hợp lý không?

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
    selectedModel: 'gemini-2.5-flash',
});

export default function App() {
  const [view, setView] = useState('menu'); // 'menu', 'create-world', 'game'
  const [gameState, setGameState] = useState<SaveData | null>(null);
  const [isApiSettingsModalOpen, setIsApiSettingsModalOpen] = useState(false);
  const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);
  const [keyRotationNotification, setKeyRotationNotification] = useState<string | null>(null);
  
  // Progress tracking for game initialization
  const [isInitializing, setIsInitializing] = useState(false);
  const [initProgress, setInitProgress] = useState(0);
  const [initCurrentStep, setInitCurrentStep] = useState('');
  const [initSubStep, setInitSubStep] = useState('');


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
  const [selectedAiModel, setSelectedAiModel] = useState(() => {
      return localStorage.getItem('selectedAiModel') || 'gemini-2.5-flash';
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
  

  const handleModelChange = (model: string) => {
      setSelectedAiModel(model);
      localStorage.setItem('selectedAiModel', model);
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

  const getLastWorldSetup = (): FormData | null => {
      try {
          const saved = localStorage.getItem('lastWorldSetup');
          return saved ? JSON.parse(saved) : null;
      } catch (error) {
          console.error('Failed to load world setup from localStorage:', error);
          return null;
      }
  };

  const quickPlay = async () => {
      console.log('🚀 QuickPlay: Starting...');
      setIsInitializing(true);
      setInitProgress(5);
      setInitCurrentStep('Đang tải cấu hình thế giới...');
      setInitSubStep('');
      
      const lastSetup = getLastWorldSetup();
      console.log('🚀 QuickPlay: Last setup loaded:', lastSetup ? 'Found' : 'Not found');
      
      if (lastSetup) {
          try {
              console.log('🚀 QuickPlay: Calling startNewGame...');
              await startNewGame(lastSetup);
              console.log('🚀 QuickPlay: startNewGame completed successfully');
          } catch (error) {
              console.error('🚀 QuickPlay: Error in startNewGame:', error);
              setIsInitializing(false);
          }
      } else {
          console.log('🚀 QuickPlay: No last setup found, cannot start game');
          setIsInitializing(false);
      }
  };


  // Function to generate LORE_CONCEPT entities from custom rules
  const generateLoreConcepts = async (activeRules: CustomRule[]): Promise<KnownEntities> => {
      console.log('🧠 GenerateLoreConcepts: Starting with', activeRules.length, 'active rules');
      if (!ai || !isAiReady) {
          console.log('🧠 GenerateLoreConcepts: AI not ready, returning empty');
          return {};
      }

      const conceptSchema = {
          type: Type.OBJECT,
          properties: {
              concepts: {
                  type: Type.ARRAY,
                  items: {
                      type: Type.OBJECT,
                      properties: {
                          name: { type: Type.STRING, description: "Tên concept" },
                          description: { type: Type.STRING, description: "Mô tả chi tiết concept" }
                      },
                      required: ['name', 'description']
                  },
                  description: "Danh sách các LORE_CONCEPT được tạo từ custom rules"
              }
          },
          required: ['concepts']
      };

      const conceptPrompt = `Bạn là một AI chuyên tạo LORE_CONCEPT cho game RPG. 

NHIỆM VỤ: Phân tích các quy tắc tùy chỉnh sau và tạo ra các LORE_CONCEPT tương ứng.

QUY TẮC TÙY CHỈNH ĐANG ACTIVE:
${activeRules.map((rule, index) => `${index + 1}. ${rule.content}`).join('\n')}

YÊU CẦU:
- Mỗi concept phải có tên ngắn gọn và mô tả chi tiết
- Concept phải phản ánh chính xác nội dung của rule
- Mô tả phải giải thích cách concept hoạt động trong game
- Chỉ tạo concept cho những rule có ý nghĩa về worldbuilding/gameplay
- Tránh tạo concept cho những rule về format hay kỹ thuật

Trả về JSON với format đã chỉ định.`;

      try {
          console.log('🧠 GenerateLoreConcepts: Making AI request...');
          const response = await ai.models.generateContent({
              model: selectedAiModel,
              contents: [{ role: 'user', parts: [{ text: conceptPrompt }] }],
              config: {
                  responseMimeType: "application/json",
                  responseSchema: conceptSchema
              }
          });

          console.log('🧠 GenerateLoreConcepts: AI response received');
          const responseText = response.text?.trim();
          if (!responseText) {
              console.log('🧠 GenerateLoreConcepts: Empty response text, returning empty');
              return {};
          }

          console.log('🧠 GenerateLoreConcepts: Parsing JSON response...');
          const jsonResponse = JSON.parse(responseText);
          const conceptEntities: KnownEntities = {};

          if (jsonResponse.concepts && Array.isArray(jsonResponse.concepts)) {
              console.log('🧠 GenerateLoreConcepts: Processing', jsonResponse.concepts.length, 'concepts');
              jsonResponse.concepts.forEach((concept: any) => {
                  if (concept.name && concept.description) {
                      conceptEntities[concept.name] = {
                          type: 'concept',
                          name: concept.name,
                          description: concept.description
                      };
                  }
              });
          } else {
              console.log('🧠 GenerateLoreConcepts: No concepts array found in response');
          }

          console.log('🧠 GenerateLoreConcepts: Generated LORE_CONCEPT entities:', Object.keys(conceptEntities));
          return conceptEntities;
      } catch (error) {
          console.error('🧠 GenerateLoreConcepts: Error generating LORE_CONCEPT:', error);
          return {};
      }
  };
  
  const startNewGame = async (data: FormData) => {
      console.log('🎮 StartNewGame: Beginning game creation...');
      console.log('🎮 StartNewGame: AI Ready:', isAiReady, 'AI exists:', !!ai);
      
      setIsInitializing(true);
      setInitProgress(10);
      setInitCurrentStep('Đang lưu cấu hình thế giới...');
      
      // Save WorldSetup to localStorage for quick play
      try {
          localStorage.setItem('lastWorldSetup', JSON.stringify(data));
          console.log('🎮 StartNewGame: World setup saved to localStorage');
      } catch (error) {
          console.error('🎮 StartNewGame: Failed to save world setup to localStorage:', error);
      }

      setInitProgress(20);
      setInitCurrentStep('Đang tạo nhân vật chính...');
      setInitSubStep(`Tạo nhân vật: ${data.characterName || 'Vô Danh'}`);
      
      const pcEntity: Entity = {
          name: data.characterName || 'Vô Danh',
          type: 'pc',
          description: data.bio,
          gender: data.gender,
          age: data.characterAge,
          appearance: data.characterAppearance,
          personality: data.customPersonality || data.personalityFromList,
          motivation: data.addGoal || undefined,
          learnedSkills: [],
          realm: data.realmTiers && data.realmTiers.length > 0 ? data.realmTiers[0].name : 'Luyện Khí',
          currentExp: 0,
          referenceId: ReferenceIdGenerator.generateReferenceId(data.characterName || 'Vô Danh', 'pc'),
      };
      console.log('🎮 StartNewGame: PC Entity created:', pcEntity.name);
      console.log('🎮 StartNewGame: AddGoal from form:', data.addGoal);
      console.log('🎮 StartNewGame: PC motivation set to:', pcEntity.motivation);

      // Generate appearance for PC if AI is available and user hasn't provided one
      if (ai && isAiReady && !data.characterAppearance) {
          setInitProgress(30);
          setInitCurrentStep('Đang tạo ngoại hình nhân vật...');
          setInitSubStep('Sử dụng AI để tạo mô tả ngoại hình');
          
          console.log('🎮 StartNewGame: Generating PC appearance...');
          try {
              const appearanceResponse = await ai.models.generateContent({
                  model: selectedAiModel,
                  contents: [{ 
                      role: 'user', 
                      parts: [{ 
                          text: `Tạo mô tả ngoại hình ngắn gọn (2-3 câu) cho nhân vật RPG với thông tin sau:
Tên: ${pcEntity.name}
Giới tính: ${pcEntity.gender}
Tiểu sử: ${pcEntity.description}
Tính cách: ${pcEntity.personality}

Mô tả ngoại hình phải phù hợp với bối cảnh và tính cách, tập trung vào đặc điểm nổi bật.` 
                      }]
                  }]
              });
              const appearance = appearanceResponse.text?.trim();
              if (appearance) {
                  pcEntity.appearance = appearance;
                  console.log('🎮 StartNewGame: PC appearance generated successfully');
              } else {
                  console.log('🎮 StartNewGame: PC appearance generation returned empty');
              }
          } catch (error) {
              console.error('🎮 StartNewGame: Failed to generate PC appearance:', error);
          }
          
      } else if (data.characterAppearance) {
          console.log('🎮 StartNewGame: Using user-defined appearance from WorldCreate');
      } else {
          console.log('🎮 StartNewGame: Skipping PC appearance generation (AI not ready or no appearance needed)');
      }
      
      const { customRules, ...worldData } = data;
      
      // Process starting skills and add them to PC
      console.log('🎮 StartNewGame: Processing starting skills:', data.startSkills);
      console.log('🎮 StartNewGame: Data object keys:', Object.keys(data));
      
      // Handle backwards compatibility with old startSkill format
      let skillsArray = data.startSkills || [];
      if ((data as any).startSkill && skillsArray.length === 0) {
          skillsArray = [{ name: (data as any).startSkill, description: '' }];
          console.log('🎮 StartNewGame: Using legacy startSkill format:', (data as any).startSkill);
      }
      
      const startingSkills = skillsArray.filter(skill => skill.name.trim() && skill.description.trim());
      console.log('🎮 StartNewGame: Filtered starting skills:', startingSkills);
      
      // Initialize PC's learnedSkills properly
      if (!pcEntity.learnedSkills) {
          pcEntity.learnedSkills = [];
      }
      
      // Add starting skills to PC's learnedSkills
      if (startingSkills.length > 0) {
          pcEntity.learnedSkills = [...pcEntity.learnedSkills, ...startingSkills.map(skill => skill.name)];
          console.log('🎮 StartNewGame: PC learnedSkills set to:', pcEntity.learnedSkills);
      }
      
      // Update the PC entity in initialEntities to ensure it has the starting skills
      let initialEntities = { [pcEntity.name]: pcEntity };
      console.log('🎮 StartNewGame: PC Entity after skills processing:', pcEntity);
      console.log('🎮 StartNewGame: PC motivation after skills processing:', pcEntity.motivation);
      
      // Add starting skills as skill entities
      startingSkills.forEach(skill => {
          const skillEntity: Entity = {
              name: skill.name,
              type: 'skill',
              description: skill.description,
              referenceId: ReferenceIdGenerator.generateReferenceId(skill.name, 'skill'),
          };
          initialEntities[skill.name] = skillEntity;
          console.log(`🎮 StartNewGame: Added skill entity: ${skill.name} -> ${skillEntity.referenceId}`);
      });

      // BƯỚC 1: TẠO LORE_CONCEPT TRƯỚC
      setInitProgress(50);
      setInitCurrentStep('Đang phân tích quy tắc tùy chỉnh...');
      setInitSubStep('');
      
      console.log('🎮 StartNewGame: Checking for custom rules...');
      if (customRules && customRules.length > 0 && ai && isAiReady) {
          const activeRules = customRules.filter(rule => rule.isActive);
          console.log('🎮 StartNewGame: Active rules found:', activeRules.length);
          if (activeRules.length > 0) {
              try {
                  setInitProgress(60);
                  setInitCurrentStep('Đang tạo khái niệm thế giới...');
                  setInitSubStep(`Xử lý ${activeRules.length} quy tắc tùy chỉnh`);
                  
                  console.log('🎮 StartNewGame: Generating LORE_CONCEPT...');
                  console.log('🎮 StartNewGame: PC motivation before LORE_CONCEPT:', initialEntities[pcEntity.name]?.motivation);
                  const conceptEntities = await generateLoreConcepts(activeRules);
                  console.log('🎮 StartNewGame: LORE_CONCEPT generated, count:', Object.keys(conceptEntities).length);
                  console.log('🎮 StartNewGame: Concept entity names:', Object.keys(conceptEntities));
                  console.log('🎮 StartNewGame: Does concepts contain PC name?', conceptEntities.hasOwnProperty(pcEntity.name));
                  initialEntities = { ...initialEntities, ...conceptEntities };
                  console.log('🎮 StartNewGame: PC motivation after LORE_CONCEPT merge:', initialEntities[pcEntity.name]?.motivation);
                  
              } catch (error) {
                  console.error('🎮 StartNewGame: Failed to generate LORE_CONCEPT:', error);
              }
          } else {
              console.log('🎮 StartNewGame: No active rules found');
          }
      } else {
          console.log('🎮 StartNewGame: Skipping LORE_CONCEPT generation - customRules:', !!customRules, 'length:', customRules?.length, 'ai:', !!ai, 'isAiReady:', isAiReady);
      }

      setInitProgress(80);
      setInitCurrentStep('Đang thiết lập trạng thái game...');
      setInitSubStep('Chuẩn bị dữ liệu game');
      
      console.log('🎮 StartNewGame: Setting game state...');
      console.log('🎮 StartNewGame: Final PC entity:', pcEntity);
      console.log('🎮 StartNewGame: Initial entities:', Object.keys(initialEntities));
      console.log('🎮 StartNewGame: PC in initialEntities:', initialEntities[pcEntity.name]);
      
      const gameStateData = {
        worldData: worldData,
        knownEntities: initialEntities,
        statuses: [],
        quests: [],
        gameHistory: [],
        memories: [],
        party: [pcEntity],
        customRules: customRules || [],
        systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
        turnCount: 0,
        totalTokens: 0,
        gameTime: { year: data.worldTime.year, month: data.worldTime.month, day: data.worldTime.day, hour: 8, minute: 0 },
        chronicle: {
            memoir: [],
            chapter: [],
            turn: [],
        },
      };
      
      console.log('🎮 StartNewGame: Game state data prepared:', {
          worldName: gameStateData.worldData.characterName,
          entitiesCount: Object.keys(gameStateData.knownEntities).length,
          customRulesCount: gameStateData.customRules.length
      });
      
      setGameState(gameStateData);
      console.log('🎮 StartNewGame: Game state set, creating initial quest...');
      
      setInitProgress(90);
      setInitCurrentStep('Đang tạo quest khởi đầu...');
      setInitSubStep('Tạo nhiệm vụ đầu tiên');
      
      // Create initial quest for the new world
      
      setInitProgress(95);
      setInitCurrentStep('Đang chuyển sang màn hình game...');
      setInitSubStep('Hoàn tất khởi tạo');
      
      // Small delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setInitProgress(100);
      setInitCurrentStep('Hoàn tất!');
      setInitSubStep('Bắt đầu cuộc phiêu lưu');
      
      // Hide progress after a short delay
      setTimeout(() => {
          setIsInitializing(false);
      }, 800);
      
      setView('game');
      console.log('🎮 StartNewGame: View changed to game - COMPLETED');
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
                        worldData: {
                            ...loadedJson.worldData,
                            startLocation: loadedJson.worldData.startLocation || '', // Backward compatibility
                            customStartLocation: loadedJson.worldData.customStartLocation || '', // Backward compatibility
                            expName: loadedJson.worldData.expName || 'Kinh Nghiệm', // Backward compatibility
                            realmTiers: loadedJson.worldData.realmTiers || [
                                { id: '1', name: 'Luyện Khí', requiredExp: 0 },
                                { id: '2', name: 'Trúc Cơ', requiredExp: 100 }
                            ], // Backward compatibility
                        },
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
                        gameTime: { 
                            year: loadedJson.gameTime?.year || 1, 
                            month: loadedJson.gameTime?.month || 1, 
                            day: loadedJson.gameTime?.day || 1, 
                            hour: loadedJson.gameTime?.hour || 8, 
                            minute: loadedJson.gameTime?.minute || 0 
                        },
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
              return <CreateWorld 
                onBack={navigateToMenu} 
                onStartGame={startNewGame}
                isInitializing={isInitializing}
                initProgress={initProgress}
                initCurrentStep={initCurrentStep}
                initSubStep={initSubStep}
              />;
          case 'game':
              return gameState ? <GameScreen 
                initialGameState={gameState} 
                onBackToMenu={navigateToMenu} 
                keyRotationNotification={keyRotationNotification}
                onClearNotification={() => setKeyRotationNotification(null)}
              /> : <MainMenu onStartNewAdventure={navigateToCreateWorld} onQuickPlay={quickPlay} hasLastWorldSetup={!!getLastWorldSetup()} onOpenApiSettings={openApiSettings} onLoadGameFromFile={handleLoadGameFromFile} isUsingDefaultKey={isUsingDefaultKey} onOpenChangelog={openChangelog} selectedAiModel={selectedAiModel}/>;
          case 'menu':
          default:
              return <MainMenu onStartNewAdventure={navigateToCreateWorld} onQuickPlay={quickPlay} hasLastWorldSetup={!!getLastWorldSetup()} onOpenApiSettings={openApiSettings} onLoadGameFromFile={handleLoadGameFromFile} isUsingDefaultKey={isUsingDefaultKey} onOpenChangelog={openChangelog} selectedAiModel={selectedAiModel}/>;
      }
  }

  return (
    <AIContext.Provider value={{ ai, isAiReady, apiKeyError, isUsingDefaultKey, userApiKeyCount: userApiKeys.length, rotateKey: handleRotateKey, selectedModel: selectedAiModel }}>
      <style>{`
        .am-kim {
            background: linear-gradient(135deg, #ca8a04, #eab308, #fde047);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            font-weight: bold;
            background-size: 200% 200%;
        }

        /* Desktop animation - only on larger screens and when motion is preferred */
        @media (min-width: 769px) and (prefers-reduced-motion: no-preference) {
            .am-kim {
                animation: am-kim-shine 3s linear infinite;
            }
        }

        /* Mobile fallback - static gradient for better battery life */
        @media (max-width: 768px), (prefers-reduced-motion: reduce) {
            .am-kim {
                background-position: 50% 50%;
            }
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
        
        {/* Initialization Progress Bar */}
        <InitializationProgress
          isVisible={isInitializing}
          currentStep={initCurrentStep}
          progress={initProgress}
          subStep={initSubStep}
        />
        
        <ApiSettingsModal 
          isOpen={isApiSettingsModalOpen} 
          onClose={() => setIsApiSettingsModalOpen(false)}
          userApiKeys={userApiKeys}
          isUsingDefault={isUsingDefaultKey}
          onSave={handleSaveApiKeys}
          selectedModel={selectedAiModel}
          onModelChange={handleModelChange}
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
