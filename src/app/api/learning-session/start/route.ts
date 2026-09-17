import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { startLearningSession, type LearningSessionSummary } from "@/services/learning-session.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json() as {
      subject?: unknown;
      topic?: unknown;
      learningGoalId?: unknown;
      sourceDocumentId?: unknown;
    };
    const subject = typeof body.subject === "string" ? body.subject : "";
    const topic = typeof body.topic === "string" ? body.topic : "";
    const learningGoalId = typeof body.learningGoalId === "string" ? body.learningGoalId : undefined;
    const sourceDocumentId = typeof body.sourceDocumentId === "string" ? body.sourceDocumentId : undefined;

    const session = await startLearningSession(userId, { subject, topic, learningGoalId, sourceDocumentId });
    return NextResponse.json<ApiResponse<LearningSessionSummary>>({ success: true, data: session });
  } catch (err) {
    console.error("[api/learning-session/start] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: err instanceof Error ? err.message : "Không thể bắt đầu buổi học." },
      { status: 400 }
    );
  }
}
