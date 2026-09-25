// ================================================================
// /api/auth/password — TRẠNG THÁI & ĐỔI MẬT KHẨU
// ================================================================
// Mạch tư duy: Auth.js KHÔNG có sẵn endpoint đổi mật khẩu (chỉ có
// signIn/signOut), nên route này tự viết nhưng TUÂN THỦ đúng cách
// Credentials provider đang xác thực ở src/auth.ts:
//
//   session (server) -> userId từ cookie đã ký
//   -> đọc User.passwordHash trong DB
//   -> bcrypt.compare(currentPassword, passwordHash)  [bắt buộc]
//   -> bcrypt.hash(newPassword, 12)
//   -> prisma.user.update({ passwordHash })
//
// 3 quy tắc bảo mật KHÔNG được lỏng:
//   1. KHÔNG tin userId gửi từ client — luôn lấy từ getCurrentUserId(),
//      tức là từ session cookie đã ký bởi Auth.js. Nếu tin client thì bất
//      kỳ ai cũng đổi được mật khẩu của user khác.
//   2. KHÔNG bao giờ ghi password thô vào DB hay log — chỉ ghi bcrypt hash.
//   3. Tài khoản OAuth không có passwordHash (null) thì KHÔNG cho đổi mật
//      khẩu ở đây: không có mật khẩu hiện tại để xác minh, nên bất kỳ ai
//      chiếm được phiên Google cũng sẽ đặt được mật khẩu. Trả 409 với
//      thông báo rõ để UI hiển thị đúng trạng thái "tài khoản Google".
//
// Vì sao dùng chung hash bcryptjs với src/auth.ts: đổi sai thuật toán sẽ
// khiến password mới không verify được ở authorize().
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse } from "@/types";

export const runtime = "nodejs";

// Khớp MIN_PASSWORD_LENGTH của /api/auth/register để không tạo ra tài
// khoản/password mà chính hệ thống đăng ký sẽ từ chối.
const MIN_PASSWORD_LENGTH = 8;
// Giới hạn độ dài đầu vào: bcrypt chỉ xét 72 byte đầu (bcryptjs cũng vậy),
// nên chặn sớm giá trị quá dài thay vì âm thầm cắt bớt — tránh tạo ảo
// giác "mật khẩu dài hơn cũng an toàn hơn".
const MAX_PASSWORD_LENGTH = 72;

/**
 * UI cần biết tài khoản này có mật khẩu hay không để quyết định hiển thị
 * form đổi mật khẩu (credentials) hay thông báo "tài khoản Google" (SSO).
 * Route này CHỈ đọc và trả boolean hasPassword — tuyệt đối KHÔNG trả
 * passwordHash (kể cả hash cũng không nên lọt ra client).
 *
 * Vì sao endpoint riêng thay vì nhét cờ vào /api/profile: /api/profile là
 * hồ sơ hiển thị công khai, không nên lẫn thông tin bảo mật vào đó.
 */
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return unauthorizedResponse();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) return unauthorizedResponse();

  return NextResponse.json<ApiResponse<{ hasPassword: boolean }>>({
    success: true,
    // Chỉ có/không có — không tiết lộ gì thêm về nội dung mật khẩu.
    data: { hasPassword: Boolean(user.passwordHash) },
  });
}

export async function PATCH(req: NextRequest) {
  // Xác thực session TRƯỚC khi đọc body: request không hợp lệ thì không
  // cần parse, và không rò rỉ thêm thông tin nào cho request chưa đăng nhập.
  const userId = await getCurrentUserId();
  if (!userId) return unauthorizedResponse();

  const body = (await req.json().catch(() => null)) as {
    currentPassword?: unknown;
    newPassword?: unknown;
    confirmPassword?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Dữ liệu gửi lên không phải JSON hợp lệ." },
      { status: 400 }
    );
  }

  if (
    typeof body.currentPassword !== "string" ||
    typeof body.newPassword !== "string" ||
    typeof body.confirmPassword !== "string"
  ) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Thiếu thông tin mật khẩu cần thiết." },
      { status: 400 }
    );
  }

  const currentPassword = body.currentPassword;
  const newPassword = body.newPassword;
  const confirmPassword = body.confirmPassword;

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: `Mật khẩu mới phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` },
      { status: 400 }
    );
  }
  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: `Mật khẩu mới không được vượt quá ${MAX_PASSWORD_LENGTH} ký tự.` },
      { status: 400 }
    );
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Xác nhận mật khẩu mới không khớp." },
      { status: 400 }
    );
  }
  if (newPassword === currentPassword) {
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Mật khẩu mới phải khác mật khẩu hiện tại." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) return unauthorizedResponse();

  // passwordHash = null nghĩa là tài khoản chỉ đăng nhập bằng Google/SSO.
  // Không có mật khẩu hiện tại để xác minh nên không thể đổi ở đây — trả 409
  // để client hiển thị đúng trạng thái thay vì báo "mật khẩu sai".
  if (!user.passwordHash) {
    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: "Tài khoản này đăng nhập bằng Google nên không có mật khẩu để đổi.",
      },
      { status: 409 }
    );
  }

  const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    // Cố ý trả 400 chứ không phải 500 và KHÔNG nói "sai" vắng mặt, nhưng cũng
    // không tiết lộ thêm gì: đây là thông báo chuẩn cho thao tác xác minh.
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Mật khẩu hiện tại không đúng." },
      { status: 400 }
    );
  }

  try {
    // Chỉ hash được ghi xuống DB — password thô không rời khỏi request này.
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    return NextResponse.json<ApiResponse<null>>({ success: true, data: null });
  } catch (err) {
    // Không log err object: message của Prisma có thể chứa chi tiết DB.
    console.error("[api/auth/password] Lỗi khi cập nhật:", err instanceof Error ? err.name : "UnknownError");
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể đổi mật khẩu, thử lại sau." },
      { status: 500 }
    );
  }
}
