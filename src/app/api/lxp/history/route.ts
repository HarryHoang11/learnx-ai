// ================================================================
// GET /api/lxp/history — LXP transaction history
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getLXPHistory } from "@/services/learning-activity.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const result = await getLXPHistory(userId, page, limit);

    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error("[api/lxp/history] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy lịch sử LXP, thử lại sau." },
      { status: 500 }
    );
  }
}