// ================================================================
// POST /api/quiz/submit
// ================================================================
// Mạch tư duy: route mỏng, chỉ chuyển tiếp cho submitQuizAnswer()
// (service) — hàm đó lo cả việc lưu Attempt lẫn cập nhật mastery,
// route không cần biết chi tiết bên trong.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemoUser } from "@/lib/auth/session";
import { submitQuizAnswer } from "@/services/quiz.service";
import type { ApiResponse, GeneratedQuestion } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = getSessionOrDemoUser(req);
    const body = await req.json();
    const question = body.question as GeneratedQuestion;
    const selectedIndex = Number(body.selectedIndex);

    if (!question || Number.isNaN(selectedIndex)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu question hoặc selectedIndex không hợp lệ." },
        { status: 400 }
      );
    }

    const result = await submitQuizAnswer({ userId: session.userId, question, selectedIndex });

    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error("[api/quiz/submit] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể chấm câu trả lời, thử lại sau." },
      { status: 500 }
    );
  }
}
