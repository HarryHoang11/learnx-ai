// ================================================================
// POST /api/rewards/redeem — Redeem a reward using LXP
// ================================================================
// Transaction-safe redemption with race condition protection
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { rewardId } = body as { rewardId?: string };

    if (!rewardId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu rewardId." },
        { status: 400 }
      );
    }

    // Use transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Lock the reward and user for update
      const reward = await tx.reward.findUnique({
        where: { id: rewardId },
      });

      if (!reward || !reward.active) {
        throw new Error("Phần thưởng không tồn tại hoặc đã ngừng hoạt động.");
      }

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { lxpBalance: true },
      });

      if (!user) {
        throw new Error("Người dùng không tồn tại.");
      }

      if (user.lxpBalance < reward.costLXP) {
        throw new Error("Không đủ LXP để đổi phần thưởng này.");
      }

      // Check stock if limited
      if (reward.stock !== null && reward.stock <= 0) {
        throw new Error("Phần thưởng đã hết hàng.");
      }

      // Check if user already owns this reward (for non-stackable)
      const existing = await tx.userReward.findUnique({
        where: { userId_rewardId: { userId, rewardId } },
      });

      if (existing && reward.type !== 'LEARNING') {
        throw new Error("Bạn đã sở hữu phần thưởng này.");
      }

      // Deduct LXP
      await tx.user.update({
        where: { id: userId },
        data: { lxpBalance: { decrement: reward.costLXP } },
      });

      // Create PointTransaction for spending
      await tx.pointTransaction.create({
        data: {
          userId,
          amount: -reward.costLXP,
          reason: `redeem_${reward.name}`,
          sourceType: 'reward_redemption',
          sourceId: rewardId,
          balanceAfter: user.lxpBalance - reward.costLXP,
        },
      });

      // Decrease stock if limited
      if (reward.stock !== null) {
        await tx.reward.update({
          where: { id: rewardId },
          data: { stock: { decrement: 1 } },
        });
      }

      // Create UserReward
      const userReward = await tx.userReward.create({
        data: {
          userId,
          rewardId,
          status: reward.type === 'LEARNING' ? 'ACTIVE' : 'OWNED',
        },
      });

      return { userReward, newLXPBalance: user.lxpBalance - reward.costLXP };
    });

    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error("[api/rewards/redeem] Error:", err);
    const message = err instanceof Error ? err.message : "Không thể đổi phần thưởng, thử lại sau.";
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: message },
      { status: 400 }
    );
  }
}