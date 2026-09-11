// ================================================================
// GET /api/friends — bạn bè + lời mời đến/đi của chính user
// ================================================================

import { NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { listFriends } from "@/services/friendship.service";
import type { ApiResponse } from "@/types";

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const data = await listFriends(userId);
    return NextResponse.json<ApiResponse<typeof data>>({ success: true, data });
  } catch (err) {
    console.error("[api/friends] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải danh sách bạn bè, thử lại sau." },
      { status: 500 }
    );
  }
}
