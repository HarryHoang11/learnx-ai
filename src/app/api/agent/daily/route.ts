// ================================================================
// GET /api/agent/daily — Get daily learning plan
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getDailyPlan } from "@/services/learning-agent.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const date = dateParam ? new Date(dateParam) : new Date();

    const dailyPlan = await getDailyPlan(userId, date);

    return NextResponse.json<ApiResponse<typeof dailyPlan>>({ success: true, data: dailyPlan });
  } catch (err) {
    console.error("[api/agent/daily] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy kế hoạch ngày, thử lại sau." },
      { status: 500 }
    );
  }
}