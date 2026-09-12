// ================================================================
// <Sidebar /> — điều hướng chính, dùng chung cho mọi trang trong (app)
// ================================================================
// Mạch tư duy: "use client" bắt buộc vì cần usePathname() để biết
// đang ở trang nào và tô sáng đúng mục nav. Nav khai báo theo nhóm
// (Học tập / AI / Tiến độ / Cộng đồng / Tài nguyên / Tài khoản) để
// sidebar dài 13 mục vẫn scan nhanh — thêm/bớt mục chỉ cần sửa mảng
// NAV_GROUPS, không sửa JSX. Icon dùng lucide-react (ISC license,
// vector đồng nhất, không vỡ font như emoji/glyph ký tự).
// ================================================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  FlaskConical,
  Flame,
  Heart,
  Home,
  Library,
  Network,
  Route,
  Sparkles,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { I18nKey } from "@/lib/i18n/dictionary";

interface NavItem {
  href: string;
  labelKey: I18nKey;
  icon: LucideIcon;
}

interface NavGroup {
  titleKey: I18nKey;
  items: NavItem[];
}

// Chỉ gồm các route đã tồn tại — không đổi route vì lý do UI.
const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: "nav.groups.learn",
    items: [
      { href: "/dashboard", labelKey: "nav.dashboard", icon: Home },
      { href: "/calendar", labelKey: "nav.calendar", icon: CalendarDays },
      { href: "/roadmap", labelKey: "nav.roadmap", icon: Route },
      { href: "/practice", labelKey: "nav.practice", icon: FlaskConical },
    ],
  },
  {
    titleKey: "nav.groups.ai",
    items: [
      { href: "/diagnostic", labelKey: "nav.diagnostic", icon: Sparkles },
      { href: "/tutor", labelKey: "nav.tutor", icon: Bot },
    ],
  },
  {
    titleKey: "nav.groups.progress",
    items: [{ href: "/progress", labelKey: "nav.progress", icon: BarChart3 }],
  },
  {
    titleKey: "nav.groups.community",
    items: [
      { href: "/friends", labelKey: "nav.friends", icon: Heart },
      { href: "/leaderboard", labelKey: "nav.leaderboard", icon: Trophy },
      { href: "/community", labelKey: "nav.community", icon: Users },
    ],
  },
  {
    titleKey: "nav.groups.resources",
    items: [
      { href: "/library", labelKey: "nav.library", icon: Library },
      { href: "/resources", labelKey: "nav.resources", icon: BookOpen },
      { href: "/mindmap", labelKey: "nav.mindmap", icon: Network },
    ],
  },
  {
    titleKey: "nav.groups.account",
    items: [{ href: "/profile", labelKey: "nav.profile", icon: User }],
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
        <div className="sidebar-logo">X</div>
        <div style={{ fontFamily: "var(--font-space-grotesk), sans-serif", fontWeight: 600, fontSize: 17 }}>
          LearnX
        </div>
      </Link>

      <nav style={{ display: "flex", flexDirection: "column", gap: 14 }} aria-label="Menu học tập">
        {NAV_GROUPS.map((group) => (
          <div key={group.titleKey}>
            <div className="sidebar-group-title">{t(group.titleKey)}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {group.items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
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
