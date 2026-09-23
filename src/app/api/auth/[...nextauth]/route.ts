// ================================================================
// GET/POST /api/auth/[...nextauth]
// ================================================================
// Mạch tư duy: đây KHÔNG phải route mình tự viết logic — Auth.js quy
// định BẮT BUỘC phải có đúng file này ở đúng path
// `api/auth/[...nextauth]/route.ts` để xử lý toàn bộ luồng OAuth
// (redirect sang Google, callback, tạo session...). Toàn bộ
// cấu hình thật nằm ở src/auth.ts — file này chỉ export lại.
//
// Thêm 1 lớp CHẶN TRƯỚC Auth.js: nếu cấu hình thiếu (thực tế đã gặp:
// AUTH_SECRET chưa set trên Vercel, hoặc AUTH_URL="" làm tắt trustHost),
// Auth.js trả HTTP 500 với body chung chung "There was a problem with the
// server configuration" — không cho biết thiếu gì. Guard dưới đây trả JSON
// 503 nêu ĐÚNG TÊN biến cần thêm (không bao giờ kèm giá trị/secret), nhờ
// vậy lần deploy sau chỉ cần nhìn response là biết phải sửa gì.
//
// Khi cấu hình đầy đủ (trường hợp bình thường) guard trả null và request
// được chuyển nguyên vẹn cho handlers của Auth.js — Google OAuth,
// Credentials, callback, PrismaAdapter... KHÔNG bị ảnh hưởng.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { handlers, getAuthConfigIssues } from "@/auth";
import type { ApiResponse } from "@/types";

function configGuardResponse(): NextResponse | null {
  const issues = getAuthConfigIssues();
  if (issues.length === 0) return null;

  console.error(`[api/auth] Cấu hình Auth.js chưa đầy đủ: ${issues.join(" | ")}`);
  return NextResponse.json<ApiResponse<never>>(
    {
      success: false,
      error: `Đăng nhập chưa được cấu hình trên máy chủ: ${issues.join("; ")}.`,
    },
    { status: 503 }
  );
}

export async function GET(req: NextRequest) {
  return configGuardResponse() ?? handlers.GET(req);
}

export async function POST(req: NextRequest) {
  return configGuardResponse() ?? handlers.POST(req);
}
