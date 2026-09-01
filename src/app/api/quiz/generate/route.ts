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
import { generateQuizQuestion } from "@/services/quiz.service";
import type { ApiResponse, Difficulty, GeneratedQuestion } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const subject = body.subject as string;
    const topic = body.topic as string;
    const difficulty = (body.difficulty as Difficulty) ?? "medium";

    if (!subject || !topic) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu subject hoặc topic." },
        { status: 400 }
      );
    }

    const question = await generateQuizQuestion(subject, topic, difficulty);

    return NextResponse.json<ApiResponse<GeneratedQuestion>>({ success: true, data: question });
  } catch (err) {
    console.error("[api/quiz/generate] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể sinh câu hỏi, thử lại sau." },
      { status: 500 }
    );
  }
}
