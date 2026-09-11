// ================================================================
// GET /api/roadmaps/[id]/recommendations?topic= — gợi ý học theo
// skill profile THẬT + nội dung THẬT trong DB (deterministic,
// không tốn AI call mỗi click).
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { recommendForTopic } from "@/services/roadmap-resource.service";
import type { ApiResponse } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get("topic") || "";
    const result = await recommendForTopic(userId, id, topic);
    if (!result.success) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json<ApiResponse<typeof result.data>>({ success: true, data: result.data });
  } catch (err) {
    console.error("[api/roadmaps/[id]/recommendations] GET error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo gợi ý" },
      { status: 500 }
    );
  }
}
