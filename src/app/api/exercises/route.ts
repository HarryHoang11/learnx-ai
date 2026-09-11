// ================================================================
// GET /api/exercises — duyệt ngân hàng bài tập
// POST /api/exercises — đóng góp bài tập mới
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { listExercises, createExercise } from "@/services/exercise.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const result = await listExercises({
      page: Math.max(1, parseInt(searchParams.get("page") || "1")),
      limit: Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20"))),
      subject: searchParams.get("subject") || undefined,
      topic: searchParams.get("topic") || undefined,
      difficulty: searchParams.get("difficulty") || undefined,
      search: searchParams.get("search") || undefined,
    });
    return NextResponse.json<ApiResponse<typeof result>>(result);
  } catch (err) {
    console.error("[api/exercises] GET error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải danh sách bài tập" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const result = await createExercise({
      createdById: userId,
      title: body.title as string,
      subject: body.subject as string,
      topic: body.topic as string,
      difficulty: body.difficulty as string | undefined,
      statement: body.statement as string,
      constraints: body.constraints as string | undefined,
      examples: body.examples,
      expectedOutput: body.expectedOutput as string | undefined,
    });
    if (!result.success) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json<ApiResponse<typeof result.data>>({ success: true, data: result.data });
  } catch (err) {
    console.error("[api/exercises] POST error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo bài tập" },
      { status: 500 }
    );
  }
}
