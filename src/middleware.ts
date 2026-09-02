// ================================================================
// MIDDLEWARE — bảo vệ route riêng tư
// ================================================================
// Mạch tư duy: đây là lớp bảo vệ Ở TẦNG NGOÀI CÙNG, chạy TRƯỚC khi
// bất kỳ page nào trong (app) render — nếu chưa đăng nhập, redirect
// thẳng về /login, KHÔNG để lọt vào dashboard rồi mới báo lỗi 401 ở
// từng API call riêng lẻ (trải nghiệm tệ hơn nhiều).
// API routes (/api/**) đã tự kiểm tra qua getCurrentUserId() ở từng
// route — middleware này KHÔNG chặn API, chỉ chặn PAGE, vì API cần
// trả JSON 401 (để frontend xử lý), còn page cần redirect (điều
// hướng trình duyệt).
// ================================================================

import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];

export default auth((req) => {
  const path = req.nextUrl.pathname;

  // API routes tự kiểm tra đăng nhập và trả JSON 401 riêng (xem
  // lib/auth/session.ts) — middleware KHÔNG được redirect các request
  // API, vì fetch() ở frontend cần nhận JSON, không phải 1 redirect
  // sang trang HTML /login (sẽ khiến res.json() lỗi parse).
  if (path.startsWith("/api")) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth?.user;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // Trang gốc "/" tự redirect sang /dashboard (page.tsx) — để middleware
  // xử lý luôn ở đây, sau đó "/" sẽ rơi vào nhánh cần đăng nhập bên dưới.
  if (!isLoggedIn && !isPublic && path !== "/") {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  // Đã đăng nhập rồi mà cố vào /login hoặc /register -> đưa thẳng
  // vào dashboard, tránh cảm giác "đăng nhập xong lại thấy form login".
  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  return NextResponse.next();
});

// matcher loại trừ các đường dẫn tĩnh/nội bộ Next.js (_next, favicon,
// api/auth) — KHÔNG loại trừ /api/** khác, vì middleware vẫn chạy qua
// nhưng logic ở trên chỉ redirect cho page, không ảnh hưởng API JSON.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon).*)"],
};
