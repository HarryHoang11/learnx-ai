// ================================================================
// POST /api/tutor/hint — Get next hint level
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { AIOverloadedError } from "@/lib/ai/router";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getNextHint } from "@/services/socratic-tutor.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { sessionId, currentHintLevel } = body as {
      sessionId: string;
      currentHintLevel: 0 | 1 | 2 | 3 | 4 | 5;
    };

    if (!sessionId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu sessionId." },
        { status: 400 }
      );
    }

    const result = await getNextHint({
      userId,
      sessionId,
      currentHintLevel: currentHintLevel ?? 0,
    });

    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error("[api/tutor/hint] Error:", err);
    if (err instanceof AIOverloadedError) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: err.message }, { status: 503 });
    }
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy gợi ý, thử lại sau." },
      { status: 500 }
    );
  }
}