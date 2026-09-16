// ================================================================
// POST /api/diagnostic/answer — verify and persist one adaptive answer
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import {
  evaluateDiagnosticResult,
  parseDiagnosticSessionState,
  serializeDiagnosticSessionState,
  toPublicDiagnosticQuestion,
  type DiagnosticAnswer,
  type DiagnosticResult,
} from "@/services/diagnostic.service";
import { pickNextDifficulty } from "@/services/assessment.service";
import type { ApiResponse } from "@/types";

function normalizeAnswer(answer: string): string {
  return answer.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function difficultyToNumber(difficulty: "easy" | "medium" | "hard"): number {
  if (difficulty === "easy") return 0.25;
  if (difficulty === "hard") return 0.75;
  return 0.5;
}

function resultToJson(result: DiagnosticResult): Prisma.InputJsonObject {
  return {
    overallScore: result.overallScore,
    skillBreakdown: result.skillBreakdown.map((item) => ({
      topic: item.topic,
      score: item.score,
      level: item.level,
      confidence: item.confidence,
    })),
    recommendedTopics: result.recommendedTopics,
    prerequisites: result.prerequisites,
  };
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json() as { sessionId?: unknown; questionId?: unknown; answer?: unknown };
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const questionId = typeof body.questionId === "string" ? body.questionId : "";
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";
    if (!sessionId || !questionId || !answer || answer.length > 5_000) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu hoặc sai định dạng sessionId, questionId hoặc câu trả lời." },
        { status: 400 }
      );
    }

    const session = await prisma.diagnosticSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Phiên kiểm tra không tồn tại." },
        { status: 404 }
      );
    }
    if (session.status === "completed") {
      return NextResponse.json<ApiResponse<{ done: true; result: unknown }>>({
        success: true,
        data: { done: true, result: session.result },
      });
    }

    const state = parseDiagnosticSessionState(session.questions);
    const question = state.questions.find((item) => item.id === questionId);
    if (!question) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Câu hỏi không tồn tại trong phiên này." },
        { status: 404 }
      );
    }
    if (state.answers.some((item) => item.questionId === questionId)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Câu trả lời này đã được ghi nhận." },
        { status: 409 }
      );
    }

    const isCorrect = normalizeAnswer(answer) === normalizeAnswer(question.correctAnswer);
    const nextDifficulty = pickNextDifficulty(question.difficulty, isCorrect);
    const nextAnswer: DiagnosticAnswer = {
      questionId,
      answer,
      isCorrect,
      difficulty: question.difficulty,
      topic: question.topic,
      subject: question.subject,
    };
    const nextState = { ...state, answers: [...state.answers, nextAnswer] };
    const answeredCount = session.answeredQuestions + 1;
    const correctAnswers = session.correctAnswers + (isCorrect ? 1 : 0);
    const totalQuestions = Math.min(Math.max(session.totalQuestions || state.questions.length, 5), 15);

    // Optimistic concurrency check prevents duplicate/replayed requests from
    // incrementing counters or overwriting an answer saved by another tab.
    const update = await prisma.diagnosticSession.updateMany({
      where: {
        id: sessionId,
        userId,
        status: "in_progress",
        answeredQuestions: session.answeredQuestions,
      },
      data: {
        answeredQuestions: answeredCount,
        correctAnswers,
        currentDifficulty: difficultyToNumber(nextDifficulty),
        questions: serializeDiagnosticSessionState(nextState),
      },
    });
    if (update.count !== 1) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Phiên kiểm tra vừa được cập nhật ở nơi khác. Hãy tải lại." },
        { status: 409 }
      );
    }

    if (answeredCount >= totalQuestions) {
      const result = await evaluateDiagnosticResult({
        userId,
        diagnosticSessionId: sessionId,
        answers: nextState.answers,
      });
      await prisma.diagnosticSession.updateMany({
        where: { id: sessionId, userId, status: "in_progress", answeredQuestions: answeredCount },
        data: { status: "completed", completedAt: new Date(), result: resultToJson(result) },
      });
      return NextResponse.json<ApiResponse<{ done: true; isCorrect: boolean; result: typeof result }>>({
        success: true,
        data: { done: true, isCorrect, result },
      });
    }

    const answeredIds = new Set(nextState.answers.map((item) => item.questionId));
    const candidates = state.questions.filter((item) => !answeredIds.has(item.id));
    const nextQuestion = candidates.find((item) => item.difficulty === nextDifficulty) ?? candidates[0];
    if (!nextQuestion) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không còn câu hỏi hợp lệ trong phiên kiểm tra." },
        { status: 409 }
      );
    }

    return NextResponse.json<ApiResponse<{
      done: false;
      isCorrect: boolean;
      nextQuestion: ReturnType<typeof toPublicDiagnosticQuestion>;
      answeredCount: number;
    }>>({
      success: true,
      data: { done: false, isCorrect, nextQuestion: toPublicDiagnosticQuestion(nextQuestion), answeredCount },
    });
  } catch (err) {
    console.error("[api/diagnostic/answer] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể xử lý câu trả lời, thử lại sau." },
      { status: 500 }
    );
  }
}
