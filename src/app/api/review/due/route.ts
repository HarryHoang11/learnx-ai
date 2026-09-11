// ================================================================
// GET /api/review/due — Get due reviews
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getDueReviews, getReviewStats } from "@/services/spaced-repetition.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    const [reviews, stats] = await Promise.all([
      getDueReviews(userId, limit),
      getReviewStats(userId),
    ]);

    return NextResponse.json<ApiResponse<{ reviews: typeof reviews; stats: typeof stats }>>({
      success: true,
      data: { reviews, stats },
    });
  } catch (err) {
    console.error("[api/review/due] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy danh sách ôn tập, thử lại sau." },
      { status: 500 }
    );
  }
}