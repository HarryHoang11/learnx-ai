// ================================================================
// <PasswordInput /> — ô mật khẩu có nút mắt ẩn/hiện + thanh đo mạnh
// ================================================================
// Mạch tư duy: cả Login lẫn Register đều cần y hệt hành vi này (bấm mắt,
// đo độ mạnh) — tách riêng để không copy-paste logic toggle ở 3 chỗ.
//
// Nâng cấp so với bản cũ:
//   1. Có `<label>` thật (bản cũ chỉ placeholder → mất ngữ cảnh khi gõ).
//   2. `autoComplete` mặc định đúng: "current-password" ở Login (trình quản
//      lý mật khẩu hiển thị "đăng nhập bằng LearnX AI"), "new-password" ở
//      Register (trình quản lý GỢI Ý mật khẩu mới — spec #39.17).
//   3. Nút mắt dùng `type="button"` + `aria-pressed` + `aria-label` đổi
//      theo trạng thái; không nằm trong flow submit.
//   4. `readOnly` lúc `loading` để trình quản lý mật khẩu không ghi đè
//      giữa lúc đang gửi (race hiếm nhưng gây lỗi khó hiểu).
//   5. Children slot để nhét <PasswordStrength> vào dưới ô.
"use client";

import { useId, useState, type ReactNode } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";

interface PasswordInputProps {
  /**
   * Nhãn hiển thị. BẮT BUỘC khi dùng trong trang auth mới (Login/Register
   * dùng component này nhúng thẳng trong form).
   *
   * CÓ THỂ BỎ — để tương thích với `ChangePasswordPanel` (đổi mật khẩu),
   * nơi `<label>` đã nằm ở component cha và truyền `id` xuống. Khi bỏ trống,
   * component KHÔNG render `<label>` (tránh lặp 2 nhãn cho 1 ô) — vẫn a11y vì
   * label của cha đã gắn đúng qua `id`.
   */
  label?: string;
  /** Id do component cha cấp — khi có, dùng thay `useId()`. */
  id?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  /** Gọi khi rời ô — mốc bắt đầu hiện lỗi (xem giải thích ở AuthField). */
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  /** Ràng buộc độ dài của HTML5 validation (dùng ở form đổi mật khẩu). */
  minLength?: number;
  /**
   * "current-password" khi ĐĂNG NHẬP, "new-password" khi ĐĂNG KÝ.
   * Mặc định "current-password" vì đó là trường hợp an toàn hơn (không gợi
   * ý lộ mật khẩu mới).
   */
  autoComplete?: "current-password" | "new-password";
  disabled?: boolean;
  /** Khoá input khi request đang bay để người dùng không sửa giữa chừng. */
  loading?: boolean;
  /** Nội dung phụ dưới ô (thanh đo độ mạnh). */
  children?: ReactNode;
}

export default function PasswordInput({
  label,
  id: providedId,
  value,
  onChange,
  error,
  onBlur,
  placeholder,
  required,
  minLength,
  autoComplete = "current-password",
  disabled,
  loading,
  children,
}: PasswordInputProps) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const generatedId = useId();
  // Ưu tiên id của cha (để `<label htmlFor>` bên ngoài trỏ đúng), fallback id
  // tự sinh khi dùng trong form auth (label nằm trong component).
  const id = providedId ?? generatedId;
  const errorId = `${id}-error`;
  const toggleLabel = visible ? t("auth.hidePassword") : t("auth.showPassword");

  return (
    <div className="auth-field">
      {label && (
        <label className="auth-label" htmlFor={id}>
          {label}
        </label>
      )}

      {/* Wrapper tương đối để đặt nút mắt nằm trong ô nhập — nhưng ô nhập
          vẫn là phần tử chiếm bề ngang (width:100% của .auth-input). */}
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type={visible ? "text" : "password"}
          className="auth-input"
          // Chừa chỗ bên phải cho nút mắt (44px).
          style={{ paddingRight: 46 }}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={error ? undefined : placeholder}
          required={required}
          minLength={minLength}
          disabled={disabled}
          readOnly={loading}
          autoComplete={autoComplete}
          aria-label={label}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
          // Bảo mật: không ghi đoán tự động cho mật khẩu.
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
        />

        <button
          type="button"
          className="auth-eye"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          aria-label={toggleLabel}
          title={toggleLabel}
          /* aria-pressed cho screen reader biết đang ở trạng thái hiện/ẩn. */
          aria-pressed={visible}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>

      {error && (
        <p className="auth-error" id={errorId} role="alert">
          <span className="auth-error__icon" aria-hidden="true">
            !
          </span>
          <span>{error}</span>
        </p>
      )}

      {children}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17.94 17.94A10.94 10.94 0 0112 19c-7 0-11-7-11-7a18.5 18.5 0 015.06-5.94M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 7 11 7a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
