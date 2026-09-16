// ================================================================
// SPACED REPETITION SERVICE — SM-2 Algorithm Adaptation
// ================================================================
// Mạch tư duy: service này quản lý review items và spaced repetition scheduling.
// Sử dụng thuật toán SM-2 đơn giản hóa cho MVP.
// ================================================================

import { prisma } from "@/lib/db/prisma";
import { generateJSON } from "@/lib/ai/router";
import { buildReviewPrompt } from "@/lib/ai/prompts";
import { recordLearningActivity } from "@/services/learning-activity.service";

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

  return { reviewItem: updated as ReviewItemData, schedule };
}

// --- 4) GET DUE REVIEWS ---
export async function getDueReviews(userId: string, limit = 20): Promise<ReviewItemData[]> {
  const now = new Date();
  now.setHours(23, 59, 59, 999); // End of today

  const items = await prisma.reviewItem.findMany({
    where: {
      userId,
      nextReviewAt: { lte: now },
    },
    orderBy: [
      { nextReviewAt: "asc" },
      { difficulty: "desc" },
      { lapses: "desc" },
    ],
    take: limit,
  });
  return items as ReviewItemData[];
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
export async function getReviewStats(userId: string): Promise<{
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

  const [due, overdue, upcoming, all] = await Promise.all([
    prisma.reviewItem.count({ where: { userId, nextReviewAt: { lte: endOfToday } } }),
    prisma.reviewItem.count({ where: { userId, nextReviewAt: { lt: startOfToday } } }),
    prisma.reviewItem.count({ where: { userId, nextReviewAt: { gt: endOfToday } } }),
    prisma.reviewItem.findMany({ where: { userId }, select: { easeFactor: true } }),
  ]);

  const avgEaseFactor = all.length > 0
    ? all.reduce((sum, r) => sum + r.easeFactor, 0) / all.length
    : 2.5;

  return {
    due,
    overdue,
    upcoming,
    total: due + upcoming,
    averageEaseFactor: Math.round(avgEaseFactor * 100) / 100,
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
  topic: string;
  concept: string;
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
    subject: params.topic,
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