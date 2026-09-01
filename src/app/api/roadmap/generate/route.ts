// ================================================================
// POST /api/roadmap/generate
// ================================================================
// Mạch tư duy: route này được gọi ở 2 tình huống:
//   1) Học sinh MỚI đặt mục tiêu lần đầu (sau khi làm xong Diagnostic
//      Test) -> tạo LearningGoal rồi sinh Roadmap đầu tiên.
//   2) AI/giáo viên/học sinh yêu cầu TÁI SINH lộ trình (vd sau khi
//      học sinh tiến bộ nhanh hơn dự kiến) -> chỉ cần learningGoalId
//      đã có sẵn, không tạo goal mới.
// Route phân biệt 2 trường hợp bằng việc body có "goalId" hay không.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemoUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generateRoadmap } from "@/services/roadmap.service";
import type { ApiResponse, RoadmapPlan } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const session = getSessionOrDemoUser(req);
    const body = await req.json();

    let goalId = body.goalId as string | undefined;
    let goalTitle = body.goalTitle as string | undefined;
    let targetMonths = body.targetMonths as number | undefined;

    // Trường hợp 1: chưa có goal -> tạo mới. Bắt buộc phải có
    // goalTitle + targetMonths trong body ở trường hợp này.
    if (!goalId) {
      if (!goalTitle || !targetMonths) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Cần goalTitle và targetMonths để tạo mục tiêu mới." },
          { status: 400 }
        );
      }
      const goal = await prisma.learningGoal.create({
        data: { userId: session.userId, title: goalTitle, targetMonths },
      });
      goalId = goal.id;
    } else {
      // Trường hợp 2: tái sinh từ goal đã có -> đọc lại title/targetMonths
      // từ DB thay vì tin vào body (tránh học sinh gửi sai lệch dữ liệu).
      const goal = await prisma.learningGoal.findUnique({ where: { id: goalId } });
      if (!goal) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Không tìm thấy mục tiêu học tập này." },
          { status: 404 }
        );
      }
      goalTitle = goal.title;
      targetMonths = goal.targetMonths;
    }

    const plan = await generateRoadmap({
      userId: session.userId,
      learningGoalId: goalId,
      goalTitle,
      targetMonths,
    });

    return NextResponse.json<ApiResponse<RoadmapPlan[]>>({ success: true, data: plan });
  } catch (err) {
    console.error("[api/roadmap/generate] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo lộ trình, thử lại sau." },
      { status: 500 }
    );
  }
}
