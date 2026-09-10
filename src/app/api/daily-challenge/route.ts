// ================================================================
// GET /api/daily-challenge — Today's daily challenge
// ================================================================

import { NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { generateDailyChallenge, getDailyChallenge } from "@/services/calendar.service";
import type { ApiResponse } from "@/types";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    // First try to get existing challenge
    let challenge = await getDailyChallenge(userId);
    
    // If none exists, generate one
    if (!challenge) {
      challenge = await generateDailyChallenge(userId);
    }

    return NextResponse.json<ApiResponse<typeof challenge>>({ success: true, data: challenge });
  } catch (err) {
    console.error("[api/daily-challenge] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy thử thách hàng ngày, thử lại sau." },
      { status: 500 }
    );
  }
}