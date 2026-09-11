// ================================================================
// POST /api/community/documents/[id]/report — Report a document
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { reportDocument } from "@/services/community-document.service";
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
    const { reason, description } = body as { reason: string; description?: string };

    const validReasons = [
      "WRONG_INFO", "SPAM", "DUPLICATE", "MISLEADING",
      "INAPPROPRIATE", "COPYRIGHT", "WRONG_SUBJECT", "OTHER"
    ];

    if (!reason || !validReasons.includes(reason)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Lý do báo cáo không hợp lệ" },
        { status: 400 }
      );
    }

    const result = await reportDocument(userId, id, reason, description);

    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error("[api/community/documents/[id]/report] POST error:", err);
    const message = err instanceof Error ? err.message : "Không thể báo cáo tài liệu";
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: message },
      { status: 500 }
    );
  }
}