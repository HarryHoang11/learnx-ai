// ================================================================
// GET /api/goals/[id]/gap — khoảng cách năng lực của 1 mục tiêu
// ================================================================
// Mạch tư duy: route mỏng — ownership check + gọi getGoalGap().
// Gap tính từ LearningProgress THẬT (evidence), target mặc định 80%.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getGoalGap } from "@/services/roadmap.service";
import type { ApiResponse } from "@/types";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const gap = await getGoalGap(userId, id);
    if (gap === null) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy mục tiêu." },
        { status: 404 }
      );
    }
    return NextResponse.json<ApiResponse<typeof gap>>({ success: true, data: gap });
  } catch (err) {
    console.error("[api/goals/[id]/gap] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể phân tích khoảng cách năng lực, thử lại sau." },
      { status: 500 }
    );
  }
}
