// ================================================================
// <AppShell /> — bọc Sidebar + Topbar + nội dung, giữ state
// "mobileNavOpen" cho drawer nav trên mobile.
// ================================================================
// Mạch tư duy: Sidebar và Topbar là 2 component ANH EM (siblings)
// trong layout — nút hamburger nằm ở Topbar nhưng phải điều khiển
// Sidebar, nên state "đang mở drawer hay không" phải nằm ở component
// CHA của cả hai (ở đây), không thể nằm trong chính Sidebar hay
// Topbar. Đây là lý do (app)/layout.tsx (Server Component) không giữ
// được state này trực tiếp — phải tách ra 1 Client Component riêng.
// ================================================================

"use client";

import { useState, useEffect, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import MobileBottomNav from "./MobileBottomNav";
import FloatingActions from "./FloatingActions";

export default function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Trên màn hình hẹp, điều hướng chính đã chuyển sang MobileBottomNav +
  // sheet "Thêm" (xem globals.css @media 880px) — Sidebar chỉ còn vai trò cột
  // bên trên desktop. Drawer + nút hamburger vẫn được giữ nguyên: đó là
  // đường vào "toàn bộ menu" dạng danh sách, hữu ích khi người dùng muốn
  // quét tìm nhanh một mục thay vì bấm Thêm. Ở desktop nút này vẫn ẩn.

  // Khóa body scroll trên mobile khi mở drawer và đóng bằng phím ESC
  useEffect(() => {
    if (!mobileNavOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileNavOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileNavOpen]);

  return (
    <div className="app-shell">
      <Sidebar open={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />

      {/* Overlay mờ phía sau drawer trên mobile — bấm vào để đóng lại,
          giống UX modal/drawer chuẩn. Chỉ hiển thị khi mobileNavOpen
          (điều khiển bằng class, xem globals.css ".sidebar-overlay"). */}
      {mobileNavOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <main className="main-content">
        <Topbar onMenuClick={() => setMobileNavOpen((v) => !v)} />
        {children}
      </main>

      {/* Cột nút nổi góc phải dưới: App Download bubble (thứ cấp) + AI
          Assistant (chính). Vị trí do `.floating-actions` trong globals.css
          quản lý — cả cục dùng MỞT z-index nên 2 nút không thể đè nhau.

          `position: fixed` nên đặt ở tầng AppShell (áp dụng mọi trang trong
          route group (app)) thay vì lặp lại trong từng page.

          MobileBottomNav nằm cùng tầng: trên desktop nó bị ẩn hoàn toàn
          bằng CSS, trên mobile là thanh điều hướng dưới cùng — CSS của
          `.floating-actions` đã nhấc cột nổi lên trên thanh đó. */}
      <FloatingActions />
      <MobileBottomNav />
    </div>
  );
}