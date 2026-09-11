// ================================================================
// POST /api/resources/[id]/rate { rating, review? } — 1 user 1 rating
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { rateResource } from "@/services/resource.service";
import type { ApiResponse } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();
    const result = await rateResource(userId, id, body.rating as number, body.review as string | undefined);
    if (!result.success) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json<ApiResponse<typeof result.data>>({ success: true, data: result.data });
  } catch (err) {
    console.error("[api/resources/[id]/rate] error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể đánh giá, thử lại sau." },
      { status: 500 }
    );
  }
}
