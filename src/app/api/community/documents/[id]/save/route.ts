// ================================================================
// POST /api/community/documents/[id]/save — Save/unsave document
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { toggleSaveDocument } from "@/services/community-document.service";
import type { ApiResponse } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const result = await toggleSaveDocument(userId, id);

    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error("[api/community/documents/[id]/save] POST error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lưu/bỏ lưu tài liệu" },
      { status: 500 }
    );
  }
}