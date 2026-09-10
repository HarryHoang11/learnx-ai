// ================================================================
// POST /api/daily-challenge/claim — Claim daily challenge rewards
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getDailyChallenge } from "@/services/calendar.service";
import { recordLearningActivity } from "@/services/learning-activity.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const challenge = await getDailyChallenge(userId);
    
    if (!challenge) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không có thử thách hàng ngày nào." },
        { status: 404 }
      );
    }

    if (!challenge.completed) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Chưa hoàn thành thử thách này." },
        { status: 400 }
      );
    }

    if (challenge.claimed) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Đã nhận thưởng cho thử thách này." },
        { status: 400 }
      );
    }

    // Mark as claimed and award rewards
    const updated = await prisma.dailyChallenge.update({
      where: { id: challenge.id },
      data: { claimed: true },
    });

    // Award XP and LXP for completing daily challenge
    await recordLearningActivity({
      userId,
      type: 'daily_challenge',
      difficulty: 'medium',
      isFirstCompletion: true,
      sourceId: challenge.id,
      sourceType: 'daily_challenge',
    });

    return NextResponse.json<ApiResponse<typeof updated>>({ success: true, data: updated });
  } catch (err) {
    console.error("[api/daily-challenge/claim] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể nhận thưởng, thử lại sau." },
      { status: 500 }
    );
  }
}