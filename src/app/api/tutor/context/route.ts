// ================================================================
// GET /api/tutor/context
// ================================================================
// Mạch tư duy: AI Tutor cần 2 thứ dữ liệu THẬT để khối bên phải không
// còn là mockup:
//   - Danh sách NGUỒN học của người dùng (tài liệu đã upload & xử lý
//     xong) để chọn nguồn grounding.
//   - CÂU HỎI GỢI Ý sinh theo ngữ cảnh (chủ đề + tài liệu + điểm yếu).
// Gom vào 1 route GET để UI chỉ cần 1 lần gọi, tránh waterfall.
//
// Query: ?topic=<chủ đề>&documentId=<id nguồn đang chọn, optional>
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { listTutorSources, suggestQuestions } from "@/services/tutor-context.service";
import type { ApiResponse } from "@/types";

export interface TutorContextResponse {
  sources: Awaited<ReturnType<typeof listTutorSources>>;
  suggestedQuestions: string[];
  suggestionsGenerated: boolean;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const topic = searchParams.get("topic")?.trim() || "Chủ đề học tập";
    const documentId = searchParams.get("documentId")?.trim() || null;

    const [sources, suggestions] = await Promise.all([
      listTutorSources(userId),
      suggestQuestions({ userId, topic, documentId }),
    ]);

    return NextResponse.json<ApiResponse<TutorContextResponse>>({
      success: true,
      data: {
        sources,
        suggestedQuestions: suggestions.questions,
        suggestionsGenerated: suggestions.generated,
      },
    });
  } catch (err) {
    console.error("[api/tutor/context] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy ngữ cảnh học tập, thử lại sau." },
      { status: 500 }
    );
  }
}
