// ================================================================
// PATCH /api/calendar/[id]  &  DELETE /api/calendar/[id]
// ================================================================
// Mạch tư duy: [id] là dynamic route CHUẨN của Next.js App Router —
// đúng yêu cầu "PATCH /api/calendar/:id" nhưng viết theo cú pháp
// Next.js (file trong thư mục [id]/route.ts) thay vì Express-style
// ":id". Cả 2 hàm đều gọi service với (id, userId) — service tự kiểm
// tra bản ghi có thuộc userId hay không TRƯỚC khi sửa/xoá (xem
// calendar.service.ts), route KHÔNG tự query DB trực tiếp.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { deleteStudySession, updateStudySession } from "@/services/calendar.service";
import type { ApiResponse, StudySessionStatus } from "@/types";

interface RouteParams {
  params: { id: string };
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { title, subject, topic, startTime, endTime, status, progress } = body as {
      title?: string;
      subject?: string;
      topic?: string;
      startTime?: string;
      endTime?: string;
      status?: StudySessionStatus;
      progress?: number;
    };

    const updated = await updateStudySession(params.id, userId, {
      ...(title && { title }),
      ...(subject && { subject }),
      ...(topic !== undefined && { topic }),
      ...(startTime && { startTime: new Date(startTime) }),
      ...(endTime && { endTime: new Date(endTime) }),
      ...(status && { status }),
      ...(progress !== undefined && { progress }),
    });

    if (!updated) {
      // null nghĩa là KHÔNG tìm thấy bản ghi này thuộc về user hiện
      // tại — trả 404 thay vì tiết lộ "bản ghi tồn tại nhưng không
      // phải của bạn" (403), để tránh lộ thông tin id của người khác.
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy buổi học này." },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<typeof updated>>({ success: true, data: updated });
  } catch (err) {
    console.error("[api/calendar/[id] PATCH] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể cập nhật buổi học, thử lại sau." },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const deleted = await deleteStudySession(params.id, userId);
    if (!deleted) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy buổi học này." },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<{ deleted: true }>>({ success: true, data: { deleted: true } });
  } catch (err) {
    console.error("[api/calendar/[id] DELETE] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể xoá buổi học, thử lại sau." },
      { status: 500 }
    );
  }
}
