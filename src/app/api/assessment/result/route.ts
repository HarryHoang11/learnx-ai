// ================================================================
// GET /api/assessment/result?assessmentId=xxx
// ================================================================
// Mạch tư duy: route này KHÔNG tính toán gì mới — chỉ gọi lại
// getSkillProfile() (đã dùng chung ở /api/progress) để trả về hồ sơ
// năng lực HIỆN TẠI của user. Lý do dùng chung thay vì tính riêng
// theo từng assessmentId: mastery là số liệu TÍCH LŨY theo thời gian
// (xem updateMastery trong assessment.service.ts), không phải điểm số
// chỉ tính riêng cho 1 lần làm bài — đúng tinh thần "AI hiểu học sinh
// yếu ở đâu" một cách liên tục, không phải một bài test rời rạc.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemoUser } from "@/lib/auth/session";
import { getSkillProfile } from "@/services/assessment.service";
import type { ApiResponse, SkillMasteryPoint } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const session = getSessionOrDemoUser(req);
    const profile = await getSkillProfile(session.userId);

    const weakTopics = profile.filter((p) => p.isWeak).map((p) => p.topic);

    return NextResponse.json<ApiResponse<{ profile: SkillMasteryPoint[]; weakTopics: string[] }>>({
      success: true,
      data: { profile, weakTopics },
    });
  } catch (err) {
    console.error("[api/assessment/result] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy kết quả, thử lại sau." },
      { status: 500 }
    );
  }
}
