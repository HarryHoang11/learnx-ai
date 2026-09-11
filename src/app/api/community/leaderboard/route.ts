// ================================================================
// GET /api/community/leaderboard — Get contributor leaderboard
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getLeaderboard, getSubjectLeaderboard } from "@/services/contribution.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get("period") as "weekly" | "monthly" | "alltime") || "alltime";
    const subjectId = searchParams.get("subjectId") || undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    let leaderboard;
    if (subjectId) {
      leaderboard = await getSubjectLeaderboard(subjectId, period, limit);
    } else {
      leaderboard = await getLeaderboard(period, subjectId, limit);
    }

    return NextResponse.json<ApiResponse<typeof leaderboard>>({ success: true, data: leaderboard });
  } catch (err) {
    console.error("[api/community/leaderboard] GET error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải bảng xếp hạng" },
      { status: 500 }
    );
  }
}