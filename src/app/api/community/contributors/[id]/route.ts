// ================================================================
// GET /api/community/contributors/[id] — Get contributor profile
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getContributorProfileData } from "@/services/contribution.service";
import type { ApiResponse } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const profileData = await getContributorProfileData(id);

    if (!profileData.profile) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy người đóng góp" },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<typeof profileData>>({ success: true, data: profileData });
  } catch (err) {
    console.error("[api/community/contributors/[id]] GET error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải hồ sơ người đóng góp" },
      { status: 500 }
    );
  }
}