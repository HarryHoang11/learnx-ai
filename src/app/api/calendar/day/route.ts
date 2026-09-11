// ================================================================
// GET /api/calendar/day?date=YYYY-MM-DD — sessions của 1 ngày
// ================================================================
// Phục vụ Day view: client truyền ngày đang xem (local timezone),
// server trả sessions trong [00:00, 24:00) của đúng ngày đó.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getDaySessions } from "@/services/calendar.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Tham số date phải có định dạng YYYY-MM-DD." },
        { status: 400 }
      );
    }

    const sessions = await getDaySessions(userId, date);
    return NextResponse.json<ApiResponse<typeof sessions>>({ success: true, data: sessions });
  } catch (err) {
    console.error("[api/calendar/day] Lỗi:", err);
    const message = err instanceof Error ? err.message : "Không thể lấy lịch ngày, thử lại sau.";
    return NextResponse.json<ApiResponse<never>>({ success: false, error: message }, { status: 400 });
  }
}
