// ================================================================
// GET /api/analytics/insights — phần "Vì sao tôi tiến bộ" + hành động
// ================================================================
// Mạch tư duy: insight là phần CHẬM nhất (gọi AI) và thay đổi ít nhất theo
// thời gian, nên tách endpoint cho phép cache/refetch riêng mà không phải
// tính lại toàn bộ metrics.
//
// AI vẫn là lớp bổ sung: `?ai=0` hoặc AI lỗi -> trả deterministic.
// Không bao giờ trả lỗi 500 chỉ vì AI hỏng.
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getLearningAnalytics } from "@/services/analytics/learning-analytics.service";
import { buildAiInsight, buildDeterministicInsight } from "@/services/analytics/insights";
import { parseAnalyticsFilters } from "@/services/analytics/filters";
import type { ApiResponse } from "@/types";
import type { RecommendedAction } from "@/services/analytics/types";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorizedResponse();

  const withAi = req.nextUrl.searchParams.get("ai") !== "0";

  try {
    const data = await getLearningAnalytics(
      userId,
      req.nextUrl.searchParams.get("range"),
      parseAnalyticsFilters(req.nextUrl.searchParams)
    );

    const deterministic = buildDeterministicInsight(data);
    const ai = withAi ? await buildAiInsight(data) : null;

    return NextResponse.json({
      success: true,
      data: {
        insight: ai ?? deterministic,
        // Gửi kèm bản deterministic để client biết chính xác câu nào là số
        // liệu thật — người dùng có quyền biết đâu do máy tính.
        deterministicInsight: deterministic,
        recommendations: data.recommendations as RecommendedAction[],
        focusAreas: data.focusAreas,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Không tạo được nhận xét phân tích học tập." },
      { status: 500 }
    );
  }
}
