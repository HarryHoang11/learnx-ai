// ================================================================
// POST /api/friends/respond { friendshipId, action: accept|reject }
// Chỉ addressee của lời mời PENDING mới được chấp nhận/từ chối.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { respondToRequest } from "@/services/friendship.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const friendshipId = body.friendshipId as string | undefined;
    const action = body.action as string | undefined;
    if (!friendshipId || (action !== "accept" && action !== "reject")) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu friendshipId hoặc action phải là accept|reject." },
        { status: 400 }
      );
    }

    const rel = await respondToRequest(userId, friendshipId, action);
    return NextResponse.json<ApiResponse<typeof rel>>({ success: true, data: rel });
  } catch (err) {
    console.error("[api/friends/respond] Lỗi:", err);
    const message = err instanceof Error ? err.message : "Không thể xử lý lời mời, thử lại sau.";
    return NextResponse.json<ApiResponse<never>>({ success: false, error: message }, { status: 409 });
  }
}
