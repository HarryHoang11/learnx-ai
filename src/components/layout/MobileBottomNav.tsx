"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { isActiveRoute } from "@/lib/nav/activeRoute";
import { NAV_GROUPS, PRIMARY_TABS, tabLabelKey } from "./navGroups";

// ================================================================
// <MobileBottomNav /> — thanh điều hướng dưới cùng, kiểu app native
// ================================================================
// Mạch tư duy: trên desktop, Sidebar cột bên đã đủ. Nhưng ở điện thoại,
// cột 230px chiếm 1/3 màn hình và bắt người dùng mở drawer mỗi lần đổi
// trang — app native dùng thanh dưới cố định 4-5 mục, phần còn lại gom
// vào 1 sheet "Thêm".
//
// Vì sao 5 ô: giữ 5 là con số chuẩn (nút giữa có thể là hành động nổi bật),
// mỗi ô đủ rộng để chạm (~64px) và nhãn vẫn đọc được không cần thu nhỏ chữ.
// 4 mục ở đây là những đích dùng nhiều nhất; MỤC "THÊM" chứa TOÀN BỘ route
// còn lại — lấy từ NAV_GROUPS chung với Sidebar, không liệt kê tay (xem
// ./navGroups) nên không bao giờ lệch với desktop.
//
// Chỉ hiện ở màn hình hẹp (globals.css @media max-width 880px) — desktop
// không render gì thêm, Sidebar vẫn là nguồn nav chính.
// ================================================================

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);

  // "Thêm" được coi là đang chọn khi route hiện tại KHÔNG thuộc 4 tab chính
  // (vd đang ở /community) — nếu không, người dùng mở trang phụ sẽ thấy
  // không tab nào sáng, tưởng mất phương hướng.
  const isSecondaryRoute = !PRIMARY_TABS.some((tab) => isActiveRoute(pathname, tab.href));

  return (
    <>
      <nav className="mobile-bottom-nav" aria-label={t("nav.primary")}>
        {PRIMARY_TABS.map((tab) => {
          const active = isActiveRoute(pathname, tab.href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`mobile-bottom-nav__item${active ? " mobile-bottom-nav__item--active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={21} strokeWidth={2} aria-hidden="true" />
              <span>{t(tabLabelKey(tab))}</span>
            </Link>
          );
        })}

        <button
          type="button"
          className={`mobile-bottom-nav__item${isSecondaryRoute ? " mobile-bottom-nav__item--active" : ""}`}
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
        >
          <MoreHorizontal size={21} strokeWidth={2} aria-hidden="true" />
          <span>{t("nav.more")}</span>
        </button>
      </nav>

      {/* Sheet "Thêm": liệt kê lại toàn bộ nhóm nav (không chỉ phần dư) để
          màn hình này là menu đầy đủ của app trên mobile — không bắt người
          dùng phải nhớ mục nào đã ghim ở thanh dưới.

          `activeHref` được truyền vào thay vì đọc `usePathname()` bên trong:
          vì sheet chỉ render khi đang mở, đọc pathname trong chính nó sẽ trả
          giá trị ĐÚNG khi mount — nhưng dùng chung nguồn với thanh tab ở trên
          rõ ràng hơn và tránh 2 cách tính trạng thái active lệch nhau. */}
      <BottomSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={t("nav.allFeatures")}
        activeHref={isSecondaryRoute ? pathname : null}
      >
        {NAV_GROUPS.map((group) => (
          <div key={group.titleKey} className="bottom-sheet-group">
            <div className="bottom-sheet-group__title">{t(group.titleKey)}</div>
            <div className="bottom-sheet-group__items">
              {group.items.map((item) => {
                const active = isActiveRoute(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`bottom-sheet-link${active ? " bottom-sheet-link--active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    // data-sheet-href: BottomSheet dùng attribute này để cuộn
                    // tới mục đang active khi mở (xem activeHref trong
                    // BottomSheet.tsx).
                    data-sheet-href={item.href}
                  >
                    <Icon size={18} strokeWidth={2} aria-hidden="true" />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </BottomSheet>
    </>
  );
}
