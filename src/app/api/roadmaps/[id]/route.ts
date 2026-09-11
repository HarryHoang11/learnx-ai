// ================================================================
// GET/PATCH/DELETE /api/roadmaps/[id]
// ================================================================
// QUAN TRỌNG VỀ THIẾT KẾ: [id] ở đây là id của LearningGoal, KHÔNG
// phải id của bản ghi Roadmap (bản plan cụ thể). Lý do: 1 LearningGoal
// ("C++ → OLP") là đơn vị "1 lộ trình" mà user nhìn thấy trên UI (1
// card trong "Lộ trình của tôi") — Roadmap chỉ là dữ liệu plan bên
// trong, có thể có NHIỀU bản ghi lịch sử cho cùng 1 goal (mỗi lần AI
// tái sinh). Toàn bộ action (xem/đổi trạng thái/xoá) đều thao tác ở
// mức GOAL, khớp đúng với mockup UX được yêu cầu.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getGoalForUser, updateGoalStatus, deleteGoal } from "@/services/roadmap.service";
import type { ApiResponse, GoalWithRoadmap, RoadmapStatus } from "@/types";

const VALID_STATUSES: RoadmapStatus[] = ["ACTIVE", "COMPLETED", "ARCHIVED"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const goal = await getGoalForUser(userId, id);
    if (!goal) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy lộ trình." },
        { status: 404 }
      );
    }
    return NextResponse.json<ApiResponse<GoalWithRoadmap>>({ success: true, data: goal });
  } catch (err) {
    console.error("[api/roadmaps/:id] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy lộ trình, thử lại sau." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;

    const body = await req.json();
    const status = body.status as string | undefined;

    if (!status || !VALID_STATUSES.includes(status as RoadmapStatus)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `status phải là một trong: ${VALID_STATUSES.join(", ")}.` },
        { status: 400 }
      );
    }

    const goal = await updateGoalStatus(userId, id, status as RoadmapStatus);
    if (!goal) {
      // KHÔNG phân biệt "không tồn tại" vs "tồn tại nhưng của user
      // khác" — luôn trả 404 chung chung, đúng nguyên tắc ownership đã
      // dùng xuyên suốt project (vd api/documents/[id]/route.ts).
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy lộ trình." },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<GoalWithRoadmap>>({ success: true, data: goal });
  } catch (err) {
    console.error("[api/roadmaps/:id] Lỗi cập nhật trạng thái:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể cập nhật lộ trình, thử lại sau." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;

    // deleteGoal() tự kiểm tra ownership (userId) trước khi xoá, trả
    // false nếu không tìm thấy/không thuộc user này — route KHÔNG bao
    // giờ cho phép xoá roadmap của user khác (đúng yêu cầu bảo mật).
    const ok = await deleteGoal(userId, id);
    if (!ok) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy lộ trình." },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<{ deleted: true }>>({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error("[api/roadmaps/:id] Lỗi xoá:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể xoá lộ trình, thử lại sau." },
      { status: 500 }
    );
  }
}
