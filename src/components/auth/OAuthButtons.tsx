// ================================================================
// <OAuthButtons /> — nút đăng nhập/đăng ký bằng Google
// ================================================================
// Mạch tư duy: cả trang Login lẫn Register đều cần y hệt nút này — OAuth
// tự tạo user mới nếu email chưa tồn tại, đây là hành vi chuẩn của Auth.js
// PrismaAdapter, KHÔNG phân biệt "đăng ký" vs "đăng nhập".
//
// Ba điều chỉnh cho trải nghiệm (spec #39.6):
//   1. `type="button"` — bản cũ không có, nằm trong <form> thì bấm nút sẽ
//      vô tình submit form (mất dữ liệu email/mật khẩu đã gõ).
//   2. `loading` — chặn bấm nhiều lần. signIn("google") điều hướng ra
//      ngoài; nếu mạng chậm, bấm 5 lần sẽ mở 5 tab OAuth.
//   3. Nhãn theo ngôn ngữ đang chọn ("Tiếp tục với Google" / "Continue with
//      Google") thay vì cứng "Login with Google" — trang đang viết tiếng Việt.
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import "./auth.css";

// SVG 4 màu chuẩn của logo Google ("G") — vẽ lại bằng path thay vì
// dùng file ảnh, tránh phải quản lý thêm asset.
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C37.961 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export default function OAuthButtons() {
  const { t } = useLanguage();
  /** Chặn bấm lặp trong lúc đang chuyển hướng sang Google. */
  const [loading, setLoading] = useState(false);

  /**
   * signIn("google") điều hướng ra trang Google — nếu người dùng bấm chặn
   * popup hoặc hủy, hàm ném lỗi. Bắt lại để hiện message thân thiện thay vì
   * lỗi kỹ thuật của NextAuth (spec #39.6: không lộ OAuth error).
   *
   * KHÔNG tự hiện lỗi ở đây: component không biết trang cha muốn báo lỗi ở
   * đâu (form-level alert vs field). Chỉ ghi log để dev chẩn đoán; lần sau
   * chỉnh nếu cần thì truyền callback `onError` xuống.
   */
  async function handleGoogle() {
    if (loading) return;
    setLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard", redirect: true });
      // Không setLoading(false): trang đang rời đi. Nếu Google chặn popup,
      // `signIn` ném lỗi → nhảy vào catch bên dưới.
    } catch (err) {
      console.error("[auth] Google sign-in thất bại:", err);
      setLoading(false);
    }
  }

  return (
    <button
      // `type="button"` là BẮT BUỘC: bản cũ thiếu, nên khi nằm trong <form>
      // bấm nút sẽ kích hoạt submit form (mất hết dữ liệu đã gõ).
      type="button"
      className="auth-oauth"
      onClick={handleGoogle}
      disabled={loading}
    >
      <GoogleIcon />
      {loading ? t("auth.loggingIn") : t("auth.googleContinue")}
    </button>
  );
}