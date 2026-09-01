// ================================================================
// LAYOUT CHO ROUTE GROUP (app)
// ================================================================
// Mạch tư duy: dấu ngoặc (app) là "route group" của Next.js — không
// xuất hiện trong URL (vd /dashboard, KHÔNG phải /app/dashboard) mà
// chỉ dùng để nhóm các trang CẦN chung 1 khung Sidebar+Topbar, tách
// khỏi layout gốc (root layout chỉ nạp font/CSS, không có Sidebar).
// Nhờ vậy, sau này nếu thêm trang KHÔNG cần sidebar (vd trang đăng
// nhập), chỉ cần đặt ngoài group (app) mà không đụng tới layout này.
// ================================================================

import type { ReactNode } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <Topbar />
        {children}
      </main>
    </div>
  );
}
