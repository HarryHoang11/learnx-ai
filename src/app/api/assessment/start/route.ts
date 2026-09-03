// ================================================================
// POST /api/assessment/start
// ================================================================
// Mạch tư duy: route này chỉ tạo 1 bản ghi Assessment mới (status =
// in_progress) và sinh CÂU HỎI ĐẦU TIÊN ở độ khó "easy" — đúng như
// sơ đồ "AI Diagnostic Test" trong bản kế hoạch gốc (luôn bắt đầu dễ
// rồi mới thích ứng dần). Việc sinh câu hỏi tiếp theo (dựa đúng/sai)
// thuộc về /api/assessment/answer, KHÔNG lặp lại ở đây.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generateQuizQuestion } from "@/services/quiz.service";
import { AIOverloadedError } from "@/lib/ai/gemini";
import type { ApiResponse, GeneratedQuestion } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();
    const body = await req.json();
    const subject = (body.subject as string) ?? "Toán";

    const assessment = await prisma.assessment.create({
      data: { userId, status: "in_progress" },
    });

    // Câu đầu tiên LUÔN ở độ khó "easy" và chủ đề tổng quát nhất của
    // môn học — mục đích là "khởi động" trước khi thích ứng dần theo
    // đúng/sai (xem services/assessment.service.ts -> pickNextDifficulty).
    const firstQuestion = await generateQuizQuestion(subject, "Kiến thức nền tảng", "easy");

    return NextResponse.json<ApiResponse<{ assessmentId: string; question: GeneratedQuestion }>>({
      success: true,
      data: { assessmentId: assessment.id, question: firstQuestion },
    });
  } catch (err) {
    console.error("[api/assessment/start] Lỗi:", err);

    if (err instanceof AIOverloadedError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: err.message },
        { status: 503 }
      );
    }

    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: "Không thể bắt đầu bài kiểm tra, thử lại sau.",
        ...(process.env.NODE_ENV === "development" && {
          debug: err instanceof Error ? err.message : String(err),
        }),
      },
      { status: 500 }
    );
  }
}
