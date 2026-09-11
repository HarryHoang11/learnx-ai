// ================================================================
// GET /api/friends/[id] — hồ sơ công khai của 1 người bạn
// DELETE /api/friends/[id] — hủy lời mời đã gửi / xóa bạn
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getFriendProfile, removeRelation } from "@/services/friendship.service";
import type { ApiResponse } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const profile = await getFriendProfile(userId, id);
    return NextResponse.json<ApiResponse<typeof profile>>({ success: true, data: profile });
  } catch (err) {
    console.error("[api/friends/[id]] Lỗi:", err);
    const message = err instanceof Error ? err.message : "Không thể tải hồ sơ bạn bè.";
    const status = message.includes("chưa phải là bạn") || message.includes("Không tìm thấy") ? 404 : 500;
    return NextResponse.json<ApiResponse<never>>({ success: false, error: message }, { status });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const result = await removeRelation(userId, id);
    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error("[api/friends/[id] DELETE] Lỗi:", err);
    const message = err instanceof Error ? err.message : "Không thể xóa, thử lại sau.";
    return NextResponse.json<ApiResponse<never>>({ success: false, error: message }, { status: 409 });
  }
}
