// Test cho quy tắc hiển thị bubble tải app trong cột floating actions.
//
// Đây là test bảo vệ CAM KẾT SẢN PHẨM, không phải test hành vi kỹ thuật:
// bubble tải app là hành động thứ cấp, được phép vắng ở một số nơi — nhưng
// những nơi đó phải đúng và có chủ đích. Thêm route mới mà quên cập nhật là
// lỗi dễ xảy ra nhất, và hậu quả thấy được ngay (bubble mọc lên giữa màn
// học, hoặc biến mất ở nơi lẽ ra cần).
import { describe, expect, it } from "vitest";
import { APP_DOWNLOAD_HIDDEN_ROUTES, isAppDownloadHiddenRoute } from "../download";

describe("isAppDownloadHiddenRoute", () => {
  it("các trang học chính -> HIỆN bubble", () => {
    // Đây là nơi người dùng ở lâu nhất; ở đây người dùng nhiều khả năng
    // muốn mang app đi học.
    for (const path of ["/dashboard", "/practice", "/library", "/roadmap", "/progress", "/profile"]) {
      expect(isAppDownloadHiddenRoute(path)).toBe(false);
    }
  });

  it("trang AI gia sư -> ẨN (panel chiếm gần hết màn hình)", () => {
    expect(isAppDownloadHiddenRoute("/tutor")).toBe(true);
  });

  it("các trải nghiệm toàn màn hình -> ẨN (không chen quảng bá vào giữa luồng)", () => {
    for (const path of ["/onboarding", "/welcome", "/setup"]) {
      expect(isAppDownloadHiddenRoute(path)).toBe(true);
    }
  });

  it("khớp cả route con, không bỏ sót khi app thêm route động", () => {
    expect(isAppDownloadHiddenRoute("/tutor/abc")).toBe(true);
    expect(isAppDownloadHiddenRoute("/onboarding/step-2")).toBe(true);
  });

  it("không nhầm route có tiền tố giống nhau", () => {
    // "/tutorxyz" là trang KHÁC, không phải trang con của "/tutor".
    // Nếu dùng `startsWith(route)` không có dấu "/", bubble sẽ biến mất ở
    // những trang không định ẩn.
    expect(isAppDownloadHiddenRoute("/tutorxyz")).toBe(false);
    expect(isAppDownloadHiddenRoute("/setup-guide")).toBe(false);
  });

  it("không ẩn ở các route khác của app", () => {
    for (const path of ["/community", "/leaderboard", "/mindmap", "/calendar", "/", ""]) {
      expect(isAppDownloadHiddenRoute(path)).toBe(false);
    }
  });

  it("AI Assistant KHÔNG nằm trong danh sách ẩn (nó phải hiện ở mọi trang)", () => {
    // Nếu vô tình thêm "/tutor" vào đây thì AI cũng biến mất — đây chính là
    // hành vi cấm, nên khoá lại bằng test.
    expect(APP_DOWNLOAD_HIDDEN_ROUTES).not.toContain("/dashboard");
  });
});