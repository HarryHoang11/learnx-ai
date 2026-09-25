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
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse } from "@/types";

export const runtime = "nodejs";

const MIN_PASSWORD_LENGTH = 8;

// Các mã lỗi Prisma báo "hạ tầng/sai trạng thái DB" chứ KHÔNG phải lỗi
// người dùng: không có DB, không kết nối được, migration chưa chạy, cột
// không tồn tại, timeout. Trả 503 để client biết đây là lỗi tạm thời của
// server thay vì "sai dữ liệu" — trước đây tất cả bị gộp thành 500 chung.
const DATABASE_INFRA_ERROR_CODES = new Set([
  "P1000", // không xác thực được
  "P1001", // không kết nối được tới DB
  "P1008", // hết thời gian chờ DB
  "P1010", // user DB không có quyền
  "P1017", // server DB đóng kết nối
  "P2021", // bảng không tồn tại (chưa chạy migration)
  "P2022", // cột không tồn tại (DB lệch schema)
  "P2034", // xung đột transaction, có thể thử lại
]);

export async function POST(req: NextRequest) {
  // Parse body RIÊNG khỏi try chính: body sai định dạng JSON là lỗi của
  // client (400), không phải lỗi hệ thống — nếu để `req.json()` ném vào
  // catch chung thì client nhận 500 "Không thể đăng ký" và rất dễ bị
  // chẩn đoán nhầm thành server sập.
  const body = (await req.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    name?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Dữ liệu gửi lên không phải JSON hợp lệ." },
      { status: 400 }
    );
  }

  try {
    if (typeof body.email !== "string" || typeof body.password !== "string" || typeof body.name !== "string") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Dữ liệu đăng ký không hợp lệ." },
        { status: 400 }
      );
    }

    const email = body.email.trim().toLowerCase();
    const password = body.password;
    const name = body.name.trim();

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
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Email này đã được đăng ký." },
          { status: 409 }
        );
      }
      if (DATABASE_INFRA_ERROR_CODES.has(err.code)) {
        // Chỉ log MÃ lỗi, không log cả error object: message của Prisma có
        // thể chứa connection string/chi tiết DB. Không log stack trace vì
        // response này đi ra client.
        console.error(`[api/auth/register] Prisma error ${err.code}`);
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Dịch vụ đăng ký tạm thời không khả dụng. Vui lòng thử lại sau." },
          { status: 503 }
        );
      }
    }
    console.error("[api/auth/register] Lỗi không xác định:", err instanceof Error ? err.name : "UnknownError");
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể đăng ký, thử lại sau." },
      { status: 500 }
    );
  }
}
