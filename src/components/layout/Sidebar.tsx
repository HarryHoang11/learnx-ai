// ================================================================
// <Sidebar /> — điều hướng chính, dùng chung cho mọi trang trong (app)
// ================================================================
// Mạch tư duy: "use client" bắt buộc vì cần usePathname() để biết
// đang ở trang nào và tô sáng đúng mục nav. Nav khai báo theo nhóm
// (Học tập / AI / Tiến độ / Cộng đồng / Tài nguyên / Tài khoản) để
// sidebar dài 13 mục vẫn scan nhanh — thêm/bớt mục chỉ cần sửa mảng
// NAV_GROUPS trong ./navGroups (dùng chung với thanh nav mobile),
// không sửa JSX. Icon dùng lucide-react (ISC license, vector đồng
// nhất, không vỡ font như emoji/glyph ký tự).
// ================================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import LearnXLogo from "@/components/brand/LearnXLogo";
import { isActiveRoute } from "@/lib/nav/activeRoute";
import { NAV_GROUPS } from "./navGroups";

// Dữ liệu các route (NAV_GROUPS) đã tách sang ./navGroups để MobileBottomNav
// dùng CHUNG — thêm route mới chỉ sửa 1 file. Ở đây Sidebar chỉ vẽ cột + tô sáng.

interface SidebarProps {
  // Mobile: sidebar là drawer overlay, cần biết đang mở/đóng và cách
  // đóng lại (bấm 1 mục nav xong nên tự đóng).
  open?: boolean;
  onNavigate?: () => void;
}

export default function Sidebar({ open = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { t } = useLanguage();

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
        {/* Logo + chữ "LearnX" — giữ nguyên nhận diện thương hiệu như trước,
            chỉ thay phần "ô X" bằng brand mark thật. */}
        <LearnXLogo size="sm" decorative />
      </Link>

      <nav style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-label="Menu học tập">
        {NAV_GROUPS.map((group) => (
          <div key={group.titleKey}>
            <div className="sidebar-group-title">{t(group.titleKey)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {group.items.map((item) => {
                const active = isActiveRoute(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={`sidebar-link${active ? " sidebar-link--active" : ""}`}
                  >
                    <Icon size={16} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
                    {t(item.labelKey)}
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
          <Flame size={15} aria-hidden="true" /> <span>{t("nav.streak")}</span>
        </div>
      </div>
    </aside>
  );
}
