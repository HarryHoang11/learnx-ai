// ================================================================
// <Sidebar /> — điều hướng chính, dùng chung cho mọi trang trong (app)
// ================================================================
// Mạch tư duy: "use client" bắt buộc vì cần usePathname() để biết
// đang ở trang nào và tô sáng đúng mục nav. Nav khai báo theo nhóm
// (LEARN / AI / PROGRESS / COMMUNITY / RESOURCES / ACCOUNT) để
// sidebar dài 13 mục vẫn scan nhanh — thêm/bớt mục chỉ cần sửa mảng
// NAV_GROUPS, không sửa JSX.
// ================================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

// Chỉ gồm các route đã tồn tại — không đổi route vì lý do UI.
const NAV_GROUPS: NavGroup[] = [
  {
    title: "Học tập",
    items: [
      { href: "/dashboard", label: "Trang chủ", icon: "⌂" },
      { href: "/calendar", label: "Lịch học", icon: "🗓" },
      { href: "/roadmap", label: "Lộ trình học", icon: "⟿" },
      { href: "/practice", label: "Luyện tập", icon: "🧪" },
    ],
  },
  {
    title: "AI",
    items: [
      { href: "/diagnostic", label: "Kiểm tra năng lực", icon: "◈" },
      { href: "/tutor", label: "AI Gia sư", icon: "✺" },
    ],
  },
  {
    title: "Tiến độ",
    items: [{ href: "/progress", label: "Tiến độ", icon: "◐" }],
  },
  {
    title: "Cộng đồng",
    items: [
      { href: "/friends", label: "Bạn bè", icon: "♥" },
      { href: "/leaderboard", label: "Bảng xếp hạng", icon: "🏆" },
      { href: "/community", label: "Cộng đồng", icon: "👥" },
    ],
  },
  {
    title: "Tài nguyên",
    items: [
      { href: "/library", label: "Thư viện", icon: "▤" },
      { href: "/resources", label: "Tài liệu học", icon: "📚" },
    ],
  },
  {
    title: "Tài khoản",
    items: [{ href: "/profile", label: "Trang cá nhân", icon: "◎" }],
  },
];

interface SidebarProps {
  // Mobile: sidebar là drawer overlay, cần biết đang mở/đóng và cách
  // đóng lại (bấm 1 mục nav xong nên tự đóng).
  open?: boolean;
  onNavigate?: () => void;
}

export default function Sidebar({ open = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={`sidebar ${open ? "sidebar--open" : ""}`} aria-label="Điều hướng chính">
      <Link
        href="/"
        onClick={onNavigate}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 8px",
          textDecoration: "none",
          color: "inherit",
          cursor: "pointer",
        }}
      >
        <div className="sidebar-logo">X</div>
        <div style={{ fontFamily: "var(--font-space-grotesk), sans-serif", fontWeight: 600, fontSize: 17 }}>
          LearnX
        </div>
      </Link>

      <nav style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-label="Menu học tập">
        {NAV_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="sidebar-group-title">{group.title}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {group.items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`sidebar-link${active ? " sidebar-link--active" : ""}`}
                  >
                    <span style={{ width: 17, textAlign: "center", fontSize: 15 }} aria-hidden="true">
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
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
