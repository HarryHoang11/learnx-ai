// ================================================================
// GET /api/roadmaps — danh sách TOÀN BỘ lộ trình (mọi status) của user
// POST /api/roadmaps — tạo lộ trình MỚI (không đụng lộ trình cũ)
// ================================================================
// Mạch tư duy: route này KHÁC với /api/roadmap (số ít, cũ) — route cũ
// chỉ trả plan mới nhất, dùng cho flow onboarding lần đầu và ĐƯỢC GIỮ
// NGUYÊN không sửa gì (xem api/roadmap/route.ts, roadmap.service.ts).
// Route này (số nhiều, mới) phục vụ màn "Lộ trình của tôi" — cho phép
// user sở hữu nhiều LearningGoal độc lập cùng lúc.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { listGoalsForUser, createGoalWithRoadmap } from "@/services/roadmap.service";
import { AIOverloadedError } from "@/lib/ai/router";
import type { ApiResponse, GoalWithRoadmap } from "@/types";

export async function GET(_req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const goals = await listGoalsForUser(userId);
    return NextResponse.json<ApiResponse<GoalWithRoadmap[]>>({ success: true, data: goals });
  } catch (err) {
    console.error("[api/roadmaps] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy danh sách lộ trình, thử lại sau." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const goalTitle = body.goalTitle as string | undefined;
    const targetMonths = body.targetMonths as number | undefined;

    if (!goalTitle || !targetMonths) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Cần goalTitle và targetMonths để tạo lộ trình mới." },
        { status: 400 }
      );
    }

    // KHÔNG kiểm tra/giới hạn số lượng goal hiện có của user — đây
    // chính là yêu cầu cốt lõi: "Không được giới hạn user chỉ có một
    // roadmap". Goal/roadmap cũ hoàn toàn không bị đụng tới.
    const goal = await createGoalWithRoadmap({ userId, goalTitle, targetMonths });
    return NextResponse.json<ApiResponse<GoalWithRoadmap>>({ success: true, data: goal });
  } catch (err) {
    console.error("[api/roadmaps] Lỗi tạo lộ trình mới:", err);

    if (err instanceof AIOverloadedError) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: err.message }, { status: 503 });
    }

    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: "Không thể tạo lộ trình, thử lại sau.",
        ...(process.env.NODE_ENV === "development" && {
          debug: err instanceof Error ? err.message : String(err),
        }),
      },
      { status: 500 }
    );
  }
}
