// ================================================================
// PUT /api/mindmap/[id] — cập nhật mind map (tiêu đề/nodes sau edit)
// DELETE /api/mindmap/[id] — xóa mind map
// ================================================================
// Mạch tư duy: UI Mind Map cho sửa/xóa/thêm node ở client rồi LƯU
// về DB qua route này. Verify mind map thuộc về đúng user để chống
// IDOR — cùng pattern với các route calendar/documents hiện có.

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse } from "@/types";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;
    const existing = await prisma.mindMap.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy Mind Map." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { title, description, data } = body as {
      title?: string;
      description?: string | null;
      data?: unknown;
    };

    if (title !== undefined && title.trim() === "") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Tiêu đề không được để trống." },
        { status: 400 }
      );
    }

    const updated = await prisma.mindMap.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(data !== undefined ? { data: data as object } : {}),
      },
    });

    return NextResponse.json<ApiResponse<typeof updated>>({ success: true, data: updated });
  } catch (err) {
    console.error("[api/mindmap/[id]] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lưu Mind Map, thử lại sau." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;

    const existing = await prisma.mindMap.findFirst({
      where: { id, userId },
      select: { id: true, title: true },
    });
    if (!existing) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy Mind Map." },
        { status: 404 }
      );
    }

    await prisma.mindMap.delete({
      where: { id },
    });

    return NextResponse.json<ApiResponse<{ id: string; title: string }>>({
      success: true,
      data: { id: existing.id, title: existing.title },
    });
  } catch (err) {
    console.error("[api/mindmap/[id]] DELETE Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể xóa Mind Map, thử lại sau." },
      { status: 500 }
    );
  }
}
