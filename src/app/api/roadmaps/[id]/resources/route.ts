// ================================================================
// GET /api/roadmaps/[id]/resources?topic= — links của goal (hoặc topic)
// POST /api/roadmaps/[id]/resources — gắn resource/exercise vào task
// DELETE /api/roadmaps/[id]/resources?linkId= — gỡ liên kết
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { listRoadmapLinks, linkRoadmapItem, unlinkRoadmapItem } from "@/services/roadmap-resource.service";
import type { ApiResponse } from "@/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const result = await listRoadmapLinks(userId, id, searchParams.get("topic") || undefined);
    if (!result.success) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: result.error }, { status: 404 });
    }
    return NextResponse.json<ApiResponse<typeof result.data>>({ success: true, data: result.data });
  } catch (err) {
    console.error("[api/roadmaps/[id]/resources] GET error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải liên kết" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const body = await req.json();
    const result = await linkRoadmapItem(userId, id, body.topic as string, {
      resourceId: body.resourceId as string | undefined,
      exerciseId: body.exerciseId as string | undefined,
      kind: body.kind as string | undefined,
    });
    if (!result.success) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json<ApiResponse<typeof result.data>>({ success: true, data: result.data });
  } catch (err) {
    console.error("[api/roadmaps/[id]/resources] POST error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể gắn liên kết" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const linkId = searchParams.get("linkId");
    if (!linkId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu linkId." },
        { status: 400 }
      );
    }
    const result = await unlinkRoadmapItem(userId, id, linkId);
    if (!result.success) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: result.error }, { status: 404 });
    }
    return NextResponse.json<ApiResponse<typeof result.data>>({ success: true, data: result.data });
  } catch (err) {
    console.error("[api/roadmaps/[id]/resources] DELETE error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể gỡ liên kết" },
      { status: 500 }
    );
  }
}
