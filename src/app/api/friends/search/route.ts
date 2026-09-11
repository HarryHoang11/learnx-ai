// ================================================================
// GET /api/friends/search?q= — tìm user khác để kết bạn
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { searchUsers } from "@/services/friendship.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    if (q.trim().length < 2) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Từ khóa tìm kiếm phải có ít nhất 2 ký tự." },
        { status: 400 }
      );
    }

    const users = await searchUsers(userId, q);
    return NextResponse.json<ApiResponse<typeof users>>({ success: true, data: users });
  } catch (err) {
    console.error("[api/friends/search] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tìm kiếm, thử lại sau." },
      { status: 500 }
    );
  }
}
