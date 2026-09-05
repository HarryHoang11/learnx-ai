// ================================================================
// GET /api/profile/photo/[type] — trả về BYTES ảnh (avatar|cover)
// ĐỌC THẲNG TỪ POSTGRES, không đọc file trên disk.
// ================================================================
// Mạch tư duy: cột "image"/"coverImage" trong User giờ chỉ lưu URL
// trỏ tới chính route này (xem api/profile/photo/route.ts) thay vì
// path file local. Route này là nơi DUY NHẤT đọc cột Bytes
// (avatarData/coverData) và trả về đúng Content-Type để trình duyệt
// render như một ảnh bình thường qua thẻ <img src="...">.
//
// Chưa có tính năng xem trang cá nhân người khác trong app hiện tại
// (chỉ có /profile cho chính mình), nên route này chỉ trả ảnh của
// CHÍNH user đang đăng nhập — không nhận userId từ query/param để
// tránh lộ ảnh của người khác. Nếu sau này có public profile, cần
// thiết kế lại endpoint này để nhận userId công khai.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

type PhotoType = "avatar" | "cover";

export async function GET(_req: NextRequest, { params }: { params: { type: string } }) {
  const type = params.type as PhotoType;
  if (type !== "avatar" && type !== "cover") {
    return NextResponse.json({ success: false, error: "Loại ảnh không hợp lệ." }, { status: 400 });
  }

  const userId = await getCurrentUserId();
  if (!userId) return unauthorizedResponse();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select:
      type === "avatar" ? { avatarData: true, avatarMimeType: true } : { coverData: true, coverMimeType: true },
  });

  const data = type === "avatar" ? user?.avatarData : user?.coverData;
  const mimeType = type === "avatar" ? user?.avatarMimeType : user?.coverMimeType;

  if (!data || !mimeType) {
    return NextResponse.json({ success: false, error: "Chưa có ảnh." }, { status: 404 });
  }

  // "private": ảnh gắn với tài khoản đăng nhập, không cho shared cache
  // (proxy/CDN công cộng) lưu chung. "max-age=0, must-revalidate":
  // vẫn cho trình duyệt cache theo URL (đã có "?v=" cache-buster ở
  // route upload) nhưng luôn revalidate nếu URL không đổi.
  return new NextResponse(data, {
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
