// ================================================================
// REWARD SYSTEM — kiểu cosmetic
// ================================================================
// Mạch tư duy: Prisma đã có `Reward` + `UserReward` (xem prisma/schema.prisma)
// nhưng `RewardType` chỉ có DIGITAL / LEARNING / REAL_WORLD / MILESTONE —
// không có nghĩa "trang trí cá nhân". Ta MỞ RỘNG enum, KHÔNG tạo bảng mới,
// để dữ liệu Reward cũ (nếu có) không bị đụng.
//
// Vì sao cần phân loại: `PET` / `AVATAR_FRAME` / `PROFILE_EFFECT` chỉ hiện ở
// 1 nơi (trang bị), còn `CHAT_STICKER` / `CHAT_GIF` dùng được ở nhiều nơi và
// có quy tắc khác. Gộp chung sẽ không biết kiểm tra quyền gì khi render.
//
// QUY TẮC BẤT BIẾN (spec §20): cosmetic CHỈ trang trí/biểu đạt. Không được
// cộng điểm, mở đáp án, hay tạo bất kỳ lợi thế học thuật nào.

/** Loại cosmetic — mở rộng từ enum Prisma `RewardType`. */
export type CosmeticType =
  | "PET"
  | "AVATAR_FRAME"
  | "PROFILE_EFFECT"
  | "CHAT_STICKER"
  | "CHAT_GIF"
  | "BADGE";

/**
 * Loại nào được trang bị trên hồ sơ (mỗi loại tối đa 1 cái đang mặc).
 * `CHAT_STICKER`/`CHAT_GIF` KHÔNG trang bị — chúng dùng kèm trong comment.
 */
export const EQUIPPABLE_TYPES: readonly CosmeticType[] = [
  "PET",
  "AVATAR_FRAME",
  "PROFILE_EFFECT",
  "BADGE",
];

const COSMETIC_TYPES: readonly CosmeticType[] = [
  "PET",
  "AVATAR_FRAME",
  "PROFILE_EFFECT",
  "CHAT_STICKER",
  "CHAT_GIF",
  "BADGE",
];

/** `true` nếu chuỗi (thường từ Prisma enum) là 1 loại cosmetic hợp lệ. */
export function isCosmeticType(value: string): value is CosmeticType {
  return COSMETIC_TYPES.includes(value as CosmeticType);
}

/** `true` nếu loại này được phép trang bị lên hồ sơ. */
export function isEquippable(value: string): value is CosmeticType {
  return isCosmeticType(value) && EQUIPPABLE_TYPES.includes(value as CosmeticType);
}

/** Loại nào được phép chọn khi viết bình luận. */
export function isCommentUsable(value: string): boolean {
  return value === "CHAT_STICKER" || value === "CHAT_GIF" || value === "BADGE";
}

/**
 * Asset của 1 cosmetic, lấy từ `Reward.metadata` (cột `Json?` có sẵn).
 *
 * Vì sao để trong `metadata` thay vì cột riêng: cosmetic có nhiều hình thức
 * (SVG tĩnh, Lottie, GIF) khác nhau theo từng loại; tách cột cho từng loại sẽ
 * phình schema vô nghĩa. `metadata` đã có sẵn và là nơi đúng để chứa thông tin
 * chỉ áp dụng cho cosmetic.
 */
export interface CosmeticMetadata {
  /** Đường dẫn asset chính (SVG/PNG/GIF). */
  assetUrl?: string;
  /** Asset dùng cho lưới nhỏ — nếu thiếu thì UI tự fallback về `assetUrl`. */
  previewUrl?: string;
  /** JSON Lottie (nội dung file `.json`), nếu loại đó dùng Lottie. */
  lottie?: string;
  /** Kích thước hiển thị (px) để layout không nhảy trước khi asset tải. */
  width?: number;
  height?: number;
  /** Màu aura dùng cho `PROFILE_EFFECT`. */
  auraColor?: string;
}

/** Đọc `metadata` an toàn — DB trả `Json | null`, không ép kiểu mù. */
export function parseCosmeticMetadata(raw: unknown): CosmeticMetadata {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as CosmeticMetadata;
}

/** Asset dùng để hiển thị: ưu tiên preview, thiếu thì dùng asset chính. */
export function displayAsset(meta: CosmeticMetadata): string | null {
  return meta.previewUrl ?? meta.assetUrl ?? null;
}