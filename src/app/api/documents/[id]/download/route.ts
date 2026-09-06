// ================================================================
// GET /api/documents/[id]/download — tải FILE GỐC (bytes thật)
// ================================================================
// Mạch tư duy: cùng pattern với api/profile/photo/[type]/route.ts đã
// có sẵn trong project (đọc thẳng cột Bytes từ Postgres, KHÔNG đọc từ
// disk/S3) — áp dụng lại chính pattern đó cho Document.fileData thay
// vì phát minh cách lưu trữ mới.
//
// "Content-Disposition: attachment" (khác route photo dùng để HIỂN
// THỊ ảnh trực tiếp) vì đây là tải file gốc (PDF/DOCX/PPTX) — người
// dùng bấm "Tải tài liệu gốc" phải ra hộp thoại Save As, không phải
// mở file ngay trong tab trình duyệt.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorizedResponse();

  const doc = await prisma.document.findUnique({
    where: { id: params.id },
    select: { userId: true, fileName: true, fileData: true, mimeType: true },
  });

  if (!doc || doc.userId !== userId) {
    return NextResponse.json({ success: false, error: "Không tìm thấy tài liệu." }, { status: 404 });
  }

  if (!doc.fileData) {
    // Document được tạo TRƯỚC khi tính năng lưu file gốc tồn tại (dữ
    // liệu cũ) — không có gì để tải, báo rõ thay vì trả file rỗng.
    return NextResponse.json(
      { success: false, error: "Tài liệu này không có bản gốc để tải (có thể được upload trước khi tính năng này ra mắt)." },
      { status: 404 }
    );
  }

  // encodeURIComponent cho filename* (RFC 5987) — đảm bảo tên file có
  // dấu tiếng Việt không bị lỗi/mất dấu khi trình duyệt lưu file.
  const encodedName = encodeURIComponent(doc.fileName);

  return new NextResponse(doc.fileData, {
    headers: {
      "Content-Type": doc.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
