// ================================================================
// GET /api/analytics — Learning Analytics cho đúng 1 user đang đăng nhập
// ================================================================
// Mạch tư duy: toàn bộ số liệu được tính ở SERVER bằng SQL aggregate
// (services/analytics/learning-analytics.service.ts). Client chỉ nhận
// payload đã xong — không tải hàng trăm record lên rồi tự tính, vừa nặng
// vừa dễ lệch số giữa client và server.
//
// DATA ISOLATION: userId KHÔNG BAO GIỜ lấy từ query string hay body của
// client — nó đến từ getCurrentUserId() đọc session Auth.js đã ký. Client
// thêm ?userId=<của người khác> không có bất kỳ tác dụng nào.
//
// Tham số:
//   ?range=7d|30d|90d|6m|all   (mặc định 30d, sai thì tự về 30d)
//   ?ai=0                      bỏ qua lớp AI, chỉ dùng số liệu thật
//
// AI là lớp BỔ SUNG, không phải điều kiện: AI lỗi/hết provider thì `insight`
// rơi về deterministic và trang vẫn dùng được bình thường.
//
// THAY THẾ: route cũ từng đưa Attempt thô cho generateText() và bắt AI "diễn
// giải thành lời" — đúng cách bịa số mà yêu cầu cấm (AI tự cộng trừ trong
// đầu, không có hàng rào kiểm tra số).
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getLearningAnalytics } from "@/services/analytics/learning-analytics.service";
import { buildAiInsight, buildDeterministicInsight } from "@/services/analytics/insights";
import { parseAnalyticsFilters } from "@/services/analytics/filters";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorizedResponse();

  const range = req.nextUrl.searchParams.get("range");
  // Bộ lọc đi qua `parseAnalyticsFilters` trước khi chạm DB: cắt độ dài,
  // chỉ nhận difficulty hợp lệ, giá trị rỗng = không lọc.
  const filters = parseAnalyticsFilters(req.nextUrl.searchParams);
  const withAi = req.nextUrl.searchParams.get("ai") !== "0";

  try {
    const data = await getLearningAnalytics(userId, range, filters);

    // Luôn có deterministic insight sẵn: đây là bản hiển thị được dùng khi
    // AI thất bại, nên mục "Why you're improving" không bao giờ trống.
    const deterministic = buildDeterministicInsight(data);
    const ai = withAi ? await buildAiInsight(data) : null;

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        // Giữ cả hai: client hiển thị `insight` và gắn nhãn nguồn bằng
        // `deterministicInsight.source` — người dùng nên biết câu nào do máy
        // tính, câu nào do AI diễn giải.
        insight: ai ?? deterministic,
      },
    } satisfies ApiResponse<typeof data & { insight: typeof deterministic }>);
  } catch {
    // Thông điệp chung, không rò chi tiết DB/Prisma ra client.
    return NextResponse.json(
      { success: false, error: "Không tải được dữ liệu phân tích học tập." },
      { status: 500 }
    );
  }
}
