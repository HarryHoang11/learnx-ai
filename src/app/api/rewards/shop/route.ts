// ================================================================
// GET /api/rewards/shop — List all available rewards with user status
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
    const type = searchParams.get('type'); // DIGITAL, LEARNING, REAL_WORLD, MILESTONE

    const rewards = await prisma.reward.findMany({
      where: {
        active: true,
        ...(type ? { type: type as any } : {}),
      },
      orderBy: [{ type: 'asc' }, { costLXP: 'asc' }],
      include: {
        userRewards: {
          where: { userId },
          select: { id: true, status: true, activatedAt: true, expiresAt: true },
        },
      },
    });

    // Get user's LXP balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lxpBalance: true },
    });

    const data = rewards.map(reward => {
      const userReward = reward.userRewards[0];
      return {
        ...reward,
        userStatus: userReward ? userReward.status : 'NOT_OWNED',
        userRewardId: userReward?.id || null,
        canAfford: (user?.lxpBalance || 0) >= reward.costLXP,
        isOwned: !!userReward,
      };
    });

    return NextResponse.json<ApiResponse<typeof data>>({ success: true, data });
  } catch (err) {
    console.error("[api/rewards/shop] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải cửa hàng phần thưởng, thử lại sau." },
      { status: 500 }
    );
  }
}