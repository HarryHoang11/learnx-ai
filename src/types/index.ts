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
  // Vì sao đáp án đúng lại đúng — dùng để phản hồi sau khi trả lời và
  // ghi vào MistakeLog khi sai. KHÔNG gửi về client trước khi trả lời.
  explanation: string;
}

// Client chỉ cần text/options để render. Đáp án đúng và giải thích
// luôn nằm ở server, không gửi về trình duyệt trước khi trả lời
// (tránh lộ đáp án qua network tab).
export type PublicQuestion = Omit<GeneratedQuestion, "correctIndex" | "explanation">;

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
  hintLevel?: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0..6 cấp độ Socratic (xem lib/ai/prompts.ts)
}

// Trạng thái 1 buổi học trong lịch — định nghĩa lại ở đây (thay vì
// import StudySessionStatus từ "@prisma/client") vì đây là type dùng
// ở CẢ backend lẫn frontend (frontend không có quyền truy cập
// @prisma/client). Giá trị PHẢI khớp CHÍNH XÁC với enum StudySessionStatus
// trong prisma/schema.prisma — nếu đổi 1 bên mà quên đổi bên kia,
// TypeScript sẽ báo lỗi type mismatch ngay khi build.
export type StudySessionStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

// Mirror enum RoadmapStatus trong prisma/schema.prisma — cùng lý do
// với StudySessionStatus ở trên (frontend không import được @prisma/client).
export type RoadmapStatus = "ACTIVE" | "COMPLETED" | "ARCHIVED";

// 1 item trong danh sách "Lộ trình của tôi" — gộp LearningGoal (đơn vị
// user nhìn thấy như "1 lộ trình") với plan MỚI NHẤT của goal đó
// (Roadmap.months mới nhất, xem roadmap.service.ts -> listGoalsForUser).
// progressPercent tính từ chính plan này (số topic "done" / tổng số
// topic) — phản ánh đúng trạng thái plan tại lần AI sinh/cập nhật gần
// nhất, KHÔNG tự động re-tính khi học sinh làm quiz ở nơi khác (đây là
// giới hạn đã có sẵn từ trước trong hệ thống, xem TODO trong
// generateRoadmap(), không phải hạn chế mới phát sinh do thay đổi này).
export interface GoalWithRoadmap {
  id: string; // id của LearningGoal — dùng cho mọi thao tác PATCH/DELETE
  title: string;
  targetMonths: number;
  status: RoadmapStatus;
  createdAt: string;
  // Metadata mục tiêu (nullable — goal cũ không có vẫn hợp lệ).
  subject: string | null;
  targetOutcome: string | null;
  deadline: string | null;
  progressPercent: number;
  plan: RoadmapPlan[] | null; // null nếu goal chưa từng generate được roadmap nào (hiếm, vd lỗi AI giữa chừng)
}

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
  language: string;
}

// --- LEARNING AGENT TYPES ---
export type AgentPlanStatus = "draft" | "active" | "paused" | "completed" | "archived";

export type AgentTaskType = 
  | "diagnostic"
  | "lesson"
  | "practice"
  | "review"
  | "mindmap"
  | "roadmap"
  | "reflection";

export type AgentTaskStatus = 
  | "pending"
  | "in_progress"
  | "completed"
  | "skipped"
  | "cancelled";

export interface LearningAgentPlan {
  id: string;
  userId: string;
  title: string;
  goal: string;
  status: AgentPlanStatus;
  startDate: Date | string;
  targetDate?: Date | string;
  currentPhase: number;
  metadata?: any;
  createdAt: Date | string;
  updatedAt: Date | string;
  tasks?: LearningAgentTask[];
}

export interface LearningAgentTask {
  id: string;
  planId: string;
  userId: string;
  title: string;
  description?: string;
  type: AgentTaskType;
  topic?: string;
  priority: number;
  status: AgentTaskStatus;
  dueDate?: Date | string;
  completedAt?: Date | string;
  estimatedMinutes: number;
  metadata?: any;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Môn học kèm danh sách chủ đề — khớp với response của
// GET /api/community/subjects?includeTopics=true và props của
// SubjectFilter/SubjectTopicItem.
export interface SubjectTopicItem {
  id: string;
  name: string;
  icon?: string | null;
}

export interface SubjectWithTopics {
  id: string;
  name: string;
  icon?: string | null;
  topics?: SubjectTopicItem[];
}

// Bộ lọc trang duyệt tài liệu cộng đồng — dùng chung cho state
// filters ở community/page.tsx để tránh `any`.
export interface BrowseFilters {
  subjectId: string;
  topicId: string;
  difficulty: string;
  language: string;
  grade: string;
  search: string;
  sortBy: string;
  trustLevel: string;
  page: number;
  limit: number;
}

// Tài liệu cộng đồng kèm relations — khớp với Prisma CommunityDocument
// + các field tính toán mà service trả về (averageRating, userRating...).
// Định nghĩa tập trung ở đây để DocumentCard/DocumentDetail/page dùng chung.
export interface CommunityDocumentWithRelations {
  id: string;
  title: string;
  description?: string | null;
  fileName: string;
  difficulty?: string | null;
  language?: string | null;
  qualityScore: number;
  trustScore: number;
  trustLevel: string;
  averageRating: number;
  ratingCount: number;
  helpfulVotes: number;
  viewCount: number;
  downloadCount: number;
  saveCount: number;
  tags: string[];
  summary?: string | null;
  aiQuality?: Record<string, number> | null;
  aiEvaluatedAt?: Date | string | null;
  uploadedAt: Date | string;
  publishedAt?: Date | string | null;
  owner: { id: string; name?: string | null; nickname?: string | null; image?: string | null };
  subject?: { icon?: string | null; name: string } | null;
  topic?: { icon?: string | null; name: string } | null;
}
