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
import type { ApiResponse } from "@/types";

// Trả về userId nếu đã đăng nhập, null nếu chưa — KHÔNG throw, để
// route tự quyết định trả 401 theo đúng format ApiResponse của mình
// (xem unauthorizedResponse() bên dưới, dùng chung cho đồng nhất).
export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
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
