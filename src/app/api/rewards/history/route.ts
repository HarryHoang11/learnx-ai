// ================================================================
// GET /api/rewards/history — Reward redemption history
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const type = searchParams.get('type');

    const where: any = { userId };
    
    if (type === 'EARNED') {
      where.amount = { gt: 0 };
      where.sourceType = { not: 'reward_redemption' };
    } else if (type === 'SPENT') {
      where.amount = { lt: 0 };
    } else if (type === 'REDEEMED') {
      where.sourceType = 'reward_redemption';
    }

    const [transactions, total] = await Promise.all([
      prisma.pointTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.pointTransaction.count({ where }),
    ]);

    const enriched = await Promise.all(transactions.map(async (tx) => {
      if (tx.sourceType === 'reward_redemption' && tx.sourceId) {
        const reward = await prisma.reward.findUnique({
          where: { id: tx.sourceId },
          select: { name: true, icon: true, type: true, rarity: true },
        });
        return { ...tx, reward };
      }
      return tx;
    }));

    return NextResponse.json<ApiResponse<{ transactions: typeof enriched; total: number; page: number; limit: number }>>({
      success: true,
      data: { transactions: enriched, total, page, limit },
    });
  } catch (err) {
    console.error("[api/rewards/history] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải lịch sử phần thưởng, thử lại sau." },
      { status: 500 }
    );
  }
}