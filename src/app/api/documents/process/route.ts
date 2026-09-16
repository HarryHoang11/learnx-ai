// ================================================================
// POST /api/documents/process
// ================================================================
// Mạch tư duy: route này phục vụ hỏi-đáp RAG trên tài liệu đã "ready"
// (action = "ask") — dùng answerFromDocument() (tìm chunk liên quan)
// thay vì chat chung chung. Retry tài liệu failed KHÔNG nằm ở đây mà
// ở POST /api/documents/[id]/retry (đọc lại fileData đã lưu, xử lý
// lại trên chính record cũ) — nhánh retry 501 cũ đã được gỡ bỏ để
// không còn 2 đường retry mâu thuẫn nhau.
// Không gộp vào /api/ai/chat vì luồng RAG cần thêm bước tìm chunk,
// khác hẳn luồng Socratic hint của AI Tutor.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { answerFromDocument } from "@/services/document.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { documentId, action } = body as { documentId: string; action: "ask"; question?: string };

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

    if (action === "ask") {
      if (!body.question) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Thiếu question." },
          { status: 400 }
        );
      }
      const result = await answerFromDocument(documentId, body.question);
      return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
    }

    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "action phải là 'ask'." },
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
