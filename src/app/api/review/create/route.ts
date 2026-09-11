// ================================================================
// POST /api/review/create — Create review item
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { createReviewItem, createReviewFromMistake } from "@/services/spaced-repetition.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { 
      topic, 
      concept, 
      subject, 
      sourceType, 
      sourceId, 
      prompt, 
      answer, 
      metadata,
      // For mistake-based review
      question,
      userAnswer,
      correctAnswer,
      explanation,
    } = body as any;

    if (!topic || !prompt) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu topic hoặc prompt." },
        { status: 400 }
      );
    }

    // Check if this is a mistake-based review
    if (question && userAnswer && correctAnswer && explanation) {
      const reviewItem = await createReviewFromMistake({
        userId,
        topic,
        concept,
        question,
        userAnswer,
        correctAnswer,
        explanation,
        sourceType: sourceType || "quiz",
        sourceId: sourceId || "unknown",
      });
      return NextResponse.json<ApiResponse<typeof reviewItem>>({ success: true, data: reviewItem });
    }

    const reviewItem = await createReviewItem({
      userId,
      topic,
      concept,
      subject,
      sourceType,
      sourceId,
      prompt,
      answer,
      metadata,
    });

    return NextResponse.json<ApiResponse<typeof reviewItem>>({ success: true, data: reviewItem });
  } catch (err) {
    console.error("[api/review/create] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo ôn tập, thử lại sau." },
      { status: 500 }
    );
  }
}