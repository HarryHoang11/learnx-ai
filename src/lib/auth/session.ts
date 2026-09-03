// ================================================================
// SESSION HELPER — dùng session THẬT từ Auth.js
// ================================================================
// Mạch tư duy: đây là bản THAY THẾ cho session.ts cũ (JWT tự chế +
// "demo user" hard-code). Toàn bộ API route trong app đều gọi
// getCurrentUserId() để biết "request này của user nào" — hàm này
// gọi `auth()` (từ src/auth.ts, Auth.js thật) để đọc session từ
// cookie đã được ký bởi Auth.js, KHÔNG tự ký/tự parse cookie nữa.
//
// Vì sao KHÔNG còn "demo user" fallback: yêu cầu bảo mật rõ ràng là
// "không hard-code userId" và "user chỉ truy cập dữ liệu của chính
// mình" — nếu giữ fallback demo user, mọi request chưa đăng nhập sẽ
// vô tình đọc/ghi vào 1 user giả dùng chung cho tất cả mọi người,
// vi phạm ngay yêu cầu cách ly dữ liệu (data isolation).
// ================================================================

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse } from "@/types";

// Trả về userId nếu đã đăng nhập, null nếu chưa — KHÔNG throw, để
// route tự quyết định trả 401 theo đúng format ApiResponse của mình
// (xem unauthorizedResponse() bên dưới, dùng chung cho đồng nhất).
//
// QUAN TRỌNG: session dùng chiến lược "jwt" (xem auth.ts) — nghĩa là
// Auth.js KHÔNG query lại DB mỗi request, chỉ giải mã cookie đã ký và
// tin luôn userId bên trong. Nếu DB từng bị reset/đổi connection
// string, hoặc cookie cũ còn sót lại từ hệ thống auth trước đây, JWT
// vẫn "hợp lệ" về mặt chữ ký nhưng userId bên trong KHÔNG còn tồn tại
// trong bảng User -> mọi insert dùng userId đó làm khoá ngoại sẽ nổ
// P2003 (Foreign key constraint violated). Vì vậy cần xác minh lại
// user thực sự tồn tại trước khi trả userId ra cho route dùng để ghi
// dữ liệu — tốn thêm 1 query nhẹ, nhưng biến lỗi Prisma khó hiểu
// thành 401 rõ ràng, xử lý được ở phía client (tự động signOut()).
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) return null;

  const exists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  return exists ? userId : null;
}

// Response 401 CHUẨN HÓA — mọi route đều dùng đúng 1 hàm này thay vì
// tự viết `NextResponse.json({...}, {status:401})` rải rác, để format
// lỗi luôn nhất quán (đúng type ApiResponse<never> đã định nghĩa).
export function unauthorizedResponse() {
  return NextResponse.json<ApiResponse<never>>(
    { success: false, error: "Bạn cần đăng nhập để thực hiện thao tác này." },
    { status: 401 }
  );
}
