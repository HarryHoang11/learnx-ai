// ================================================================
// TYPES DÙNG CHUNG
// ================================================================
// Mạch tư duy: những route API khác nhau (assessment, roadmap, quiz)
// đều cần "nói chung một ngôn ngữ" khi trả JSON cho frontend. Định
// nghĩa type ở đây một lần, import lại ở mọi nơi, để nếu sau này đổi
// cấu trúc thì chỉ sửa 1 chỗ thay vì rà từng route.
// ================================================================

// Độ khó câu hỏi — dùng cả trong Attempt (Prisma) lẫn logic adaptive
export type Difficulty = "easy" | "medium" | "hard";

// Một câu hỏi được AI sinh ra (assessment hoặc quiz đều dùng chung shape này)
export interface GeneratedQuestion {
  id: string;
  text: string;
  difficulty: Difficulty;
  subject: string;
  topic: string;
  options: string[];
  correctIndex: number;
}

// Kết quả 1 dòng trong hồ sơ năng lực — map trực tiếp từ LearningProgress
// nhưng KHÔNG expose toàn bộ field DB (vd id nội bộ) ra frontend.
export interface SkillMasteryPoint {
  subject: string;
  topic: string;
  masteryPercent: number; // 0-100, đã nhân 100 từ Float 0-1 trong DB cho dễ hiển thị
  isWeak: boolean; // true nếu masteryPercent < WEAK_THRESHOLD (xem services/assessment.service.ts)
}

// Cấu trúc JSON lưu trong Roadmap.months (Prisma model Roadmap)
export interface RoadmapPlan {
  month: number;
  label: string; // "Tháng 1", hoặc "Tháng 2 — đang học"
  topics: {
    name: string;
    status: "done" | "current" | "locked";
  }[];
}

// Một tin nhắn trong hội thoại AI Tutor — khớp với Conversation.messages (JSON)
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  hintLevel?: 0 | 1 | 2 | 3; // 0 = chưa gợi ý, 1=🟢 2=🟡 3=🔴 (xem lib/ai/prompts.ts)
}

// Response chuẩn cho MỌI API route — giúp frontend xử lý lỗi đồng nhất
// thay vì mỗi route trả lỗi một kiểu khác nhau.
export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };
