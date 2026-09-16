// ================================================================
// POST /api/review/submit — Submit review attempt
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { ReviewConflictError, submitReviewAttempt } from "@/services/spaced-repetition.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { reviewItemId, rating, response, timeSpentSec } = body as {
      reviewItemId: string;
      rating: 1 | 2 | 3 | 4;
      response?: string;
      timeSpentSec?: number;
    };

    if (!reviewItemId || !rating) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu reviewItemId hoặc rating." },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 4) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Rating phải từ 1 đến 4." },
        { status: 400 }
      );
    }

    const result = await submitReviewAttempt({
      reviewItemId,
      userId,
      rating,
      response,
      timeSpentSec,
    });

    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error("[api/review/submit] Error:", err);
    if (err instanceof ReviewConflictError) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: err.message }, { status: 409 });
    }
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể gửi ôn tập, thử lại sau." },
      { status: 500 }
    );
  }
}