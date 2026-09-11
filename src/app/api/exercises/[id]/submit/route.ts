// ================================================================
// POST /api/exercises/[id]/submit { answer } — nộp bài, chấm, +XP
// XP chỉ cộng 1 lần duy nhất cho lần đúng đầu tiên.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { submitExerciseAttempt } from "@/services/exercise.service";
import type { ApiResponse } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();
    const answer = body.answer as string | undefined;
    if (!answer || !answer.trim()) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Câu trả lời trống." },
        { status: 400 }
      );
    }

    const result = await submitExerciseAttempt(userId, id, answer);
    if (!result.success) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json<ApiResponse<typeof result.data>>({ success: true, data: result.data });
  } catch (err) {
    console.error("[api/exercises/[id]/submit] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể nộp bài, thử lại sau." },
      { status: 500 }
    );
  }
}
