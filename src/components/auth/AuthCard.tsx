// ================================================================
// <AuthCard /> — khung chung cho trang Login/Register
// ================================================================
// Mạch tư duy: 2 trang Login/Register có bố cục giống hệt nhau (card
// giữa màn hình, logo, tiêu đề, nội dung form) — tách thành 1 wrapper
// để không copy-paste phần khung, chỉ khác phần form bên trong.
// ================================================================

import type { ReactNode } from "react";
import LearnXLogo from "@/components/brand/LearnXLogo";

export default function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Logo chính thức: dùng LearnXLogo (cùng asset với sidebar, welcome,
            favicon) thay vì ô gradient + chữ "X" tự dựng ở đây. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 28,
          }}
        >
          <LearnXLogo size="lg" />
        </div>

        <div className="panel" style={{ padding: "30px 28px" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, textAlign: "center" }}>{title}</h1>
          <p style={{ fontSize: 13.5, color: "var(--text-dim)", textAlign: "center", marginTop: 6, marginBottom: 24 }}>
            {subtitle}
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}
