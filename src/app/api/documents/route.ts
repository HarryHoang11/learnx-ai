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
  errorMessage: string | null;
  hasOriginalFile: boolean;
  subject: string | null;
  topic: string | null;
  difficulty: string | null;
  description: string | null;
  uploadedAt: string;
  updatedAt: string;
}

// Shape THẬT của 1 row trả về từ query raw bên dưới. Dùng $queryRaw
// (thay vì prisma.document.findMany với select fileData: true) để
// kiểm tra "fileData IS NOT NULL" NGAY Ở TẦNG DATABASE — nếu select
// nguyên cột fileData rồi check ở JS, Postgres/Prisma vẫn phải tải
// TOÀN BỘ bytes file (có thể vài MB mỗi file) về Node chỉ để lấy 1
// boolean, làm chậm hẳn danh sách khi có nhiều tài liệu lớn. Cùng
// triết lý với lib/embeddings/vector.ts (đã dùng raw SQL cho việc
// Prisma Client không tối ưu/không hỗ trợ trực tiếp).
interface DocumentRow {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  summary: string | null;
  errorMessage: string | null;
  hasOriginalFile: boolean;
  subject: string | null;
  topic: string | null;
  difficulty: string | null;
  description: string | null;
  uploadedAt: Date;
  updatedAt: Date;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const docs = await prisma.$queryRaw<DocumentRow[]>`
      SELECT
        "id", "fileName", "fileType", "status", "summary", "errorMessage",
        ("fileData" IS NOT NULL) AS "hasOriginalFile",
        "subject", "topic", "difficulty", "description",
        "uploadedAt", "updatedAt"
      FROM "Document"
      WHERE "userId" = ${userId}
      ORDER BY "uploadedAt" DESC
    `;

    const data: DocumentSummary[] = docs.map((d: DocumentRow) => ({
      id: d.id,
      fileName: d.fileName,
      fileType: d.fileType,
      status: d.status,
      summary: d.summary,
      errorMessage: d.status === "failed" ? d.errorMessage : null,
      hasOriginalFile: d.hasOriginalFile,
      subject: d.subject,
      topic: d.topic,
      difficulty: d.difficulty,
      description: d.description,
      uploadedAt: d.uploadedAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
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
