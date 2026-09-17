import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { completeLearningSession, type LearningSessionSummary } from "@/services/learning-session.service";
import type { ApiResponse } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const session = await completeLearningSession(userId, id);
    return NextResponse.json<ApiResponse<LearningSessionSummary>>({ success: true, data: session });
  } catch (err) {
    console.error("[api/learning-session/[id]/complete] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: err instanceof Error ? err.message : "Không thể hoàn thành buổi học." },
      { status: 400 }
    );
  }
}
