// ================================================================
// NAV DATA — nguồn sự thật DUY NHẤT cho danh sách mục điều hướng.
// ================================================================
// Mạch tư duy: trước đây NAV_GROUPS nằm riêng trong Sidebar.tsx. Khi thêm
// thanh nav dưới cho mobile (MobileBottomNav) + sheet "Thêm", cả 3 nơi
// phải liệt kê CÙNG một danh sách route — để copy-paste sẽ chắc chắn lệch
// sau này (thêm route mới chỉ nhớ sửa 1 chỗ). Tách ra module dữ liệu
// thuần, không phụ thuộc React: Sidebar import để vẽ cột, MobileBottomNav
// import để vẽ tab + sheet. Thêm route = sửa đúng 1 file này.
//
// Icon dùng lucide (vector) như Sidebar: emoji/glyph ký tự vỡ font.
// ================================================================

import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarDays,
  FlaskConical,
  Heart,
  Home,
  Library,
  Network,
  RotateCcw,
  Route,
  Sparkles,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { I18nKey } from "@/lib/i18n/dictionary";

export interface NavItem {
  href: string;
  labelKey: I18nKey;
  icon: LucideIcon;
}

export interface NavGroup {
  titleKey: I18nKey;
  items: NavItem[];
}

// Chỉ gồm các route đã tồn tại — không đổi route vì lý do UI.
export const NAV_GROUPS: NavGroup[] = [
  {
    titleKey: "nav.groups.learn",
    items: [
      { href: "/dashboard", labelKey: "nav.dashboard", icon: Home },
      { href: "/workspace", labelKey: "nav.workspace", icon: Network },
      { href: "/review", labelKey: "nav.review", icon: RotateCcw },
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

/** Tất cả mục nav đã rút phẳng (bỏ nhóm) — dùng cho sheet "Thêm". */
export const ALL_NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);

/** Tìm mục nav theo href (dùng cho tab mobile cố định). */
export function findNavItem(href: string): NavItem | undefined {
  return ALL_NAV_ITEMS.find((item) => item.href === href);
}

/**
 * 4 đích chính ghim ở thanh nav dưới.
 *
 * Chọn theo tiêu chí "học sinh mở app lên bấm ngay": Trang chủ (tổng quan),
 * Mind Map (tư duy), AI Gia sư (hỏi bài), Cá nhân (cài đặt/tài khoản). Phần còn
 * lại (Workspace, Lịch, Cộng đồng, Thư viện...) không nhét nổi vào 5 ô nên
 * nằm trong sheet "Thêm" — cùng bộ NAV_GROUPS với Sidebar, không phải bản
 * liệt kê riêng.
 */
export const PRIMARY_TAB_HREFS = ["/dashboard", "/mindmap", "/tutor", "/profile"] as const;

export const PRIMARY_TABS: NavItem[] = PRIMARY_TAB_HREFS.map((href) => findNavItem(href)).filter(
  (item): item is NavItem => item !== undefined
);
