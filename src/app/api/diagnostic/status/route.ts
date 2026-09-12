// ================================================================
// GET /api/diagnostic/status — Get diagnostic status per subject
// ================================================================
// Trả về danh sách các môn học mà user đã/không đã làm kiểm tra
// năng lực, kèm thời gian hoàn thành và mastery trung bình gần nhất.
// Dùng cho Phase 5: hiển thị trạng thái trước khi bắt đầu.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getAssessmentHistoryBySubject } from "@/services/assessment.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const history = await getAssessmentHistoryBySubject(userId);

    return NextResponse.json<ApiResponse<typeof history>>({
      success: true,
      data: history,
    });
  } catch (err) {
    console.error("[api/diagnostic/status] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy trạng thái kiểm tra, thử lại sau." },
      { status: 500 }
    );
  }
}
