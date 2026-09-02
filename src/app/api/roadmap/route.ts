// ================================================================
// GET /api/roadmap
// ================================================================
// Mạch tư duy: tách biệt rõ GET (lấy lộ trình hiện có, route này) và
// POST /api/roadmap/generate (yêu cầu AI SINH MỚI lộ trình) — 2 việc
// khác nhau về chi phí (GET rẻ, chỉ đọc DB; POST tốn 1 lượt gọi AI)
// nên không gộp chung 1 route để tránh vô tình gọi AI tốn phí chỉ để
// hiển thị lại trang.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getLatestRoadmap } from "@/services/roadmap.service";
import type { ApiResponse, RoadmapPlan } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();
    const plan = await getLatestRoadmap(userId);

    if (!plan) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Chưa có lộ trình nào — hãy tạo mục tiêu và gọi /api/roadmap/generate trước." },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<RoadmapPlan[]>>({ success: true, data: plan });
  } catch (err) {
    console.error("[api/roadmap] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy lộ trình, thử lại sau." },
      { status: 500 }
    );
  }
}
