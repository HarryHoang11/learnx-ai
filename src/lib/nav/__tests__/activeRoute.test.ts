// Test cho quy tắc tô sáng mục nav — dùng chung bởi Sidebar (desktop) và
// MobileBottomNav (mobile). Sai ở đây thì cả 2 nơi cùng tô sai trạng thái
// "đang ở trang nào", nên đây là hàm thuần dễ test.
import { describe, expect, it } from "vitest";
import { isActiveRoute } from "../activeRoute";

describe("isActiveRoute", () => {
  it("khớp khi pathname bằng đúng href", () => {
    expect(isActiveRoute("/dashboard", "/dashboard")).toBe(true);
    expect(isActiveRoute("/mindmap", "/mindmap")).toBe(true);
  });

  it("khớp với route con (trang chi tiết) của mục nav", () => {
    expect(isActiveRoute("/community/documents/abc", "/community")).toBe(true);
    expect(isActiveRoute("/mindmap/9f2", "/mindmap")).toBe(true);
  });

  it("KHÔNG khớp route chỉ có tiền tố giống (prefix trap)", () => {
    // "/mindmaps" khác "/mindmap" — so sánh chuỗi thô sẽ tô sáng nhầm.
    expect(isActiveRoute("/mindmaps", "/mindmap")).toBe(false);
    expect(isActiveRoute("/profilex", "/profile")).toBe(false);
  });

  it("mục gốc chỉ khớp đúng / chứ không nuốt mọi trang", () => {
    expect(isActiveRoute("/", "/")).toBe(true);
    expect(isActiveRoute("/dashboard", "/")).toBe(false);
  });

  it("bỏ qua dấu / cuối ở cả pathname và href", () => {
    expect(isActiveRoute("/tutor/", "/tutor")).toBe(true);
    expect(isActiveRoute("/tutor", "/tutor/")).toBe(true);
  });

  it("trả về false khi chưa có pathname (SSR / usePathname null)", () => {
    expect(isActiveRoute(null, "/dashboard")).toBe(false);
    expect(isActiveRoute(undefined, "/dashboard")).toBe(false);
  });
});
