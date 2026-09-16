// ================================================================
// POST /api/quiz/generate
// ================================================================
// Mạch tư duy: khác /api/assessment/start (luôn bắt đầu easy, do hệ
// thống chọn chủ đề), route này để HỌC SINH TỰ CHỌN (subject, topic,
// difficulty) muốn luyện tập thêm — vd từ màn hình Roadmap bấm vào
// 1 topic cụ thể. Logic sinh câu hỏi vẫn dùng chung
// generateQuizQuestion() với assessment, tránh 2 luồng sinh câu hỏi
// khác nhau cho cùng 1 việc.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { AIOverloadedError } from "@/lib/ai/router";
import { generateQuizQuestion, QuizQuestionError, toPublicQuestion } from "@/services/quiz.service";
import type { ApiResponse, Difficulty, PublicQuestion } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const subject = body.subject as string;
    const topic = body.topic as string;
    const difficulty = (body.difficulty as Difficulty) ?? "medium";
    const sourceDocumentId = typeof body.sourceDocumentId === "string" ? body.sourceDocumentId : undefined;

    if (!subject || !topic) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu subject hoặc topic." },
        { status: 400 }
      );
    }

    const question = await generateQuizQuestion(userId, subject, topic, difficulty, sourceDocumentId);

    return NextResponse.json<ApiResponse<PublicQuestion>>({ success: true, data: toPublicQuestion(question) });
  } catch (err) {
    console.error("[api/quiz/generate] Lỗi:", err);
    if (err instanceof QuizQuestionError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: err.message },
        { status: err.status }
      );
    }
    if (err instanceof AIOverloadedError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: err.message },
        { status: 503 }
      );
    }
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể sinh câu hỏi, thử lại sau." },
      { status: 500 }
    );
  }
}
