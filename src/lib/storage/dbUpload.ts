// ================================================================
// CHUẨN BỊ ẢNH UPLOAD ĐỂ LƯU THẲNG VÀO POSTGRES (KHÔNG GHI LOCAL DISK)
// ================================================================
// Mạch tư duy: thay thế hoàn toàn cho lib/storage/localUpload.ts cũ
// (ghi file vào public/uploads/...). File local KHÔNG persistent giữa
// các lần deploy/scale và không đáp ứng yêu cầu "ảnh phải nằm trong
// DB". Hàm ở đây CHỈ validate + trả về Buffer thô cùng mimeType —
// việc ghi vào cột avatarData/coverData (Bytes) do route gọi
// (api/profile/photo/route.ts) đảm nhiệm, để lib này không phụ thuộc
// Prisma/DB, giữ đúng trách nhiệm (validate + đọc file).
// ================================================================

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

export interface PreparedImage {
  data: Buffer;
  mimeType: string;
}

/**
 * Validate 1 file ảnh (từ FormData) và đọc thành Buffer để lưu thẳng
 * vào cột Bytes trong Postgres (avatarData/coverData). KHÔNG ghi bất
 * kỳ file nào ra disk — đây là điểm khác biệt duy nhất so với hàm
 * saveUploadedImage() cũ, phần còn lại (rule validate MIME/size) giữ
 * nguyên để không đổi behavior người dùng thấy được (thông báo lỗi,
 * giới hạn dung lượng...).
 */
export async function prepareUploadedImage(file: File): Promise<PreparedImage> {
  if (!(file.type in ALLOWED_MIME_TO_EXT)) {
    throw new InvalidImageError("Chỉ chấp nhận ảnh định dạng PNG, JPG hoặc WEBP.");
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new InvalidImageError("Ảnh vượt quá dung lượng cho phép (tối đa 5MB).");
  }

  const data = Buffer.from(await file.arrayBuffer());
  return { data, mimeType: file.type };
}
