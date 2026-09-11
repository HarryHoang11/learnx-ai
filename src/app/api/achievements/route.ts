// ================================================================
// GET /api/achievements — Get user achievements
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getUserAchievements, getAchievementProgress } from "@/services/achievement.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const withProgress = searchParams.get("progress") === "true";

    if (withProgress) {
      const progress = await getAchievementProgress(userId);
      return NextResponse.json<ApiResponse<typeof progress>>({ success: true, data: progress });
    }

    const achievements = await getUserAchievements(userId);
    return NextResponse.json<ApiResponse<typeof achievements>>({ success: true, data: achievements });
  } catch (err) {
    console.error("[api/achievements] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy danh sách thành tựu, thử lại sau." },
      { status: 500 }
    );
  }
}