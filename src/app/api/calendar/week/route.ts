// ================================================================
// GET /api/calendar/week
// ================================================================
import { NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getWeekSessions } from "@/services/calendar.service";
import type { ApiResponse } from "@/types";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const sessions = await getWeekSessions(userId);
    return NextResponse.json<ApiResponse<typeof sessions>>({ success: true, data: sessions });
  } catch (err) {
    console.error("[api/calendar/week] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy lịch tuần này, thử lại sau." },
      { status: 500 }
    );
  }
}
