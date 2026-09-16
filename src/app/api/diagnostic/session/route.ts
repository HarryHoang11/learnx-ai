// ================================================================
// POST /api/diagnostic/session — Create new diagnostic session
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import {
  createDiagnosticSession,
  generateDiagnosticQuestions,
  toPublicDiagnosticQuestion,
} from "@/services/diagnostic.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json() as { subject?: unknown; topic?: unknown; goal?: unknown };
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const topic = typeof body.topic === "string" ? body.topic.trim() || undefined : undefined;
    const goal = typeof body.goal === "string" ? body.goal.trim() || undefined : undefined;

    if (!subject || subject.length > 120 || (topic && topic.length > 160) || (goal && goal.length > 500)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu subject." },
        { status: 400 }
      );
    }

    // Generate before persisting a session so an AI failure cannot leave
    // an empty in-progress diagnostic in the user's history.
    const questions = await generateDiagnosticQuestions({ subject, topic, goal, questionCount: 15 });
    const session = await createDiagnosticSession({ userId, subject, topic, questions });

    return NextResponse.json<ApiResponse<{ sessionId: string; questions: ReturnType<typeof toPublicDiagnosticQuestion>[] }>>({
      success: true,
      data: { sessionId: session.id, questions: questions.map(toPublicDiagnosticQuestion) },
    });
  } catch (err) {
    console.error("[api/diagnostic/session] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo bài kiểm tra, thử lại sau." },
      { status: 500 }
    );
  }
}
