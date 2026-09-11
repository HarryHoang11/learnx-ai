// ================================================================
// POST /api/friends/request { addresseeId } — gửi lời mời kết bạn
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { sendFriendRequest } from "@/services/friendship.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const addresseeId = body.addresseeId as string | undefined;
    if (!addresseeId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu addresseeId." },
        { status: 400 }
      );
    }

    const rel = await sendFriendRequest(userId, addresseeId);
    return NextResponse.json<ApiResponse<typeof rel>>({ success: true, data: rel });
  } catch (err) {
    console.error("[api/friends/request] Lỗi:", err);
    const message = err instanceof Error ? err.message : "Không thể gửi lời mời, thử lại sau.";
    const status = message.includes("chính mình") || message.includes("Không tìm thấy") ? 400 : 409;
    return NextResponse.json<ApiResponse<never>>({ success: false, error: message }, { status });
  }
}
