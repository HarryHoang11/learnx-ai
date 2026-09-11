// ================================================================
// GET /api/leaderboard?scope=global|friends&limit= — BXH XP/LXP
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getGlobalXpLeaderboard, getFriendsXpLeaderboard, getMyGlobalRank } from "@/services/leaderboard.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") || "global";
    const limit = parseInt(searchParams.get("limit") || "20");

    if (scope === "friends") {
      const entries = await getFriendsXpLeaderboard(userId, limit);
      return NextResponse.json<ApiResponse<typeof entries>>({ success: true, data: entries });
    }

    if (scope !== "global") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "scope phải là global hoặc friends." },
        { status: 400 }
      );
    }

    const [entries, myRank] = await Promise.all([
      getGlobalXpLeaderboard(limit),
      getMyGlobalRank(userId),
    ]);
    return NextResponse.json<ApiResponse<{ entries: typeof entries; myRank: number | null }>>({
      success: true,
      data: { entries, myRank },
    });
  } catch (err) {
    console.error("[api/leaderboard] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải bảng xếp hạng, thử lại sau." },
      { status: 500 }
    );
  }
}
