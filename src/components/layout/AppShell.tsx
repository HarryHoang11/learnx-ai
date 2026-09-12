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
import FloatingAIButton from "@/components/tutor/FloatingAIButton";

export default function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

      {/* position: fixed nên đặt ở tầng AppShell (áp dụng mọi trang
          trong route group (app)) thay vì lặp lại trong từng page. */}
      <FloatingAIButton />
    </div>
  );
}