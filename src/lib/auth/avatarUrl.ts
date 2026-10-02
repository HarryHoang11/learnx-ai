// ================================================================
// NGUỒN SỰ THẬT DUY NHẤT cho URL avatar
// ================================================================
// Mạch tư duy: LearnX lưu ảnh đại diện ở HAI nơi KHÁC NHAU:
//
//   1. `User.image` (String?)    → URL ẢNH NGOÀI (Google OAuth), hoặc
//                                   đường dẫn local cũ.
//   2. `User.avatarData` (Bytes) → ảnh user TỰ TẢI LÊN, nằm trong DB.
//
// Bản cũ ở Topbar/AccountMenu/FloatingAIButton chỉ đọc `session.user.image`,
// mà callback `session` của Auth.js **không** nạp field này từ DB (xem
// `src/auth.ts`). Với tài khoản đăng ký bằng email, `image` luôn `undefined`
// ⇒ `<Avatar src={undefined}>` ⇒ hiện initials ("HỌ") dù user ĐÃ tải ảnh.
//
// Cách sửa ĐÚNG ở đây, không phải vá từng file:
//   - Ưu tiên `image` nếu có (Google/external — CDN tự cache).
//   - Không có thì trỏ thẳng `/api/profile/photo/avatar`: route đó tự đọc
//     `avatarData` trong DB và PHỤC VỤ ẢNH (app không cần biết URL nào làm
//     gì). Route đã có ETag/304 nên không tốn băng thông khi ảnh không đổi.
//   - `?v=` cache-buster: đổi ảnh là URL mới ⇒ cache cũ bị bỏ qua ngay.
//
// Nếu user chưa có ảnh nào, route trả 404 ⇒ `Avatar` bắt `onError` và quay về
// initials (xem `src/components/ui/Avatar.tsx`). KHÔNG cần đưa cờ `hasAvatar`
// vào session — thêm vào sẽ lại tạo 1 nguồn sự thật phải đồng bộ.

/** Route phục vụ ảnh đại diện đọc thẳng từ DB. */
export const AVATAR_ROUTE = "/api/profile/photo/avatar";

/**
 * Chuẩn hoá nguồn avatar về MỘT giá trị `src` cho `<Avatar>`.
 *
 * @param sessionImage `session.user.image` (URL ngoài nếu đăng nhập Google).
 * @param version      Bump khi user vừa đổi ảnh (timestamp) để phá cache.
 * @returns URL ảnh; luôn trả về URL (kể cả khi chưa chắc có ảnh) vì route
 *          sẽ tự trả 404 và `Avatar` fallback sang initials.
 */
export function resolveAvatarUrl(
  sessionImage?: string | null,
  version?: string | number | null
): string | null {
  const external = typeof sessionImage === "string" ? sessionImage.trim() : "";
  if (external) return external;

  const v = version === null || version === undefined ? "" : String(version);
  return v ? `${AVATAR_ROUTE}?v=${encodeURIComponent(v)}` : AVATAR_ROUTE;
}

/** Tên hiển thị ưu tiên nickname, sau đó tới name, cuối cùng email. */
export function resolveDisplayName(user?: {
  name?: string | null;
  nickname?: string | null;
  email?: string | null;
}): string {
  return user?.nickname?.trim() || user?.name?.trim() || user?.email?.trim() || "";
}