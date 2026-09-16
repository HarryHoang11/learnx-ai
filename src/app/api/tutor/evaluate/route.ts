// ================================================================
// POST /api/tutor/evaluate — Evaluate user answer
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { AIOverloadedError } from "@/lib/ai/router";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { evaluateUserAnswer } from "@/services/socratic-tutor.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { sessionId, question, userAnswer, expectedConcepts } = body as {
      sessionId: string;
      question: string;
      userAnswer: string;
      expectedConcepts?: string[];
    };

    if (!sessionId || !question || !userAnswer) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu sessionId, question hoặc userAnswer." },
        { status: 400 }
      );
    }

    const result = await evaluateUserAnswer({
      userId,
      sessionId,
      question,
      userAnswer,
      expectedConcepts,
    });

    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error("[api/tutor/evaluate] Error:", err);
    if (err instanceof AIOverloadedError) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: err.message }, { status: 503 });
    }
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể đánh giá câu trả lời, thử lại sau." },
      { status: 500 }
    );
  }
}