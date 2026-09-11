// ================================================================
// POST /api/tutor/message — Send message to tutor
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { sendTutorMessage } from "@/services/socratic-tutor.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { topic, userMessage, hintLevel, sessionId } = body as {
      topic: string;
      userMessage: string;
      hintLevel: 0 | 1 | 2 | 3 | 4 | 5;
      sessionId?: string;
    };

    if (!topic || !userMessage) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu topic hoặc userMessage." },
        { status: 400 }
      );
    }

    const result = await sendTutorMessage({
      userId,
      topic,
      userMessage,
      hintLevel: hintLevel ?? 0,
      sessionId,
    });

    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error("[api/tutor/message] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể gửi tin nhắn, thử lại sau." },
      { status: 500 }
    );
  }
}