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
import { extractTextFromBuffer, UnsupportedFileTypeError } from "@/lib/documents/extractText";
import type { ApiResponse } from "@/types";

// Khoảng thời gian coi là "double-submit" (double-click, form gửi 2
// lần do mạng chậm rồi user bấm lại...) — CÙNG userId + CÙNG fileName
// + CÙNG kích thước file, tạo trong khoảng này -> coi là 1 request bị
// lặp, trả về document đã tạo trước đó thay vì tạo record mới. Ngoài
// khoảng này, user upload lại đúng file đó vẫn tạo record MỚI bình
// thường (đây là hành vi hợp lệ, không phải bug — theo đúng yêu cầu
// "không tự ý coi mọi lần trùng tên là duplicate").
const DUPLICATE_SUBMIT_WINDOW_MS = 15_000;

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

    // Đọc bytes MỘT LẦN DUY NHẤT — dùng chung cho việc trích xuất text
    // (bên dưới) VÀ lưu lại nguyên vẹn làm "fileData" (phục vụ tải file
    // gốc + retry sau này). Trước đây extractText() tự đọc
    // file.arrayBuffer() bên trong, tách riêng nghĩa là phải đọc 2 lần
    // — không sai về mặt kỹ thuật (File có thể đọc lại nhiều lần) nhưng
    // thừa 1 lượt I/O không cần thiết.
    const buffer = Buffer.from(await file.arrayBuffer());

    // ------------------------------------------------------------
    // GUARD chống duplicate do double-submit — kiểm tra TRƯỚC khi tốn
    // công trích xuất text. Chỉ khớp khi file THẬT SỰ giống hệt (tên +
    // kích thước byte), tránh nhầm 2 file khác nhau vô tình trùng tên.
    // ------------------------------------------------------------
    const recentDuplicate = await prisma.$queryRaw<{ id: string; fileLength: number | null }[]>`
      SELECT "id", octet_length("fileData") AS "fileLength"
      FROM "Document"
      WHERE "userId" = ${userId}
        AND "fileName" = ${file.name}
        AND "uploadedAt" >= ${new Date(Date.now() - DUPLICATE_SUBMIT_WINDOW_MS)}
      ORDER BY "uploadedAt" DESC
      LIMIT 1
    `;
    const dup = recentDuplicate[0];
    if (dup && dup.fileLength === buffer.length) {
      console.log(`[api/documents/upload] Phát hiện double-submit (cùng file trong ${DUPLICATE_SUBMIT_WINDOW_MS}ms) — trả về document đã tạo, không tạo record mới.`);
      return NextResponse.json<ApiResponse<{ documentId: string }>>({
        success: true,
        data: { documentId: dup.id },
      });
    }

    // ------------------------------------------------------------
    // Trích xuất text THẬT ngay tại đây (trước khi tạo Document) —
    // để nếu file không đọc được (định dạng chưa hỗ trợ, hoặc file
    // PDF/DOCX bị hỏng/mã hoá), người dùng nhận lỗi rõ ràng NGAY LẬP
    // TỨC thay vì thấy "upload thành công" rồi vài giây sau tài liệu
    // âm thầm chuyển sang "failed" (như hành vi cũ).
    // ------------------------------------------------------------
    let extractedText: string;
    try {
      extractedText = await extractTextFromBuffer(buffer, fileType);
    } catch (err) {
      if (err instanceof UnsupportedFileTypeError) {
        return NextResponse.json<ApiResponse<never>>({ success: false, error: err.message }, { status: 400 });
      }
      console.error("[api/documents/upload] Lỗi trích xuất nội dung:", err);
      return NextResponse.json<ApiResponse<never>>(
        {
          success: false,
          error: "Không thể đọc nội dung file này — file có thể bị hỏng hoặc mã hoá.",
          ...(process.env.NODE_ENV === "development" && {
            debug: err instanceof Error ? err.message : String(err),
          }),
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
        fileData: buffer,
        mimeType: file.type || guessMimeType(fileType),
      },
    });

    // TODO (production): đẩy job vào queue (vd BullMQ + Redis) thay vì
    // gọi trực tiếp ở đây, để không block request và có thể retry khi lỗi.
    // MVP demo gọi thẳng cho đơn giản, không await để trả response ngay
    // (frontend sẽ tự poll status qua GET /api/documents hoặc websocket
    // nếu cần "real-time" — ngoài phạm vi MVP).
    processDocument(document.id, extractedText).catch((err) =>
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
  if (ext === "txt") return "txt";
  if (ext === "md") return "md";
  if (ext === "pdf") return "pdf";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "pptx" || ext === "ppt") return "pptx";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "image";
  return "unknown";
}

// Fallback khi trình duyệt/client không set `file.type` (vài trường
// hợp upload qua công cụ khác ngoài <input type="file"> chuẩn) — đảm
// bảo route download sau này luôn có Content-Type hợp lý thay vì rỗng.
function guessMimeType(fileType: string): string {
  switch (fileType) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "txt":
      return "text/plain";
    case "md":
      return "text/markdown";
    default:
      return "application/octet-stream";
  }
}