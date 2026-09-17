import { NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getActiveLearningSession, type LearningSessionSummary } from "@/services/learning-session.service";
import type { ApiResponse } from "@/types";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const session = await getActiveLearningSession(userId);
    return NextResponse.json<ApiResponse<LearningSessionSummary | null>>({ success: true, data: session });
  } catch (err) {
    console.error("[api/learning-session/active] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải buổi học hiện tại." },
      { status: 500 }
    );
  }
}
