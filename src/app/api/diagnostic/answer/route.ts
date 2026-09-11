// ================================================================
// POST /api/diagnostic/answer — Submit diagnostic answer
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { updateDiagnosticSession, evaluateDiagnosticResult } from "@/services/diagnostic.service";
import { pickNextDifficulty } from "@/services/assessment.service";
import { generateDiagnosticQuestions } from "@/services/diagnostic.service";
import type { ApiResponse, Difficulty } from "@/types";

interface AnswerInput {
  sessionId: string;
  questionId: string;
  answer: string;
  isCorrect: boolean;
  difficulty: Difficulty;
  topic: string;
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { sessionId, questionId, answer, isCorrect, difficulty, topic } = body as AnswerInput;

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

    // Update session
    await updateDiagnosticSession({
      sessionId,
      userId,
      answeredQuestions: session.answeredQuestions + 1,
      correctAnswers: isCorrect ? session.correctAnswers + 1 : session.correctAnswers,
      currentDifficulty: isCorrect ? pickNextDifficulty(difficulty, true) as any : difficulty,
    });

    // Check if diagnostic is complete (max 15 questions or adaptive stopping)
    const MAX_QUESTIONS = 15;
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
    const nextDifficulty = pickNextDifficulty(difficulty, isCorrect);
    const questions = await generateDiagnosticQuestions({
      subject: session.subject!,
      topic: session.topic || undefined,
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