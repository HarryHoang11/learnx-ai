// ================================================================
// GET /api/streak — Current streak info
// ================================================================

import { NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getCurrentStreak, getUserProgress } from "@/services/learning-activity.service";
import type { ApiResponse } from "@/types";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const [streak, progress] = await Promise.all([
      getCurrentStreak(userId),
      getUserProgress(userId),
    ]);

    return NextResponse.json<ApiResponse<{ streak: typeof streak; progress: typeof progress }>>({
      success: true,
      data: { streak, progress },
    });
  } catch (err) {
    console.error("[api/streak] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy thông tin streak, thử lại sau." },
      { status: 500 }
    );
  }
}