// ================================================================
// EXERCISE SERVICE — ngân hàng bài tập + chấm + XP/mastery
// ================================================================
// Mạch tư duy: Exercise là bài tập TỰ LUẬN/ngắn do cộng đồng đóng
// góp (khác quiz AI-sinh). Chấm EXACT (so khớp chuẩn hóa) khi có
// expectedOutput; nếu không có đáp án mẫu thì ghi nhận nộp bài
// nhưng KHÔNG chấm đúng (tránh đoán bừa). XP chỉ cộng DUY NHẤT 1
// lần cho lần đúng đầu tiên của mỗi (user, exercise) — nộp lặp
// (đúng hay sai) không farm thêm. Mastery cập nhật mỗi lần nộp
// qua updateMastery() dùng chung với quiz (assessment.service).

import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { updateMastery } from "@/services/assessment.service";
import { recordLearningActivity } from "@/services/learning-activity.service";
import type { ApiResponse } from "@/types";

export const EXERCISE_DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type ExerciseDifficulty = (typeof EXERCISE_DIFFICULTIES)[number];

export interface ListExercisesParams {
  page: number;
  limit: number;
  subject?: string;
  topic?: string;
  difficulty?: string;
  search?: string;
}

export interface CreateExerciseParams {
  createdById: string;
  title: string;
  subject: string;
  topic: string;
  difficulty?: string;
  statement: string;
  constraints?: string;
  examples?: Prisma.InputJsonValue;
  expectedOutput?: string;
}

// Chuẩn hóa đáp án trước khi so khớp: bỏ khoảng trắng thừa,
// không phân biệt hoa thường — chấm nới tay nhưng vẫn xác định.
export function normalizeAnswer(answer: string): string {
  return answer.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function listExercises(params: ListExercisesParams): Promise<ApiResponse<any>> {
  try {
    const { page, limit, subject, topic, difficulty, search } = params;
    const where: Record<string, unknown> = {
      ...(subject && { subject }),
      ...(topic && { topic }),
      ...(difficulty && { difficulty }),
    };
    if (search) {
      (where as Record<string, unknown>).OR = [
        { title: { contains: search, mode: "insensitive" } },
        { statement: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.exercise.findMany({
        where: where as never,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: { select: { id: true, name: true, nickname: true } },
          _count: { select: { attempts: true } },
        },
      }),
      prisma.exercise.count({ where: where as never }),
    ]);

    return {
      success: true,
      data: { exercises: items, total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  } catch (err) {
    console.error("[listExercises] Error:", err);
    return { success: false, error: "Không thể tải danh sách bài tập, thử lại sau." };
  }
}

export async function createExercise(params: CreateExerciseParams): Promise<ApiResponse<any>> {
  try {
    const { createdById, title, subject, topic, difficulty, statement, constraints, examples, expectedOutput } =
      params;
    if (!title.trim() || !subject.trim() || !topic.trim() || !statement.trim()) {
      return { success: false, error: "Thiếu tiêu đề, môn, chủ đề hoặc đề bài." };
    }
    const diff = difficulty || "medium";
    if (!EXERCISE_DIFFICULTIES.includes(diff as ExerciseDifficulty)) {
      return { success: false, error: "Độ khó phải là easy, medium hoặc hard." };
    }

    const created = await prisma.exercise.create({
      data: {
        createdById,
        title: title.trim(),
        subject: subject.trim(),
        topic: topic.trim(),
        difficulty: diff,
        statement: statement.trim(),
        constraints,
        ...(examples !== undefined && { examples }),
        expectedOutput: expectedOutput?.trim() || undefined,
      },
    });
    return { success: true, data: created };
  } catch (err) {
    console.error("[createExercise] Error:", err);
    return { success: false, error: "Không thể tạo bài tập, thử lại sau." };
  }
}

export async function getExercise(exerciseId: string, userId?: string): Promise<ApiResponse<any>> {
  try {
    const exercise = await prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: { author: { select: { id: true, name: true, nickname: true } } },
    });
    if (!exercise) return { success: false, error: "Không tìm thấy bài tập." };

    let solvedByMe = false;
    if (userId) {
      const done = await prisma.exerciseAttempt.findFirst({
        where: { userId, exerciseId, isCorrect: true },
        select: { id: true },
      });
      solvedByMe = !!done;
    }
    // Không trả expectedOutput cho client để chống xem đáp án trước.
    const { expectedOutput: _hidden, ...publicFields } = exercise;
    return { success: true, data: { ...publicFields, solvedByMe, hasSampleAnswer: !!exercise.expectedOutput } };
  } catch (err) {
    console.error("[getExercise] Error:", err);
    return { success: false, error: "Không thể tải bài tập, thử lại sau." };
  }
}

export async function submitExerciseAttempt(
  userId: string,
  exerciseId: string,
  answer: string
): Promise<ApiResponse<any>> {
  try {
    if (!answer.trim()) return { success: false, error: "Câu trả lời trống." };
    const exercise = await prisma.exercise.findUnique({ where: { id: exerciseId } });
    if (!exercise) return { success: false, error: "Không tìm thấy bài tập." };

    // Chấm đúng/sai: chỉ khi có đáp án mẫu; không thì ghi nhận nộp
    // nhưng không kết luận (tránh chấm bừa bằng AI tốn phí mỗi submit).
    const isCorrect = exercise.expectedOutput
      ? normalizeAnswer(answer) === normalizeAnswer(exercise.expectedOutput)
      : false;
    const score = isCorrect ? 100 : 0;

    const alreadySolved = await prisma.exerciseAttempt.findFirst({
      where: { userId, exerciseId, isCorrect: true },
      select: { id: true },
    });
    const isFirstSolve = isCorrect && !alreadySolved;

    const attempt = await prisma.exerciseAttempt.create({
      data: { userId, exerciseId, answer: answer.trim(), isCorrect, score },
    });

    // Mastery cập nhật mỗi lần nộp (đúng/sai đều là tín hiệu học).
    await updateMastery({ userId, subject: exercise.subject, topic: exercise.topic, isCorrect });

    // XP: CHỈ lần đúng đầu tiên. Nộp sai hoặc nộp đúng lặp lại = 0 XP.
    let xpEarned = 0;
    if (isFirstSolve) {
      const difficulty =
        exercise.difficulty === "easy" || exercise.difficulty === "hard" ? exercise.difficulty : "medium";
      const result = await recordLearningActivity({
        userId,
        type:
          difficulty === "easy"
            ? "exercise_easy"
            : difficulty === "hard"
              ? "exercise_hard"
              : "exercise_medium",
        difficulty,
        scorePercent: 100,
        isFirstCompletion: true,
        sourceId: exercise.id,
        sourceType: "exercise",
      });
      xpEarned = result.xpEarned;
    }

    return {
      success: true,
      data: {
        attemptId: attempt.id,
        isCorrect,
        score,
        hasSampleAnswer: !!exercise.expectedOutput,
        isFirstSolve,
        xpEarned,
      },
    };
  } catch (err) {
    console.error("[submitExerciseAttempt] Error:", err);
    return { success: false, error: "Không thể nộp bài, thử lại sau." };
  }
}
