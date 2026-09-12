// ================================================================
// POST /api/diagnostic/session — Create new diagnostic session
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createDiagnosticSession, generateDiagnosticQuestions } from "@/services/diagnostic.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { subject, topic, goal } = body as { subject: string; topic?: string; goal?: string };

    if (!subject) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu subject." },
        { status: 400 }
      );
    }

    // Create session
    const session = await createDiagnosticSession({ userId, subject, topic });

    // Generate questions
    const questions = await generateDiagnosticQuestions({ subject, topic, goal });

    // Update session with questions (stored server-side for answer verification)
    await prisma.diagnosticSession.update({
      where: { id: session.id },
      data: { totalQuestions: questions.length, currentDifficulty: 0.5, questions: questions as any },
    });

    return NextResponse.json<ApiResponse<{ sessionId: string; questions: typeof questions }>>({
      success: true,
      data: { sessionId: session.id, questions },
    });
  } catch (err) {
    console.error("[api/diagnostic/session] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo bài kiểm tra, thử lại sau." },
      { status: 500 }
    );
  }
}