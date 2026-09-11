// ================================================================
// GET /api/leaderboard/subject?subject=&limit= — BXH mastery theo môn
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getSubjectMasteryLeaderboard } from "@/services/leaderboard.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject") || "";
    const limit = parseInt(searchParams.get("limit") || "20");
    if (!subject.trim()) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu tham số subject." },
        { status: 400 }
      );
    }

    const entries = await getSubjectMasteryLeaderboard(subject, limit);
    return NextResponse.json<ApiResponse<typeof entries>>({ success: true, data: entries });
  } catch (err) {
    console.error("[api/leaderboard/subject] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải bảng xếp hạng, thử lại sau." },
      { status: 500 }
    );
  }
}
