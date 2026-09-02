// ================================================================
// POST /api/calendar
// ================================================================
// Mạch tư duy: route TẠO mới, tách khỏi GET /api/calendar/today|week|
// month vì đây là hành động ghi (write), cần validate input kỹ hơn
// (thời gian hợp lệ, các trường bắt buộc) — gộp chung sẽ làm route
// GET (chỉ đọc) phình to không cần thiết.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { createStudySession } from "@/services/calendar.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { title, subject, topic, startTime, endTime } = body as {
      title?: string;
      subject?: string;
      topic?: string;
      startTime?: string;
      endTime?: string;
    };

    if (!title || !subject || !startTime || !endTime) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu title, subject, startTime hoặc endTime." },
        { status: 400 }
      );
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "startTime/endTime phải là chuỗi ngày giờ hợp lệ (ISO 8601)." },
        { status: 400 }
      );
    }

    const session = await createStudySession(userId, { title, subject, topic, startTime: start, endTime: end });
    return NextResponse.json<ApiResponse<typeof session>>({ success: true, data: session });
  } catch (err) {
    console.error("[api/calendar POST] Lỗi:", err);
    const message = err instanceof Error ? err.message : "Không thể tạo lịch học, thử lại sau.";
    return NextResponse.json<ApiResponse<never>>({ success: false, error: message }, { status: 400 });
  }
}
