// ================================================================
// TRANG ĐĂNG NHẬP (/login)
// ================================================================
// Mạch tư duy: form email/password gọi signIn("credentials", {...}) — ĐÂY LÀ
// ĐÚNG provider đã cấu hình trong src/auth.ts (authorize()).
//
// `redirect: false` để tự xử lý lỗi hiển thị trong trang (thay vì Auth.js
// tự redirect sang trang lỗi mặc định, trải nghiệm xấu hơn).
//
// KHÔNG ĐỔI kiến trúc auth (spec #39.22): vẫn dùng đúng `signIn` của
// Auth.js, không thêm endpoint, không tự quản lý token. Đợt này chỉ nâng
// lớp UI/UX + validate + xử lý lỗi thân thiện.
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import AuthField from "@/components/auth/AuthField";
import PasswordInput from "@/components/auth/PasswordInput";
import OAuthButtons from "@/components/auth/OAuthButtons";
import { useLanguage } from "@/components/providers/LanguageProvider";

/**
 * Kiểm tra email tối thiểu — CHỮA Ý, không phải validate đầy đủ.
 *
 * Vì sao không dùng regex RFC 5322 dài 60 ký tự: regex chuẩn quá chặt (chặn
 * cả email hợp lệ có dấu chấm liền nhau ở cuối, sub-domain có dấu gạch...)
 * và quá lỏng (nhận "a@b"). Trình duyệt ĐÃ có `type="email"` + validation
 * HTML5 sẵn; ta chỉ cần bắt lỗi đủ rõ để hiện message TIẾNG VIỆT.
 */
function isEmailValid(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value.trim());
}

/** Khoảng chờ trước khi chuyển trang sau khi thành công (spec #39.8).
 *  Đủ để người dùng THẤY nút chuyển sang trạng thái thành công, nhưng ngắn
 *  đến mức không cảm thấy đang chờ. */
const SUCCESS_REDIRECT_DELAY_MS = 420;

export default function LoginPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { status } = useSession();

  /**
   * ĐÃ ĐĂNG NHẬP RỒI mà vẫn vào /login (spec #39.10: "không bắt user login
   * lại không cần thiết") — đưa thẳng vào app.
   *
   * CHỈ chạy khi `status === "authenticated"`; lúc status = "loading" ta
   * CHƯA biết có session hay không nên im lặng (đừng đẩy người dùng ra
   * khỏi trang trước khi session kịp khôi phục).
   *
   * Vẫn đi qua `/dashboard` chứ không nhảy thẳng tới trang đích — `proxy.ts`
   * là nơi DUY NHẤT quyết định đi /welcome hay /onboarding hay /dashboard,
   * nên đi vòng qua đó giữ đúng luồng của user mới.
   */
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  /** Lỗi cấp FIELD (validate tức thì). Chỉ hiện sau blur hoặc khi submit. */
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  /** Đã blur chưa — cờ này NGĂN spam lỗi lúc vừa mở trang (spec #39.5). */
  const [touched, setTouched] = useState({ email: false, password: false });
  /** Lỗi cấp FORM (sai thông tin / mạng / server). */
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function validateEmail(): string | undefined {
    if (!email.trim()) return t("auth.error.emailRequired");
    if (!isEmailValid(email)) return t("auth.error.emailInvalid");
    return undefined;
  }

  function validatePassword(): string | undefined {
    if (!password) return t("auth.error.passwordRequired");
    return undefined;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Chặn double-submit: nút đã disabled nhưng Enter có thể gửi lại khi
    // state chưa kịp cập nhật trong cùng 1 tick.
    if (loading) return;

    // Validate TẤT CẢ field và đánh dấu đã chạm — khi submit, hiện hết lỗi
    // (không giữ trạng thái "chưa chạm" đang che lỗi).
    setTouched({ email: true, password: true });
    const emailError = validateEmail();
    const passwordError = validatePassword();
    setFieldErrors({ email: emailError, password: passwordError });
    if (emailError || passwordError) return;

    setLoading(true);
    setFormError(null);

    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (result?.error) {
        // Auth.js CHỈ trả `error` chung cho mọi ca thất bại (sai email, sai
        // mật khẩu, user không tồn tại) — đúng là không tiết lộ email nào đã
        // đăng ký. Message dưới đây cũng cố ý nói chung chung.
        setFormError(t("auth.badCredentials"));
        setLoading(false);
        return;
      }

      // Thành công: hiện trạng thái xanh trước khi rời trang.
      setDone(true);
      /**
       * Sau đăng nhập, đi thẳng /dashboard — KHÔNG cần biết user mới hay cũ.
       *
       * Lý do: proxy.ts (chạy server, đọc onboardingStatus từ JWT) tự chuyển
       * user CHƯA xem Welcome sang /welcome, và user chưa có hồ sơ học sang
       * /onboarding. Nếu login page tự quyết định ở client thì phải đọc
       * onboarding ở 3 nơi (login + register + Google OAuth) và dễ lệch với
       * proxy. Để MỘT chỗ quyết định như vậy an toàn hơn, và user cũ vẫn tới
       * thẳng Dashboard không bị delay.
       */
      setTimeout(() => router.push("/dashboard"), SUCCESS_REDIRECT_DELAY_MS);
    } catch {
      // signIn() chỉ ném khi không có mạng / Auth.js không trả JSON (proxy
      // trả HTML, server sập). KHÔNG lộ message kỹ thuật ra UI.
      setFormError(t("auth.error.network"));
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.loginTitle")}
      subtitle={t("auth.loginSubtitle")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          {/* Next <Link> thay cho <a>: điều hướng client-side, không tải
              lại toàn bộ bundle — bản cũ dùng <a> nên mỗi lần bấm chuyển
              sang trang kia đều là 1 lần load toàn bộ app. */}
          <Link href="/register">{t("auth.registerLink")}</Link>
        </>
      }
    >
      {/* Google đặt TRÊN (như bản cũ): đa số người dùng chọn đăng nhập 1
          chạm, không cần gõ mật khẩu. Trải nghiệm nhanh hơn hẳn. */}
      <OAuthButtons />

      <div className="auth-divider">
        <span className="auth-divider__line" />
        <span className="auth-divider__label">{t("auth.or")}</span>
        <span className="auth-divider__line" />
      </div>

      {/* `noValidate` để TẮT validation HTML5 mặc định: trình duyệt hiện
          bubble tiếng Anh ("Please fill out this field") không dịch được và
          không kiểm soát được vị trí hiển thị trên mobile. Ta dùng validate
          của riêng mình để hiện message tiếng Việt đúng kiểu LearnX. */}
      <form onSubmit={handleSubmit} noValidate className="auth-form-fields">
        <AuthField
          label={t("auth.email")}
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            // Chỉ re-validate ô này khi user ĐÃ chạm nó — không hiện lỗi
            // ngay lúc vừa focus (spam lỗi). Đã sửa lỗi thì tự xoá lỗi.
            if (touched.email) {
              const err = value.trim()
                ? isEmailValid(value)
                  ? undefined
                  : t("auth.error.emailInvalid")
                : t("auth.error.emailRequired");
              setFieldErrors((prev) => ({ ...prev, email: err }));
            }
          }}
          onBlur={() => {
            setTouched((prev) => ({ ...prev, email: true }));
            setFieldErrors((prev) => ({ ...prev, email: validateEmail() }));
          }}
          error={touched.email ? fieldErrors.email : undefined}
          placeholder="ban@truong.edu.vn"
          required
          disabled={loading}
          autoComplete="email"
          inputMode="email"
        />

        <PasswordInput
          label={t("auth.passwordLabel")}
          value={password}
          onChange={setPassword}
          error={touched.password ? fieldErrors.password : undefined}
          onBlur={() => {
            setTouched((prev) => ({ ...prev, password: true }));
            setFieldErrors((prev) => ({ ...prev, password: validatePassword() }));
          }}
          required
          disabled={loading}
          loading={loading}
          // "current-password" khiến trình quản lý mật khẩu (Google
          // Password Manager, 1Password, iOS Keychain) hiển thị đúng "đăng
          // nhập bằng LearnX AI" thay vì một mục chung chung.
          autoComplete="current-password"
        />

        {formError && (
          <p className="auth-alert" role="alert">
            <span aria-hidden="true">⚠</span>
            <span>{formError}</span>
          </p>
        )}

        <button
          type="submit"
          className={`btn-primary auth-submit${done ? " auth-submit--done" : ""}`}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="auth-spinner" aria-hidden="true" />
              {t("auth.loggingIn")}
            </>
          ) : done ? (
            <>✓ {t("auth.successLoggingIn")}</>
          ) : (
            t("auth.login")
          )}
        </button>
      </form>
    </AuthShell>
  );
}

