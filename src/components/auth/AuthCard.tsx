// ================================================================
// <AuthCard /> — khung chung cho trang Login/Register
// ================================================================
// Mạch tư duy: 2 trang Login/Register có bố cục giống hệt nhau (card
// giữa màn hình, logo, tiêu đề, nội dung form) — tách thành 1 wrapper
// để không copy-paste phần khung, chỉ khác phần form bên trong.
// ================================================================

import type { ReactNode } from "react";

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
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 28 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "linear-gradient(135deg, var(--indigo), var(--cyan))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "var(--font-space-grotesk), sans-serif",
              fontWeight: 700,
              fontSize: 17,
              color: "#0a0e16",
            }}
          >
            X
          </div>
          <div style={{ fontFamily: "var(--font-space-grotesk), sans-serif", fontWeight: 600, fontSize: 19 }}>
            LearnX
          </div>
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
