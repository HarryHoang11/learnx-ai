// ================================================================
// POST /api/ai/chat
// ================================================================
// Mạch tư duy: route này CHỦ Ý rất mỏng — chỉ đọc body, gọi
// sendTutorMessage() (service), trả kết quả. Toàn bộ logic Socratic
// và lưu lịch sử nằm trong services/tutor.service.ts. Nếu bạn thấy
// mình sắp viết if/else phức tạp NGAY TRONG route này, đó là dấu hiệu
// logic đó nên chuyển vào service thay vì ở đây.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { sendTutorMessage } from "@/services/tutor.service";
import { AIOverloadedError } from "@/lib/ai/gemini";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();
    const body = await req.json();

    // Validate tối thiểu — MVP chưa dùng zod để giữ dependency gọn,
    // nhưng nếu project lớn lên, NÊN thay đoạn check tay này bằng
    // zod schema để tránh lỗi rải rác ở nhiều route.
    if (!body.message || typeof body.message !== "string") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu trường 'message' (string)." },
        { status: 400 }
      );
    }

    const hintLevel = (body.hintLevel ?? 0) as 0 | 1 | 2 | 3;
    const topic = (body.topic as string) ?? "Chưa xác định";

    const result = await sendTutorMessage({
      userId,
      topic,
      userMessage: body.message,
      hintLevel,
    });

    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error("[api/ai/chat] Lỗi:", err);

    if (err instanceof AIOverloadedError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: err.message },
        { status: 503 }
      );
    }

    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: "Có lỗi khi gọi AI Tutor, thử lại sau.",
        ...(process.env.NODE_ENV === "development" && {
          debug: err instanceof Error ? err.message : String(err),
        }),
      },
      { status: 500 }
    );
  }
}
