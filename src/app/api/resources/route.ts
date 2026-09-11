// ================================================================
// GET /api/resources — discovery (search/filter/sort)
// POST /api/resources — đóng góp resource mới
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { listResources, createResource } from "@/services/resource.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const result = await listResources({
      page: Math.max(1, parseInt(searchParams.get("page") || "1")),
      limit: Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20"))),
      search: searchParams.get("search") || undefined,
      subject: searchParams.get("subject") || undefined,
      topic: searchParams.get("topic") || undefined,
      difficulty: searchParams.get("difficulty") || undefined,
      type: searchParams.get("type") || undefined,
      sortBy: (searchParams.get("sortBy") as "quality" | "rating" | "popular" | "newest" | undefined) || undefined,
    });
    return NextResponse.json<ApiResponse<typeof result>>(result);
  } catch (err) {
    console.error("[api/resources] GET error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải danh sách tài liệu học" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const result = await createResource({
      contributorId: userId,
      title: body.title as string,
      description: body.description as string | undefined,
      subject: body.subject as string | undefined,
      topic: body.topic as string | undefined,
      difficulty: body.difficulty as string | undefined,
      type: body.type as string,
      url: body.url as string | undefined,
      communityDocumentId: body.communityDocumentId as string | undefined,
    });
    if (!result.success) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json<ApiResponse<typeof result.data>>({ success: true, data: result.data });
  } catch (err) {
    console.error("[api/resources] POST error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo tài liệu học" },
      { status: 500 }
    );
  }
}
