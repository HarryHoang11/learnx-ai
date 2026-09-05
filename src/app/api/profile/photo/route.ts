// ================================================================
// POST /api/profile/photo — upload avatar HOẶC cover photo
// ================================================================
// Mạch tư duy: gộp avatar + cover vào 1 route (phân biệt bằng field
// "type" trong form-data) thay vì tách 2 route riêng, vì logic xử lý
// (validate file, lưu disk, update 1 cột DB) giống hệt nhau — chỉ khác
// tên cột. Tách riêng sẽ trùng lặp gần như toàn bộ code.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { prepareUploadedImage, InvalidImageError } from "@/lib/storage/dbUpload";
import type { ApiResponse } from "@/types";

type PhotoType = "avatar" | "cover";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const type = formData.get("type") as PhotoType | null;

    if (!file) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu file trong form-data (key 'file')." },
        { status: 400 }
      );
    }
    if (type !== "avatar" && type !== "cover") {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu hoặc sai giá trị 'type' (phải là 'avatar' hoặc 'cover')." },
        { status: 400 }
      );
    }

    const { data, mimeType } = await prepareUploadedImage(file);

    // "v" là cache-buster (timestamp) — vì URL serve ảnh giờ CỐ ĐỊNH
    // theo userId (/api/profile/photo/avatar, không đổi tên file ngẫu
    // nhiên như path local cũ), nếu không có query param đổi mỗi lần
    // upload thì trình duyệt/CDN có thể cache ảnh cũ và không thấy
    // ảnh mới sau khi đổi avatar.
    const servedUrl = `/api/profile/photo/${type}?v=${Date.now()}`;

    const user = await prisma.user.update({
      where: { id: userId },
      data:
        type === "avatar"
          ? { image: servedUrl, avatarData: data, avatarMimeType: mimeType }
          : { coverImage: servedUrl, coverData: data, coverMimeType: mimeType },
      select: { image: true, coverImage: true },
    });

    return NextResponse.json<ApiResponse<{ image: string | null; coverImage: string | null }>>({
      success: true,
      data: user,
    });
  } catch (err) {
    console.error("[api/profile/photo] Lỗi:", err);

    // Lỗi do người dùng chọn sai file (quá lớn / sai định dạng) — trả
    // 400 với message rõ ràng để hiển thị thẳng ra UI, KHÔNG phải lỗi
    // server (500).
    if (err instanceof InvalidImageError) {
      return NextResponse.json<ApiResponse<never>>({ success: false, error: err.message }, { status: 400 });
    }

    return NextResponse.json<ApiResponse<never>>(
      {
        success: false,
        error: "Không thể tải ảnh lên, thử lại sau.",
        ...(process.env.NODE_ENV === "development" && {
          debug: err instanceof Error ? err.message : String(err),
        }),
      },
      { status: 500 }
    );
  }
}
