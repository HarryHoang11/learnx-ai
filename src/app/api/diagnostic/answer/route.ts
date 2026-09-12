// ================================================================
// POST /api/diagnostic/answer — Submit diagnostic answer
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { updateDiagnosticSession, evaluateDiagnosticResult, generateDiagnosticQuestions, type DiagnosticQuestion } from "@/services/diagnostic.service";
import { pickNextDifficulty } from "@/services/assessment.service";
import type { ApiResponse } from "@/types";

const MAX_QUESTIONS = 15;

interface AnswerInput {
  sessionId: string;
  questionId: string;
  answer: string;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { sessionId, questionId, answer } = body as {
      sessionId: string;
      questionId: string;
      answer: string;
    };

    if (!sessionId || !questionId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu sessionId hoặc questionId." },
        { status: 400 }
      );
    }

    // Verify session ownership
    const session = await prisma.diagnosticSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Phiên kiểm tra không tồn tại." },
        { status: 404 }
      );
    }

    // IDEMPOTENT: phiên đã completed thì trả kết quả đã lưu, KHÔNG cập
    // nhật counters, KHÔNG evaluate/record lại — chống farm XP/streak
    // bằng cách submit lặp lại.
    if (session.status === "completed") {
      return NextResponse.json<ApiResponse<{ done: true; result: unknown }>>({
        success: true,
        data: { done: true, result: (session as { result?: unknown }).result ?? null },
      });
    }

    // Server-side answer verification: look up the stored question in
    // the session's questions cache and verify the answer independently.
    // This prevents cheating by modifying client-side question data.
    const storedQuestions = (session.questions as unknown as DiagnosticQuestion[] | undefined) ?? [];
    const storedQuestion = storedQuestions.find((q: { id: string }) => q.id === questionId);

    if (!storedQuestion) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Câu hỏi không tồn tại trong phiên này." },
        { status: 404 }
      );
    }

    // Verify answer server-side
    const isCorrect = answer.trim().toLowerCase() === storedQuestion.correctAnswer.trim().toLowerCase();

    // Update session
    // Map difficulty to numeric value for currentDifficulty field
    const difficultyToNumber = (d: string): number => {
      if (d === "easy") return 0.25;
      if (d === "hard") return 0.75;
      return 0.5; // medium
    };

    await updateDiagnosticSession({
      sessionId,
      userId,
      answeredQuestions: session.answeredQuestions + 1,
      correctAnswers: isCorrect ? session.correctAnswers + 1 : session.correctAnswers,
      currentDifficulty: difficultyToNumber(isCorrect ? pickNextDifficulty(storedQuestion.difficulty, true) : storedQuestion.difficulty),
    });

    // Check if diagnostic is complete
    const answeredCount = session.answeredQuestions + 1;

    if (answeredCount >= MAX_QUESTIONS) {
      // Complete diagnostic
      const updatedSession = await prisma.diagnosticSession.findUnique({
        where: { id: sessionId },
      });

      // Get all answers from session metadata or we need to store them
      // For now, we'll evaluate based on what we have
      const answers = []; // In real implementation, store answers in session
      
      // Evaluate result
      // Note: In production, you'd store answers during the session
      const result = await evaluateDiagnosticResult({
        userId,
        diagnosticSessionId: sessionId,
        answers: [], // Would come from stored answers
      });

      await updateDiagnosticSession({
        sessionId,
        userId,
        status: "completed",
        result: result,
      });

      return NextResponse.json<ApiResponse<{ done: true; result: typeof result }>>({
        success: true,
        data: { done: true, result },
      });
    }

    // Generate next question with adaptive difficulty
    const nextDifficulty = pickNextDifficulty(storedQuestion.difficulty, isCorrect);
    const questions = await generateDiagnosticQuestions({
      subject: session.subject!,
      topic: session.topic || undefined,
    });

    // Store new questions in session cache for verification
    await prisma.diagnosticSession.update({
      where: { id: sessionId },
      data: { questions: questions as any },
    });

    // Filter for appropriate difficulty
    const nextQuestion = questions.find(q => q.difficulty === nextDifficulty) || questions[0];

    return NextResponse.json<ApiResponse<{ 
      done: false; 
      isCorrect: boolean; 
      nextQuestion: typeof nextQuestion;
      answeredCount: number;
    }>>({
      success: true,
      data: { done: false, isCorrect, nextQuestion, answeredCount },
    });
  } catch (err) {
    console.error("[api/diagnostic/answer] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể xử lý câu trả lời, thử lại sau." },
      { status: 500 }
    );
  }
}