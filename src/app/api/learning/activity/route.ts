// ================================================================
// POST /api/learning/activity — intentionally not client-callable
// ================================================================
// XP/LXP may only be awarded after a server-side domain action has
// been verified (exercise submission, review, calendar completion,
// etc.). Those services call recordLearningActivity() directly. A
// generic public endpoint would let any signed-in user forge an event
// and farm points.
// ================================================================

import { NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import type { ApiResponse } from "@/types";

export async function POST() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Hoạt động học chỉ được ghi nhận sau khi hoàn thành hành động tương ứng." },
      { status: 403 }
    );
  } catch (err) {
    console.error("[api/learning/activity] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể ghi nhận hoạt động học tập, thử lại sau." },
      { status: 500 }
    );
  }
}
