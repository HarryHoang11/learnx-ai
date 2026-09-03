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
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generateRoadmap } from "@/services/roadmap.service";
import { AIOverloadedError } from "@/lib/ai/gemini";
import type { ApiResponse, RoadmapPlan } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();
    const body = await req.json();

    let goalId = body.goalId as string | undefined;
    const bodyGoalTitle = body.goalTitle as string | undefined;
    const bodyTargetMonths = body.targetMonths as number | undefined;

    // Dùng 2 biến "final..." được gán ĐÚNG 1 LẦN (thay vì mutate lại
    // goalTitle/targetMonths gốc qua nhiều nhánh if/else) — vừa tránh
    // TypeScript không narrow được kiểu string|undefined -> string
    // qua các nhánh phức tạp, vừa rõ ràng hơn khi đọc: "final" luôn
    // là giá trị CHẮC CHẮN dùng để gọi generateRoadmap().
    let finalGoalTitle: string;
    let finalTargetMonths: number;
    let finalGoalId: string;

    // Trường hợp 1: chưa có goal -> tạo mới. Bắt buộc phải có
    // goalTitle + targetMonths trong body ở trường hợp này.
    if (!goalId) {
      if (!bodyGoalTitle || !bodyTargetMonths) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Cần goalTitle và targetMonths để tạo mục tiêu mới." },
          { status: 400 }
        );
      }
      const goal = await prisma.learningGoal.create({
        data: { userId, title: bodyGoalTitle, targetMonths: bodyTargetMonths },
      });
      goalId = goal.id;
      finalGoalId = goal.id;
      finalGoalTitle = bodyGoalTitle;
      finalTargetMonths = bodyTargetMonths;
    } else {
      // Trường hợp 2: tái sinh từ goal đã có -> đọc lại title/targetMonths
      // từ DB thay vì tin vào body (tránh học sinh gửi sai lệch dữ liệu).
      // QUAN TRỌNG: where PHẢI gồm cả userId, không chỉ id — nếu chỉ
      // lọc theo id, user A gửi goalId của user B vẫn đọc được lộ
      // trình của B (lỗ hổng data isolation). findFirst + where userId
      // đảm bảo goal KHÔNG thuộc user hiện tại sẽ coi như "không tìm
      // thấy", giống hệt cách calendar.service.ts đã làm.
      const goal = await prisma.learningGoal.findFirst({ where: { id: goalId, userId } });
      if (!goal) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Không tìm thấy mục tiêu học tập này." },
          { status: 404 }
        );
      }
      finalGoalId = goal.id;
      finalGoalTitle = goal.title;
      finalTargetMonths = goal.targetMonths;
    }

    const plan = await generateRoadmap({
      userId,
      learningGoalId: finalGoalId,
      goalTitle: finalGoalTitle,
      targetMonths: finalTargetMonths,
    });

    return NextResponse.json<ApiResponse<RoadmapPlan[]>>({ success: true, data: plan });
  } catch (err) {
    console.error("[api/roadmap/generate] Lỗi:", err);

    // Google Gemini đang quá tải (503/429) — lỗi tạm thời, không phải
    // bug của app. Trả 503 để frontend biết đây là "thử lại sau", có
    // thể hiển thị khác với lỗi 500 thật (vd nút "Thử lại" thay vì
    // form báo lỗi).
    if (err instanceof AIOverloadedError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: err.message },
        { status: 503 }
      );
    }

    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: "Không thể tạo lộ trình, thử lại sau.",
        // Chỉ trả chi tiết lỗi thật khi đang dev, KHÔNG bao giờ để lộ ở
        // production — giúp thấy nguyên nhân thật trong Network tab
        // thay vì chỉ "500 Internal Server Error" chung chung.
        ...(process.env.NODE_ENV === "development" && {
          debug: err instanceof Error ? err.message : String(err),
        }),
      },
      { status: 500 }
    );
  }
}
