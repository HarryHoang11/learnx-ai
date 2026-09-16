// ================================================================
// ASSESSMENT SERVICE
// ================================================================
// Mạch tư duy: đây là "bộ não" của tính năng Diagnostic Test.
// 2 trách nhiệm chính, tách bạch rõ ràng:
//   1) pickNextDifficulty() — logic ADAPTIVE: câu tiếp theo nên khó
//      hay dễ hơn, dựa trên việc học sinh vừa đúng/sai.
//   2) updateMastery() — biến 1 Attempt (đúng/sai) thành thay đổi
//      trong LearningProgress.mastery (hồ sơ năng lực TỔNG HỢP).
// Route (api/assessment/*) KHÔNG được tự viết 2 logic này — mọi thay
// đổi công thức tính adaptive/mastery chỉ sửa Ở ĐÂY, một chỗ duy nhất.
// ================================================================

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { Difficulty, SkillMasteryPoint } from "@/types";

// Ngưỡng coi là "yếu" — dưới mức này thì bị gắn cờ ⚠ trên UI.
// Đặt thành hằng số ở đây để mọi nơi (roadmap, progress, tutor) dùng
// chung MỘT định nghĩa "yếu là gì", tránh mỗi chỗ tự đặt ngưỡng khác nhau.
export const WEAK_THRESHOLD_PERCENT = 65;

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];

// --- 1) ADAPTIVE BRANCHING ---
// Input: độ khó câu vừa làm + đúng/sai.
// Output: độ khó câu tiếp theo.
// Quy tắc (khớp với sơ đồ "AI Diagnostic Test" trong bản kế hoạch gốc):
//   - Đúng ở "dễ" -> lên "trung bình"
//   - Đúng ở "trung bình" -> lên "khó"
//   - Đúng ở "khó" -> giữ nguyên "khó" (đã chạm trần)
//   - Sai ở bất kỳ đâu -> lùi xuống 1 bậc (không rơi thẳng về "dễ"
//     ngay, để tránh dao động quá mạnh chỉ vì 1 câu sai ngẫu nhiên)
export function pickNextDifficulty(current: Difficulty, wasCorrect: boolean): Difficulty {
  const idx = DIFFICULTY_ORDER.indexOf(current);
  if (wasCorrect) {
    const nextIdx = Math.min(idx + 1, DIFFICULTY_ORDER.length - 1);
    return DIFFICULTY_ORDER[nextIdx];
  }
  const prevIdx = Math.max(idx - 1, 0);
  return DIFFICULTY_ORDER[prevIdx];
}

// --- 2) CẬP NHẬT HỒ SƠ NĂNG LỰC ---
// Dùng upsert dựa trên unique key [userId, subject, topic] đã khai
// báo trong schema.prisma — nghĩa là:
//   - Lần đầu học chủ đề này -> tạo dòng mới, mastery = (đúng ? 1 : 0)
//   - Đã có dữ liệu -> cộng dồn attempts/correct, tính lại mastery
//     bằng correct/attempts (đơn giản, dễ giải thích trước ban giám
//     khảo, thay vì dùng công thức Bayesian phức tạp cho MVP).
export async function updateMastery(params: {
  userId: string;
  subject: string;
  topic: string;
  isCorrect: boolean;
}, db: Pick<Prisma.TransactionClient, "learningProgress"> = prisma): Promise<void> {
  const existing = await db.learningProgress.findUnique({
    where: {
      userId_subject_topic: {
        userId: params.userId,
        subject: params.subject,
        topic: params.topic,
      },
    },
  });

  const attempts = (existing?.attempts ?? 0) + 1;
  const correct = (existing?.correct ?? 0) + (params.isCorrect ? 1 : 0);
  const mastery = correct / attempts;

  await db.learningProgress.upsert({
    where: {
      userId_subject_topic: {
        userId: params.userId,
        subject: params.subject,
        topic: params.topic,
      },
    },
    create: { userId: params.userId, subject: params.subject, topic: params.topic, attempts, correct, mastery },
    update: { attempts, correct, mastery },
  });
}

// --- HELPER: lấy toàn bộ hồ sơ năng lực của 1 user, format sẵn cho UI ---
// Dùng chung bởi api/assessment/result, api/progress, và
// roadmap.service.ts (để biết topic nào đang yếu khi sinh lộ trình).
//
// LearningProgressRow khai báo tường minh (thay vì để TS tự suy luận
// từ Prisma Client) vì Prisma Client trong sandbox phát triển hiện
// tại chưa được `generate` lại theo schema mới nhất, nên kiểu trả về
// có thể không chính xác — khai báo tay đảm bảo an toàn kiểu độc lập
// với trạng thái generate của Prisma Client.
interface LearningProgressRow {
  subject: string;
  topic: string;
  mastery: number;
}

export async function getSkillProfile(userId: string): Promise<SkillMasteryPoint[]> {
  const rows: LearningProgressRow[] = await prisma.learningProgress.findMany({ where: { userId } });
  return rows.map((r: LearningProgressRow) => {
    const masteryPercent = Math.round(r.mastery * 100);
    return {
      subject: r.subject,
      topic: r.topic,
      masteryPercent,
      isWeak: masteryPercent < WEAK_THRESHOLD_PERCENT,
    };
  });
}

// --- Helper: lấy hồ sơ năng lực theo môn học cụ thể ---
// Dùng cho trang diagnostic khi đã chọn môn: chỉ hiển thị mastery của
// chính môn đó, KHÔNG đè môn khác (Phase 4 multi-subject).
export async function getSkillProfileBySubject(userId: string, subject: string): Promise<SkillMasteryPoint[]> {
  const rows: LearningProgressRow[] = await prisma.learningProgress.findMany({
    where: { userId, subject },
  });
  return rows.map((r: LearningProgressRow) => {
    const masteryPercent = Math.round(r.mastery * 100);
    return {
      subject: r.subject,
      topic: r.topic,
      masteryPercent,
      isWeak: masteryPercent < WEAK_THRESHOLD_PERCENT,
    };
  });
}

// --- Helper: kiểm tra trạng thái đã làm bài kiểm tra năng lực theo môn ---
// Dùng cho Phase 5: hiển thị trạng thái "Đã kiểm tra" / "Chưa kiểm tra"
// / "Kết quả cũ" trước khi người dùng bắt đầu. Người dùng vẫn có thể
// retake tùy ý.
export async function getAssessmentHistoryBySubject(userId: string): Promise<
  Array<{
    subject: string;
    completed: boolean;
    completedAt: Date | null;
    lastMastery: number;
  }>
> {
  const rows = await prisma.$queryRaw<
    Array<{
      subject: string;
      completed: boolean;
      completedAt: Date | null;
      lastMastery: number;
    }>
  >`SELECT subject,
     bool_or(status = 'completed' OR "completedAt" IS NOT NULL) as completed,
     max("completedAt") as "completedAt",
     COALESCE(ROUND(MAX(lp.mastery) * 100), 0) as "lastMastery"
   FROM "Assessment" a
   LEFT JOIN "Attempt" att ON att."assessmentId" = a.id
   LEFT JOIN "LearningProgress" lp ON lp."userId" = a."userId" AND lp.subject = a.subject
   WHERE a."userId" = ${userId}
     AND a.subject IS NOT NULL
   GROUP BY subject`;

  return rows;
}
