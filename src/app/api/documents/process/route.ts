// ================================================================
// POST /api/documents/process
// ================================================================
// Mạch tư duy: route này phục vụ 2 mục đích, phân biệt qua body.action:
//   - action = "retry": tài liệu bị status "failed" (lỗi lúc upload),
//     học sinh bấm nút "Xử lý lại" -> gọi lại processDocument().
//   - action = "ask": học sinh hỏi 1 câu hỏi CỤ THỂ dựa trên tài liệu
//     đã "ready" -> dùng answerFromDocument() (RAG thật sự, có tìm
//     kiếm chunk liên quan) thay vì chat chung chung.
// Không gộp vào /api/ai/chat vì luồng RAG cần thêm bước tìm chunk,
// khác hẳn luồng Socratic hint của AI Tutor.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { answerFromDocument, processDocument } from "@/services/document.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { documentId, action } = body as { documentId: string; action: "retry" | "ask"; question?: string };

    if (!documentId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu documentId." },
        { status: 400 }
      );
    }

    // where PHẢI gồm cả userId — nếu chỉ lọc theo id, user A gửi
    // documentId của user B vẫn đọc/hỏi được nội dung tài liệu của B.
    const document = await prisma.document.findFirst({ where: { id: documentId, userId } });
    if (!document) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy tài liệu." },
        { status: 404 }
      );
    }

    if (action === "retry") {
      // Lưu ý: retry cần rawText gốc — MVP này CHƯA lưu rawText đầy đủ
      // vào DB (chỉ lưu chunk đã xử lý), nên retry thật sự cần thiết kế
      // thêm 1 cột "rawText" hoặc lưu file gốc trong storage để đọc lại.
      // Đây là điểm cần hoàn thiện khi chuyển từ demo sang production.
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Retry cần rawText gốc — xem TODO trong code để hoàn thiện." },
        { status: 501 }
      );
    }

    if (action === "ask") {
      if (!body.question) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Thiếu question." },
          { status: 400 }
        );
      }
      const answer = await answerFromDocument(documentId, body.question);
      return NextResponse.json<ApiResponse<{ answer: string }>>({ success: true, data: { answer } });
    }

    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "action phải là 'retry' hoặc 'ask'." },
      { status: 400 }
    );
  } catch (err) {
    console.error("[api/documents/process] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể xử lý yêu cầu, thử lại sau." },
      { status: 500 }
    );
  }
}

// Import processDocument dù chưa dùng trực tiếp trong action "retry" ở
// trên (để dành khi bạn nối thêm cột rawText) — giữ import tường minh
// thay vì xoá đi rồi phải nhớ thêm lại.
void processDocument;
