// ================================================================
// POST /api/quiz/submit
// ================================================================
// Mạch tư duy: route mỏng, chỉ chuyển tiếp cho submitQuizAnswer()
// (service) — hàm đó lo cả việc lưu Attempt lẫn cập nhật mastery,
// route không cần biết chi tiết bên trong.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { QuizQuestionError, submitQuizAnswer } from "@/services/quiz.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();
    const body = await req.json();
    const questionId = body.questionId as string;
    const selectedIndex = Number(body.selectedIndex);

    if (!questionId || !Number.isInteger(selectedIndex) || selectedIndex < 0) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu questionId hoặc selectedIndex không hợp lệ." },
        { status: 400 }
      );
    }

    const result = await submitQuizAnswer({ userId, questionId, selectedIndex });

    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error("[api/quiz/submit] Lỗi:", err);
    if (err instanceof QuizQuestionError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể chấm câu trả lời, thử lại sau." },
      { status: 500 }
    );
  }
}
