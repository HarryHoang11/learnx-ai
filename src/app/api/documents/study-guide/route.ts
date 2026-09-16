import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { generateStudyGuide } from "@/services/document.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();
    const body = await req.json() as { documentId?: unknown; difficulty?: unknown };
    const documentId = typeof body.documentId === "string" ? body.documentId : "";
    const difficulty = body.difficulty === "beginner" || body.difficulty === "advanced" ? body.difficulty : "intermediate";
    if (!documentId) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: "Thiếu documentId." }, { status: 400 });
    }
    const guide = await generateStudyGuide(documentId, userId, difficulty);
    return NextResponse.json<ApiResponse<{ guide: string; difficulty: string }>>({
      success: true,
      data: { guide, difficulty },
    });
  } catch (err) {
    console.error("[api/documents/study-guide] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo Study Guide, thử lại sau." },
      { status: 500 }
    );
  }
}