// ================================================================
// GET /api/practice/mistakes
// ================================================================
// Mạch tư duy: route mỏng, chỉ đọc — mọi logic gộp/nhóm nằm ở
// mistake-analysis.service.ts. `weakConcepts` là input trực tiếp cho
// nút "Targeted Practice" ở Workspace (client gọi lại /api/quiz/
// generate với đúng subject/topic/sourceDocumentId lấy từ đây).
// ================================================================

import { NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getRecentMistakes, getWeakConcepts, type RecentMistake, type WeakConcept } from "@/services/mistake-analysis.service";
import type { ApiResponse } from "@/types";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const [weakConcepts, recentMistakes] = await Promise.all([
      getWeakConcepts(userId),
      getRecentMistakes(userId),
    ]);

    return NextResponse.json<ApiResponse<{ weakConcepts: WeakConcept[]; recentMistakes: RecentMistake[] }>>({
      success: true,
      data: { weakConcepts, recentMistakes },
    });
  } catch (err) {
    console.error("[api/practice/mistakes] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải dữ liệu lỗi sai, thử lại sau." },
      { status: 500 }
    );
  }
}
