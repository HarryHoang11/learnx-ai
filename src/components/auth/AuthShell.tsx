// ================================================================
// <AuthShell /> — KHUNG BỐ CỤC chung cho Login / Register
// ================================================================
// Mạch tư duy:
//   Trước đây cả 2 trang dùng `<AuthCard>` = 1 card nhỏ (maxWidth 380px)
//   giữa màn hình trống. Ở desktop 1440px trông nhỏ xíu và thiếu cảm giác
//   "sản phẩm"; Ở mobile thì card là thừa (chiếm 100% bề ngang nhưng bọc
//   thêm 1 lớp nền).
//
//   Khung mới chia 2 vùng, mỗi vùng phục vụ 1 mục đích:
//     LEFT (desktop) — BRAND: logo, tagline, và một "visual" nền tảng AI
//       học tập. Ẩn hoàn toàn ở mobile (chiếm bề ngang mà không thêm
//       thông tin — mất 300px chiều cao trên 360px là mất CTA).
//     RIGHT — FORM: card kính, logo nhỏ, tiêu đề, nội dung do trang truyền
//       vào. Dùng CHUNG design system (token --*) nên không có "design system
//       riêng cho login" như spec #39.20 cảnh báo.
//
// VỀ SAFE-AREA (spec #39.11 + bug thật đã sửa trước đó):
//   `capacitor.config.ts` đặt `StatusBar.overlaysWebView = true` => trên
//   Android có notch, status bar ĐÈ LÊN webview. Không chừa
//   `env(safe-area-inset-top)` thì logo + tiêu đề nằm ngay dưới camera
//   punch-hole. Vì vậy padding trên dùng `var(--safe-top)`.
// ================================================================

import type { ReactNode } from "react";
import LearnXLogo from "@/components/brand/LearnXLogo";
import { useLanguage } from "@/components/providers/LanguageProvider";
import "./auth.css";

interface AuthShellProps {
  title: string;
  subtitle: string;
  /** Nội dung form (children). */
  children: ReactNode;
  /** Link chuyển sang trang kia ("Chưa có tài khoản? Đăng ký"). */
  footer?: ReactNode;
  /**
   * Bổ sung class cho khung (vd `auth-shell--register`).
   * Lý do tồn tại: form Register dài hơn Login ~1 field + 2 thanh đo mật
   * khẩu, nên muốn card cao hơn một chút — nhưng KHÔNG tạo 1 component
   * riêng cho Register (sẽ lệch design system về sau).
   */
  variant?: "default" | "register";
}

export default function AuthShell({
  title,
  subtitle,
  children,
  footer,
  variant = "default",
}: AuthShellProps) {
  const { t } = useLanguage();

  return (
    <div className={`auth-shell auth-shell--${variant}`}>
      {/* ---------- VÙNG BRAND (desktop) ---------- */}
      <aside className="auth-brand" aria-hidden="true">
        <div className="auth-brand__inner">
          <LearnXLogo size="xl" />

          {/* Tagline: câu định vị, đặt ở đây thay vì tiêu đề form — vì
              trên mobile vùng brand bị ẩn, tagline vẫn còn ở subtitle. */}
          <p className="auth-brand__tagline">{t("auth.brandTagline")}</p>

          {/* 3 điểm giá trị: làm vùng brand có "chiều sâu nội dung" thay vì
              chỉ là logo + 1 câu rỗng. Nội dung là điều học sinh thật sự
              được (không phải marketing rỗng). */}
          <ul className="auth-brand__points">
            <li>{t("auth.brandPoint1")}</li>
            <li>{t("auth.brandPoint2")}</li>
            <li>{t("auth.brandPoint3")}</li>
          </ul>
        </div>

        {/* Nền: 2 quả cầu sáng gradient + lưới mờ. Đặt ở cuối cùng và
            `position:absolute` nên không chiếm layout (không đẩy form). */}
        <div className="auth-orb auth-orb--1" />
        <div className="auth-orb auth-orb--2" />
        <div className="auth-grid-bg" />
      </aside>

      {/* ---------- VÙNG FORM ---------- */}
      <main className="auth-form">
        <div className="auth-form__inner">
          {/* Logo ở trên (mobile không có vùng brand nên cần logo ở đây;
              desktop thu nhỏ lại nhưng vẫn hiện -> nhất quán hình ảnh). */}
          <div className="auth-form__logo">
            <LearnXLogo size="md" />
          </div>

          <div className="auth-panel">
            <header className="auth-panel__head">
              <h1 className="auth-panel__title">{title}</h1>
              <p className="auth-panel__subtitle">{subtitle}</p>
            </header>

            {children}
          </div>

          {footer && <div className="auth-form__footer">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
