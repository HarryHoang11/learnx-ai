// ================================================================
// GET /api/analytics/overview — chỉ số tổng quan
// ================================================================
// Mạch tư duy: endpoint tách riêng cho phần dashboard muốn load độc lập.
// Trang hiện dùng /api/analytics (payload đầy đủ) vì 1 request là đủ; tách
// ở đây để (a) widget nhỏ không phải tải cả payload, (b) có chỗ gắn cache
// riêng cho phần tĩnh.
//
// CHÚ Ý: dùng CHUNG hàm getLearningAnalytics, KHÔNG viết lại logic. Endpoint
// này chỉ chọn ra phần dữ liệu cần trả — tránh 2 bản số liệu lệch nhau.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getLearningAnalytics } from "@/services/analytics/learning-analytics.service";
import { parseAnalyticsFilters } from "@/services/analytics/filters";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorizedResponse();

  try {
    const data = await getLearningAnalytics(
      userId,
      req.nextUrl.searchParams.get("range"),
      parseAnalyticsFilters(req.nextUrl.searchParams)
    );
    return NextResponse.json({
      success: true,
      data: {
        range: data.range,
        availability: data.availability,
        overview: data.overview,
        metrics: data.metrics,
        studyTime: data.studyTime,
        correlation: data.correlation,
      },
    } satisfies ApiResponse<unknown>);
  } catch {
    return NextResponse.json(
      { success: false, error: "Không tải được tổng quan học tập." },
      { status: 500 }
    );
  }
}
