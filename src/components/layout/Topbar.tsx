// ================================================================
// <Topbar /> — thanh trên cùng của mọi trang trong (app)
// ================================================================
// Mạch tư duy: thanh này chỉ gom các điều khiển CHUNG — đổi ngôn ngữ,
// đổi theme, và khu vực tài khoản. Phần tài khoản (avatar + tên +
// menu: Cài đặt/Thêm tài khoản/Đăng xuất) do <AccountMenu> tự lo
// trọn và TỰ gọi useSession().
//
// Vì sao Topbar KHÔNG tự vẽ avatar/tên: trước đây cả Topbar lẫn
// AccountMenu đều render <Avatar> với cùng props => header hiện 2
// avatar giống hệt nhau. Giữ AccountMenu là nguồn DUY NHẤT, đúng
// tinh thần component <Avatar /> dùng chung ("một user chỉ có một
// cách avatar được vẽ ra").
//
// Sticky + gọn chiều cao để không chiếm không gian nội dung.
// ================================================================

"use client";

import { useState } from "react";
import { Menu, Sun, Moon } from "lucide-react";
import AccountMenu from "@/components/account/AccountMenu";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import type { Language } from "@/lib/i18n/dictionary";

interface TopbarProps {
  onMenuClick?: () => void;
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const isLight = theme === "light";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle-btn"
      aria-label={isLight ? t("topbar.switchToDark") : t("topbar.switchToLight")}
      title={isLight ? t("topbar.switchToDark") : t("topbar.switchToLight")}
    >
      {isLight ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
    </button>
  );
}

function LanguageSwitcher() {
  const { lang, setLang, t } = useLanguage();
  const options: { value: Language; label: string }[] = [
    { value: "vi", label: "VI" },
    { value: "en", label: "EN" },
  ];
  return (
    <div role="group" aria-label={t("topbar.language")} style={{ display: "flex", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setLang(o.value)}
          aria-pressed={lang === o.value}
          aria-label={o.value === "vi" ? "Tiếng Việt" : "English"}
          style={{
            background: lang === o.value ? "var(--indigo-soft)" : "transparent",
            border: "none",
            color: lang === o.value ? "var(--text)" : "var(--text-dim)",
            fontSize: 11.5,
            fontWeight: 700,
            padding: "6px 9px",
            cursor: "pointer",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { t } = useLanguage();
  return (
    <header className="topbar">
      {/* Nút hamburger CHỈ hiển thị trên mobile (ẩn bằng CSS ở
          globals.css qua class "menu-btn") — trên desktop Sidebar luôn
          hiện sẵn nên không cần nút này. */}
      <button
        type="button"
        className="menu-btn"
        onClick={onMenuClick}
        aria-label={t("topbar.menu")}
      >
        <Menu size={18} aria-hidden="true" />
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginLeft: "auto" }}>
        <LanguageSwitcher />
        <ThemeToggle />
        {/* Menu tài khoản gom "Cài đặt tài khoản / Thêm tài khoản / Đăng xuất"
            vào một điểm. Nút đăng xuất cũ (logout-btn) bị thay bằng menu này
            để thanh trên không bị rối nhiều nút; hành vi đăng xuất giữ
            nguyên signOut({ callbackUrl: "/login" }) như trước.

            AccountMenu tự render <Avatar> + tên + mũi tên trong một trigger
            duy nhất. Topbar KHÔNG render avatar/tên riêng nữa: trước đây
            cả hai cùng vẽ nên header hiện 2 avatar giống hệt nhau. */}
        <AccountMenu />
      </div>
    </header>
  );
}
