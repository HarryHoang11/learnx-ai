// ================================================================
// POST /api/tutor/session — Create new tutor session
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { createTutorSession } from "@/services/socratic-tutor.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { topic, subject, mode, initialDifficulty } = body as {
      topic: string;
      subject?: string;
      mode?: "socratic" | "explanation" | "practice";
      initialDifficulty?: number;
    };

    if (!topic) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu topic." },
        { status: 400 }
      );
    }

    const session = await createTutorSession({
      userId,
      topic,
      subject,
      mode,
      initialDifficulty,
    });

    return NextResponse.json<ApiResponse<typeof session>>({ success: true, data: session });
  } catch (err) {
    console.error("[api/tutor/session] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo phiên tutor, thử lại sau." },
      { status: 500 }
    );
  }
}