import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { generateStudyGuide } from "@/services/document.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();
    const body = await req.json() as { documentId?: unknown; difficulty?: unknown; forceRegenerate?: unknown };
    const documentId = typeof body.documentId === "string" ? body.documentId : "";
    const difficulty = body.difficulty === "beginner" || body.difficulty === "advanced" ? body.difficulty : "intermediate";
    const forceRegenerate = body.forceRegenerate === true;
    if (!documentId) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: "Thiếu documentId." }, { status: 400 });
    }
    const result = await generateStudyGuide(documentId, userId, difficulty, { forceRegenerate });
    return NextResponse.json<ApiResponse<{ guide: string; difficulty: string; cached: boolean; updatedAt: string }>>({
      success: true,
      data: { guide: result.content, difficulty, cached: result.cached, updatedAt: result.updatedAt },
    });
  } catch (err) {
    console.error("[api/documents/study-guide] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo Study Guide, thử lại sau." },
      { status: 500 }
    );
  }
}
