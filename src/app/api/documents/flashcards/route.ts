import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { generateFlashcards, type FlashcardItem } from "@/services/document.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();
    const body = await req.json() as { documentId?: unknown; forceRegenerate?: unknown };
    const documentId = typeof body.documentId === "string" ? body.documentId : "";
    const forceRegenerate = body.forceRegenerate === true;
    if (!documentId) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: "Thiếu documentId." }, { status: 400 });
    }
    const result = await generateFlashcards(documentId, userId, { forceRegenerate });
    return NextResponse.json<ApiResponse<{ cards: FlashcardItem[]; cached: boolean; updatedAt: string }>>({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("[api/documents/flashcards] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: err instanceof Error ? err.message : "Không thể tạo flashcards, thử lại sau." },
      { status: 500 }
    );
  }
}
