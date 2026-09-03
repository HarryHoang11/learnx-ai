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

// Trạng thái 1 buổi học trong lịch — định nghĩa lại ở đây (thay vì
// import StudySessionStatus từ "@prisma/client") vì đây là type dùng
// ở CẢ backend lẫn frontend (frontend không có quyền truy cập
// @prisma/client). Giá trị PHẢI khớp CHÍNH XÁC với enum StudySessionStatus
// trong prisma/schema.prisma — nếu đổi 1 bên mà quên đổi bên kia,
// TypeScript sẽ báo lỗi type mismatch ngay khi build.
export type StudySessionStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

// Response chuẩn cho MỌI API route — giúp frontend xử lý lỗi đồng nhất
// thay vì mỗi route trả lỗi một kiểu khác nhau.
export type ApiResponse<T> =
  | { success: true; data: T }
  // debug là optional, CHỈ được điền khi NODE_ENV === "development" (xem
  // các route trong api/roadmap/generate, api/assessment/start,
  // api/ai/chat) — dùng để lộ message lỗi thật ra Network tab lúc dev,
  // giúp debug nhanh hơn thay vì chỉ thấy "500 Internal Server Error".
  // Khai báo optional ở đây để tránh lỗi "excess property" của
  // TypeScript khi các route gán thêm field này vào object literal.
  | { success: false; error: string; debug?: string };

// Hồ sơ trang cá nhân — map từ User (Prisma) nhưng CHỈ expose field an
// toàn hiển thị công khai trên trang cá nhân (không lộ passwordHash,
// role nội bộ dùng riêng, v.v).
export interface UserProfile {
  id: string;
  name: string | null;
  nickname: string | null;
  email: string;
  bio: string | null;
  image: string | null;
  coverImage: string | null;
}