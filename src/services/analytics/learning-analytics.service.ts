// ================================================================
// LEARNING ANALYTICS — aggregate từ dữ liệu học THẬT của user
// ================================================================
// Không snapshot JSON. Mastery lịch sử suy từ Attempt + LearningProgress
// (correct/attempts chạy dồn). Identity chỉ nhận từ caller đã auth.

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { parseAnalyticsFilters, toAttemptWhere } from "./filters";
import { listGoalsForUser } from "@/services/roadmap.service";
import { getUserAchievements } from "@/services/achievement.service";
import { WEAK_THRESHOLD_PERCENT } from "@/services/assessment.service";
import { enumerateDayKeys, parseAnalyticsRange, resolveAnalyticsWindow, fillDailySeries, toDayKey, type AnalyticsRangeId } from "./range";
import {
  composeLearningScore,
  computeConsistencyScore,
  computeGoalScore,
  computeImprovementScore,
  computePracticeScore,
  computeReviewScore,
  computeSkillScore,
} from "./score";
import {
  directionFromDelta,
  enoughEvidence,
  isMastered,
  isWeakSkill,
  masteryFromCounts,
  pearsonCorrelation,
  pointDelta,
  previousMasteryFromTotals,
  relativeDelta,
  skillTrend,
} from "./skill-math";
import { buildDeterministicInsight } from "./insights";
import { buildOutcomeBreakdown, buildSubjectTimeShare } from "./outcomes";
import { buildFocusAreas, buildSkillActions, buildWeeklyReport, topRecommendations } from "./recommendations";
import type {
  AccuracyBreakdown,
  ActivityMixRow,
  AnalyticsFilterOptions,
  AnalyticsFilters,
  CommonMistake,
  CorrelationResult,
  DailyActivityPoint,
  DataAvailability,
  DifficultyAnalyticsRow,
  GoalProgressCard,
  JourneyMonth,
  LearningAnalyticsPayload,
  MetricComparison,
  SinceAssessment,
  SkillAnalyticsRow,
  SkillEvidence,
  StudyTimeStats,
  SubjectAnalyticsRow,
  TopicAnalyticsRow,
} from "./types";
import type { RoadmapPlan } from "@/types";

interface DayCountRow {
  day: Date | string;
  n: number | bigint;
  extra?: number | bigint | null;
}

interface SkillAttemptRow {
  subject: string;
  topic: string;
  attempts: number | bigint;
  correct: number | bigint;
  last_at: Date | null;
}

interface DiffRow {
  difficulty: string;
  attempts: number | bigint;
  correct: number | bigint;
}

interface MonthSkillRow {
  month: string;
  subject: string;
  topic: string;
  attempts: number | bigint;
  correct: number | bigint;
}

function n(value: number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "bigint" ? Number(value) : value;
}

function dayKeyFromSql(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/** Cắt câu hỏi dài cho UI mà không phá từ. */
function truncate(text: string, max = 80): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Field lọc phẳng để spread vào `where` của Prisma.
 *
 * `difficulty` CHỈ có ở bảng `Attempt`. Bảng `MistakeLog` chỉ có
 * subject/topic, nên truyền cả `difficulty` vào sẽ khiến Prisma ném
 * "Unknown argument `difficulty`" và làm hỏng cả trang analytics. Vì vậy
 * bản dùng cho MistakeLog là `pickTopicFilters` bên dưới.
 */
function pickFilters(filters: AnalyticsFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.subject) out.subject = filters.subject;
  if (filters.topic) out.topic = filters.topic;
  if (filters.difficulty) out.difficulty = filters.difficulty;
  return out;
}

/**
 * Bản THU HẸP cho bảng không có cột `difficulty` (MistakeLog).
 *
 * Hệ quả cần nói rõ: khi người dùng lọc theo độ khó, danh sách lỗi sai vẫn
 * hiện (và KHÔNG được gắn nhãn là đã lọc theo độ khó) — MistakeLog không lưu
 * độ khó nên không thể suy ra. Đây là giới hạn của dữ liệu, không phải lỗi
 * logic; bịa thêm điều kiện chỉ khiến kết quả sai.
 */
function pickTopicFilters(filters: AnalyticsFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.subject) out.subject = filters.subject;
  if (filters.topic) out.topic = filters.topic;
  return out;
}

/**
 * Đoạn SQL lọc theo môn cho các query raw.
 *
 * Dùng `${Prisma.sql}` chứ không nội suy chuỗi: giá trị lọc tới từ URL nên
 * phải được bind như tham số, tuyệt đối không ghép thẳng vào SQL.
 */
function subjectSql(filters: AnalyticsFilters) {
  return filters.subject ? Prisma.sql`AND subject = ${filters.subject}` : Prisma.empty;
}

/** Tương tự `subjectSql` cho `topic` — dùng cho các query raw. */
function topicSql(filters: AnalyticsFilters) {
  return filters.topic ? Prisma.sql`AND topic = ${filters.topic}` : Prisma.empty;
}

/**
 * Tương tự cho `difficulty`.
 *
 * CHỈ dùng cho query trên bảng `Attempt` — `MistakeLog`, `LearningSession`,
 * `LearningProgress` không có cột này, nên lọc theo difficulty trên các bảng
 * đó sẽ ném lỗi Prisma. Đó là lý do `pickTopicFilters` bên dưới cố tình BỎ
 * difficulty thay vì cố ép.
 */
function difficultySql(filters: AnalyticsFilters) {
  return filters.difficulty ? Prisma.sql`AND difficulty = ${filters.difficulty}` : Prisma.empty;
}

/** Thứ tự hiển thị độ khó — không phải thứ tự DB trả về. */
const DIFFICULTY_ORDER = ["easy", "medium", "hard"];

/** Thời gian học theo môn lấy từ LearningSession, gộp vào map để tra nhanh. */
function toSubjectMinutes(rows: Array<{ subject: string; minutes: number }>): Map<string, number> {
  return new Map(rows.map((r) => [r.subject, Math.round(r.minutes)]));
}

function metric(current: number, previous: number | null, kind: MetricComparison["kind"]): MetricComparison {
  const delta = kind === "pp" ? pointDelta(current, previous) : kind === "percent" ? relativeDelta(current, previous) : pointDelta(current, previous);
  return {
    current,
    previous,
    delta,
    kind,
    direction: directionFromDelta(delta),
  };
}

function availability(attempts: number, sessions: number, reviews: number): DataAvailability {
  const events = attempts + sessions + reviews;
  if (events === 0) return "empty";
  if (attempts < 8 && sessions < 3) return "low";
  return "ready";
}

/**
 * Tính analytics cho 1 user.
 *
 * @param rangeRaw  Khoảng thời gian; sai định dạng thì về "30d".
 * @param filtersRaw Bộ lọc subject/topic/difficulty đã chuẩn hoá (xem ./filters).
 *                   Bỏ qua khi không có.
 *
 * LƯU Ý QUAN TRỌNG: `userId` phải đến từ session đã xác thực (getCurrentUserId).
 * Hàm này KHÔNG tự kiểm tra quyền — nếu ai đó gọi trực tiếp với userId của
 * người khác thì sẽ đọc được dữ liệu người đó. Đó là lý do các API route
 * LUÔN lấy userId từ `getCurrentUserId()` chứ không bao giờ từ query/body.
 */
export async function getLearningAnalytics(
  userId: string,
  rangeRaw?: string | null,
  filtersRaw: AnalyticsFilters = {}
): Promise<LearningAnalyticsPayload> {
  const rangeId = parseAnalyticsRange(rangeRaw);
  const filters = filtersRaw;
  const window = resolveAnalyticsWindow(rangeId);
  const { start, end, previousStart, previousEnd, dayCount } = window;
  const days = rangeId === "all" ? enumerateDayKeys(addDays(end, -90), end) : enumerateDayKeys(start, end);

  // Điều kiện lọc dùng chung cho các query Attempt/LearningSession.
  const attemptWhereInRange = toAttemptWhere(userId, filters, { gte: start, lt: end });
  const attemptWherePrev = previousStart && previousEnd
    ? toAttemptWhere(userId, filters, { gte: previousStart, lt: previousEnd })
    : null;

  const [
    progressRows,
    currentAttemptAgg,
    previousAttemptAgg,
    skillRange,
    skillPrev,
    skillLast,
    dailyAttempts,
    dailyXp,
    dailyExercises,
    dailyReviews,
    dailyTutor,
    sessionStats,
    prevSessionStats,
    dailySessionMinutes,
    subjectTimeShareRows,
    outcomeRows,
    abandonedSessions,
    reviewMinutes,
    prevReviewAgg,
    exerciseCount,
    prevExerciseCount,
    uniqueExercises,
    reviewCount,
    prevReviewCount,
    reviewItemCount,
    tutorCount,
    prevTutorCount,
    documentsStudied,
    streak,
    xpInRange,
    lxpInRange,
    xpPrev,
    diagnosticCount,
    mistakeRows,
    topMistakeQuestions,
    goals,
    overdueTasks,
    achievements,
    hourRows,
    monthSkills,
    difficultyRows,
    subjectRows,
    completedSessions,
    prevCompletedSessions,
    attemptPairs,
    attemptDifficulties,
    subjectSessionRows,
    activityMixRows,
    firstAssessment,
  ] = await Promise.all([
    prisma.learningProgress.findMany({
      where: { userId },
      select: { subject: true, topic: true, mastery: true, attempts: true, correct: true, updatedAt: true },
    }),
    prisma.attempt.groupBy({
      by: ["isCorrect"],
      where: attemptWhereInRange,
      _count: { _all: true },
    }),
    previousStart && previousEnd
      ? prisma.attempt.groupBy({
          by: ["isCorrect"],
          where: attemptWherePrev as Record<string, unknown>,
          _count: { _all: true },
        })
      : Promise.resolve([] as Array<{ isCorrect: boolean; _count: { _all: number } }>),
    prisma.$queryRaw<SkillAttemptRow[]>`
      SELECT subject, topic, COUNT(*)::int AS attempts,
             COUNT(*) FILTER (WHERE "isCorrect")::int AS correct,
             MAX("createdAt") AS last_at
      FROM "Attempt"
      WHERE "userId" = ${userId} AND "createdAt" >= ${start} AND "createdAt" < ${end}
      GROUP BY subject, topic
    `,
    previousStart && previousEnd
      ? prisma.$queryRaw<SkillAttemptRow[]>`
          SELECT subject, topic, COUNT(*)::int AS attempts,
                 COUNT(*) FILTER (WHERE "isCorrect")::int AS correct,
                 MAX("createdAt") AS last_at
          FROM "Attempt"
          WHERE "userId" = ${userId} AND "createdAt" >= ${previousStart} AND "createdAt" < ${previousEnd}
          GROUP BY subject, topic
        `
      : Promise.resolve([] as SkillAttemptRow[]),
    prisma.$queryRaw<SkillAttemptRow[]>`
      SELECT subject, topic, COUNT(*)::int AS attempts,
             COUNT(*) FILTER (WHERE "isCorrect")::int AS correct,
             MAX("createdAt") AS last_at
      FROM "Attempt"
      WHERE "userId" = ${userId}
      GROUP BY subject, topic
    `,
    prisma.$queryRaw<Array<{ day: Date; attempts: number; correct: number }>>`
      SELECT ("createdAt" AT TIME ZONE 'UTC')::date AS day,
             COUNT(*)::int AS attempts,
             COUNT(*) FILTER (WHERE "isCorrect")::int AS correct
      FROM "Attempt"
      WHERE "userId" = ${userId} AND "createdAt" >= ${rangeId === "all" ? addDays(end, -90) : start} AND "createdAt" < ${end}
      GROUP BY 1
    `,
    prisma.$queryRaw<Array<{ day: Date; xp: number }>>`
      SELECT "date" AS day, "xpEarned"::int AS xp
      FROM "LearningDay"
      WHERE "userId" = ${userId} AND "date" >= ${rangeId === "all" ? addDays(end, -90) : start} AND "date" < ${end}
    `,
    prisma.$queryRaw<Array<{ day: Date; n: number }>>`
      SELECT ("createdAt" AT TIME ZONE 'UTC')::date AS day, COUNT(*)::int AS n
      FROM "ExerciseAttempt"
      WHERE "userId" = ${userId} AND "createdAt" >= ${rangeId === "all" ? addDays(end, -90) : start} AND "createdAt" < ${end}
      GROUP BY 1
    `,
    prisma.$queryRaw<Array<{ day: Date; n: number; minutes: number }>>`
      SELECT ("reviewedAt" AT TIME ZONE 'UTC')::date AS day,
             COUNT(*)::int AS n,
             COALESCE(SUM("timeSpentSec"), 0)::float / 60 AS minutes
      FROM "ReviewAttempt"
      WHERE "userId" = ${userId} AND "reviewedAt" >= ${rangeId === "all" ? addDays(end, -90) : start} AND "reviewedAt" < ${end}
      GROUP BY 1
    `,
    prisma.$queryRaw<Array<{ day: Date; n: number; minutes: number }>>`
      SELECT ("startedAt" AT TIME ZONE 'UTC')::date AS day,
             COUNT(*)::int AS n,
             COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE("completedAt", "startedAt") - "startedAt")) / 60), 0)::float AS minutes
      FROM "TutorSession"
      WHERE "userId" = ${userId} AND "startedAt" >= ${rangeId === "all" ? addDays(end, -90) : start} AND "startedAt" < ${end}
      GROUP BY 1
    `,
    prisma.$queryRaw<Array<{ minutes: number; sessions: number; longest: number }>>`
      SELECT COALESCE(SUM(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) / 60), 0)::float AS minutes,
             COUNT(*)::int AS sessions,
             COALESCE(MAX(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) / 60), 0)::float AS longest
      FROM "LearningSession"
      WHERE "userId" = ${userId} AND "completedAt" IS NOT NULL
        AND "startedAt" >= ${start} AND "startedAt" < ${end}
    `,
    previousStart && previousEnd
      ? prisma.$queryRaw<Array<{ minutes: number; sessions: number }>>`
          SELECT COALESCE(SUM(EXTRACT(EPOCH FROM ("completedAt" - "startedAt")) / 60), 0)::float AS minutes,
                 COUNT(*)::int AS sessions
          FROM "LearningSession"
          WHERE "userId" = ${userId} AND "completedAt" IS NOT NULL
            AND "startedAt" >= ${previousStart} AND "startedAt" < ${previousEnd}
        `
      : Promise.resolve([{ minutes: 0, sessions: 0 }]),
    prisma.$queryRaw<Array<{ day: Date; minutes: number; n: number }>>`
      SELECT ("startedAt" AT TIME ZONE 'UTC')::date AS day,
             COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE("completedAt", "startedAt") - "startedAt")) / 60), 0)::float AS minutes,
             COUNT(*)::int AS n
      FROM "LearningSession"
      WHERE "userId" = ${userId}
        AND "startedAt" >= ${rangeId === "all" ? addDays(end, -90) : start} AND "startedAt" < ${end}
      GROUP BY 1
    `,
    // ---- Phân bổ thời gian theo môn (§8) ----
    // CÙNG công thức thời gian với query "all-time study time" ngay trên: có
    // `COALESCE("completedAt","startedAt")` nên phiên bỏ dở vẫn được tính (với
    // thời lượng bằng 0) — đồng nhất, không lệch giữa KPI và biểu đồ.
    // GROUP BY "subject" chạy trong DB: không kéo từng LearningSession về JS.
    prisma.$queryRaw<Array<{ subject: string; minutes: number; sessions: number }>>`
      SELECT "subject",
             COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE("completedAt", "startedAt") - "startedAt")) / 60), 0)::float AS minutes,
             COUNT(*)::int AS sessions
      FROM "LearningSession"
      WHERE "userId" = ${userId}
        AND "startedAt" >= ${rangeId === "all" ? addDays(end, -90) : start} AND "startedAt" < ${end}
      GROUP BY "subject"
      HAVING COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE("completedAt", "startedAt") - "startedAt")) / 60), 0) > 0
      ORDER BY minutes DESC
      LIMIT 8
    `,
    // ---- Đúng / Sai (§9) ----
    // Gộp Attempt (câu hỏi trắc nghiệm + diagnostic) và ExerciseAttempt (bài
    // tập). Cả hai đều có cột isCorrect nên SQL UNION được thẳng — không cần
    // kéo về JS rồi tự đếm (đó là lỗi hiệu năng kinh điển).
    prisma.$queryRaw<Array<{ correct: number; incorrect: number }>>`
      SELECT
        COALESCE(SUM(c.correct), 0)::int  AS correct,
        COALESCE(SUM(c.total - c.correct), 0)::int AS incorrect
      FROM (
        SELECT COUNT(*)::int AS total,
               COALESCE(SUM(CASE WHEN "isCorrect" THEN 1 ELSE 0 END), 0)::int AS correct
        FROM "Attempt" WHERE "userId" = ${userId} AND "createdAt" >= ${start} AND "createdAt" < ${end}
        UNION ALL
        SELECT COUNT(*)::int AS total,
               COALESCE(SUM(CASE WHEN "isCorrect" THEN 1 ELSE 0 END), 0)::int AS correct
        FROM "ExerciseAttempt" WHERE "userId" = ${userId} AND "createdAt" >= ${start} AND "createdAt" < ${end}
      ) AS c
    `,
    // Phiên học bỏ dở: đã trả lời ít nhất 1 câu nhưng chưa completedAt.
    prisma.learningSession.count({
      where: {
        userId,
        startedAt: { gte: start, lt: end },
        completedAt: null,
        questionsAnswered: { gt: 0 },
      },
    }),
    prisma.reviewAttempt.aggregate({
      where: { userId, reviewedAt: { gte: start, lt: end } },
      _sum: { timeSpentSec: true },
      _count: { _all: true },
    }),
    previousStart && previousEnd
      ? prisma.reviewAttempt.aggregate({
          where: { userId, reviewedAt: { gte: previousStart, lt: previousEnd } },
          _sum: { timeSpentSec: true },
          _count: { _all: true },
        })
      : Promise.resolve({ _sum: { timeSpentSec: 0 }, _count: { _all: 0 } }),
    prisma.exerciseAttempt.count({ where: { userId, createdAt: { gte: start, lt: end } } }),
    previousStart && previousEnd
      ? prisma.exerciseAttempt.count({ where: { userId, createdAt: { gte: previousStart, lt: previousEnd } } })
      : Promise.resolve(0),
    prisma.exerciseAttempt.findMany({
      where: { userId, createdAt: { gte: start, lt: end }, isCorrect: true },
      distinct: ["exerciseId"],
      select: { exerciseId: true },
    }),
    prisma.reviewAttempt.count({ where: { userId, reviewedAt: { gte: start, lt: end } } }),
    previousStart && previousEnd
      ? prisma.reviewAttempt.count({ where: { userId, reviewedAt: { gte: previousStart, lt: previousEnd } } })
      : Promise.resolve(0),
    prisma.reviewItem.count({ where: { userId } }),
    prisma.tutorSession.count({ where: { userId, startedAt: { gte: start, lt: end } } }),
    previousStart && previousEnd
      ? prisma.tutorSession.count({ where: { userId, startedAt: { gte: previousStart, lt: previousEnd } } })
      : Promise.resolve(0),
    prisma.learningSession.findMany({
      where: { userId, sourceDocumentId: { not: null }, startedAt: { gte: start, lt: end } },
      distinct: ["sourceDocumentId"],
      select: { sourceDocumentId: true },
    }),
    prisma.streak.findUnique({ where: { userId }, select: { currentStreak: true, longestStreak: true } }),
    prisma.xPTransaction.aggregate({
      where: { userId, createdAt: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
    prisma.pointTransaction.aggregate({
      where: { userId, createdAt: { gte: start, lt: end }, amount: { gt: 0 } },
      _sum: { amount: true },
    }),
    previousStart && previousEnd
      ? prisma.xPTransaction.aggregate({
          where: { userId, createdAt: { gte: previousStart, lt: previousEnd } },
          _sum: { amount: true },
        })
      : Promise.resolve({ _sum: { amount: 0 } }),
    prisma.diagnosticSession.count({ where: { userId, status: "completed" } }),
    prisma.mistakeLog.groupBy({
      by: ["subject", "topic"],
      where: { userId, createdAt: { gte: start, lt: end }, ...pickTopicFilters(filters) },
      _count: { _all: true },
      orderBy: { _count: { topic: "desc" } },
      take: 12,
    }),
    // Câu sai NHIỀU NHẤT trong mỗi (subject, topic) — bằng chứng thật cho
    // "main issue" của Focus Area. DISTINCT ON (Postgres) lấy đúng 1 dòng
    // nhiều nhất mỗi nhóm sau khi đã đếm số lần sai theo từng câu.
    prisma.$queryRaw<Array<{ subject: string; topic: string; question_text: string; n: number }>>`
      SELECT DISTINCT ON (subject, topic) subject, topic, question_text, n
      FROM (
        SELECT subject, topic, "questionText" AS question_text, COUNT(*)::int AS n
        FROM "MistakeLog"
        WHERE "userId" = ${userId} AND "createdAt" >= ${start} AND "createdAt" < ${end}
        ${subjectSql(filters)}
        ${topicSql(filters)}
        GROUP BY subject, topic, "questionText"
      ) t
      ORDER BY subject, topic, n DESC
    `,
    listGoalsForUser(userId),
    prisma.learningAgentTask.count({
      where: { userId, status: { not: "completed" }, dueDate: { lt: end } },
    }),
    getUserAchievements(userId),
    prisma.$queryRaw<Array<{ hour: number; n: number }>>`
      SELECT EXTRACT(HOUR FROM "startedAt")::int AS hour, COUNT(*)::int AS n
      FROM "LearningSession"
      WHERE "userId" = ${userId} AND "completedAt" IS NOT NULL
        AND "startedAt" >= ${start} AND "startedAt" < ${end}
        ${subjectSql(filters)}
        ${topicSql(filters)}
      GROUP BY 1
    `,
    prisma.$queryRaw<MonthSkillRow[]>`
      SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
             subject, topic,
             COUNT(*)::int AS attempts,
             COUNT(*) FILTER (WHERE "isCorrect")::int AS correct
      FROM "Attempt"
      WHERE "userId" = ${userId}
        ${subjectSql(filters)}
        ${topicSql(filters)}
        ${difficultySql(filters)}
      GROUP BY 1, 2, 3
      ORDER BY 1
    `,
    prisma.$queryRaw<DiffRow[]>`
      SELECT difficulty, COUNT(*)::int AS attempts,
             COUNT(*) FILTER (WHERE "isCorrect")::int AS correct
      FROM "Attempt"
      WHERE "userId" = ${userId} AND "createdAt" >= ${start} AND "createdAt" < ${end}
        ${subjectSql(filters)}
        ${topicSql(filters)}
        ${difficultySql(filters)}
      GROUP BY difficulty
    `,
    prisma.$queryRaw<Array<{ subject: string; attempts: number; correct: number }>>`
      SELECT subject, COUNT(*)::int AS attempts,
             COUNT(*) FILTER (WHERE "isCorrect")::int AS correct
      FROM "Attempt"
      WHERE "userId" = ${userId} AND "createdAt" >= ${start} AND "createdAt" < ${end}
        ${subjectSql(filters)}
        ${topicSql(filters)}
        ${difficultySql(filters)}
      GROUP BY subject
    `,
    prisma.learningSession.count({ where: { userId, completedAt: { not: null }, startedAt: { gte: start, lt: end } } }),
    previousStart && previousEnd
      ? prisma.learningSession.count({
          where: { userId, completedAt: { not: null }, startedAt: { gte: previousStart, lt: previousEnd } },
        })
      : Promise.resolve(0),
    // ==== Dữ liệu MỚI cho filters + LearningActivity + chẩn đoán nền tảng ====
    // Tất cả chạy SONG SONG trong cùng Promise.all (không +1 round-trip).

    // Danh sách môn/topic/độ khó thực sự có dữ liệu -> dựng dropdown filter.
    // Cố ý KHÔNG lấy từ danh sách môn cố định trong code: tên môn trong DB
    // là dữ liệu thật, có thể gồm cả môn cộng đồng tự tạo.
    //
    // DÙNG groupBy, KHÔNG dùng `distinct`. `distinct: ["subject"]` của Prisma
    // chỉ trả về MỘT hàng cho mỗi môn, nên `topic`/`difficulty` đọc từ đó là
    // thiếu — dropdown sẽ âm thầm mất option (rõ nhất là ở `distinct` kèm
    // `orderBy` nhiều trường, Prisma còn phụ thuộc thứ tự cột). groupBy gom
    // thật trong SQL nên luôn đủ, và chỉ trả về số hàng bằng số giá trị
    // phân biệt thay vì kéo về mọi Attempt.
    prisma.attempt.groupBy({
      by: ["subject", "topic"],
      where: { userId },
      orderBy: [{ subject: "asc" }, { topic: "asc" }],
    }),
    prisma.attempt.groupBy({
      by: ["difficulty"],
      where: { userId },
      orderBy: { difficulty: "asc" },
    }),

    // Thời gian học + số phiên theo TỪNG MÔN (LearningSession có subject/topic).
    prisma.$queryRaw<Array<{ subject: string; sessions: number; minutes: number }>>`
      SELECT subject,
             COUNT(*)::int AS sessions,
             COALESCE(SUM(EXTRACT(EPOCH FROM ("completedAt" - "startedAt"))/60), 0)::float AS minutes
      FROM "LearningSession"
      WHERE "userId" = ${userId} AND "completedAt" IS NOT NULL
        AND "startedAt" >= ${start} AND "startedAt" < ${end}
        ${subjectSql(filters)}
      GROUP BY subject
    `,

    // Cơ cấu hoạt động theo LearningActivity.type.
    // Đây là nguồn DUY NHẤT cho các việc không sinh Attempt: tạo mind map,
    // upload tài liệu, hoàn thành bài học trong roadmap, hỏi tutor...
    prisma.learningActivity.groupBy({
      by: ["type"],
      where: { userId, occurredAt: { gte: start, lt: end } },
      _count: { _all: true },
      _sum: { xpAwarded: true },
      orderBy: { _count: { type: "desc" } },
      take: 12,
    }),

    // Lần chẩn đoán ĐẦU TIÊN làm mốc so sánh (baseline) — §15.
    // `completedAt` chứ không phải `status`: status là String tự do
    // ("in_progress"/...), còn completedAt mới là dấu hiệu chắc chắn.
    // Assessment KHÔNG có createdAt — dùng startedAt để sắp xếp.
    prisma.assessment.findFirst({
      where: { userId, completedAt: { not: null } },
      orderBy: { startedAt: "asc" },
      select: { id: true, startedAt: true },
    }),
  ]);

  void prevReviewAgg;
  void prevCompletedSessions;
  void xpPrev;

  const currentCorrect = currentAttemptAgg.filter((g) => g.isCorrect).reduce((s, g) => s + g._count._all, 0);
  const currentAttempts = currentAttemptAgg.reduce((s, g) => s + g._count._all, 0);
  const prevCorrect = previousAttemptAgg.filter((g) => g.isCorrect).reduce((s, g) => s + g._count._all, 0);
  const prevAttempts = previousAttemptAgg.reduce((s, g) => s + g._count._all, 0);
  const accuracy = masteryFromCounts(currentCorrect, currentAttempts);
  const prevAccuracy = masteryFromCounts(prevCorrect, prevAttempts);
  const allTimeAttempts = skillLast.reduce((s, r) => s + n(r.attempts), 0);
  const allTimeCorrect = skillLast.reduce((s, r) => s + n(r.correct), 0);
  const allTimeAccuracy = masteryFromCounts(allTimeCorrect, allTimeAttempts) ?? 0;

  const reviewMinutesTotal = (reviewMinutes._sum.timeSpentSec ?? 0) / 60;
  const sessionMinutes = sessionStats[0]?.minutes ?? 0;
  const tutorMinutes = dailyTutor.reduce((s, r) => s + n(r.minutes), 0);
  const totalStudyMinutes = Math.round(sessionMinutes + reviewMinutesTotal + tutorMinutes);
  const prevStudyMinutes = Math.round((prevSessionStats[0]?.minutes ?? 0) + ((prevReviewAgg as { _sum: { timeSpentSec: number | null } })._sum.timeSpentSec ?? 0) / 60);

  const sessionCount = sessionStats[0]?.sessions ?? 0;
  const longestSession = sessionStats[0]?.longest ?? 0;

  const dailyMapMinutes = new Map<string, number>();
  for (const row of dailySessionMinutes) dailyMapMinutes.set(dayKeyFromSql(row.day), (dailyMapMinutes.get(dayKeyFromSql(row.day)) ?? 0) + n(row.minutes));
  for (const row of dailyReviews) dailyMapMinutes.set(dayKeyFromSql(row.day), (dailyMapMinutes.get(dayKeyFromSql(row.day)) ?? 0) + n(row.minutes));
  for (const row of dailyTutor) dailyMapMinutes.set(dayKeyFromSql(row.day), (dailyMapMinutes.get(dayKeyFromSql(row.day)) ?? 0) + n(row.minutes));

  const attemptByDay = new Map(dailyAttempts.map((r) => [dayKeyFromSql(r.day), r]));
  const xpByDay = new Map(dailyXp.map((r) => [dayKeyFromSql(r.day), n(r.xp)]));
  const exByDay = new Map(dailyExercises.map((r) => [dayKeyFromSql(r.day), n(r.n)]));
  const revByDay = new Map(dailyReviews.map((r) => [dayKeyFromSql(r.day), n(r.n)]));
  const tutorByDay = new Map(dailyTutor.map((r) => [dayKeyFromSql(r.day), n(r.n)]));

  const activity: DailyActivityPoint[] = fillDailySeries(
    days,
    days.map((day) => ({
      day,
      studyMinutes: Math.round(dailyMapMinutes.get(day) ?? 0),
      exercises: exByDay.get(day) ?? 0,
      reviews: revByDay.get(day) ?? 0,
      tutorSessions: tutorByDay.get(day) ?? 0,
      attempts: n(attemptByDay.get(day)?.attempts),
      correct: n(attemptByDay.get(day)?.correct),
      xp: xpByDay.get(day) ?? 0,
    })),
    { studyMinutes: 0, exercises: 0, reviews: 0, tutorSessions: 0, attempts: 0, correct: 0, xp: 0 }
  );

  const activeDays = activity.filter((d) => d.studyMinutes > 0 || d.attempts > 0 || d.reviews > 0 || d.exercises > 0 || d.tutorSessions > 0).length;

  const rangeByKey = new Map(skillRange.map((r) => [`${r.subject}::${r.topic}`, r]));
  const prevByKey = new Map(skillPrev.map((r) => [`${r.subject}::${r.topic}`, r]));
  const lastByKey = new Map(skillLast.map((r) => [`${r.subject}::${r.topic}`, r]));
  const reviewByTopic = await reviewsByTopic(userId, start, end);
  const tutorByTopic = await tutorByTopicCount(userId, start, end);

  const skills: SkillAnalyticsRow[] = progressRows.map((row) => {
    const key = `${row.subject}::${row.topic}`;
    const currentMastery = Math.round(row.mastery * 100);
    const range = rangeByKey.get(key);
    const prev = prevByKey.get(key);
    const lifetime = lastByKey.get(key);
    const rangeAttempts = n(range?.attempts);
    const rangeCorrect = n(range?.correct);
    const previous = previousMasteryFromTotals(row.correct, row.attempts, rangeCorrect, rangeAttempts);
    const change = previous === null ? null : currentMastery - previous;
    const recentAccuracy = masteryFromCounts(rangeCorrect, rangeAttempts);
    const prevAcc = masteryFromCounts(n(prev?.correct), n(prev?.attempts));
    const evidence: SkillEvidence = {
      exercisesCompleted: rangeAttempts,
      reviews: reviewByTopic.get(key) ?? 0,
      tutorSessions: tutorByTopic.get(key) ?? 0,
      accuracyBefore: prevAcc,
      accuracyAfter: recentAccuracy,
      enoughForWhy: enoughEvidence(
        { exercisesCompleted: rangeAttempts, reviews: reviewByTopic.get(key) ?? 0, tutorSessions: tutorByTopic.get(key) ?? 0 },
        rangeAttempts
      ),
    };
    const lastAt = range?.last_at ?? lifetime?.last_at ?? row.updatedAt;
    return {
      subject: row.subject,
      topic: row.topic,
      currentMastery,
      previousMastery: previous,
      change,
      attempts: row.attempts,
      attemptsInRange: rangeAttempts,
      accuracy: masteryFromCounts(row.correct, row.attempts),
      recentAccuracy,
      reviewCount: reviewByTopic.get(key) ?? 0,
      lastPracticedAt: lastAt ? new Date(lastAt).toISOString() : null,
      trend: skillTrend(change, rangeAttempts + n(prev?.attempts)),
      isWeak: isWeakSkill(currentMastery),
      isMastered: isMastered(currentMastery, row.attempts),
      evidence,
    };
  });

  const improvements = skills
    .filter((s) => s.change !== null && s.change >= 8)
    .sort((a, b) => (b.change ?? 0) - (a.change ?? 0))
    .slice(0, 8)
    .map((s) => ({
      subject: s.subject,
      topic: s.topic,
      points: s.change as number,
      evidence: s.evidence,
    }));

  const currentRoadmapTopics = new Set<string>();
  let roadmapAnalytics = null as LearningAnalyticsPayload["roadmap"];
  const goalCards: GoalProgressCard[] = goals.map((g) => {
    const plan = g.plan ?? [];
    const topics = plan.flatMap((m) => m.topics);
    const completed = topics.filter((t) => t.status === "done").map((t) => t.name);
    const remaining = topics.filter((t) => t.status !== "done").map((t) => t.name);
    const current = topics.find((t) => t.status === "current");
    if (current) currentRoadmapTopics.add(current.name);
    topics.filter((t) => t.status === "current").forEach((t) => currentRoadmapTopics.add(t.name));
    return {
      id: g.id,
      title: g.title,
      progressPercent: g.progressPercent,
      remainingPercent: g.plan ? Math.max(0, 100 - g.progressPercent) : null,
      completed,
      remaining,
      currentFocus: current?.name ?? null,
    };
  });

  const activeGoal = goals.find((g) => g.status === "ACTIVE") ?? goals[0];
  if (activeGoal?.plan) {
    const topics = activeGoal.plan.flatMap((m: RoadmapPlan) => m.topics);
    const done = topics.filter((t) => t.status === "done").length;
    roadmapAnalytics = {
      progressPercent: activeGoal.progressPercent,
      completed: done,
      total: topics.length,
      overdue: overdueTasks,
      currentFocus: topics.find((t) => t.status === "current")?.name ?? null,
    };
  }

  // Ghép "câu sai nhiều nhất" vào từng nhóm lỗi để Focus Area có bằng chứng
  // cụ thể. Cắt bớt câu hỏi vì chúng có thể rất dài và UI chỉ hiện 1 dòng.
  const topQuestionByKey = new Map(
    topMistakeQuestions.map((row) => [`${row.subject}::${row.topic}`, truncate(row.question_text)])
  );

  const mistakes: CommonMistake[] = mistakeRows
    .map((m) => ({
      subject: m.subject,
      topic: m.topic,
      mistakeCount: m._count._all,
      topQuestion: topQuestionByKey.get(`${m.subject}::${m.topic}`) ?? null,
    }))
    .sort((a, b) => b.mistakeCount - a.mistakeCount);

  const focusAreas = buildFocusAreas(skills, mistakes, currentRoadmapTopics, new Map());

  const masteredSkills = skills.filter((s) => s.isMastered).length;
  const improvingSkills = skills.filter((s) => s.trend === "improving").length;
  const weakSkills = skills.filter((s) => s.isWeak).length;
  const prevMastered = skills.filter((s) => s.previousMastery !== null && isMastered(s.previousMastery, Math.max(0, s.attempts - s.attemptsInRange))).length;

  const scoreResult = composeLearningScore({
    consistency: computeConsistencyScore(activeDays, rangeId === "all" ? 90 : dayCount),
    practice: computePracticeScore(accuracy, currentAttempts, rangeId === "all" ? 40 : Math.max(8, Math.round(dayCount * 0.7))),
    skill: computeSkillScore(
      skills.map((s) => s.currentMastery),
      skills.map((s) => s.attempts >= 5)
    ),
    review: computeReviewScore(reviewCount, reviewItemCount, rangeId === "all" ? 30 : dayCount),
    goal: computeGoalScore(goalCards.filter((g) => goals.find((x) => x.id === g.id)?.status === "ACTIVE").map((g) => g.progressPercent)),
    improvement: computeImprovementScore(skills.map((s) => s.change)),
  });

  const profileStatus = availability(currentAttempts, completedSessions, reviewCount);

  const studyTime: StudyTimeStats = {
    totalMinutes: totalStudyMinutes,
    averageSessionMinutes: sessionCount > 0 ? Math.round(sessionMinutes / sessionCount) : null,
    sessionsPerWeek: rangeId === "all" ? null : Math.round((sessionCount / Math.max(1, dayCount / 7)) * 10) / 10,
    activeDays,
    longestSessionMinutes: longestSession > 0 ? Math.round(longestSession) : null,
    preferredHour: preferredHour(hourRows),
    preferredLabel: preferredHourLabel(hourRows),
  };

  const accuracyBreakdown: AccuracyBreakdown = {
    overall: accuracy,
    previous: prevAccuracy,
    deltaPp: pointDelta(accuracy ?? 0, prevAccuracy),
    recent: accuracy,
    bySubject: subjectRows
      .map((r) => ({
        subject: r.subject,
        accuracy: masteryFromCounts(n(r.correct), n(r.attempts)) ?? 0,
        attempts: n(r.attempts),
      }))
      .filter((r) => r.attempts > 0),
    bySkill: skills
      .filter((s) => s.attemptsInRange > 0 && s.recentAccuracy !== null)
      .map((s) => ({ subject: s.subject, topic: s.topic, accuracy: s.recentAccuracy as number, attempts: s.attemptsInRange })),
    byDifficulty: difficultyRows.map((r) => ({
      difficulty: r.difficulty,
      accuracy: masteryFromCounts(n(r.correct), n(r.attempts)) ?? 0,
      attempts: n(r.attempts),
    })),
    overTime: activity.map((d) => ({
      day: d.day,
      attempts: d.attempts,
      accuracy: masteryFromCounts(d.correct, d.attempts),
    })),
  };

  const correlation = buildCorrelation(activity);

  const journey = buildJourney(monthSkills);
  const beforeNow = skills
    .filter((s) => s.previousMastery !== null && s.change !== null && Math.abs(s.change) >= 5)
    .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0))
    .slice(0, 6)
    .map((s) => ({
      subject: s.subject,
      topic: s.topic,
      before: s.previousMastery as number,
      now: s.currentMastery,
      points: s.change as number,
      whatChanged: s.evidence,
    }));

  const weeklyDays = activity.slice(-7);
  const weekly = buildWeeklyReport({
    studyMinutes: weeklyDays.reduce((s, d) => s + d.studyMinutes, 0),
    exercises: weeklyDays.reduce((s, d) => s + d.exercises + d.attempts, 0),
    accuracy: masteryFromCounts(
      weeklyDays.reduce((s, d) => s + d.correct, 0),
      weeklyDays.reduce((s, d) => s + d.attempts, 0)
    ),
    improvements,
    focus: focusAreas,
  });

  const recommendations = topRecommendations(focusAreas, diagnosticCount > 0);

  // ============ PHÂN TÍCH THEO MÔN / CHỦ ĐỀ / ĐỘ KHÓ (§4) ============
  // Dùng lại đúng những query đã chạy sẵn ở trên — KHÔNG query thêm.
  const subjectMinutes = toSubjectMinutes(subjectSessionRows);
  const subjectSessions = new Map(subjectSessionRows.map((r) => [r.subject, r.sessions]));
  const masteryBySubject = new Map<string, number[]>();
  for (const s of skills) {
    const list = masteryBySubject.get(s.subject) ?? [];
    list.push(s.currentMastery);
    masteryBySubject.set(s.subject, list);
  }

  // `subjectRows` / `difficultyAttempts` đã có sẵn từ query ở trên (dùng cho
  // accuracy breakdown) — tái sử dụng, KHÔNG query thêm lần nữa.
  const subjectBreakdown: SubjectAnalyticsRow[] = subjectRows.map((row) => {
    const masteries = masteryBySubject.get(row.subject) ?? [];
    const avg = masteries.length > 0
      ? Math.round(masteries.reduce((s, m) => s + m, 0) / masteries.length)
      : null;
    return {
      subject: row.subject,
      attempts: n(row.attempts),
      correct: n(row.correct),
      accuracy: masteryFromCounts(n(row.correct), n(row.attempts)),
      studyMinutes: subjectMinutes.get(row.subject) ?? 0,
      sessions: subjectSessions.get(row.subject) ?? 0,
      avgMastery: avg,
      isWeak: avg !== null && isWeakSkill(avg),
    };
  }).sort((a, b) => b.attempts - a.attempts);

  const topicBreakdown: TopicAnalyticsRow[] = skills
    .filter((s) => !filters.subject || s.subject === filters.subject)
    .map((s) => ({
      subject: s.subject,
      topic: s.topic,
      attempts: s.attempts,
      accuracy: s.accuracy,
      recentAccuracy: s.recentAccuracy,
      mastery: s.currentMastery,
      lastPracticedAt: s.lastPracticedAt,
      trend: s.trend,
    }))
    .sort((a, b) => b.attempts - a.attempts);

  const difficultyBreakdown: DifficultyAnalyticsRow[] = difficultyRows
    .map((d) => {
      const attempts = n(d.attempts);
      const correct = n(d.correct);
      return {
        difficulty: d.difficulty,
        attempts,
        correct,
        accuracy: masteryFromCounts(correct, attempts),
      };
    })
    // Sắp theo độ khó tăng dần, không sắp theo số lượng — người học muốn
    // đọc "Easy → Hard", không phải "môn nào tôi làm nhiều nhất".
    .sort((a, b) => DIFFICULTY_ORDER.indexOf(a.difficulty) - DIFFICULTY_ORDER.indexOf(b.difficulty));

  // Option lọc lấy theo TOÀN BỘ lịch sử (không giới hạn range) — nếu chỉ lấy
  // trong range thì đổi sang "7 ngày" rỗng sẽ làm dropdown biến mất, người dùng
  // không còn đường quay lại. Chỉ khi đang chọn môn mới thu hẹp topic theo môn
  // đó, tránh hiện 200 chủ đề không liên quan.
  const filterOptions: AnalyticsFilterOptions = {
    subjects: [...new Set(attemptPairs.map((a) => a.subject))].sort(),
    topics: [...new Set(
      (filters.subject ? attemptPairs.filter((a) => a.subject === filters.subject) : attemptPairs).map((a) => a.topic)
    )].sort(),
    difficulties: attemptDifficulties.map((d) => d.difficulty).sort(
      (a, b) => DIFFICULTY_ORDER.indexOf(a) - DIFFICULTY_ORDER.indexOf(b)
    ),
  };

  // ============ CƠ CẤU HOẠT ĐỘNG (LearningActivity) ============
  const activityMix: ActivityMixRow[] = activityMixRows.map((r) => ({
    type: r.type,
    count: n(r._count._all),
    xp: r._sum.xpAwarded ?? 0,
  }));

  // ============ SO VỚI CHẨN ĐOÁN ĐẦU TIÊN (§15) ============
  // Baseline suy từ chính các Attempt thuộc Assessment ĐẦU TIÊN (Attempt có
  // cột assessmentId). Không tạo bảng snapshot mới: dữ liệu đã có sẵn, chỉ
  // cần gom theo (subject, topic).
  //
  // So sánh "baseline accuracy" (lúc chẩn đoán) với "hiện tại" (masterity hiện
  // tại) là hai thứ khác nhau, nên ta hiện CẢ HAI cột cạnh nhau thay vì chỉ
  // một con số "đã tăng bao nhiêu" — người học tự đánh giá được.
  const sinceAssessment: SinceAssessment = { hasBaseline: false, baselineDate: null, rows: [] };
  if (firstAssessment) {
    const baselineAttempts = await prisma.attempt.findMany({
      where: { userId, assessmentId: firstAssessment.id },
      select: { subject: true, topic: true, isCorrect: true },
    });
    // Gộp theo subject::topic để ra đúng tỉ lệ đúng của từng chủ đề.
    const baselineMap = new Map<string, { correct: number; total: number }>();
    for (const a of baselineAttempts) {
      const key = `${a.subject}::${a.topic}`;
      const entry = baselineMap.get(key) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (a.isCorrect) entry.correct += 1;
      baselineMap.set(key, entry);
    }
    const rows = skills
      .map((s) => {
        const b = baselineMap.get(`${s.subject}::${s.topic}`);
        const baseline = b ? masteryFromCounts(b.correct, b.total) : null;
        if (baseline === null) return null;
        return {
          subject: s.subject,
          topic: s.topic,
          baseline,
          current: s.currentMastery,
          // So sánh 2 TỈ LỆ nên delta là ĐIỂM PHẦN TRĂM, không phải %.
          changePp: s.currentMastery - baseline,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => b.changePp - a.changePp)
      .slice(0, 8);
    sinceAssessment.hasBaseline = rows.length > 0;
    sinceAssessment.baselineDate = firstAssessment.startedAt.toISOString();
    sinceAssessment.rows = rows;
  }
  // ---- §8 Phân bổ thời gian học theo môn ----
  // Công thức tỉ lệ nằm ở outcomes.ts (hàm thuần, có test) — đặt ở service
  // chỉ vì cần test, chứ không phải để né kiểm thử.
  const subjectTimeShare = buildSubjectTimeShare(subjectTimeShareRows);

  // ---- §9 Đúng / Sai / Chưa hoàn thành ----
  const outcomes = buildOutcomeBreakdown(outcomeRows, abandonedSessions);

  const payloadLite = {
    availability: profileStatus,
    metrics: {
      learningScore: {
        ...metric(scoreResult.score ?? 0, null, "none"),
        lowConfidence: scoreResult.lowConfidence,
        breakdown: scoreResult.breakdown,
      },
      studyTime: metric(totalStudyMinutes, previousStart ? prevStudyMinutes : null, "percent"),
      exercises: metric(exerciseCount, previousStart ? prevExerciseCount : null, "percent"),
      accuracy: { ...metric(accuracy ?? 0, prevAccuracy, "pp"), current: accuracy ?? 0 },
      skillsImproved: metric(improvements.length, null, "none"),
      skillsMastered: metric(masteredSkills, previousStart ? prevMastered : null, "none"),
    },
    improvements,
    focusAreas,
    accuracy: accuracyBreakdown,
    // Deterministic insight cần `skills` (để suy ra xu hướng) và `mistakes`
    // (để cảnh báo "làm nhiều nhưng ít ôn lại"). Cả hai đã tính sẵn ở trên.
    skills,
    mistakes,
    overview: {
      studyMinutes: totalStudyMinutes,
      activeDays,
      completedExercises: uniqueExercises.length,
      completedReviews: reviewCount,
      completedRoadmapItems: roadmapAnalytics?.completed ?? 0,
      tutorSessions: tutorCount,
      documentsStudied: documentsStudied.length,
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      xpEarned: xpInRange._sum.amount ?? 0,
      lxpEarned: lxpInRange._sum.amount ?? 0,
      masteredSkills,
      improvingSkills,
      weakSkills,
    },
  };

  const deterministicInsight = buildDeterministicInsight(payloadLite);

  const skillMap = skills.map((s) => ({
    subject: s.subject,
    topic: s.topic,
    masteryPercent: s.currentMastery,
    isWeak: s.isWeak,
  }));

  return {
    range: rangeId,
    filters,
    filterOptions,
    availability: profileStatus,
    overview: payloadLite.overview,
    metrics: payloadLite.metrics,
    activity,
    skills,
    improvements,
    focusAreas,
    mistakes,
    accuracy: accuracyBreakdown,
    studyTime,
    correlation,
    journey,
    beforeNow,
    goals: goalCards,
    roadmap: roadmapAnalytics,
    weekly,
    achievements: (achievements as Array<{ achievement: { code: string; title: string; description: string; icon: string | null }; unlockedAt: Date }>)
      .slice(0, 8)
      .map((ua) => ({
        code: ua.achievement.code,
        title: ua.achievement.title,
        description: ua.achievement.description,
        icon: ua.achievement.icon,
        unlockedAt: ua.unlockedAt.toISOString(),
      })),
    recommendations,
    deterministicInsight,
    subjects: subjectBreakdown,
    topics: topicBreakdown,
    difficulties: difficultyBreakdown,
    activityMix,
    sinceAssessment,
    subjectTimeShare,
    outcomes,
    skillMap,
    totalAttempts: allTimeAttempts,
    accuracyPercent: allTimeAccuracy,
    streakDays: streak?.currentStreak ?? 0,
  };
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function reviewsByTopic(userId: string, start: Date, end: Date): Promise<Map<string, number>> {
  const rows = await prisma.reviewAttempt.findMany({
    where: { userId, reviewedAt: { gte: start, lt: end } },
    select: { reviewItem: { select: { subject: true, topic: true } } },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.reviewItem.subject ?? ""}::${row.reviewItem.topic}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

async function tutorByTopicCount(userId: string, start: Date, end: Date): Promise<Map<string, number>> {
  const rows = await prisma.tutorSession.groupBy({
    by: ["subject", "topic"],
    where: { userId, startedAt: { gte: start, lt: end } },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = `${row.subject ?? ""}::${row.topic ?? ""}`;
    map.set(key, row._count._all);
  }
  return map;
}

function preferredHour(rows: Array<{ hour: number; n: number }>): number | null {
  const total = rows.reduce((s, r) => s + n(r.n), 0);
  if (total < 10) return null;
  const top = [...rows].sort((a, b) => n(b.n) - n(a.n))[0];
  if (!top || n(top.n) / total < 0.4) return null;
  return n(top.hour);
}

function preferredHourLabel(rows: Array<{ hour: number; n: number }>): string | null {
  const hour = preferredHour(rows);
  if (hour === null) return null;
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function buildCorrelation(activity: DailyActivityPoint[]): CorrelationResult {
  const samples = activity.filter((d) => d.studyMinutes > 0 && d.attempts >= 3);
  const r = pearsonCorrelation(
    samples.map((d) => d.studyMinutes),
    samples.map((d) => (d.attempts === 0 ? 0 : (d.correct / d.attempts) * 100))
  );
  if (r === null) return { sampleDays: samples.length, r: null, direction: "insufficient" };
  if (r >= 0.25) return { sampleDays: samples.length, r, direction: "positive" };
  if (r <= -0.25) return { sampleDays: samples.length, r, direction: "negative" };
  return { sampleDays: samples.length, r, direction: "none" };
}

function buildJourney(rows: MonthSkillRow[]): JourneyMonth[] {
  const months = [...new Set(rows.map((r) => r.month))].sort();
  const running = new Map<string, { correct: number; attempts: number }>();
  const result: JourneyMonth[] = [];
  for (const month of months) {
    const highlights: JourneyMonth["highlights"] = [];
    for (const row of rows.filter((r) => r.month === month)) {
      const key = `${row.subject}::${row.topic}`;
      const before = running.get(key) ?? { correct: 0, attempts: 0 };
      const from = masteryFromCounts(before.correct, before.attempts);
      const after = {
        correct: before.correct + n(row.correct),
        attempts: before.attempts + n(row.attempts),
      };
      running.set(key, after);
      const to = masteryFromCounts(after.correct, after.attempts);
      if (from !== null && to !== null && to - from >= 5) {
        highlights.push({ subject: row.subject, topic: row.topic, from, to });
      }
    }
    highlights.sort((a, b) => b.to - b.from - (a.to - a.from));
    if (highlights.length > 0) {
      result.push({
        monthKey: month,
        label: month,
        highlights: highlights.slice(0, 3),
      });
    }
  }
  return result.slice(-8);
}

export { parseAnalyticsRange, WEAK_THRESHOLD_PERCENT };
export type { AnalyticsRangeId };
