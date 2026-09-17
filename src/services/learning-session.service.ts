// ================================================================
// LEARNING SESSION SERVICE
// ================================================================
// Mạch tư duy: đây là mảnh ghép cuối cùng nối "Goal -> Source -> Topic
// -> Hoạt động (quiz/exercise/diagnostic) -> Kết quả", đúng như PHASE 0
// audit đã chỉ ra là còn thiếu ("Chưa có model/session nối goal, source,
// tutor, practice, review và completion"). Thiết kế CHỦ ĐỘNG tránh
// user tự khai số liệu: startLearningSession() chỉ ghi lại THỜI ĐIỂM
// bắt đầu + mastery hiện tại (mốc "before"); completeLearningSession()
// tự đếm lại Attempt/LearningActivity thật đã xảy ra TRONG khoảng thời
// gian đó, không tin bất kỳ con số nào client gửi lên.
//
// Vì sao KHÔNG dùng chung bảng StudySession (đã có sẵn, phục vụ
// /calendar): StudySession là 1 buổi học ĐÃ LÊN LỊCH trước
// (startTime/endTime do user tự chọn trước khi học), hoàn thành = 1
// checkbox tự khai (progress: Int người dùng tự set, XP thưởng cố
// định). LearningSession ở đây ngược lại — bắt đầu NGAY LÚC học, và
// completion summary luôn được TÍNH LẠI từ dữ liệu thật. Gộp chung 2
// khái niệm sẽ làm rối logic XP hiện có của calendar (rủi ro cao,
// lợi ích thấp) nên tách bảng riêng, additive, không đụng calendar.
// ================================================================

import { prisma } from "@/lib/db/prisma";

export interface LearningSessionSummary {
  id: string;
  subject: string;
  topic: string;
  status: "active" | "completed";
  startedAt: string;
  completedAt: string | null;
  masteryBeforePercent: number | null;
  masteryAfterPercent: number | null;
  questionsAnswered: number;
  correctAnswers: number;
  xpEarned: number;
  learningGoalId: string | null;
  sourceDocumentId: string | null;
}

// Khai báo tường minh (không suy luận từ Prisma Client) vì Prisma
// Client trong sandbox phát triển hiện tại chưa được `generate` lại
// theo schema mới nhất — cùng lý do/pattern đã áp dụng ở
// assessment.service.ts (LearningProgressRow) và mistake-analysis.
interface LearningSessionRow {
  id: string;
  userId: string;
  learningGoalId: string | null;
  sourceDocumentId: string | null;
  subject: string;
  topic: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  masteryBefore: number | null;
  masteryAfter: number | null;
  questionsAnswered: number;
  correctAnswers: number;
  xpEarned: number;
}

function toPercent(mastery: number | null): number | null {
  return mastery === null || mastery === undefined ? null : Math.round(mastery * 100);
}

function toSummary(row: LearningSessionRow): LearningSessionSummary {
  return {
    id: row.id,
    subject: row.subject,
    topic: row.topic,
    status: row.status === "completed" ? "completed" : "active",
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    masteryBeforePercent: toPercent(row.masteryBefore),
    masteryAfterPercent: toPercent(row.masteryAfter),
    questionsAnswered: row.questionsAnswered,
    correctAnswers: row.correctAnswers,
    xpEarned: row.xpEarned,
    learningGoalId: row.learningGoalId,
    sourceDocumentId: row.sourceDocumentId,
  };
}

// Bắt đầu 1 buổi học mới. CHỈ cho phép 1 session "active" tại 1 thời
// điểm cho mỗi user — nếu đang có session dang dở, tự động hoàn thành
// nó trước (best-effort) thay vì chặn hoặc để "treo" mãi mãi (vd user
// rời Workspace giữa chừng không bấm nút Hoàn thành ở lần học trước).
export async function startLearningSession(
  userId: string,
  params: { subject: string; topic: string; learningGoalId?: string | null; sourceDocumentId?: string | null }
): Promise<LearningSessionSummary> {
  const subject = params.subject.trim();
  const topic = params.topic.trim();
  if (!subject || !topic || subject.length > 120 || topic.length > 160) {
    throw new Error("Thiếu hoặc sai định dạng subject/topic để bắt đầu buổi học.");
  }

  const existingActive: LearningSessionRow | null = await prisma.learningSession.findFirst({
    where: { userId, status: "active" },
    orderBy: { startedAt: "desc" },
  });
  if (existingActive) {
    try {
      await completeLearningSession(userId, existingActive.id);
    } catch (err) {
      console.error("[learning-session] Không thể tự hoàn thành session cũ trước khi bắt đầu session mới:", err);
    }
  }

  // Verify ownership — cùng pattern IDOR-guard dùng ở roadmap/calendar
  // service (findFirst theo cả id lẫn userId trước khi cho liên kết).
  if (params.learningGoalId) {
    const goal = await prisma.learningGoal.findFirst({ where: { id: params.learningGoalId, userId }, select: { id: true } });
    if (!goal) throw new Error("Lộ trình liên kết không tồn tại.");
  }
  if (params.sourceDocumentId) {
    const doc = await prisma.document.findFirst({ where: { id: params.sourceDocumentId, userId }, select: { id: true } });
    if (!doc) throw new Error("Nguồn liên kết không tồn tại.");
  }

  const progress = await prisma.learningProgress.findUnique({
    where: { userId_subject_topic: { userId, subject, topic } },
    select: { mastery: true },
  });

  const session: LearningSessionRow = await prisma.learningSession.create({
    data: {
      userId,
      subject,
      topic,
      learningGoalId: params.learningGoalId ?? null,
      sourceDocumentId: params.sourceDocumentId ?? null,
      masteryBefore: progress?.mastery ?? null,
    },
  });

  return toSummary(session);
}

export async function getActiveLearningSession(userId: string): Promise<LearningSessionSummary | null> {
  const session: LearningSessionRow | null = await prisma.learningSession.findFirst({
    where: { userId, status: "active" },
    orderBy: { startedAt: "desc" },
  });
  return session ? toSummary(session) : null;
}

// Hoàn thành buổi học — TỰ ĐẾM LẠI từ Attempt/LearningActivity thật đã
// xảy ra trong khoảng [startedAt, completedAt], KHÔNG nhận số liệu từ
// client. Idempotent: gọi lại trên session đã completed chỉ trả về
// đúng summary cũ, không tính lại (tránh 2 tab cùng bấm Complete làm
// lệch số liệu vì cửa sổ thời gian khác nhau).
export async function completeLearningSession(userId: string, sessionId: string): Promise<LearningSessionSummary> {
  const session: LearningSessionRow | null = await prisma.learningSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) throw new Error("Không tìm thấy buổi học.");
  if (session.status === "completed") return toSummary(session);

  const completedAt = new Date();
  const window = { gte: session.startedAt, lte: completedAt };

  const [questionsAnswered, correctAnswers, xpAgg, progress] = await Promise.all([
    prisma.attempt.count({ where: { userId, subject: session.subject, topic: session.topic, createdAt: window } }),
    prisma.attempt.count({ where: { userId, subject: session.subject, topic: session.topic, isCorrect: true, createdAt: window } }),
    // XP tính trong TOÀN BỘ khoảng thời gian session mở (không lọc
    // theo topic — LearningActivity không luôn được ghi kèm subject/
    // topic ở mọi loại hoạt động, xem recordLearningActivity), nên
    // đây là XP kiếm được TRONG LÚC buổi học diễn ra, không phải XP
    // CHỈ RIÊNG cho topic này nếu user mở nhiều việc song song.
    prisma.learningActivity.aggregate({ where: { userId, occurredAt: window }, _sum: { xpAwarded: true } }),
    prisma.learningProgress.findUnique({
      where: { userId_subject_topic: { userId, subject: session.subject, topic: session.topic } },
      select: { mastery: true },
    }),
  ]);

  const updated: LearningSessionRow = await prisma.learningSession.update({
    where: { id: session.id },
    data: {
      status: "completed",
      completedAt,
      questionsAnswered,
      correctAnswers,
      xpEarned: xpAgg._sum.xpAwarded ?? 0,
      masteryAfter: progress?.mastery ?? null,
    },
  });

  return toSummary(updated);
}
