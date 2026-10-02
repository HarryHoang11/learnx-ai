// ================================================================
// TRANG ĐĂNG KÝ (/register)
// ================================================================
// Mạch tư duy: đăng ký gồm 2 BƯỚC nối tiếp:
//   1) POST /api/auth/register — tạo User + hash password trong DB.
//   2) signIn("credentials", ...) — đăng nhập NGAY sau khi tạo xong,
//      để học sinh không phải quay lại trang Login nhập lại lần nữa.
// 2 bước này KHÔNG gộp làm 1 vì "tạo user" (ghi DB) và "tạo session"
// (Auth.js) là 2 trách nhiệm khác nhau, xử lý bởi 2 lớp khác nhau.
//
// KHÔNG thu thập thông tin học tập ở đây (spec #39.3): lớp/môn/mục tiêu đã
// có bước khảo sát riêng sau đăng ký. Nhồi vào form đăng ký sẽ khiến người
// dùng điền 8 ô trước khi biết app là gì.
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import AuthField from "@/components/auth/AuthField";
import PasswordInput from "@/components/auth/PasswordInput";
import PasswordStrength from "@/components/auth/PasswordStrength";
import OAuthButtons from "@/components/auth/OAuthButtons";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { readApi } from "@/lib/api/readApi";
import type { ApiResponse } from "@/types";

/**
 * Độ dài tối thiểu — PHẢI khớp hệt `MIN_PASSWORD_LENGTH` trong
 * `src/app/api/auth/register/route.ts` (dòng 20).
 *
 * Khai báo lại ở client để validate tức thì (không mất round-trip), nhưng
 * server vẫn kiểm tra lại — đây chỉ là tiết kiệm trải nghiệm, KHÔNG phải
 * lớp bảo mật. Nếu sau này đổi server, sửa cả 2 nơi (đã ghi chú ở route).
 */
const MIN_PASSWORD_LENGTH = 8;

const SUCCESS_REDIRECT_DELAY_MS = 420;

function isEmailValid(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value.trim());
}

export default function RegisterPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const { status } = useSession();

  /**
   * Đã có session mà vẫn vào /register — đưa thẳng vào app thay vì bắt tạo
   * tài khoản thứ hai (đi qua /dashboard để `proxy.ts` quyết định đích, đúng
   * như trang Login — xem giải thích ở `login/page.tsx`).
   */
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirm?: string;
  }>({});
  /** Ô nào đã chạm — quy tắc hiện lỗi giống hệt trang Login. */
  const [touched, setTouched] = useState({
    name: false,
    email: false,
    password: false,
    confirm: false,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function validateName(): string | undefined {
    if (!name.trim()) return t("auth.error.nameRequired");
    return undefined;
  }

  function validateEmail(): string | undefined {
    if (!email.trim()) return t("auth.error.emailRequired");
    if (!isEmailValid(email)) return t("auth.error.emailInvalid");
    return undefined;
  }

  function validatePassword(): string | undefined {
    if (!password) return t("auth.error.passwordRequired");
    if (password.length < MIN_PASSWORD_LENGTH) {
      return t("auth.strength.needLength", { n: String(MIN_PASSWORD_LENGTH) });
    }
    return undefined;
  }

  function validateConfirm(): string | undefined {
    if (!confirmPassword) return t("auth.error.confirmRequired");
    if (password !== confirmPassword) return t("auth.error.confirmMismatch");
    return undefined;
  }


  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;

    // Validate TẤT CẢ + đánh dấu đã chạm: khi submit thì hiện hết lỗi.
    setTouched({ name: true, email: true, password: true, confirm: true });
    const errors = {
      name: validateName(),
      email: validateEmail(),
      password: validatePassword(),
      confirm: validateConfirm(),
    };
    setFieldErrors(errors);
    if (errors.name || errors.email || errors.password || errors.confirm) return;

    setLoading(true);
    setFormError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });

      // `readApi` thay cho `res.json()`: nếu server/proxy trả HTML (lỗi 502,
      // trang bảo trì) thì `res.json()` NÉM lỗi parse rất khó hiểu. readApi
      // ném TransportError có kiểu riêng → ta map sang message tiếng Việt.
      const json: ApiResponse<{ id: string }> = await readApi(res, "POST /api/auth/register");

      if (!json.success) {
        // Message từ server ĐÃ viết cho người dùng (xem route.ts) — giữ nguyên.
        // Riêng "email đã đăng ký" thì dùng bản dịch của mình cho nhất quán
        // với ngôn ngữ đang chọn (spec §39.16: "chuyển Login").
        if (res.status === 409) {
          setFormError(t("auth.error.emailTaken"));
        } else if (res.status === 503) {
          setFormError(t("auth.error.server"));
        } else {
          setFormError(json.error);
        }
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (result?.error) {
        // Tạo user thành công nhưng đăng nhập lỗi (hiếm) — đưa sang Login
        // để tự thử lại, thay vì kẹt ở trang Register không biết làm gì.
        router.push("/login");
        return;
      }

      setDone(true);
      /**
       * User MỚI đi thẳng /dashboard; proxy.ts sẽ tự dẫn sang /welcome (chưa
       * xem Welcome) rồi /onboarding (chưa có hồ sơ học). Không quyết định
       * onboarding ở đây — cùng lý do & cùng cách làm với trang Login: để
       * MỘT chỗ (proxy) quyết định để không lệch.
       */
      setTimeout(() => router.push("/dashboard"), SUCCESS_REDIRECT_DELAY_MS);
    } catch {
      // Không có mạng / response hỏng — KHÔNG lộ message kỹ thuật.
      setFormError(t("auth.error.registerFailed"));
      setLoading(false);

  /** Re-validate 1 ô khi user đã chạm nó — dùng chung cho cả 4 field để
   *  không lặp logic "chỉ hiện lỗi sau blur" 4 lần. */
  function revalidate<K extends "name" | "email" | "password" | "confirm">(
    field: K,
    value: string
  ) {
    if (!touched[field]) return;
    const next = {
      name: validateName(),
      email: validateEmail(),
      password: validatePassword(),
      confirm: validateConfirm(),
    }[field];
    setFieldErrors((prev) => ({ ...prev, [field]: next }));
    void value;
  }

  return (
    <AuthShell
      title={t("auth.registerTitle")}
      subtitle={t("auth.registerSubtitle")}
      variant="register"
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link href="/login">{t("auth.loginLink")}</Link>
        </>
      }
    >
      <OAuthButtons />

      <div className="auth-divider">
        <span className="auth-divider__line" />
        <span className="auth-divider__label">{t("auth.or")}</span>
        <span className="auth-divider__line" />
      </div>

      <form onSubmit={handleSubmit} noValidate className="auth-form-fields">
        <AuthField
          label={t("auth.name")}
          type="text"
          value={name}
          onChange={(value) => {
            setName(value);
            revalidate("name", value);
          }}
          onBlur={() => {
            setTouched((prev) => ({ ...prev, name: true }));
            setFieldErrors((prev) => ({ ...prev, name: validateName() }));
          }}
          error={touched.name ? fieldErrors.name : undefined}
          placeholder="Nguyễn Minh An"
          required
          disabled={loading}
          // "name" để trình duyệt/Android tự gợi ý tên thật của user.
          autoComplete="name"
        />

        <AuthField
          label={t("auth.email")}
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            revalidate("email", value);
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
          label={t("auth.newPassword")}
          value={password}
          onChange={setPassword}
          onBlur={() => {
            setTouched((prev) => ({ ...prev, password: true }));
            setFieldErrors((prev) => ({ ...prev, password: validatePassword() }));
          }}
          error={touched.password ? fieldErrors.password : undefined}
          placeholder={t("auth.passwordMin")}
          required
          minLength={MIN_PASSWORD_LENGTH}
          disabled={loading}
          loading={loading}
          // "new-password" khiến trình quản lý mật khẩu GỢI Ý mật khẩu mới
          // (có sinh ngẫu nhiên) thay vì điền mật khẩu cũ — đúng ý nghĩa
          // của việc đăng ký.
          autoComplete="new-password"
        >
          <PasswordStrength value={password} touched={touched.password} />
        </PasswordInput>

        <PasswordInput
          label={t("auth.confirmPasswordLabel")}
          value={confirmPassword}
          onChange={setConfirmPassword}
          onBlur={() => {
            setTouched((prev) => ({ ...prev, confirm: true }));
            setFieldErrors((prev) => ({ ...prev, confirm: validateConfirm() }));
          }}
          error={touched.confirm ? fieldErrors.confirm : undefined}
          required
          disabled={loading}
          loading={loading}
          autoComplete="new-password"
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
              {t("auth.creating")}
            </>
          ) : done ? (
            <>✓ {t("auth.successCreating")}</>
          ) : (
            t("auth.register")
          )}
        </button>
      </form>
    </AuthShell>
  );
}
    }
  }
