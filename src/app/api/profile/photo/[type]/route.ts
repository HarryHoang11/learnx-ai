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

import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

type PhotoType = "avatar" | "cover";

export async function GET(
  // `req` dùng để đọc header `If-None-Match` cho cơ chế 304 (xem phần CACHE
  // trong thân hàm) — trước đây tham số này là `_req` vì không dùng.
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  try {
    const { type: rawType } = await params;
    const type = rawType as PhotoType;

    if (type !== "avatar" && type !== "cover") {
      return NextResponse.json(
        { success: false, error: "Loại ảnh không hợp lệ." },
        { status: 400 },
      );
    }

    const userId = await getCurrentUserId();

    if (!userId) {
      return unauthorizedResponse();
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        avatarData: true,
        avatarMimeType: true,
        coverData: true,
        coverMimeType: true,
      },
    });

    const data = type === "avatar" ? user?.avatarData : user?.coverData;

    const mimeType =
      type === "avatar" ? user?.avatarMimeType : user?.coverMimeType;

    if (!data || !mimeType) {
      return NextResponse.json(
        { success: false, error: "Chưa có ảnh." },
        { status: 404 },
      );
    }

    // ---- CACHE (spec §20) ----
    // VÌ SAO ĐỔI: trước đây gửi `private, max-age=0, must-revalidate` —
    // nghĩa là MỖI lần mở app trình duyệt lại hỏi server, và server lại
    // query DB + trả lại TOÀN BỘ bytes ảnh. Đó là lý do
    // `GET /api/profile/photo/avatar` tốn ~1s dù API trả 200.
    //
    // CÁCH SỬA (không đổi kiến trúc lưu trữ, không đụng DB):
    //   1. `ETag` + `If-None-Match` -> khi ảnh KHÔNG đổi, server chỉ trả
    //      304 với 0 byte. Đây là chuẩn HTTP, mọi proxy/CDN đều hiểu.
    //      Ta tạo ETag từ chính bytes đã đọc nên không cần thêm cột DB.
    //   2. `max-age=60` cho phép trình duyệt dùng bản cache 1 phút mà không
    //      hỏi lại — đủ để chuyển trong app không bị tải lại ảnh.
    //      `must-revalidate` bị BỎ vì nó triệt tiêu toàn bộ lợi ích cache.
    //
    // AN TOÀN: ảnh vẫn là `private` (không đưa vào shared cache của proxy
    // công cộng) và URL vẫn có `?v=` cache-buster do route upload gắn — nên
    // khi user đổi ảnh, URL đổi theo và cache cũ tự nhiên bị bỏ qua.
    const etag = `"${createHash("sha1").update(data).digest("base64url")}"`;

    // 304: client đã có đúng ảnh này rồi -> không gửi lại body.
    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "private, max-age=60, must-revalidate",
        },
      });
    }

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeType,
        ETag: etag,
        "Cache-Control": "private, max-age=60, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[api/profile/photo] Lỗi:", err);
    return NextResponse.json({ success: false, error: "Không thể tải ảnh." }, { status: 500 });
  }
}
