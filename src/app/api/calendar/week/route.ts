// ================================================================
// GET /api/calendar/week
// ================================================================
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getWeekSessions, getWeekSessionsFor, parseDateString } from "@/services/calendar.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    // ?start=YYYY-MM-DD (ngày bất kỳ trong tuần cần xem) — không có
    // thì mặc định tuần hiện tại. Cho phép prev/next tuần ở UI.
    const { searchParams } = new URL(req.url);
    const startParam = searchParams.get("start");
    let sessions;
    if (startParam) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startParam)) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Tham số start phải có định dạng YYYY-MM-DD." },
          { status: 400 }
        );
      }
      sessions = await getWeekSessionsFor(userId, parseDateString(startParam));
    } else {
      sessions = await getWeekSessions(userId);
    }
    return NextResponse.json<ApiResponse<typeof sessions>>({ success: true, data: sessions });
  } catch (err) {
    console.error("[api/calendar/week] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy lịch tuần này, thử lại sau." },
      { status: 500 }
    );
  }
}
