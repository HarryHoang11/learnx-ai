// ================================================================
// LƯU ẢNH UPLOAD VÀO LOCAL DISK (public/uploads/...)
// ================================================================
// Mạch tư duy: project chưa cấu hình cloud storage thật (Supabase
// Storage / S3 — xem .env, STORAGE_BUCKET_URL đang để trống cho MVP).
// Next.js tự động serve bất kỳ file nào nằm trong thư mục `public/`
// tại đúng path tương ứng (vd public/uploads/avatars/a.png ->
// http://localhost:3000/uploads/avatars/a.png), nên với MVP chạy local
// đây là cách đơn giản nhất, không cần thêm dependency hay tài khoản
// cloud nào. Khi lên production thật (nhiều server/serverless), cần
// thay hàm này bằng upload lên S3/Supabase Storage vì disk local
// KHÔNG persistent giữa các lần deploy/scale — đã ghi rõ TODO bên dưới.
// ================================================================

import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — đủ cho avatar/cover ảnh nén

export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidImageError";
  }
}

/**
 * Lưu 1 file ảnh (từ FormData) vào public/uploads/{subfolder}/ với tên
 * file ngẫu nhiên (tránh trùng + tránh lộ tên file gốc). Trả về path
 * public (bắt đầu bằng "/uploads/...") để lưu thẳng vào cột DB kiểu
 * String và render trực tiếp bằng <img src={path}>.
 *
 * TODO (production): thay thân hàm này bằng upload lên S3/Supabase
 * Storage rồi trả về URL đầy đủ (https://...) thay vì path local —
 * signature hàm (nhận File, trả string) giữ nguyên nên chỗ gọi
 * (api/profile/photo/route.ts) KHÔNG cần sửa gì khi migrate.
 */
export async function saveUploadedImage(file: File, subfolder: "avatars" | "covers"): Promise<string> {
  if (!(file.type in ALLOWED_MIME_TO_EXT)) {
    throw new InvalidImageError("Chỉ chấp nhận ảnh định dạng PNG, JPG hoặc WEBP.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new InvalidImageError("Ảnh vượt quá dung lượng cho phép (tối đa 5MB).");
  }

  const ext = ALLOWED_MIME_TO_EXT[file.type];
  const fileName = `${crypto.randomUUID()}.${ext}`;

  const uploadDir = path.join(process.cwd(), "public", "uploads", subfolder);
  // recursive: true để tự tạo cả public/uploads lẫn public/uploads/avatars
  // nếu chưa tồn tại — tránh lỗi ENOENT ở lần chạy đầu tiên.
  await mkdir(uploadDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, fileName), buffer);

  return `/uploads/${subfolder}/${fileName}`;
}