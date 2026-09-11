// ================================================================
// POST /api/resources/[id]/use — ghi nhận 1 lượt mở/sử dụng
// (không cộng XP — chỉ phục vụ sort popularity + quality).
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { trackResourceUsage } from "@/services/resource.service";
import type { ApiResponse } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const result = await trackResourceUsage(userId, id);
    if (!result.success) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: result.error }, { status: 404 });
    }
    return NextResponse.json<ApiResponse<typeof result.data>>({ success: true, data: result.data });
  } catch (err) {
    console.error("[api/resources/[id]/use] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể ghi nhận lượt xem." },
      { status: 500 }
    );
  }
}
