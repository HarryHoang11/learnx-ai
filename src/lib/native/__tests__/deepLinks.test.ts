// Test cho parseDeepLink — hàm thuần, không cần app/native.
//
// Vì sao cần test riêng: deep link là ĐẦU VÀO TỪ BÊN NGOÀI (người khác
// gửi link vào app). Một lỗi ở đây không chỉ hỏng điều hướng mà còn mở
// đường để điều khiển app — nên các ca định hướng ra ngoài phải bị chặn.
import { describe, expect, it } from "vitest";
import { parseDeepLink } from "../deepLinks";

describe("parseDeepLink", () => {
  it("chuyển host + path thành đường dẫn web", () => {
    // Với scheme tùy biến, phần đầu sau // là HOST chứ không phải path —
    // đây là chỗ dễ viết sai nhất, nên test đúng từng dạng link thật.
    expect(parseDeepLink("learnx://roadmap/123")).toBe("/roadmap/123");
    expect(parseDeepLink("learnx://mindmap/abc")).toBe("/mindmap/abc");
    expect(parseDeepLink("learnx://profile")).toBe("/profile");
  });

  it("bỏ query/fragment — điều hướng nội bộ không cần chúng", () => {
    expect(parseDeepLink("learnx://tutor/7?tab=latex#msg")).toBe("/tutor/7");
  });

  it("URL scheme KHÁC thì bỏ qua, không điều hướng nhầm", () => {
    expect(parseDeepLink("https://learnx.ai/roadmap/123")).toBeNull();
    expect(parseDeepLink("http://localhost:3000/")).toBeNull();
  });

  it("URL hỏng không làm crash app", () => {
    expect(parseDeepLink("không phải url")).toBeNull();
    expect(parseDeepLink("")).toBeNull();
  });

  it("KHÔNG bao giờ trả về URL thoát ra ngoài app (open redirect)", () => {
    // `new URL("learnx:////evil.com")` cho hostname="" và pathname="//evil.com".
    // Nếu ghép thẳng pathname vào, ta được "//evil.com" và
    // location.assign sẽ hiểu là protocol-relative → mở sang evil.com.
    // Hàm cắt sạch dấu "/" đầu nên chỉ còn đường dẫn nội bộ (404).
    expect(parseDeepLink("learnx:////evil.com")).toBe("/evil.com");
    // Bất kể host/path có gì, kết quả LUÔN bắt đầu đúng MỘT dấu "/".
    for (const url of ["learnx:////evil.com", "learnx://a//b", "learnx://x"]) {
      const parsed = parseDeepLink(url);
      expect(parsed === null || (parsed.startsWith("/") && !parsed.startsWith("//"))).toBe(true);
    }
    // ".." bị new URL chuẩn hoá mất, nên kết quả vẫn là đường dẫn nội bộ
    // chứ không phải null (điều kiện `includes("..")` cũ là code chết).
    expect(parseDeepLink("learnx://x/../../etc/passwd")).toBe("/x/etc/passwd");
  });
});
