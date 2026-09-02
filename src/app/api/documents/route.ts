// ================================================================
// GET /api/documents
// ================================================================
// Mạch tư duy: route này được thêm để phục vụ trang Thư viện — trước
// đó backend chỉ có POST /api/documents/upload (tạo mới) và POST
// /api/documents/process (xử lý), CHƯA có cách nào để FRONTEND biết
// user đã upload những gì. Tách thành route riêng (không gộp vào
// /upload) vì đây là 1 việc khác hẳn: đọc danh sách, không ghi gì.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse } from "@/types";

interface DocumentSummary {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  summary: string | null;
  uploadedAt: string;
}

// Shape THẬT của 1 row trả về từ prisma.document.findMany() bên dưới
// — khai báo tường minh ở đây (thay vì để TS tự suy luận từ Prisma
// Client) vì Prisma Client trong sandbox phát triển hiện tại chưa
// được `generate` lại theo schema mới nhất, nên kiểu trả về có thể
// không chính xác. Khai báo type tay đảm bảo compile-time an toàn
// độc lập với trạng thái generate của Prisma Client.
interface DocumentRow {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  summary: string | null;
  uploadedAt: Date;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const docs: DocumentRow[] = await prisma.document.findMany({
      where: { userId },
      orderBy: { uploadedAt: "desc" },
    });

    const data: DocumentSummary[] = docs.map((d: DocumentRow) => ({
      id: d.id,
      fileName: d.fileName,
      fileType: d.fileType,
      status: d.status,
      summary: d.summary,
      uploadedAt: d.uploadedAt.toISOString(),
    }));

    return NextResponse.json<ApiResponse<DocumentSummary[]>>({ success: true, data });
  } catch (err) {
    console.error("[api/documents] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy danh sách tài liệu, thử lại sau." },
      { status: 500 }
    );
  }
}
