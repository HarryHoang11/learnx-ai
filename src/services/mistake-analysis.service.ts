// ================================================================
// MISTAKE ANALYSIS SERVICE
// ================================================================
// Mạch tư duy: LearningProgress.mastery cho biết "đang yếu topic
// nào" ở mức % chung chung, nhưng không nói RÕ học sinh đang sai cái
// gì. MistakeLog (ghi mỗi lần chọn sai ở quiz/diagnostic — xem
// submitQuizAnswer trong quiz.service.ts) lưu lại question/explanation
// thật, nên gộp theo (subject, topic) sẽ lộ ra "misconception" lặp
// lại — đúng như flow đích: "AI phát hiện: Bạn đang sai substitution"
// -> Targeted Practice. Service này CHỈ query Prisma rồi giao logic
// gộp/sắp xếp cho hàm thuần groupIntoWeakConcepts (xem
// src/lib/mistakes/groupWeakConcepts.ts — tách ra để unit test được
// mà không cần mock Prisma). Không sinh câu hỏi ở đây — việc đó vẫn
// dùng generateQuizQuestion sẵn có, gọi lại đúng subject/topic/
// sourceDocumentId lấy được từ service này.
// ================================================================

import { prisma } from "@/lib/db/prisma";
import { groupIntoWeakConcepts, type MistakeLogRow, type WeakConcept } from "@/lib/mistakes/groupWeakConcepts";

export type { MistakeLogRow, WeakConcept };

// Chỉ nhìn lỗi sai gần đây — lỗi cũ đã luyện lại/đã cải thiện thì
// không nên tiếp tục "kết án" học sinh mãi theo nó.
const MISTAKE_WINDOW_DAYS = 30;

export interface RecentMistake {
  id: string;
  subject: string;
  topic: string;
  questionText: string;
  selectedAnswer: string;
  correctAnswer: string;
  explanation: string | null;
  sourceDocumentId: string | null;
  createdAt: string;
}

export async function getWeakConcepts(userId: string, limit = 5): Promise<WeakConcept[]> {
  const since = new Date(Date.now() - MISTAKE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const mistakes = await prisma.mistakeLog.findMany({
    where: { userId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    // Trần hợp lý — user hoạt động lâu năm không kéo cả bảng vào bộ nhớ
    // chỉ để group-by ở tầng ứng dụng.
    take: 500,
  }) as MistakeLogRow[];

  return groupIntoWeakConcepts(mistakes, limit);
}

export async function getRecentMistakes(userId: string, limit = 10): Promise<RecentMistake[]> {
  const rows = await prisma.mistakeLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 50),
  }) as MistakeLogRow[];

  return rows.map((row: MistakeLogRow) => ({
    id: row.id,
    subject: row.subject,
    topic: row.topic,
    questionText: row.questionText,
    selectedAnswer: row.selectedAnswer,
    correctAnswer: row.correctAnswer,
    explanation: row.explanation,
    sourceDocumentId: row.sourceDocumentId,
    createdAt: row.createdAt.toISOString(),
  }));
}
