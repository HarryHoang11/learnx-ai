// ================================================================
// POST /api/assessment/answer
// ================================================================
// Mạch tư duy: đây là route QUAN TRỌNG NHẤT của Diagnostic Test vì
// nó thực hiện trọn vòng lặp thích ứng:
//   nhận câu trả lời -> lưu Attempt -> cập nhật mastery
//   -> pickNextDifficulty() -> sinh câu hỏi tiếp theo (hoặc kết thúc
//      nếu đã đủ số câu quy định).
// Route KHÔNG tự tính đúng/sai hay tự quyết định độ khó tiếp theo —
// toàn bộ nằm trong services/assessment.service.ts, route chỉ điều
// phối thứ tự gọi.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemoUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { pickNextDifficulty, updateMastery } from "@/services/assessment.service";
import { generateQuizQuestion } from "@/services/quiz.service";
import type { ApiResponse, GeneratedQuestion } from "@/types";

// Số câu tối đa cho 1 phiên kiểm tra — khớp với "15-20 câu" trong mô
// tả gốc, đặt 16 làm mặc định MVP để demo không quá dài dòng.
const MAX_QUESTIONS_PER_ASSESSMENT = 16;

export async function POST(req: NextRequest) {
  try {
    const session = getSessionOrDemoUser(req);
    const body = await req.json();

    const { assessmentId, question, selectedIndex } = body as {
      assessmentId: string;
      question: GeneratedQuestion;
      selectedIndex: number;
    };

    if (!assessmentId || !question) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu assessmentId hoặc question." },
        { status: 400 }
      );
    }

    const isCorrect = selectedIndex === question.correctIndex;

    // Lưu Attempt GẮN VỚI assessmentId (khác quiz luyện tập thường,
    // xem quiz.service.ts submitQuizAnswer dùng assessmentId: null)
    await prisma.attempt.create({
      data: {
        userId: session.userId,
        assessmentId,
        subject: question.subject,
        topic: question.topic,
        difficulty: question.difficulty,
        question: question.text,
        isCorrect,
      },
    });

    await updateMastery({
      userId: session.userId,
      subject: question.subject,
      topic: question.topic,
      isCorrect,
    });

    const answeredCount = await prisma.attempt.count({ where: { assessmentId } });

    // Đủ số câu -> đóng phiên assessment, báo frontend chuyển sang
    // màn hình kết quả (gọi tiếp /api/assessment/result).
    if (answeredCount >= MAX_QUESTIONS_PER_ASSESSMENT) {
      await prisma.assessment.update({
        where: { id: assessmentId },
        data: { status: "completed", completedAt: new Date() },
      });
      return NextResponse.json<ApiResponse<{ done: true }>>({
        success: true,
        data: { done: true },
      });
    }

    // Chưa đủ câu -> sinh câu tiếp theo với độ khó đã điều chỉnh
    const nextDifficulty = pickNextDifficulty(question.difficulty, isCorrect);
    const nextQuestion = await generateQuizQuestion(question.subject, question.topic, nextDifficulty);

    return NextResponse.json<ApiResponse<{ done: false; isCorrect: boolean; nextQuestion: GeneratedQuestion }>>({
      success: true,
      data: { done: false, isCorrect, nextQuestion },
    });
  } catch (err) {
    console.error("[api/assessment/answer] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể xử lý câu trả lời, thử lại sau." },
      { status: 500 }
    );
  }
}
