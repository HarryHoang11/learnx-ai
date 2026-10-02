// ================================================================
// GET /api/review/due — Get due reviews
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import {
  getDueReviews,
  getReviewStats,
  getReviewInsights,
} from "@/services/spaced-repetition.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    // Validate limit SAU auth (user ẩn danh luôn nhận 401 như mọi API —
    // không để lộ hành vi validate) và TRƯỚC Prisma:
    //   - không truyền / rỗng        -> default 20 (giữ contract cũ);
    //   - không phải số nguyên 1–100 -> 400 Bad Request rõ ràng.
    // Trước đây `?limit=abc` rơi thẳng xuống Prisma `take` = NaN -> 500
    // khó chẩn đoán; max 100 để tránh abuse (frontend thật chỉ gửi 30 và 5).
    const { searchParams } = new URL(req.url);
    const rawLimit = searchParams.get("limit");
    let limit = 20;
    if (rawLimit !== null && rawLimit.trim() !== "") {
      const parsed = Number(rawLimit);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "limit phải là số nguyên trong khoảng 1–100." },
          { status: 400 }
        );
      }
      limit = parsed;
    }

    // Lọc môn cho flow "Ôn tập": `?subject=Toán`. Validate cơ bản — chỉ nhận
    // chuỗi ngắn, không cho truyền rác vào SQL (Prisma vẫn bind tham số nên
    // an toàn, nhưng giới hạn độ dài tránh log/ghi rác).
    const rawSubject = searchParams.get("subject");
    const subject =
      rawSubject && rawSubject.trim() !== "" && rawSubject.length <= 100
        ? rawSubject.trim()
        : undefined;

    // Smart review: thống kê môn + chủ đề hay sai. Chỉ tính khi UI KHÔNG lọc
    // môn — nếu đã lọc "Toán" thì gợi ý phải nói về Toán, không nói về Vật lý
    // (tránh thấy "nên ôn Toán" khi đang ở tab Vật lý).
    const wantInsights = searchParams.get("insights") === "true" && !subject;

    const [reviews, stats, insights] = await Promise.all([
      getDueReviews(userId, limit, { subject }),
      getReviewStats(userId, { subject }),
      wantInsights
        ? getReviewInsights(userId)
        : Promise.resolve(null),
    ]);

    return NextResponse.json<ApiResponse<{
      reviews: typeof reviews;
      stats: typeof stats;
      /** null = UI không yêu cầu insights (hoặc đang lọc môn). */
      insights: typeof insights;
    }>>({
      success: true,
      data: { reviews, stats, insights },
    });
  } catch (err) {
    console.error("[api/review/due] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy danh sách ôn tập, thử lại sau." },
      { status: 500 }
    );
  }
}