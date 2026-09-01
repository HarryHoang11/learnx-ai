// ================================================================
// <Sidebar /> — điều hướng chính, dùng chung cho mọi trang trong (app)
// ================================================================
// Mạch tư duy: "use client" bắt buộc vì cần usePathname() để biết
// đang ở trang nào và tô sáng đúng mục nav — việc này không thể làm
// ở Server Component. Danh sách nav khai báo dạng mảng (thay vì viết
// tay 6 thẻ <Link> lặp lại cấu trúc) để thêm/bớt mục chỉ cần sửa
// mảng, không phải sửa JSX.
// ================================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Trang chủ", icon: "⌂" },
  { href: "/diagnostic", label: "Kiểm tra năng lực", icon: "◈" },
  { href: "/tutor", label: "AI Gia sư", icon: "✺" },
  { href: "/roadmap", label: "Lộ trình học", icon: "⟿" },
  { href: "/progress", label: "Tiến độ", icon: "◐" },
  { href: "/library", label: "Thư viện", icon: "▤" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 230,
        flexShrink: 0,
        padding: "28px 16px",
        borderRight: "1px solid var(--border-soft)",
        display: "flex",
        flexDirection: "column",
        gap: 26,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 8px" }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: "linear-gradient(135deg, var(--indigo), var(--cyan))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-space-grotesk), sans-serif",
            fontWeight: 700,
            fontSize: 15,
            color: "#0a0e16",
          }}
        >
          X
        </div>
        <div style={{ fontFamily: "var(--font-space-grotesk), sans-serif", fontWeight: 600, fontSize: 17 }}>
          LearnX
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {NAV_ITEMS.map((item) => {
          const active = pathname?.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "9px 12px",
                borderRadius: 9,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
                color: active ? "var(--text)" : "var(--text-dim)",
                background: active ? "var(--panel-strong)" : "transparent",
                border: active ? "1px solid var(--border)" : "1px solid transparent",
              }}
            >
              <span style={{ width: 17, textAlign: "center", fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border-soft)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "var(--text-dim)",
            background: "var(--panel)",
            border: "1px solid var(--border-soft)",
            padding: "8px 10px",
            borderRadius: 10,
          }}
        >
          🔥 <span>Chuỗi ngày học</span>
        </div>
      </div>
    </aside>
  );
}
