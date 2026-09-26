// ================================================================
// POST /api/assessment/start
// ================================================================
// Mạch tư duy: route này chỉ tạo 1 bản ghi Assessment mới (status =
// in_progress) và sinh CÂU HỎI ĐẦU TIÊN ở độ khó "easy" — đúng như
// sơ đồ "AI Diagnostic Test" trong bản kế hoạch gốc (luôn bắt đầu dễ
// rồi mới thích ứng dần). Việc sinh câu hỏi tiếp theo (dựa đúng/sai)
// thuộc về /api/assessment/answer, KHÔNG lặp lại ở đây.
//
// THỨ TỰ CỐ Ý: sinh câu hỏi TRƯỚC, tạo Assessment SAU. Nếu AI fail
// (503/quota) thì không tạo ra dòng rác status=in_progress không bao
// giờ được dùng. Đổi thứ tự này sẽ làm mỗi lần AI chết lại đẻ thêm
// 1 phiên mồ côi.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generateQuizQuestion, QuizQuestionError, toPublicQuestion } from "@/services/quiz.service";
import { AIOverloadedError } from "@/lib/ai/router";
import type { ApiResponse, PublicQuestion } from "@/types";

/**
 * Cửa sổ "coi như chưa từng bấm" — chống tạo trùng Assessment ở TẦNG SERVER.
 *
 * Client đã chặn double-click bằng ref (xem start() ở (app)/diagnostic/page.tsx),
 * nhưng ref chỉ bảo vệ 1 tab. Vẫn còn 2 đường tạo phiên trùng KHÔNG qua guard UI:
 *   1) user bấm lại trong vài giây (mất mạng rồi bấm "Thử lại");
 *   2) request đầu vẫn đang chờ AI, client đã hết patience và abort
 *      -> server vẫn tạo Assessment, user không biết và thử lại -> 2 phiên.
 *
 * Vì vậy: nếu đã có Assessment status=in_progress, cùng user + cùng môn,
 * vừa tạo trong cửa sổ này VÀ chưa trả lời câu nào -> tái dùng chính phiên
 * đó thay vì tạo phiên mới. Câu hỏi KHÔNG gắn với dòng Assessment (nó nằm
 * ở QuizQuestionCache), nên sinh câu đầu tiên mới rồi trả về vẫn đúng — chỉ
 * là bỏ 1 lần tạo dòng thừa.
 *
 * GIỚI HẠN CỐ Ý: cửa sổ ngắn + điều kiện "chưa có Attempt". Sau khi đã
 * trả lời câu nào, bấm lại là người dùng CHỦ ĐỘNG làm lại bài -> vẫn tạo
 * phiên mới đúng như mong muốn, không bị nuốt.
 */
const DEDUPE_WINDOW_MS = 2 * 60 * 1000;

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

    const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
    const recentOpen = await prisma.assessment.findFirst({
      where: {
        userId,
        status: "in_progress",
        startedAt: { gte: since },
        subject: { equals: subject, mode: "insensitive" },
        // attempts: { none: {} } -> chỉ khử trùng phiên CHƯA dùng.
        // Đã làm vài câu rồi thì bấm lại = làm bài mới, không phải trùng.
        attempts: { none: {} },
      },
      orderBy: { startedAt: "desc" },
      select: { id: true },
    });

    const assessmentId = recentOpen?.id ?? (
      await prisma.assessment.create({
        data: { userId, subject, status: "in_progress" },
        select: { id: true },
      })
    ).id;

    if (recentOpen) {
      console.log(
        `[api/assessment/start] Tái dùng phiên in_progress ${assessmentId} (môn "${subject}") ` +
        "thay vì tạo phiên trùng."
      );
    }

    return NextResponse.json<ApiResponse<{ assessmentId: string; question: PublicQuestion }>>({
      success: true,
      data: { assessmentId, question: toPublicQuestion(firstQuestion) },
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
