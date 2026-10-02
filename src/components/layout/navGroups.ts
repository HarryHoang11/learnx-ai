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
  Gift,
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
  /**
   * Nhãn RIÊNG cho ô tab dưới cùng trên mobile, khi nhãn đầy đủ quá dài
   * (vd "AI Gia sư" / "Trang cá nhân" bị bóp/cắt ở 320px). `undefined` =
   * dùng `labelKey`. Tách riêng thay vì đổi luôn nhãn sidebar để desktop
   * không bị mất tên đầy đủ.
   */
  shortLabelKey?: I18nKey;
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
      { href: "/dashboard", labelKey: "nav.dashboard", shortLabelKey: "nav.tabHome", icon: Home },
      { href: "/workspace", labelKey: "nav.workspace", shortLabelKey: "nav.tabLearn", icon: Network },
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
    items: [
      { href: "/progress", labelKey: "nav.progress", icon: BarChart3 },
      // Đổi thưởng — nằm cùng nhóm "Tiến độ" vì nó là nơi tiêu thụ những gì
      // người học kiếm được ở /progress (XP/LXP/streak). Đây là route ĐÃ CÓ
      // backend (Reward/UserReward/PointTransaction + /api/rewards/*) nhưng
      // trước đợt này không có UI nào gọi tới (xem CHANGELOG 2026-10-03).
      { href: "/rewards", labelKey: "nav.rewards", icon: Gift },
      // Thành tựu — cùng nhóm vì achievement cũng là phần thưởng (XP+LXP),
      // và backend đã có sẵn (`/api/achievements`).
      { href: "/achievements", labelKey: "nav.achievements", icon: Trophy },
    ],
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
 * 5 đích chính ghim ở thanh nav dưới (mobile).
 *
 * Bộ này bám theo mô hình app native phổ biến và giữ đúng vai trò từng
 * bước trong pipeline của LearnX:
 *   Home     (/dashboard) — mở app là thấy ngay việc cần làm hôm nay
 *   Learn    (/workspace) — tải tài liệu lên, xem tóm tắt, mind map
 *   Practice (/practice)  — luyện tập / quiz đo năng lực
 *   Progress (/progress)  — XP, streak, thống kê
 *   Profile  (/profile)   — cài đặt, tài khoản
 *
 * Mind Map và AI Gia sư (2 tính năng dùng rất nhiều) nằm trong sheet "Thêm"
 * cùng toàn bộ route còn lại — lấy từ NAV_GROUPS chung với Sidebar nên
 * không bao giờ lệch với desktop.
 *
 * Lưu ý khi đổi: giữ đúng 5 ô. Thêm ô thứ 6 làm mỗi ô hẹp lại (~53px ở
 * 320px) và nhãn tiếng Việt dài sẽ bị cắt — xem docs/architecture/MOBILE.md.
 */
export const PRIMARY_TAB_HREFS = [
  "/dashboard",
  "/workspace",
  "/practice",
  "/progress",
  "/profile",
] as const;

/** Nhãn hiển thị trên ô tab: ưu tiên nhãn ngắn nếu mục nav có định nghĩa. */
export function tabLabelKey(item: NavItem): I18nKey {
  return item.shortLabelKey ?? item.labelKey;
}

export const PRIMARY_TABS: NavItem[] = PRIMARY_TAB_HREFS.map((href) => findNavItem(href)).filter(
  (item): item is NavItem => item !== undefined
);
