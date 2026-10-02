// ================================================================
// TEST — resolveAvatarUrl (nguồn chuẩn hoá duy nhất cho avatar)
// ================================================================
// VÌ SAO CÓ FILE NÀY:
//   Bug thật: header/AI button hiện initials ("HỌ") dù user ĐÃ tải ảnh lên.
//   Nguyên nhân: UI đọc thẳng `session.user.image`, nhưng callback `session`
//   của Auth.js không nạp field đó từ DB, và ảnh do user tự tải nằm ở
//   `User.avatarData` (Bytes) chứ không phải `User.image`.
//   Sửa JSX sai thì test này vẫn xanh — phải khoá logic ở đây.
import { describe, expect, it } from "vitest";
import { AVATAR_ROUTE, resolveAvatarUrl } from "@/lib/auth/avatarUrl";

describe("resolveAvatarUrl", () => {
  it("có session.image (Google) → dùng URL ngoài, KHÔNG ép route nội bộ", () => {
    expect(resolveAvatarUrl("https://lh3.googleusercontent.com/a/xyz")).toBe(
      "https://lh3.googleusercontent.com/a/xyz"
    );
  });

  it("không có image → trỏ route nội bộ đọc avatarData trong DB", () => {
    // Đây là fix chính: trước đây trả undefined ⇒ Avatar fallback initials.
    expect(resolveAvatarUrl(null)).toBe(AVATAR_ROUTE);
    expect(resolveAvatarUrl(undefined)).toBe(AVATAR_ROUTE);
    expect(resolveAvatarUrl("")).toBe(AVATAR_ROUTE);
    expect(resolveAvatarUrl("   ")).toBe(AVATAR_ROUTE);
  });

  it("có version → thêm cache-buster để đổi ảnh là URL mới", () => {
    expect(resolveAvatarUrl(null, 1712345678)).toBe(`${AVATAR_ROUTE}?v=1712345678`);
    // Đổi ảnh phải cho URL khác, nếu không trình duyệt giữ ảnh cũ.
    expect(resolveAvatarUrl(null, 1)).not.toBe(resolveAvatarUrl(null, 2));
  });

  it("version rỗng / 0 vẫn hợp lệ, không sinh '?v=' trống", () => {
    expect(resolveAvatarUrl(null, 0)).toBe(`${AVATAR_ROUTE}?v=0`);
    expect(resolveAvatarUrl(null, "")).toBe(AVATAR_ROUTE);
  });

  it("URL ngoài + version → giữ URL ngoài (cache-buster chỉ dành cho route nội bộ)", () => {
    expect(resolveAvatarUrl("https://example.com/a.png", 5)).toBe(
      "https://example.com/a.png"
    );
  });

  it("luôn trả URL hợp lệ — không bao giờ null (route tự 404, Avatar fallback)", () => {
    // `null` ở đây sẽ khiến Avatar hiện initials ngay, tức là quay lại bug
    // cũ cho user CHƯA tải ảnh; còn để route trả 404 thì `onError` bắt được
    // sau khi đã thử — hành vi nhất quán ở cả 2 nhóm user.
    expect(resolveAvatarUrl(null)).not.toBeNull();
    expect(resolveAvatarUrl("")).not.toBeNull();
  });
});
