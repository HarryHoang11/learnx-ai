// ================================================================
// POST /api/rewards/equip  — Trang bị 1 cosmetic lên hồ sơ
// PUT  /api/rewards/equip  — Bỏ trang bị (thân vẫn thuộc sở hữu)
// ================================================================
// Vì sao có 2 method trong 1 file: cùng một resource (món đồ đang mặc), khác
// nhau ở ý nghĩa — POST = mặc, PUT = bỏ mặc. Gộp giúp UI chỉ cần nhớ 1 URL.
//
// BẢO MẬT (spec §15): client chỉ gửi `rewardId`. Mọi thứ khác — quyền sở hữu,
// loại cosmetic có trang bị được không — server tự tra DB. Không tin bất kỳ
// cờ nào do client gửi lên.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { equipCosmetic, unequipCosmetic } from "@/services/reward-cosmetic.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = (await req.json()) as { rewardId?: string };
    if (!body.rewardId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu rewardId." },
        { status: 400 }
      );
    }

    const result = await equipCosmetic(userId, body.rewardId);
    if (!result.ok) {
      // 403 vì lý do là "không đủ quyền", không phải request sai cú pháp —
      // giúp client biết đâu là disable nút, đâu là lỗi cần báo.
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: result.message },
        { status: 403 }
      );
    }

    return NextResponse.json<ApiResponse<{ rewardId: string }>>({
      success: true,
      data: { rewardId: result.rewardId },
    });
  } catch (err) {
    console.error("[api/rewards/equip] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể trang bị, thử lại sau." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = (await req.json()) as { rewardId?: string };
    if (!body.rewardId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu rewardId." },
        { status: 400 }
      );
    }

    const result = await unequipCosmetic(userId, body.rewardId);
    if (!result.ok) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: result.message },
        { status: 403 }
      );
    }

    return NextResponse.json<ApiResponse<{ rewardId: string }>>({
      success: true,
      data: { rewardId: result.rewardId },
    });
  } catch (err) {
    console.error("[api/rewards/equip] PUT Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể bỏ trang bị, thử lại sau." },
      { status: 500 }
    );
  }
}