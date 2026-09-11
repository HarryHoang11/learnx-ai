// ================================================================
// GET /api/community/documents/[id] — Get document detail
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getCommunityDocument } from "@/services/community-document.service";
import type { ApiResponse } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const result = await getCommunityDocument(id, userId);

    if (!result.success) {
      const status = result.error.includes("Không tìm thấy")
        ? 404
        : result.error.includes("quyền")
          ? 403
          : 500;
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: result.error },
        { status }
      );
    }

    return NextResponse.json<ApiResponse<typeof result.data>>({ success: true, data: result.data });
  } catch (err) {
    console.error("[api/community/documents/[id]] GET error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải tài liệu" },
      { status: 500 }
    );
  }
}