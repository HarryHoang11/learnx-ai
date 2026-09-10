// ================================================================
// GET /api/calendar/month-grid — Month calendar with learning indicators
// ================================================================
// Returns 42-day grid (6 weeks) with learning day indicators
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getMonthGrid, getLearningDaysForMonth } from "@/services/calendar.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

    if (month < 1 || month > 12) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Tháng không hợp lệ (1-12)." },
        { status: 400 }
      );
    }

    const [grid, learningDays] = await Promise.all([
      getMonthGrid(year, month),
      getLearningDaysForMonth(userId, year, month),
    ]);

    // Create a Set of date strings for quick lookup
    const learnedDates = new Set(learningDays.map(d => d.date.toISOString().slice(0, 10)));

    const gridWithIndicators = grid.map(day => ({
      ...day,
      isLearned: learnedDates.has(day.dateStr),
    }));

    return NextResponse.json<ApiResponse<typeof gridWithIndicators>>({
      success: true,
      data: gridWithIndicators,
    });
  } catch (err) {
    console.error("[api/calendar/month-grid] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải dữ liệu lịch, thử lại sau." },
      { status: 500 }
    );
  }
}