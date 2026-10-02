// ================================================================
// SPACED REPETITION SERVICE — SM-2 Algorithm Adaptation
// ================================================================
// Mạch tư duy: service này quản lý review items và spaced repetition scheduling.
// Sử dụng thuật toán SM-2 đơn giản hóa cho MVP.
// ================================================================

import { prisma } from "@/lib/db/prisma";
// `Prisma.sql` dùng để ghép điều kiện lọc môn ĐỘNG vào câu SQL của
// getReviewStats — xem giải thích tại chỗ dùng (SQL injection an toàn).
import { Prisma } from "@prisma/client";
import { generateJSON } from "@/lib/ai/router";
import { buildReviewPrompt } from "@/lib/ai/prompts";
import { recordLearningActivity } from "@/services/learning-activity.service";
import { updateMastery } from "@/services/assessment.service";
import { syncRoadmapAfterMastery } from "@/services/roadmap.service";

export interface ReviewItemInput {
  userId: string;
  topic: string;
  concept?: string;
  subject?: string;
  sourceType?: string;
  sourceId?: string;
  prompt: string;
  answer?: string;
  metadata?: any;
}

export class ReviewConflictError extends Error {
  constructor() {
    super("Review item vừa được cập nhật ở nơi khác. Hãy tải lại danh sách ôn tập.");
    this.name = "ReviewConflictError";
  }
}

export interface ReviewItemData {
  id: string;
  userId: string;
  topic: string;
  concept?: string;
  subject?: string;
  sourceType?: string;
  sourceId?: string;
  prompt: string;
  answer?: string;
  metadata?: any;
  difficulty: number;
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  lastReviewedAt?: Date;
  nextReviewAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewAttemptInput {
  reviewItemId: string;
  userId: string;
  rating: 1 | 2 | 3 | 4; // 1=Again, 2=Hard, 3=Good, 4=Easy
  response?: string;
  timeSpentSec?: number;
}

export interface ReviewScheduleResult {
  nextReviewAt: Date;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
}

// --- SM-2 ALGORITHM ---
function calculateNextReview(params: {
  rating: 1 | 2 | 3 | 4;
  currentEaseFactor: number;
  currentInterval: number;
  currentRepetitions: number;
  currentLapses: number;
}): ReviewScheduleResult {
  let { rating, currentEaseFactor, currentInterval, currentRepetitions, currentLapses } = params;

  // Update ease factor based on rating
  // SM-2 formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  // where q is rating (1-4, but we map 1=Again, 2=Hard, 3=Good, 4=Easy)
  const q = rating; // 1, 2, 3, 4
  const easeFactorChange = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  let newEaseFactor = currentEaseFactor + easeFactorChange;
  
  // Ease factor minimum is 1.3
  if (newEaseFactor < 1.3) newEaseFactor = 1.3;

  let newInterval = currentInterval;
  let newRepetitions = currentRepetitions;
  let newLapses = currentLapses;

  if (rating === 1) { // Again - reset
    newInterval = 0;
    newRepetitions = 0;
    newLapses += 1;
  } else if (rating === 2) { // Hard
    if (currentRepetitions === 0) newInterval = 1;
    else if (currentRepetitions === 1) newInterval = 6;
    else newInterval = Math.round(currentInterval * 1.2);
    newRepetitions += 1;
  } else if (rating === 3) { // Good
    if (currentRepetitions === 0) newInterval = 1;
    else if (currentRepetitions === 1) newInterval = 6;
    else newInterval = Math.round(currentInterval * newEaseFactor);
    newRepetitions += 1;
  } else if (rating === 4) { // Easy
    if (currentRepetitions === 0) newInterval = 1;
    else if (currentRepetitions === 1) newInterval = 6;
    else newInterval = Math.round(currentInterval * newEaseFactor * 1.3);
    newRepetitions += 1;
  }

  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);
  nextReviewAt.setHours(0, 0, 0, 0);

  return {
    nextReviewAt,
    intervalDays: newInterval,
    easeFactor: newEaseFactor,
    repetitions: newRepetitions,
    lapses: newLapses,
  };
}

// --- 1) CREATE REVIEW ITEM ---
export async function createReviewItem(input: ReviewItemInput): Promise<ReviewItemData> {
  // Check if similar review item already exists
  const existing = await prisma.reviewItem.findFirst({
    where: {
      userId: input.userId,
      topic: input.topic,
      concept: input.concept || null,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
    },
  });

  if (existing) {
    // Update existing item with new prompt if provided
    const updated = await prisma.reviewItem.update({
      where: { id: existing.id },
      data: {
        prompt: input.prompt,
        answer: input.answer ?? existing.answer,
        concept: input.concept ?? existing.concept ?? undefined,
        metadata: input.metadata ?? existing.metadata,
        updatedAt: new Date(),
      },
    });
    return updated as ReviewItemData;
  }

const created = await prisma.reviewItem.create({
    data: {
      userId: input.userId,
      topic: input.topic,
      concept: input.concept,
      subject: input.subject,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      prompt: input.prompt,
      answer: input.answer,
      metadata: input.metadata,
      difficulty: 0.5,
      easeFactor: 2.5,
      intervalDays: 0,
      repetitions: 0,
      lapses: 0,
    },
  });
  return created as ReviewItemData;
}

// --- 2) CREATE REVIEW ITEM FROM LEARNING ACTIVITY ---
export async function createReviewFromActivity(params: {
  userId: string;
  topic: string;
  concept?: string;
  subject?: string;
  sourceType: string;
  sourceId: string;
  prompt: string;
  answer?: string;
  metadata?: any;
}): Promise<ReviewItemData> {
  // Generate review prompt from the learning activity
  const reviewPrompt = await generateReviewPrompt({
    topic: params.topic,
    concept: params.concept,
    originalPrompt: params.prompt,
    answer: params.answer,
  });

  return createReviewItem({
    userId: params.userId,
    topic: params.topic,
    concept: params.concept,
    subject: params.subject,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    prompt: reviewPrompt,
    answer: params.answer,
    metadata: params.metadata,
  });
}

// --- 3) SUBMIT REVIEW ATTEMPT ---
export async function submitReviewAttempt(input: ReviewAttemptInput): Promise<{
  reviewItem: ReviewItemData;
  schedule: ReviewScheduleResult;
}> {
  if (![1, 2, 3, 4].includes(input.rating)) {
    throw new Error("Rating phải từ 1 đến 4.");
  }

  const reviewItem = await prisma.reviewItem.findFirst({
    where: { id: input.reviewItemId, userId: input.userId },
  });

  if (!reviewItem) throw new Error("Review item not found");

  // Calculate next review schedule
  const schedule = calculateNextReview({
    rating: input.rating,
    currentEaseFactor: reviewItem.easeFactor,
    currentInterval: reviewItem.intervalDays,
    currentRepetitions: reviewItem.repetitions,
    currentLapses: reviewItem.lapses,
  });

  const updated = await prisma.$transaction(async (tx) => {
    const claim = await tx.reviewItem.updateMany({
      where: {
        id: input.reviewItemId,
        userId: input.userId,
        repetitions: reviewItem.repetitions,
        updatedAt: reviewItem.updatedAt,
      },
      data: {
        difficulty: Math.max(0, Math.min(1, reviewItem.difficulty + (input.rating >= 3 ? -0.05 : 0.1))),
        easeFactor: schedule.easeFactor,
        intervalDays: schedule.intervalDays,
        repetitions: schedule.repetitions,
        lapses: schedule.lapses,
        lastReviewedAt: new Date(),
        nextReviewAt: schedule.nextReviewAt,
      },
    });
    if (claim.count !== 1) throw new ReviewConflictError();

    await tx.reviewAttempt.create({
      data: {
        reviewItemId: input.reviewItemId,
        userId: input.userId,
        rating: input.rating,
        correct: input.rating >= 3,
        response: input.response,
        timeSpentSec: input.timeSpentSec,
        previousInterval: reviewItem.intervalDays,
        newInterval: schedule.intervalDays,
      },
    });

    return tx.reviewItem.findUniqueOrThrow({ where: { id: input.reviewItemId } });
  });

  // Record learning activity for review
  await recordLearningActivity({
    userId: input.userId,
    type: "review_completed",
    difficulty: reviewItem.difficulty < 0.33 ? "easy" : reviewItem.difficulty < 0.66 ? "medium" : "hard",
    scorePercent: input.rating === 4 ? 100 : input.rating === 3 ? 75 : input.rating === 2 ? 50 : 25,
    isFirstCompletion: reviewItem.repetitions === 0,
    sourceId: input.reviewItemId,
    sourceType: "review",
  });

  // Đây chính là lỗ hổng đã phát hiện ở PHASE 5 audit: Review (SM-2)
  // trước đây CHỈ cộng XP, không hề chạm tới LearningProgress/Roadmap
  // — nghĩa là ôn tập bao nhiêu lần cũng không giúp Roadmap nhận ra
  // học sinh đã "vững" lại 1 topic từng sai (hoặc ngược lại, vẫn đang
  // yếu). Cập nhật CẢ HAI CHIỀU (đúng/sai), giống hệt cách quiz/
  // exercise/diagnostic đều làm — không chỉ báo cáo lúc thành công.
  // rating>=3 nghĩa là "nhớ đúng" (chuẩn SM-2: 1=Again, 2=Hard,
  // 3=Good, 4=Easy — cùng quy ước với `correct: input.rating >= 3` ở
  // ReviewAttempt phía trên). Chỉ chạy khi `subject` có giá trị thật
  // — ReviewItem.subject là nullable, và updateMastery() cần đúng
  // (subject, topic) để không tạo nhầm 1 dòng LearningProgress rác.
  if (reviewItem.subject) {
    const wasCorrect = input.rating >= 3;
    try {
      await updateMastery({
        userId: input.userId,
        subject: reviewItem.subject,
        topic: reviewItem.topic,
        isCorrect: wasCorrect,
      });
      if (wasCorrect) {
        await syncRoadmapAfterMastery(input.userId, reviewItem.subject, reviewItem.topic);
      }
    } catch (masteryError) {
      console.error("[review] Không thể cập nhật mastery/roadmap từ review:", masteryError);
    }
  }

  return { reviewItem: updated as ReviewItemData, schedule };
}

// --- 4) GET DUE REVIEWS ---
// Shape THU GỌN: chỉ trả các field mà UI thật sự đọc (trang Review,
// dashboard, learning-agent) thay vì kéo NGUYÊN row — bỏ metadata Json,
// sourceType/sourceId, easeFactor, intervalDays, lapses, createdAt...
// mỗi lần lấy danh sách đến hạn.
export interface ReviewDueItem {
  id: string;
  topic: string;
  concept: string | null;
  subject: string | null;
  prompt: string;
  answer: string | null;
  repetitions: number;
  nextReviewAt: Date | null;
}

export async function getDueReviews(
  userId: string,
  limit = 20,
  filter?: ReviewFilter,
): Promise<ReviewDueItem[]> {
  const now = new Date();
  now.setHours(23, 59, 59, 999); // End of today

  return prisma.reviewItem.findMany({
    where: {
      userId,
      nextReviewAt: { lte: now },
      // `subject` trong DB là `String?` — chỉ lọc khi có truyền, vì
      // `subject: undefined` bị Prisma bỏ qua (không tương đương với so sánh
      // NULL) — giữ nguyên hành vi "không lọc" khi UI chưa chọn môn.
      ...(filter?.subject ? { subject: filter.subject } : {}),
    },
    orderBy: [
      { nextReviewAt: "asc" },
      { difficulty: "desc" },
      { lapses: "desc" },
    ],
    take: limit,
    select: {
      id: true,
      topic: true,
      concept: true,
      subject: true,
      prompt: true,
      answer: true,
      repetitions: true,
      nextReviewAt: true,
    },
  });
}

/**
 * Filter tuỳ chọn cho ôn tập — trang /review gửi lên để lọc theo môn.
 *
 * Vì sao cần: `getDueReviews` trả MỌI môn trộn lẫn, nên học sinh lớp 11
 * không thể ôn riêng "Toán". Đây là yêu cầu trực tiếp từ flow ôn tập
 * (chọn môn -> ôn nội dung của môn đó).
 *
 * Dùng kiểu "where fragment" thay vì thêm tham số rời rạc vào mọi hàm:
 *   - `getDueReviews` và `getReviewStats` chia sẻ đúng 1 bộ điều kiện lọc
 *     => KHÔNG THỂ xảy ra tình trạng "UI lọc môn A nhưng thống kê đếm môn B"
 *     (rất dễ xảy ra khi mỗi hàm tự viết điều kiện riêng).
 */
export interface ReviewFilter {
  /** Chỉ lấy item của môn này. `undefined` = tất cả. */
  subject?: string;
}

/** Chủ đề có nội dung đến hạn, để trang /review hiện môn nào đang ôn được. */
export interface ReviewSubjectSummary {
  subject: string;
  due: number;
}

/**
 * SMART REVIEW — tổng hợp "nên ôn gì hôm nay" từ dữ liệu THẬT.
 *
 * Không phải gợi ý bịa: mọi con số đều đếm trên bảng ReviewItem của user.
 * Nhờ đó trang /review có thể nói:
 *   - có bao nhiêu nội dung đến hạn, theo từng môn (để đề xuất môn).
 *   - những chủ đề hay sai (nhiều `lapses` hoặc `difficulty` cao) — chính là
 *     nơi SM-2 hạ lịch ôn ngắn lại.
 *
 * Đây là tầng ĐỌC dữ liệu, không tính lại thuật toán SM-2 (thuật toán nằm
 * ở `calculateNextReview`) — không tạo nguồn sự thật thứ hai.
 */
export async function getReviewInsights(userId: string): Promise<{
  subjects: ReviewSubjectSummary[];
  weakTopics: { subject: string | null; topic: string; due: number; lapses: number }[];
}> {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // Đếm theo môn: groupBy + _count, tất cả chạy ở DB (không kéo row về Node).
  const bySubject = await prisma.reviewItem.groupBy({
    by: ["subject"],
    where: { userId, nextReviewAt: { lte: endOfToday } },
    _count: { _all: true },
  });

  // Chủ đề "hay sai": lấy item đến hạn có lapses > 0, sắp theo lapses giảm dần
  // rồi difficulty giảm dần. `take` nhỏ vì UI chỉ hiện vài dòng gợi ý.
  const weak = await prisma.reviewItem.findMany({
    where: { userId, nextReviewAt: { lte: endOfToday }, lapses: { gt: 0 } },
    select: { subject: true, topic: true, lapses: true },
    orderBy: [{ lapses: "desc" }, { difficulty: "desc" }],
    take: 5,
  });

  const subjects: ReviewSubjectSummary[] = bySubject
    .map((row) => ({
      subject: row.subject ?? "",
      due: row._count._all,
    }))
    // Ẩn nhóm rỗng (item không gán môn) — không phải "môn" nào để chọn.
    .filter((row) => row.subject !== "")
    .sort((a, b) => b.due - a.due);

  return {
    subjects,
    weakTopics: weak.map((item) => ({
      subject: item.subject,
      topic: item.topic,
      due: 1,
      lapses: item.lapses,
    })),
  };
}

// --- 5) GET OVERDUE REVIEWS ---
export async function getOverdueReviews(userId: string): Promise<ReviewItemData[]> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const items = await prisma.reviewItem.findMany({
    where: {
      userId,
      nextReviewAt: { lt: now },
    },
    orderBy: { nextReviewAt: "asc" },
  });
  return items as ReviewItemData[];
}

// --- 6) GET UPCOMING REVIEWS ---
export async function getUpcomingReviews(userId: string, days = 7): Promise<ReviewItemData[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  const items = await prisma.reviewItem.findMany({
    where: {
      userId,
      nextReviewAt: { gte: start, lte: end },
    },
    orderBy: { nextReviewAt: "asc" },
  });
  return items as ReviewItemData[];
}

// --- 7) GET REVIEW STATS ---
export async function getReviewStats(
  userId: string,
  filter?: ReviewFilter,
): Promise<{
  due: number;
  overdue: number;
  upcoming: number;
  total: number;
  averageEaseFactor: number;
}> {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  // MỘT query thay cho bốn (3 × count + findMany nạp TOÀN BỘ row của
  // user về Node chỉ để tự cộng): COUNT(*) FILTER đếm từng nhóm ngay
  // trong PostgreSQL và AVG("easeFactor") tính ở DB — không còn O(N)
  // dữ liệu nào bị kéo qua mạng mỗi lần gọi endpoint này.
  //
  // Ngữ nghĩa giữ NGUYÊN 100% so với code cũ:
  //   - due/upcoming chỉ tính item có nextReviewAt khác NULL (toán tử
  //     lte/gt cũ vốn bỏ qua NULL — cột này nullable trong schema);
  //   - total = due + upcoming (KHÔNG gồm item nextReviewAt NULL);
  //   - averageEaseFactor tính trên TẤT CẢ item của user (findMany cũ
  //     không lọc nextReviewAt), mặc định 2.5 khi user chưa có item nào.
  // Cùng pattern $queryRaw + COUNT FILTER đang dùng ở
  // services/analytics/learning-analytics.service.ts.
  //
  // Lọc môn: dùng `Prisma.sql` để ghép điều kiện ĐỘNG — nối chuỗi thô vào
  // SQL là SQL injection, còn `${...}` trong template literal của
  // `$queryRaw` thì tự bind thành tham số. Giá trị filter vẫn được bind,
  // không phải nội suy vào câu lệnh.
  const subjectClause = filter?.subject ? Prisma.sql`AND "subject" = ${filter.subject}` : Prisma.empty;
  const [stats] = await prisma.$queryRaw<
    Array<{ due: number; overdue: number; upcoming: number; avgEase: number }>
  >`
    SELECT
      COUNT(*) FILTER (WHERE "nextReviewAt" <= ${endOfToday})::int AS "due",
      COUNT(*) FILTER (WHERE "nextReviewAt" < ${startOfToday})::int AS "overdue",
      COUNT(*) FILTER (WHERE "nextReviewAt" > ${endOfToday})::int AS "upcoming",
      COALESCE(AVG("easeFactor"), 2.5)::float8 AS "avgEase"
    FROM "ReviewItem"
    WHERE "userId" = ${userId}
    ${subjectClause}
  `;

  return {
    due: stats.due,
    overdue: stats.overdue,
    upcoming: stats.upcoming,
    total: stats.due + stats.upcoming,
    averageEaseFactor: Math.round(stats.avgEase * 100) / 100,
  };
}

// --- 8) GENERATE REVIEW PROMPT USING AI ---
async function generateReviewPrompt(params: {
  topic: string;
  concept?: string;
  originalPrompt: string;
  answer?: string;
}): Promise<string> {
  try {
    const prompt = buildReviewPrompt(params);
    const result = await generateJSON<{ prompt: string }>({
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      jsonMode: true,
    });
    return result.prompt;
  } catch {
    // Fallback to simple prompt
    return `Review: ${params.topic}${params.concept ? ` - ${params.concept}` : ""}\nQuestion: ${params.originalPrompt}\nAnswer: ${params.answer || "Think about this concept"}`;
  }
}

// --- 9) CREATE REVIEW FROM MISTAKE ---
export async function createReviewFromMistake(params: {
  userId: string;
  subject: string;
  topic: string;
  concept?: string;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  sourceType: string;
  sourceId: string;
}): Promise<ReviewItemData> {
  const prompt = `Why is "${params.correctAnswer}" the correct answer for: ${params.question}?`;
  const answer = params.explanation;

  return createReviewItem({
    userId: params.userId,
    topic: params.topic,
    concept: params.concept,
    // BUG CŨ: gán `subject: params.topic` (trùng lặp topic, sai hoàn
    // toàn với "môn học" thật) — khiến submitReviewAttempt() không
    // thể gọi updateMastery() được vì subject/topic không khớp với
    // key thật trong LearningProgress. Giờ nhận đúng subject truyền
    // vào (xem quiz.service.ts — nơi duy nhất gọi hàm này).
    subject: params.subject,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    prompt,
    answer,
    metadata: {
      originalQuestion: params.question,
      userAnswer: params.userAnswer,
      correctAnswer: params.correctAnswer,
      mistakeType: "incorrect_answer",
    },
  });
}

// --- 10) DELETE REVIEW ITEM ---
export async function deleteReviewItem(reviewItemId: string, userId: string): Promise<void> {
  await prisma.reviewItem.delete({
    where: { id: reviewItemId, userId },
  });
}

// --- 11) RESET REVIEW ITEM (for manual adjustment) ---
export async function resetReviewItem(reviewItemId: string, userId: string): Promise<ReviewItemData> {
  const updated = await prisma.reviewItem.update({
    where: { id: reviewItemId, userId },
    data: {
      intervalDays: 0,
      repetitions: 0,
      lapses: 0,
      easeFactor: 2.5,
      difficulty: 0.5,
      nextReviewAt: new Date(),
      lastReviewedAt: null,
    },
  });
  return updated as ReviewItemData;
}