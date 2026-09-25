// ================================================================
// <AccountMenu /> — Menu tài khoản trên Topbar
// ================================================================
// Mạch tư duy: gom các thao tác liên quan tới tài khoản vào một menu thay
// vì để nhiều nút rời rạc trên thanh trên cùng.
//
// GIỚI HẠN KIẾN TRÚC — đọc trước khi mở rộng:
//   App dùng Auth.js v5 với session strategy = "jwt" (xem src/auth.ts).
//   Chiến lược này lưu DUY NHẤT một JWT trong cookie
//   `authjs.session-token` của trình duyệt. Vì vậy KHÔNG thể đồng thời
//   đăng nhập 2 tài khoản trên cùng một trình duyệt — đăng nhận tài khoản
//   thứ hai sẽ GHI ĐÈ session hiện tại.
//   => "Chuyển tài khoản" kiểu Google (nhiều tài khoản cùng lúc) KHÔNG làm
//      được với kiến trúc hiện tại, và cũng không nên tự vờ ra bằng cách
//      lưu token vào localStorage (phá session hiện tại + rủi ro bảo mật).
//   Menu này vì vậy làm ĐÚNG những gì kiến trúc cho phép.
// ================================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { ChevronDown, LogOut, Settings, UserPlus, ShieldCheck } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useToast } from "@/components/ui/Toast";

export default function AccountMenu() {
  const { data: session } = useSession();
  const { t } = useLanguage();
  const router = useRouter();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const name = session?.user?.name ?? session?.user?.email ?? t("topbar.student");
  const email = session?.user?.email ?? "";
  const image = session?.user?.image;

  // Đóng menu khi bấm ra ngoài hoặc nhấn Esc — tránh menu bị "dính" mở khi
  // người dùng đã chuyển sang làm việc khác.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleLogout() {
    setOpen(false);
    void signOut({ callbackUrl: "/login" });
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("account.switchAccount")}
        title={name}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        <Avatar src={image} name={name} size={34} />
        {/* Tên nằm TRONG trigger (cùng một nút bấm) thay vì là <span> riêng ở
            Topbar. Nhờ vậy khu vực tài khoản là MỘT nút duy nhất:
            [avatar] [tên] [mũi tên]. Trước đây Topbar render <Avatar> riêng
            ngay cạnh <AccountMenu> (cũng render <Avatar>) nên header bị 2
            avatar giống hệt nhau. Giữ 1 nguồn duy nhất: AccountMenu. */}
        <span
          style={{
            fontSize: 13,
            color: "var(--text-dim)",
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </span>
        <ChevronDown size={14} aria-hidden="true" style={{ color: "var(--text-dim)" }} />
      </button>

      {open && (
        <div role="menu" className="account-menu">
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text)" }}>{name}</div>
            {email && (
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2, wordBreak: "break-all" }}>
                {email}
              </div>
            )}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                marginTop: 8,
                fontSize: 11.5,
                color: "var(--text-dim)",
              }}
            >
              <ShieldCheck size={12} aria-hidden="true" />
              <span>{t("account.sessions")}</span>
            </div>
            <p style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 4, lineHeight: 1.5 }}>
              {t("account.sessionNote")}
            </p>
          </div>

          <button
            type="button"
            role="menuitem"
            className="account-menu__item"
            onClick={() => {
              setOpen(false);
              router.push("/profile");
            }}
          >
            <Settings size={15} aria-hidden="true" />
            <span>{t("account.accountSettings")}</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="account-menu__item"
            onClick={() => {
              setOpen(false);
              push("info", t("account.addAccountNote"));
              // Đi qua luồng đăng nhập thật của Auth.js. Vì session là JWT đơn
              // nên tài khoản mới SẼ thay thế tài khoản hiện tại — đã nói rõ
              // ở note phía trên, không im lặng làm người dùng bất ngờ.
              router.push("/login");
            }}
          >
            <UserPlus size={15} aria-hidden="true" />
            <span>{t("account.addAccount")}</span>
          </button>

          <button
            type="button"
            role="menuitem"
            className="account-menu__item"
            onClick={handleLogout}
            style={{ color: "var(--rose)" }}
          >
            <LogOut size={15} aria-hidden="true" />
            <span>{t("topbar.logout")}</span>
          </button>
        </div>
      )}
    </div>
  );
}