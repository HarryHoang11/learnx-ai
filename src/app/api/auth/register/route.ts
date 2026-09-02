// ================================================================
// POST /api/auth/register
// ================================================================
// Mạch tư duy: Auth.js KHÔNG có sẵn API "đăng ký" (chỉ lo đăng nhập)
// — route này tự viết để tạo User mới với mật khẩu đã hash, SAU ĐÓ
// học sinh dùng chính Credentials provider (đã cấu hình ở src/auth.ts)
// để đăng nhập bình thường. Tách biệt rõ 2 việc: route này CHỈ tạo
// user, KHÔNG tự đăng nhập luôn (để không lẫn logic session vào đây,
// giữ đúng nguyên tắc "1 route lo 1 việc").
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse } from "@/types";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email as string | undefined)?.trim().toLowerCase();
    const password = body.password as string | undefined;
    const name = (body.name as string | undefined)?.trim();

    if (!email || !email.includes("@")) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Email không hợp lệ." },
        { status: 400 }
      );
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` },
        { status: 400 }
      );
    }
    if (!name) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu tên hiển thị." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Email này đã được đăng ký." },
        { status: 409 }
      );
    }

    // Hash mật khẩu với cost factor 12 — cao hơn mặc định (10) một
    // chút để tăng độ an toàn, vẫn đủ nhanh cho trải nghiệm đăng ký
    // (dưới ~200ms trên phần cứng thông thường). KHÔNG BAO GIỜ lưu
    // password gốc, kể cả tạm thời trong log.
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, name, passwordHash },
      select: { id: true, email: true, name: true },
    });

    return NextResponse.json<ApiResponse<typeof user>>({ success: true, data: user });
  } catch (err) {
    console.error("[api/auth/register] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể đăng ký, thử lại sau." },
      { status: 500 }
    );
  }
}
