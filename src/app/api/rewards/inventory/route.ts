// ================================================================
// GET /api/rewards/inventory — User's owned rewards
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // OWNED, ACTIVE, USED, EXPIRED

    const userRewards = await prisma.userReward.findMany({
      where: {
        userId,
        ...(status ? { status: status as any } : {}),
      },
      include: { reward: true },
      orderBy: { redeemedAt: 'desc' },
    });

    return NextResponse.json<ApiResponse<typeof userRewards>>({ success: true, data: userRewards });
  } catch (err) {
    console.error("[api/rewards/inventory] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải túi đồ, thử lại sau." },
      { status: 500 }
    );
  }
}