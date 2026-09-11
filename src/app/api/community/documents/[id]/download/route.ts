// ================================================================
// POST /api/community/documents/[id]/download — Track download
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { trackDownload } from "@/services/community-document.service";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;

    // Track download
    await trackDownload(userId, id);

    // Get document file data
    const document = await prisma.communityDocument.findUnique({
      where: { id },
      select: { fileData: true, fileName: true, mimeType: true, ownerId: true, visibility: true, status: true },
    });

    if (!document) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy tài liệu" },
        { status: 404 }
      );
    }

    // Check access
    if (document.visibility !== "COMMUNITY" && document.ownerId !== userId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không có quyền tải tài liệu này" },
        { status: 403 }
      );
    }

    if (document.status !== "READY" || !document.fileData) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Tài liệu chưa sẵn sàng để tải" },
        { status: 400 }
      );
    }

    const encodedName = encodeURIComponent(document.fileName);

    return new NextResponse(new Uint8Array(document.fileData), {
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[api/community/documents/[id]/download] POST error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải tài liệu" },
      { status: 500 }
    );
  }
}