// ================================================================
// GET /api/documents/[id] — chi tiết 1 document
// ================================================================
// Mạch tư duy: GET /api/documents (danh sách) đã trả summary ĐẦY ĐỦ
// (không cắt ngắn) nên trang Library có thể mở modal chi tiết ngay từ
// dữ liệu đã có trong state, không BẮT BUỘC phải gọi route này mỗi lần
// mở modal. Route này vẫn cần thiết cho:
//   - Trả hasOriginalFile (không trả nguyên fileData ở đây, quá nặng
//     cho 1 response JSON — file gốc phải tải qua route /download
//     riêng, đọc thẳng binary).
//   - Cho phép các trang/tính năng khác sau này (vd link chia sẻ chi
//     tiết 1 document) fetch trực tiếp theo id mà không cần tải cả
//     danh sách.
// KHÔNG trả field "fileData" (Bytes) trong JSON — object khổng lồ,
// không cần thiết khi FE chỉ cần biết CÓ hay KHÔNG để hiện nút tải.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse } from "@/types";

interface DocumentDetail {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  summary: string | null;
  errorMessage: string | null;
  hasOriginalFile: boolean;
  uploadedAt: string;
  updatedAt: string;
}

interface DocumentDetailRow {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  status: string;
  summary: string | null;
  errorMessage: string | null;
  hasOriginalFile: boolean;
  uploadedAt: Date;
  updatedAt: Date;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    // $queryRaw thay vì findUnique + select fileData: true — tránh tải
    // nguyên bytes file gốc (có thể vài MB) chỉ để kiểm tra có/không,
    // xem giải thích chi tiết ở GET /api/documents.
    const rows = await prisma.$queryRaw<DocumentDetailRow[]>`
      SELECT
        "id", "userId", "fileName", "fileType", "status", "summary", "errorMessage",
        ("fileData" IS NOT NULL) AS "hasOriginalFile",
        "uploadedAt", "updatedAt"
      FROM "Document"
      WHERE "id" = ${params.id}
      LIMIT 1
    `;
    const doc = rows[0];

    // So sánh userId thay vì lọc thẳng trong where (Prisma $queryRaw
    // không hỗ trợ generic WHERE builder) — trả 404 chung chung cho cả
    // "không tồn tại" lẫn "không phải chủ sở hữu", KHÔNG để lộ rằng
    // document có tồn tại nhưng thuộc người khác (tránh dò ID document
    // của user khác qua status code khác nhau).
    if (!doc || doc.userId !== userId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy tài liệu." },
        { status: 404 }
      );
    }

    const data: DocumentDetail = {
      id: doc.id,
      fileName: doc.fileName,
      fileType: doc.fileType,
      status: doc.status,
      summary: doc.summary,
      // Chỉ trả errorMessage khi THẬT SỰ failed — tránh lộ chi tiết kỹ
      // thuật không cần thiết ở các trạng thái khác.
      errorMessage: doc.status === "failed" ? doc.errorMessage : null,
      hasOriginalFile: doc.hasOriginalFile,
      uploadedAt: doc.uploadedAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };

    return NextResponse.json<ApiResponse<DocumentDetail>>({ success: true, data });
  } catch (err) {
    console.error("[api/documents/:id] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy chi tiết tài liệu, thử lại sau." },
      { status: 500 }
    );
  }
}
