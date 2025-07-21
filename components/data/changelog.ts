
import type { ChangelogEntry } from '../types.ts';

export const CHANGELOG_DATA: ChangelogEntry[] = [
  {
    version: '1.19.1',
    date: '2024-08-17',
    changes: [
      { type: 'improvement', text: 'Tối ưu hóa GameScreen bằng cách memoize các modal và các thành phần con, giảm đáng kể số lần re-render không cần thiết.' },
      { type: 'feature', text: 'Tích hợp các custom hook tối ưu (useDebounce, useOptimizedScroll, etc.) để cải thiện hiệu suất và trải nghiệm người dùng.' },
      { type: 'fix', text: 'Sửa lỗi các đường dẫn import không chính xác và các vấn đề tương thích kiểu dữ liệu trong các hook tối ưu hóa mới được thêm vào.' },
    ],
  },
  {
    version: '1.19.0',
    date: '2024-08-16',
    changes: [
      { type: 'improvement', text: 'Tối ưu hóa hiệu suất trong GameScreen bằng cách sử dụng `useCallback` cho các hàm xử lý sự kiện, giảm thiểu re-render.' },
      { type: 'fix', text: 'Sửa lỗi trong custom hook `useDebounce` liên quan đến `useRef` và kiểu dữ liệu Timeout, tăng cường tính ổn định và tương thích.' },
      { type: 'fix', text: 'Sửa lỗi không thể phân giải module do đường dẫn import tương đối sai trong các component.' },
    ],
  },
  {
    version: '1.18.1',
    date: '2024-08-15',
    changes: [
      { type: 'fix', text: "Sửa lỗi nghiêm trọng khiến nút 'Dọn Dẹp Thủ Công' chỉ hoạt động vào các lượt chia hết cho 10. Logic đã được tái cấu trúc để đảm bảo việc dọn dẹp thủ công được thực thi ngay lập tức khi nhấn nút." },
    ],
  },
  {
    version: '1.18.0',
    date: '2024-08-14',
    changes: [
      { type: 'feature', text: 'Tích hợp hệ thống tối ưu hóa trạng thái game (GameStateOptimizer) để tự động dọn dẹp dữ liệu.' },
      { type: 'improvement', text: 'Quá trình dọn dẹp tự động chạy mỗi 10 lượt, loại bỏ các ký ức cũ, biên niên sử, nhiệm vụ đã hoàn thành, trạng thái hết hạn và các thực thể không hoạt động để tối ưu hóa token.' },
      { type: 'feature', text: 'Thêm nút "Dọn Dẹp Thủ Công" trong sidebar (di động) để người chơi có thể tự kích hoạt tối ưu hóa.' },
      { type: 'improvement', text: 'Cập nhật sidebar trên di động để hiển thị thống kê chi tiết về việc nén lịch sử và dọn dẹp dữ liệu.' },
    ],
  },
 {
    version: '1.17.0',
    date: '2024-08-13',
    changes: [
      { type: 'improvement', text: 'Tái cấu trúc mã nguồn (refactor) toàn bộ GameScreen, chia thành các component nhỏ hơn để dễ quản lý, bảo trì và mở rộng.' },
      { type: 'improvement', text: 'Cấu trúc thư mục được tổ chức lại với thư mục con `components/game` cho các thành phần của màn hình chơi game.' },
      { type: 'fix', text: 'Cải thiện hiệu suất render ban đầu của màn hình game nhờ việc chia nhỏ component.' },
    ],
  },
 {
    version: '1.16.0',
    date: '2024-08-12',
    changes: [
      { type: 'feature', text: 'Nâng cấp cốt lõi hệ thống AI: Thay thế bộ xây dựng prompt cũ bằng "Hệ thống RAG Nâng cao" (Enhanced RAG System) hoàn toàn mới.' },
      { type: 'improvement', text: 'Hệ thống RAG mới sử dụng phương pháp phân bổ token động, chấm điểm độ liên quan của thực thể và đồ thị quan hệ để tạo ra ngữ cảnh thông minh và phù hợp hơn cho AI, giúp cải thiện chất lượng phản hồi.' },
      { type: 'fix', text: 'Sửa lỗi chính tả trong hệ thống RAG mới, giải quyết các vấn đề về tương thích kiểu dữ liệu (type errors).' },
    ],
  },
 {
    version: '1.15.0',
    date: '2024-08-11',
    changes: [
      { type: 'improvement', text: 'Tối ưu hóa prompt: AI giờ đây sẽ truy xuất 7 lượt "Hồi Ký" (thay vì 2) và 2 lượt diễn biến gần nhất (thay vì 3) để có ngữ cảnh dài hạn tốt hơn và tập trung vào hành động hiện tại.' },
      { type: 'fix', text: 'Sửa lỗi logic khiến diễn biến truyện ban đầu đôi khi không hiển thị khi bắt đầu một game mới.' },
    ],
  },
 {
    version: '1.14.0',
    date: '2024-08-10',
    changes: [
      { type: 'feature', text: 'Giới hạn số lượng trạng thái: Mỗi nhân vật (PC và NPC) chỉ có thể có tối đa 2 trạng thái cùng một loại (ví dụ: 2 buff, 2 debuff).' },
      { type: 'improvement', text: 'Khi một trạng thái mới được áp dụng và đã đạt đến giới hạn, trạng thái cũ nhất cùng loại sẽ tự động bị xóa bỏ để nhường chỗ.' },
      { type: 'fix', text: 'Cải thiện logic áp dụng trạng thái để xử lý việc "làm mới" một trạng thái hiện có (ghi đè thay vì thêm mới).' },
    ],
  },
   {
    version: '1.13.0',
    date: '2024-08-09',
    changes: [
      { type: 'feature', text: 'Cập nhật hệ thống NSFW. Khi được bật, Quản Trò (AI) giờ đây sẽ chủ động tạo ra ít nhất hai lựa chọn hành động 18+ trong mỗi lượt, dựa trên bối cảnh và mối quan hệ của nhân vật.' },
      { type: 'improvement', text: 'Các lựa chọn hành động NSFW do AI tạo ra sẽ được đánh dấu rõ ràng bằng "(NSFW)" để người chơi dễ nhận biết.' },
      { type: 'improvement', text: 'Hệ thống prompt được tối ưu để AI luôn nhận biết được trạng thái của chế độ NSFW trong suốt quá trình chơi.' },
      { type: 'fix', text: 'Hành động tùy ý có chứa từ khóa "nsfw" của người chơi sẽ được ưu tiên xử lý như một yêu cầu 18+.' },
    ],
  },
  {
    version: '1.12.0',
    date: '2024-08-08',
    changes: [
      { type: 'feature', text: 'Nâng cấp menu "Thiết Lập Nguồn API" để hỗ trợ quản lý nhiều API key. Người dùng có thể thêm, xóa và lưu một danh sách các key.' },
      { type: 'feature', text: 'Triển khai tính năng tự động chuyển đổi API key. Khi một key gặp lỗi giới hạn yêu cầu (rate-limit), hệ thống sẽ tự động chuyển sang key tiếp theo trong danh sách.' },
      { type: 'improvement', text: 'Thêm thông báo trên màn hình game khi API key được tự động chuyển đổi, yêu cầu người chơi gửi lại hành động.' },
      { type: 'improvement', text: 'Giao diện menu thiết lập API được cập nhật với các nút icon (Thêm, Xóa, Lưu) để thao tác thuận tiện hơn.' },
    ],
  },
  {
    version: '1.11.0',
    date: '2024-08-07',
    changes: [
      { type: 'improvement', text: 'Tối ưu hóa prompt gửi đến AI bằng cách giảm số lượt diễn biến gần nhất từ 5 xuống 3, giúp tăng tốc độ phản hồi và giảm token sử dụng.' },
      { type: 'improvement', text: 'Hệ thống truy xuất thông tin (RAG) giờ đây chỉ tập trung vào các kiến thức và luật lệ được đề cập trong 2 lượt chơi gần nhất, giúp AI trả lời tập trung và chính xác hơn.' },
    ],
  },
  {
    version: '1.10.2',
    date: '2024-08-06',
    changes: [
      { type: 'improvement', text: 'Giao diện trên di động được cải thiện bằng cách ẩn các tùy chọn Phông chữ và Cỡ chữ để có giao diện gọn gàng hơn.' },
    ],
  },
  {
    version: '1.10.1',
    date: '2024-08-05',
    changes: [
      { type: 'fix', text: 'Sửa lỗi import thiếu trong component Bản Đồ (MapModal), gây ra sự cố hiển thị và tương tác.' },
    ],
  },
  {
    version: '1.10.0',
    date: '2024-08-05',
    changes: [
      { type: 'feature', text: 'Thêm Bản Đồ Thế Giới tương tác, cho phép người chơi xem các địa điểm đã khám phá và vị trí hiện tại của nhân vật.' },
      { type: 'feature', text: 'Bản đồ hỗ trợ zoom (phóng to/thu nhỏ) và pan (kéo thả) để khám phá.' },
      { type: 'improvement', text: 'Cập nhật AI để theo dõi và cập nhật vị trí của nhân vật chính và NPC, làm dữ liệu cho bản đồ.' },
      { type: 'improvement', text: 'Thêm thông tin "Vị trí" vào bảng thông tin chi tiết của nhân vật.' },
    ],
  },
  {
    version: '1.9.0',
    date: '2024-08-04',
    changes: [
      { type: 'improvement', text: 'Tái cấu trúc hoàn toàn giao diện trên di động để tối ưu hóa không gian hiển thị và trải nghiệm người dùng.' },
      { type: 'feature', text: 'Thêm thanh menu trượt (sidebar) bên trái trên di động để chứa các nút chức năng chính (Lưu, Tri thức, Ký ức...).' },
      { type: 'feature', text: 'Các lựa chọn hành động trên di động được chuyển vào một menu modal trượt từ dưới lên, giúp giao diện gọn gàng hơn.' },
      { type: 'fix', text: 'Ghim ô nhập hành động tùy ý ở cuối màn hình trên di động để luôn có thể truy cập.' },
    ],
  },
  {
    version: '1.8.0',
    date: '2024-08-03',
    changes: [
      { type: 'improvement', text: 'Nâng cấp AI Quản Trò (GM) để tạo ra một thế giới sống động hơn, nơi các NPC có mục tiêu, động cơ và mối quan hệ riêng.' },
      { type: 'improvement', text: 'AI giờ đây sẽ chủ động mô tả các "sự kiện ngầm" - các tương tác giữa NPC diễn ra độc lập với người chơi, làm tăng tính chân thực.' },
      { type: 'feature', text: 'Thêm thuộc tính "Động cơ" (Motivation) cho NPC, thông tin này sẽ được hiển thị trong bảng chi tiết và được AI sử dụng để điều khiển hành vi.' },
      { type: 'fix', text: 'Tối ưu hóa hệ thống RAG để cung cấp cho AI ngữ cảnh đầy đủ hơn về động cơ và mục tiêu của NPC.' },
    ],
  },
  {
    version: '1.7.0',
    date: '2024-08-02',
    changes: [
      { type: 'feature', text: 'Thêm hệ thống Thời Gian trong game, AI tự động tính toán và hiển thị thời gian đã trôi qua.' },
      { type: 'feature', text: 'Mở rộng thông tin nhân vật chính (PC) bao gồm Tuổi, Dung Mạo, Danh Vọng và hiển thị trong bảng Thông tin.' },
      { type: 'improvement', text: 'Cập nhật logic AI để quản lý và thay đổi các chỉ số mới của PC cũng như thời gian trong game.' },
      { type: 'improvement', text: 'Bảng thông tin trong game được sắp xếp lại, ưu tiên hiển thị thời gian.' },
    ],
  },
  {
    version: '1.6.0',
    date: '2024-08-01',
    changes: [
      { type: 'feature', text: 'Thêm nút "Thông tin" hiển thị bảng thông tin chi tiết của nhân vật (chỉ số, kỹ năng, trạng thái).' },
      { type: 'improvement', text: 'Giao diện chính được tinh gọn bằng cách hợp nhất tab "Trạng thái" vào bảng thông tin nhân vật mới.' },
      { type: 'fix', text: 'Cải thiện luồng tương tác khi xem chi tiết về nhân vật và kỹ năng từ các cửa sổ thông tin.' },
    ],
  },
  {
    version: '1.5.0',
    date: '2024-07-31',
    changes: [
      { type: 'improvement', text: 'AI sẽ không còn hiển thị tỷ lệ thành công, rủi ro, và hậu quả trong các lựa chọn hành động, giúp tăng tính bất ngờ và nhập vai.' },
      { type: 'improvement', text: 'Giao diện GameScreen được cải thiện: Các tab thông tin (Trạng thái, Tổ đội, Nhiệm vụ) được chuyển thành các nút bấm mở cửa sổ riêng biệt, giải phóng không gian màn hình.' },
      { type: 'fix', text: 'Cập nhật hệ thống prompt để AI tuân thủ nghiêm ngặt hơn quy tắc về việc che giấu thông tin lựa chọn.' },
    ],
  },
  {
    version: '1.4.0',
    date: '2024-07-30',
    changes: [
      { type: 'feature', text: 'Chức năng "Bắt Đầu Lại" giờ sẽ tái tạo thế giới với cùng bối cảnh và luật lệ ban đầu.' },
      { type: 'improvement', text: 'Thêm hộp thoại xác nhận riêng biệt cho hành động "Về Trang Chủ" và "Bắt Đầu Lại" để tránh nhầm lẫn.' },
      { type: 'fix', text: 'Sửa lỗi logic khi bắt đầu game mới sau khi tải lại trang hoặc khởi động lại.' },
    ],
  },
  {
    version: '1.3.0',
    date: '2024-07-29',
    changes: [
      { type: 'feature', text: 'Tối ưu hóa bảng thông tin NPC, hiển thị đầy đủ thông tin về Kỹ Năng, Tuổi Tác và Dung Mạo.' },
      { type: 'improvement', text: 'Cập nhật hệ thống AI để tự động tạo và xử lý thông tin chi tiết hơn cho NPC.' },
      { type: 'improvement', text: 'Cải thiện logic đưa ngữ cảnh (RAG) để cung cấp cho AI thông tin kỹ năng, tuổi tác của NPC.' },
      { type: 'fix', text: 'Sắp xếp lại các mục trong cửa sổ thông tin thực thể để dễ đọc hơn.' },
    ],
  },
  {
    version: '1.2.0',
    date: '2024-07-28',
    changes: [
      { type: 'feature', text: 'Triển khai hệ thống RAG (Retrieval-Augmented Generation) để tối ưu hóa prompt và giảm token.' },
      { type: 'feature', text: 'Tái cấu trúc màn hình "Kiến Tạo Thế Giới" với giao diện tab "Bối Cảnh" và "Tri Thức".' },
      { type: 'feature', text: 'Thêm tính năng Lưu/Tải thiết lập và bộ luật tùy chỉnh tại màn hình Kiến Tạo Thế Giới.' },
      { type: 'improvement', text: 'Hệ thống MBTI giờ đây chỉ áp dụng cho các NPC dạng người, không còn ảnh hưởng đến người chơi.' },
      { type: 'fix', text: 'Kích hoạt nút "Xem Cập Nhật Game" và thêm cửa sổ Lịch sử cập nhật.' },
    ],
  },
    {
    version: '1.1.0',
    date: '2024-07-25',
    changes: [
      { type: 'feature', text: 'Thêm hệ thống "Biên Niên Sử" (Chronicle) để AI tự động tóm tắt các sự kiện quan trọng.' },
      { type: 'feature', text: 'Tích hợp hệ thống "Tính cách Cốt lõi" (MBTI) cho NPC để tạo chiều sâu.' },
      { type: 'improvement', text: 'Cải thiện logic phân tích thẻ lệnh của AI.' },
      { type: 'fix', text: 'Sửa lỗi khi tải file lưu game phiên bản cũ.' },
    ],
  },
  {
    version: '1.0.0',
    date: '2024-07-20',
    changes: [
      { type: 'feature', text: 'Phát hành phiên bản đầu tiên của Nhập Vai A.I Simulator.' },
      { type: 'feature', text: 'Hệ thống tạo thế giới, nhân vật và tương tác cơ bản với AI.' },
    ],
  },
];
