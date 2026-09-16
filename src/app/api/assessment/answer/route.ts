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
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { AIOverloadedError } from "@/lib/ai/router";
import { prisma } from "@/lib/db/prisma";
import { pickNextDifficulty } from "@/services/assessment.service";
import { generateQuizQuestion, QuizQuestionError, submitQuizAnswer, toPublicQuestion } from "@/services/quiz.service";
import { getCurrentStreak, recordLearningActivity } from "@/services/learning-activity.service";
import type { ApiResponse, Difficulty, PublicQuestion } from "@/types";

// Số câu tối đa cho 1 phiên kiểm tra — khớp với "15-20 câu" trong mô
// tả gốc, đặt 16 làm mặc định MVP để demo không quá dài dòng.
const MAX_QUESTIONS_PER_ASSESSMENT = 15;

interface CompletionActivity {
  recorded: boolean;
  alreadyRecorded?: boolean;
  xpEarned: number;
  streak: { current: number; longest: number };
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();
    const body = await req.json();

    const { assessmentId, questionId, selectedIndex } = body as {
      assessmentId: string;
      questionId: string;
      selectedIndex: number;
    };

    if (!assessmentId || !questionId || !Number.isInteger(selectedIndex) || selectedIndex < 0) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu assessmentId, questionId hoặc selectedIndex không hợp lệ." },
        { status: 400 }
      );
    }

    // Xác minh assessmentId THẬT SỰ thuộc user hiện tại trước khi ghi
    // Attempt hay cập nhật trạng thái — nếu không, user A gửi
    // assessmentId của user B có thể chèn dữ liệu/đóng phiên kiểm tra
    // của B (lỗ hổng data isolation).
    const assessment = await prisma.assessment.findFirst({ where: { id: assessmentId, userId } });
    if (!assessment) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy phiên kiểm tra này." },
        { status: 404 }
      );
    }

    // IDEMPOTENT: phiên đã completed thì trả done ngay, KHÔNG tạo thêm
    // Attempt/mastery/XP — chống farm bằng cách submit lặp lại.
    if (assessment.status === "completed") {
      const streak = await getCurrentStreak(userId);
      const activity: CompletionActivity = {
        recorded: false,
        alreadyRecorded: true,
        xpEarned: 0,
        streak: { current: streak.current, longest: streak.longest },
      };
      return NextResponse.json<ApiResponse<{ done: true; activity: CompletionActivity }>>({
        success: true,
        data: { done: true, activity },
      });
    }

    // Chấm bằng câu hỏi đã cache ở server. Không nhận subject/topic,
    // difficulty hay correctIndex từ client để chống giả mạo kết quả.
    const answered = await submitQuizAnswer({ userId, questionId, selectedIndex, assessmentId });

    const answeredCount = await prisma.attempt.count({ where: { assessmentId, userId } });

    // Đủ số câu -> đóng phiên assessment, ghi nhận hoạt động học MỘT
    // LẦN duy nhất (ngay tại transition sang completed — lần gọi sau
    // rơi vào nhánh idempotent ở trên), rồi báo frontend chuyển sang
    // màn hình kết quả (gọi tiếp /api/assessment/result).
    if (answeredCount >= MAX_QUESTIONS_PER_ASSESSMENT) {
      await prisma.assessment.update({
        where: { id: assessmentId },
        data: { status: "completed", completedAt: new Date() },
      });
      const correctCount = await prisma.attempt.count({ where: { assessmentId, userId, isCorrect: true } });
      const scorePercent = Math.round((correctCount / answeredCount) * 100);
      const activityResult = await recordLearningActivity({
        userId,
        type: "diagnostic_completed",
        difficulty: "medium",
        scorePercent,
        isFirstCompletion: true,
        sourceId: assessmentId,
        sourceType: "diagnostic",
      });
      const activity: CompletionActivity = {
        recorded: true,
        xpEarned: activityResult.xpEarned,
        streak: activityResult.streakUpdated,
      };
      return NextResponse.json<ApiResponse<{ done: true; activity: CompletionActivity }>>({
        success: true,
        data: { done: true, activity },
      });
    }

    // Chưa đủ câu -> sinh câu tiếp theo với độ khó đã điều chỉnh
    const nextDifficulty = pickNextDifficulty(answered.difficulty as Difficulty, answered.isCorrect);
    const nextQuestion = await generateQuizQuestion(userId, answered.subject, answered.topic, nextDifficulty);

    return NextResponse.json<ApiResponse<{ done: false; isCorrect: boolean; nextQuestion: PublicQuestion }>>({
      success: true,
      data: { done: false, isCorrect: answered.isCorrect, nextQuestion: toPublicQuestion(nextQuestion) },
    });
  } catch (err) {
    console.error("[api/assessment/answer] Lỗi:", err);
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
      { success: false, error: "Không thể xử lý câu trả lời, thử lại sau." },
      { status: 500 }
    );
  }
}
