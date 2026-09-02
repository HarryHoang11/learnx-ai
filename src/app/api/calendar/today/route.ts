// ================================================================
// GET /api/calendar/today
// ================================================================
// Mạch tư duy: route mỏng — chỉ xác thực user rồi gọi
// getTodaySessions() (service). Logic tính "hôm nay là khoảng nào"
// nằm 100% trong calendar.service.ts, route không tự tính lại.
// ================================================================

import { NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getTodaySessions } from "@/services/calendar.service";
import type { ApiResponse } from "@/types";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const sessions = await getTodaySessions(userId);
    return NextResponse.json<ApiResponse<typeof sessions>>({ success: true, data: sessions });
  } catch (err) {
    console.error("[api/calendar/today] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy lịch hôm nay, thử lại sau." },
      { status: 500 }
    );
  }
}
