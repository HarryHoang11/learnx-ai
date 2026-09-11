// ================================================================
// GET /api/diagnostic/result — Get diagnostic result
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSkillProfile } from "@/services/assessment.service";
import type { ApiResponse, SkillMasteryPoint } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      // Return latest diagnostic result
      const profile = await getSkillProfile(userId);
      const weakTopics = profile.filter(p => p.isWeak).map(p => p.topic);

      return NextResponse.json<ApiResponse<{ profile: SkillMasteryPoint[]; weakTopics: string[] }>>({
        success: true,
        data: { profile, weakTopics },
      });
    }

    const session = await prisma.diagnosticSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy phiên kiểm tra." },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<typeof session>>({
      success: true,
      data: session,
    });
  } catch (err) {
    console.error("[api/diagnostic/result] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy kết quả, thử lại sau." },
      { status: 500 }
    );
  }
}