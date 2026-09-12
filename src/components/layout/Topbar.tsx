// ================================================================
// <Topbar /> — thanh trên cùng của mọi trang trong (app)
// ================================================================
// Mạch tư duy: dùng useSession() để lấy tên/avatar THẬT của user đã
// đăng nhập (Google trả về `image`, đăng ký email/password
// thì `image` sẽ là null — component tự fallback về chữ cái đầu tên
// khi không có ảnh). Nút đăng xuất gọi signOut() của next-auth, tự
// xoá session cookie và điều hướng về /login. Sticky + gọn chiều cao
// để không chiếm không gian nội dung. Thêm LanguageSwitcher (VI/EN)
// persist 2 lớp qua LanguageProvider.
// ================================================================

"use client";

import { useSession, signOut } from "next-auth/react";
import { Menu } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { Language } from "@/lib/i18n/dictionary";

interface TopbarProps {
  onMenuClick?: () => void;
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
  const { data: session } = useSession();
  const { t } = useLanguage();
  const name = session?.user?.name ?? session?.user?.email ?? t("topbar.student");
  const image = session?.user?.image;

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
        <span
          style={{
            fontSize: 13,
            color: "var(--text-dim)",
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={name}
        >
          {name}
        </span>

        <Avatar src={image} name={name} size={34} />

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="btn-secondary"
          style={{ fontSize: 12.5, padding: "7px 12px" }}
        >
          {t("topbar.logout")}
        </button>
      </div>
    </header>
  );
}
