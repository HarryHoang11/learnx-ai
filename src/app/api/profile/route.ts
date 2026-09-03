// ================================================================
// GET /api/profile — lấy hồ sơ hiện tại
// PATCH /api/profile — cập nhật name / nickname / bio (KHÔNG gồm ảnh —
// ảnh đi qua route riêng /api/profile/photo vì multipart/form-data
// khác hẳn JSON, tách route cho route handler đơn giản, dễ test).
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse, UserProfile } from "@/types";

const BIO_MAX_LENGTH = 150;

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, nickname: true, email: true, bio: true, image: true, coverImage: true },
    });

    if (!user) return unauthorizedResponse();

    return NextResponse.json<ApiResponse<UserProfile>>({ success: true, data: user });
  } catch (err) {
    console.error("[api/profile GET] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: "Không thể tải hồ sơ, thử lại sau.",
        ...(process.env.NODE_ENV === "development" && {
          debug: err instanceof Error ? err.message : String(err),
        }),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const nickname = typeof body.nickname === "string" ? body.nickname.trim() : undefined;
    const bio = typeof body.bio === "string" ? body.bio.trim() : undefined;

    // Validate BIO length ở tầng server — KHÔNG chỉ tin giới hạn
    // maxLength của <textarea> phía client, vì request có thể được gửi
    // trực tiếp (Postman, script) bỏ qua UI.
    if (bio !== undefined && bio.length > BIO_MAX_LENGTH) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Tiểu sử không được vượt quá ${BIO_MAX_LENGTH} ký tự.` },
        { status: 400 }
      );
    }

    if (name !== undefined && name.length === 0) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Họ và tên không được để trống." },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(name !== undefined && { name }),
        // nickname/bio cho phép rỗng ("") để user XOÁ giá trị cũ —
        // khác với name (không cho rỗng, đã chặn ở trên).
        ...(nickname !== undefined && { nickname: nickname || null }),
        ...(bio !== undefined && { bio: bio || null }),
      },
      select: { id: true, name: true, nickname: true, email: true, bio: true, image: true, coverImage: true },
    });

    return NextResponse.json<ApiResponse<UserProfile>>({ success: true, data: user });
  } catch (err) {
    console.error("[api/profile PATCH] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: "Không thể lưu thay đổi, thử lại sau.",
        ...(process.env.NODE_ENV === "development" && {
          debug: err instanceof Error ? err.message : String(err),
        }),
      },
      { status: 500 }
    );
  }
}
