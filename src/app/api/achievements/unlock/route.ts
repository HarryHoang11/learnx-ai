// ================================================================
// POST /api/achievements/unlock — Check and unlock achievements
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { checkAndUnlockAchievements, initializeAchievements } from "@/services/achievement.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { event } = body as { event?: { type: string; data?: any } };

    // Initialize achievements if needed
    await initializeAchievements();

    const results = await checkAndUnlockAchievements(userId, event || { type: "manual_check" });

    return NextResponse.json<ApiResponse<typeof results>>({ success: true, data: results });
  } catch (err) {
    console.error("[api/achievements/unlock] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể kiểm tra thành tựu, thử lại sau." },
      { status: 500 }
    );
  }
}