// ================================================================
// POST /api/documents/upload
// ================================================================
// Mạch tư duy: tách UPLOAD (lưu file + tạo record "processing") ra
// khỏi PROCESS (chunk + embedding + tóm tắt bằng AI) vì 2 lý do:
//   1) Upload cần phản hồi NGAY để UI không bị treo chờ, trong khi
//      chunk+embed+tóm tắt có thể mất vài giây tới vài chục giây với
//      tài liệu dài — nên xử lý bất đồng bộ (fire-and-forget) hoặc
//      qua queue thật sự khi lên production.
//   2) Nếu bước xử lý AI lỗi, record Document vẫn tồn tại với status
//      "failed" để retry, thay vì mất luôn cả thông tin file đã upload.
// MVP demo: gọi luôn process() ngay sau khi lưu file (KHÔNG dùng
// queue thật như BullMQ) để đơn giản — ghi rõ TODO bên dưới cho việc
// nâng cấp sau này.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { processDocument } from "@/services/document.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu file trong form-data (key 'file')." },
        { status: 400 }
      );
    }

    const fileType = inferFileType(file.name);

    // ------------------------------------------------------------
    // GIỚI HẠN QUAN TRỌNG (MVP): chỉ thật sự trích xuất được nội dung
    // từ file TEXT THUẦN (.txt, .md). PDF/DOCX/PPTX là định dạng NHỊ
    // PHÂN (binary) — gọi file.text() trên chúng đọc sai byte thành ký
    // tự rác (kể cả byte 0x00 null mà Postgres tuyệt đối không cho
    // phép trong cột text), gây crash ở bước lưu DocumentChunk. Parse
    // PDF/DOCX thật cần thư viện riêng (pdf-parse, mammoth...) — CHƯA
    // được cài trong project này, nên chặn sớm ở đây với thông báo rõ
    // ràng, thay vì để tài liệu "tưởng như thành công" rồi âm thầm lỗi
    // ở bước xử lý nền (như log bạn đang thấy).
    // TODO (nâng cấp sau): cài `pdf-parse` cho PDF, `mammoth` cho DOCX,
    // trích xuất text thật rồi bỏ giới hạn này.
    if (fileType !== "unknown" && fileType !== "image" && !file.name.match(/\.(txt|md)$/i)) {
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: `Hiện chỉ hỗ trợ tóm tắt file .txt hoặc .md. Định dạng "${fileType}" chưa được hỗ trợ trích xuất nội dung.`,
        },
        { status: 400 }
      );
    }

    const document = await prisma.document.create({
      data: {
        userId,
        fileName: file.name,
        fileType,
        status: "processing",
      },
    });

    // TODO (production): đẩy job vào queue (vd BullMQ + Redis) thay vì
    // gọi trực tiếp ở đây, để không block request và có thể retry khi lỗi.
    // MVP demo gọi thẳng cho đơn giản, không await để trả response ngay
    // (frontend sẽ tự poll status qua GET /api/documents hoặc websocket
    // nếu cần "real-time" — ngoài phạm vi MVP).
    const fileText = await file.text(); // MVP: giả định file là text-extractable
    processDocument(document.id, fileText).catch((err) =>
      console.error(`[documents/upload] Xử lý document ${document.id} thất bại:`, err)
    );

    return NextResponse.json<ApiResponse<{ documentId: string }>>({
      success: true,
      data: { documentId: document.id },
    });
  } catch (err) {
    console.error("[api/documents/upload] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể upload tài liệu, thử lại sau." },
      { status: 500 }
    );
  }
}

function inferFileType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "pptx" || ext === "ppt") return "pptx";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "image";
  return "unknown";
}