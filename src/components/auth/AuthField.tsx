// ================================================================
// <AuthField /> — ô nhập có nhãn + lỗi, dùng chung Login & Register
// ================================================================
// Mạch tư duy — 4 vấn đề của bản cũ, sửa hết ở đây 1 lần cho 2 trang:
//
// 1. ACCESSIBILITY (spec #39.17): trang cũ chỉ có `placeholder`, không có
//    `<label>`. Placeholder biến mất ngay khi gõ, nên sau đó không còn gì
//    chỉ ra ô này là gì — và screen reader đọc placeholder rất kém (nó là
//    gợi ý, không phải nhãn). Ở đây nhãn luôn hiện và `<label htmlFor>`
//    gắn đúng với `id`.
// 2. `aria-describedby` trỏ tới id của ô lỗi + của hint -> screen reader đọc
//    "Sai định dạng email" ngay sau khi đọc label, không phải đi tìm.
// 3. `aria-invalid` để trình đọc màn hình báo lỗi (CSS cũng dùng nó để
//    viền đỏ — 1 nguồn cho cả 2).
// 4. `autoComplete` + `inputMode`: quyết định bàn phím nào hiện trên
//    mobile và có tự động điền hay không (spec #39.17 nói rõ).
import { useId, type ReactNode } from "react";

interface AuthFieldProps {
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  onChange: (value: string) => void;
  /**
   * Gọi khi rời ô (blur). Đây là mốc để bắt đầu hiện lỗi — trước blur thì
   * im lặng, tránh "spam lỗi" lúc người dùng vừa bắt đầu nhập (spec §39.5).
   */
  onBlur?: () => void;
  /** Message lỗi; có thay thế placeholder trong `error` state. */
  error?: string | null;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autoComplete?: string;
  /** Gợi ý cho bàn phím: "email" mở @, "numeric" mở bàn phím số. */
  inputMode?: "email" | "text" | "numeric";
  /** Chỉ định cho input này (screen reader). Mặc định lấy từ `label`. */
  ariaLabel?: string;
  /** Nội dung phụ dưới ô (vd thanh đo mật khẩu). */
  children?: ReactNode;
}

export default function AuthField({
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  placeholder,
  required,
  disabled,
  autoComplete,
  inputMode,
  ariaLabel,
  children,
}: AuthFieldProps) {
  // `useId` sinh id ổn định theo thứ tự render — tránh phải tự đặt tên
  // `email`/`password1` rồi đụng nhau giữa 2 trang.
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>
        {label}
      </label>

      <input
        id={id}
        type={type}
        className="auth-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        // Placeholder rỗng khi đang lỗi: tránh hiện đồng thời "gợi ý mờ" và
        // "lỗi đỏ" ở cùng 1 ô — rối và giảm tương phản của lỗi.
        placeholder={error ? undefined : placeholder}
        required={required}
        disabled={disabled}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-label={ariaLabel ?? label}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? errorId : undefined}
        // Bỏ `spellCheck` cho email/password: gạch đỏ chính tả dưới ô làm
        // người dùng tưởng đã nhập sai.
        spellCheck={type === "text" ? true : false}
        autoCapitalize={type === "email" ? "none" : undefined}
        autoCorrect={type === "email" ? "off" : undefined}
      />

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
