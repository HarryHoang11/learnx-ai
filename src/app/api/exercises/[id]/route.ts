// ================================================================
// GET /api/exercises/[id] — chi tiết bài tập (ẩn đáp án mẫu)
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getExercise } from "@/services/exercise.service";
import type { ApiResponse } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const result = await getExercise(id, userId);
    if (!result.success) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: result.error }, { status: 404 });
    }
    return NextResponse.json<ApiResponse<typeof result.data>>({ success: true, data: result.data });
  } catch (err) {
    console.error("[api/exercises/[id]] GET error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải bài tập" },
      { status: 500 }
    );
  }
}
