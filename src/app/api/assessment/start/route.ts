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
import { generateQuizQuestion, QuizQuestionError, toPublicQuestion } from "@/services/quiz.service";
import { AIOverloadedError } from "@/lib/ai/router";
import type { ApiResponse, PublicQuestion } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();
    const body = await req.json() as { subject?: unknown };
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    if (!subject || subject.length > 120) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Vui lòng chọn môn học hợp lệ." },
        { status: 400 }
      );
    }

    // Câu đầu tiên LUÔN ở độ khó "easy" và chủ đề tổng quát nhất của
    // môn học — mục đích là "khởi động" trước khi thích ứng dần theo
    // đúng/sai (xem services/assessment.service.ts -> pickNextDifficulty).
    const firstQuestion = await generateQuizQuestion(userId, subject, "Kiến thức nền tảng", "easy");

    const assessment = await prisma.assessment.create({
      data: { userId, subject, status: "in_progress" },
    });

    return NextResponse.json<ApiResponse<{ assessmentId: string; question: PublicQuestion }>>({
      success: true,
      data: { assessmentId: assessment.id, question: toPublicQuestion(firstQuestion) },
    });
  } catch (err) {
    console.error("[api/assessment/start] Lỗi:", err);

    if (err instanceof AIOverloadedError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: err.message },
        { status: 503 }
      );
    }

    if (err instanceof QuizQuestionError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: err.message },
        { status: err.status }
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
