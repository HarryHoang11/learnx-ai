// ================================================================
// POST /api/documents/[id]/retry — thử xử lý lại document đã FAILED
// ================================================================
// Mạch tư duy: trước đây khi processDocument() fail, document bị kẹt
// vĩnh viễn ở "failed" — user chỉ còn cách upload lại từ đầu (tạo
// thêm 1 record mới, tên file trùng tên cũ, dễ gây hiểu nhầm là bug
// duplicate). Route này đọc lại "fileData" ĐÃ LƯU SẴN từ lần upload
// gốc (xem api/documents/upload/route.ts) để xử lý lại TRÊN CHÍNH
// record cũ — không tạo record mới, không bắt user chọn lại file.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { processDocument } from "@/services/document.service";
import {
  extractTextFromBuffer,
  type ExtractionResult,
} from "@/lib/documents/extractText";
import { DocumentProcessingError, logDocumentError } from "@/lib/documents/docErrors";
import type { ApiResponse } from "@/types";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const doc = await prisma.document.findUnique({
      where: { id },
      select: { userId: true, status: true, fileType: true, fileData: true },
    });

    if (!doc || doc.userId !== userId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy tài liệu." },
        { status: 404 }
      );
    }

    if (doc.status !== "failed") {
      // Chỉ cho retry document THẬT SỰ đang failed — tránh xử lý lại
      // lãng phí (gọi AI tốn phí) 1 document đang "processing" hoặc
      // đã "ready" chỉ vì user bấm nhầm/spam click.
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Chỉ có thể thử lại tài liệu đang ở trạng thái lỗi." },
        { status: 400 }
      );
    }

    if (!doc.fileData) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Không tìm thấy file gốc để thử lại (tài liệu upload trước khi tính năng này ra mắt) — vui lòng upload lại.",
        },
        { status: 400 }
      );
    }

    // Trích xuất lại text NGAY tại đây (giống upload/route.ts) để nếu
    // file gốc thật sự hỏng (không phải lỗi tạm thời của AI provider
    // lần trước), báo lỗi CÓ CODE rõ ràng ngay thay vì lại rơi vào
    // "processing" rồi "failed" lần nữa sau vài giây.
    let extraction: ExtractionResult;
    try {
      extraction = await extractTextFromBuffer(doc.fileData, doc.fileType);
    } catch (err) {
      logDocumentError(id, "TEXT_EXTRACTION", err);
      const message =
        err instanceof DocumentProcessingError
          ? `${err.userMessage} ${err.suggestion}`
          : "Không thể đọc lại nội dung file gốc — file có thể bị hỏng.";
      const status = err instanceof DocumentProcessingError ? err.httpStatus : 400;
      await prisma.document.update({ where: { id }, data: { status: "failed", errorMessage: err instanceof Error ? err.message : message } });
      return NextResponse.json<ApiResponse<never>>({ success: false, error: message }, { status });
    }

    if (extraction.text.trim() === "") {
      const coded = new DocumentProcessingError("DOCUMENT_EMPTY", "TEXT_EXTRACTION");
      await prisma.document.update({ where: { id }, data: { status: "failed", errorMessage: coded.message } });
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `${coded.userMessage} ${coded.suggestion}` },
        { status: coded.httpStatus }
      );
    }

    await prisma.document.update({
      where: { id },
      data: { status: "processing", errorMessage: null },
    });

    // Fire-and-forget giống hệt luồng upload — frontend quay lại polling
    // GET /api/documents để thấy status chuyển "processing" -> "ready"/"failed".
    processDocument(id, extraction).catch((err) =>
      console.error(`[documents/retry] Xử lý lại document ${id} thất bại:`, err)
    );

    return NextResponse.json<ApiResponse<{ documentId: string }>>({
      success: true,
      data: { documentId: id },
    });
  } catch (err) {
    console.error("[api/documents/:id/retry] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể thử lại, vui lòng thử lại sau." },
      { status: 500 }
    );
  }
}
