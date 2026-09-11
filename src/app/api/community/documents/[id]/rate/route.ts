// ================================================================
// POST /api/community/documents/[id]/rate — Rate a document
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { rateDocument } from "@/services/community-document.service";
import type { ApiResponse } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;

    const body = await req.json();
    const { rating, review } = body as { rating: number; review?: string };

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Đánh giá phải từ 1 đến 5 sao" },
        { status: 400 }
      );
    }

    const result = await rateDocument(userId, id, rating, review);

    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error("[api/community/documents/[id]/rate] POST error:", err);
    const message = err instanceof Error ? err.message : "Không thể đánh giá tài liệu";
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}