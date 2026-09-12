// ================================================================
// POST /api/ai/hint
// ================================================================
// Mạch tư duy: tách riêng khỏi /api/ai/chat vì mục đích khác nhau —
// /chat là học sinh GÕ câu hỏi mới, còn /hint là học sinh BẤM NÚT
// (🟢/🟡/🔴) để xin thêm gợi ý cho CÂU ĐANG HỎI, không cần gõ lại.
// Về bản chất vẫn tái sử dụng sendTutorMessage() — chỉ khác ở chỗ
// userMessage được tự sinh sẵn thay vì lấy từ input của học sinh.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { sendTutorMessage } from "@/services/tutor.service";
import { AIOverloadedError } from "@/lib/ai/router";
import type { ApiResponse } from "@/types";

const HINT_LABELS: Record<number, string> = {
  1: "💡 Manh mối khái niệm",
  2: "🔍 Gợi ý mạnh",
  3: "🧩 Suy luận từng phần",
  4: "🎯 Dẫn dắt sát lời giải",
  5: "📖 Giải thích chi tiết",
  6: "📝 Lời giải hoàn chỉnh",
};

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();
    const body = await req.json();
    const hintLevel = Number(body.hintLevel) as 1 | 2 | 3 | 4 | 5 | 6;

    if (![1, 2, 3, 4, 5, 6].includes(hintLevel)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "hintLevel phải từ 1 đến 6." },
        { status: 400 }
      );
    }

    const topic = (body.topic as string) ?? "Chưa xác định";
    const language = body.language === "en" ? ("en" as const) : ("vi" as const);

    // userMessage tự sinh dựa theo nút học sinh vừa bấm, để service
    // tutor.service.ts vẫn lưu lại đúng ngữ cảnh "học sinh đã yêu cầu
    // mức gợi ý nào" trong lịch sử hội thoại.
    const result = await sendTutorMessage({
      userId,
      topic,
      userMessage: `(Học sinh bấm nút: ${HINT_LABELS[hintLevel]})`,
      hintLevel,
      language,
    });

    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error("[api/ai/hint] Lỗi:", err);

    if (err instanceof AIOverloadedError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: err.message },
        { status: 503 }
      );
    }

    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: "Có lỗi khi lấy gợi ý, thử lại sau.",
        ...(process.env.NODE_ENV === "development" && {
          debug: err instanceof Error ? err.message : String(err),
        }),
      },
      { status: 500 }
    );
  }
}
