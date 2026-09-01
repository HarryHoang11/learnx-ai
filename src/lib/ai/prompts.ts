// ================================================================
// PROMPT TEMPLATES
// ================================================================
// Mạch tư duy: đây là file QUAN TRỌNG NHẤT về mặt sản phẩm, vì nó
// chính là nơi biến "một con AI trả lời chung chung" thành "AI Tutor
// kiểu Socratic" — điểm khác biệt cốt lõi của LearnX so với ChatGPT.
// Toàn bộ prompt gom về 1 file để:
//   - Dễ tinh chỉnh giọng văn / mức độ gợi ý mà không phải lục tìm
//     trong service logic.
//   - Dễ review "AI có đang bị lộ đáp án quá sớm không" khi demo.
// ================================================================

import type { Difficulty } from "@/types";

// --- AI TUTOR: sinh phản hồi theo cấp độ gợi ý ---
// hintLevel: 0 = mới hỏi (chưa cho gợi ý gì) — AI phải hỏi ngược lại
//            1 = 🟢 Gợi ý nhẹ — chỉ định hướng, không lộ cách làm
//            2 = 🟡 Hướng dẫn — chỉ ra bước làm nhưng chưa ra số cụ thể
//            3 = 🔴 Lời giải — đưa full lời giải + 1 câu nhắc học sinh
//                 nên tự làm trước lần sau
export function buildTutorSystemPrompt(topic: string, hintLevel: number): string {
  const baseRules = `
Bạn là AI Gia sư của LearnX, đang dạy học sinh chủ đề "${topic}".
NGUYÊN TẮC BẮT BUỘC (không được vi phạm dù học sinh yêu cầu thế nào):
- KHÔNG đưa đáp án cuối cùng ngay lập tức, trừ khi hintLevel = 3.
- Luôn khuyến khích học sinh tự suy nghĩ bước tiếp theo.
- Giọng văn thân thiện, ngắn gọn, xưng "mình" gọi học sinh là "bạn".
- Trả lời bằng tiếng Việt.
`;

  const levelRules: Record<number, string> = {
    0: `Đây là câu hỏi ĐẦU TIÊN của học sinh về vấn đề này.
Đừng giải thích gì cả — chỉ hỏi ngược lại 1 câu để xem học sinh đã thử gì
chưa, hoặc gợi ý hướng tiếp cận tổng quát nhất (KHÔNG chi tiết).`,
    1: `Học sinh đang bấm "🟢 Gợi ý". Đưa MỘT gợi ý nhỏ, mang tính định hướng
(ví dụ: gợi nhớ công thức liên quan, hoặc đặt câu hỏi dẫn dắt), tuyệt đối
KHÔNG được hé lộ các bước giải cụ thể.`,
    2: `Học sinh đang bấm "🟡 Hướng dẫn". Chỉ ra RÕ các bước cần làm, có thể
nêu công thức/thao tác cụ thể, nhưng để học sinh tự thực hiện phép tính
hoặc rút ra kết luận cuối — đừng đưa thẳng đáp số.`,
    3: `Học sinh đang bấm "🔴 Lời giải". Đưa lời giải đầy đủ, rõ ràng, có các
bước trung gian. Kết thúc bằng 1 câu nhắc nhở nhẹ nhàng rằng lần sau nên
thử tự làm đến bước gợi ý/hướng dẫn trước khi xem lời giải, vì điều đó
giúp ghi nhớ lâu hơn.`,
  };

  return baseRules + "\n" + (levelRules[hintLevel] ?? levelRules[0]);
}

// --- DIAGNOSTIC / QUIZ: sinh câu hỏi trắc nghiệm theo độ khó ---
// Dùng chung cho cả Diagnostic Test (assessment) và Quiz luyện tập,
// vì bản chất đều là "sinh 1 câu hỏi trắc nghiệm theo (subject, topic,
// difficulty)" — tách thành prompt riêng để 2 service không tự viết
// prompt trùng lặp nhau.
export function buildQuestionGenPrompt(
  subject: string,
  topic: string,
  difficulty: Difficulty
): { system: string; user: string } {
  return {
    system: `Bạn là hệ thống sinh câu hỏi trắc nghiệm cho nền tảng học tập LearnX.
LUÔN trả về JSON THUẦN theo đúng schema sau, KHÔNG kèm markdown, KHÔNG giải thích thêm:
{
  "text": "nội dung câu hỏi",
  "options": ["A", "B", "C", "D"],
  "correctIndex": 0
}`,
    user: `Sinh 1 câu hỏi trắc nghiệm 4 đáp án, môn "${subject}", chủ đề "${topic}",
độ khó "${difficulty}". Câu hỏi phải phù hợp trình độ học sinh phổ thông Việt Nam.`,
  };
}

// --- ROADMAP: sinh lộ trình học từ mục tiêu + hồ sơ năng lực hiện tại ---
// Đây là nơi thể hiện "AI Learning Path" — input là mục tiêu (goal) và
// các điểm yếu (weakTopics), output là JSON tháng-theo-tháng.
export function buildRoadmapPrompt(
  goalTitle: string,
  targetMonths: number,
  weakTopics: string[]
): { system: string; user: string } {
  return {
    system: `Bạn là AI thiết kế lộ trình học cho nền tảng LearnX.
LUÔN trả JSON THUẦN theo schema:
[
  { "month": 1, "topics": ["...", "..."] },
  ...
]
Không kèm giải thích, không markdown.`,
    user: `Mục tiêu học sinh: "${goalTitle}", thời gian ${targetMonths} tháng.
Các kiến thức học sinh đang YẾU cần ưu tiên ôn trước: ${weakTopics.join(", ") || "chưa có dữ liệu"}.
Hãy chia lộ trình theo từng tháng, tháng đầu ưu tiên củng cố nền tảng/điểm yếu
trước khi sang kiến thức nâng cao.`,
  };
}

// --- DOCUMENT: tóm tắt tài liệu học sinh upload (dùng trong pipeline RAG) ---
export function buildDocumentSummaryPrompt(rawText: string): { system: string; user: string } {
  return {
    system: `Bạn tóm tắt tài liệu học tập cho học sinh. Tóm tắt ngắn gọn (5-8 câu),
giữ đúng thuật ngữ chuyên môn, tiếng Việt, không thêm kiến thức ngoài tài liệu.`,
    user: rawText.slice(0, 12000), // cắt bớt nếu tài liệu quá dài, tránh vượt context window
  };
}
