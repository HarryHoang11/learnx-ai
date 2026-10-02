import { describe, it, expect } from "vitest";
import { resolvePublicUrl, PUBLIC_URL_ENV_NAMES } from "../app";

// ================================================================
// Regression test cho lỗi "toàn bộ /api/auth/* trả 503".
//
// Lỗi gốc: `auth.ts` đọc `AUTH_URL`/`NEXTAUTH_URL` còn `layout.tsx` đọc
// `APP_URL`/`NEXTAUTH_URL`. Project đặt `APP_URL` ⇒ `publicAuthUrl` =
// undefined ⇒ `trustHost = false` ⇒ session/providers/csrf đều 503 TRONG
// KHI phần còn lại của app vẫn chạy (rất khó chẩn đoán). Test này ghim
// lại hành vi đúng để lần refactor sau không tái tạo.
// ================================================================

describe("resolvePublicUrl", () => {
  it("đọc được APP_URL — biến duy nhất project này đặt (trường hợp gây lỗi 503)", () => {
    expect(resolvePublicUrl({ APP_URL: "https://learnx.example.com" })).toBe(
      "https://learnx.example.com"
    );
  });

  it("bỏ qua biến rỗng / toàn khoảng trắng", () => {
    expect(resolvePublicUrl({ AUTH_URL: "", NEXTAUTH_URL: "   ", APP_URL: "https://a.dev" })).toBe(
      "https://a.dev"
    );
  });

  it("bỏ qua biến SAI ĐỊNH DẠNG rồi thử biến kế tiếp, không dừng ở biến hỏng", () => {
    // Nếu dừng ở biến hỏng đầu tiên thì sẽ trả null và tái tạo đúng lỗi gốc.
    expect(resolvePublicUrl({ AUTH_URL: "không-phải-url", APP_URL: "https://b.dev" })).toBe(
      "https://b.dev"
    );
  });

  it("tôn trọng thứ tự ưu tiên của danh sách biến", () => {
    expect(
      resolvePublicUrl({ AUTH_URL: "https://auth.dev", NEXTAUTH_URL: "https://n.dev", APP_URL: "https://app.dev" })
    ).toBe("https://auth.dev");
    expect(resolvePublicUrl({ NEXTAUTH_URL: "https://n.dev", APP_URL: "https://app.dev" })).toBe(
      "https://n.dev"
    );
  });

  it("chỉ nhận http/https, từ chối scheme khác (vd javascript:)", () => {
    expect(resolvePublicUrl({ APP_URL: "javascript:alert(1)" })).toBeNull();
  });

  it("trả null khi không có biến nào — caller phải tự fallback", () => {
    expect(resolvePublicUrl({})).toBeNull();
  });

  it("trim khoảng trắng thừa quanh URL", () => {
    expect(resolvePublicUrl({ APP_URL: "  https://c.dev  " })).toBe("https://c.dev");
  });

  it("AUTH_URL vẫn được ưu tiên như trước (không phá hành vi cũ)", () => {
    expect(PUBLIC_URL_ENV_NAMES[0]).toBe("AUTH_URL");
    expect([...PUBLIC_URL_ENV_NAMES]).toContain("APP_URL");
  });
});