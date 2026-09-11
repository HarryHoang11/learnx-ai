// ================================================================
// POST /api/agent/task — Update agent task status
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { updateTaskStatus } from "@/services/learning-agent.service";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { taskId, status } = body as {
      taskId: string;
      status: "pending" | "in_progress" | "completed" | "skipped" | "cancelled";
    };

    if (!taskId || !status) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu taskId hoặc status." },
        { status: 400 }
      );
    }

    const validStatuses = ["pending", "in_progress", "completed", "skipped", "cancelled"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Status không hợp lệ." },
        { status: 400 }
      );
    }

    const task = await updateTaskStatus({ taskId, userId, status });

    return NextResponse.json<ApiResponse<typeof task>>({ success: true, data: task });
  } catch (err) {
    console.error("[api/agent/task] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể cập nhật task, thử lại sau." },
      { status: 500 }
    );
  }
}