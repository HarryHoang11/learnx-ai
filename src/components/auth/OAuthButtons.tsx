// ================================================================
// <OAuthButtons /> — nút đăng nhập Google
// ================================================================
// Mạch tư duy: cả trang Login lẫn Register đều cần y hệt nút này —
// OAuth tự tạo user mới nếu email chưa tồn tại, đây là hành vi chuẩn
// của Auth.js PrismaAdapter, không phân biệt "đăng ký" vs "đăng nhập".
// signIn() gọi thẳng provider, Auth.js tự xử lý toàn bộ redirect +
// callback.
// ================================================================

"use client";

import { signIn } from "next-auth/react";

export default function OAuthButtons() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        className="btn-secondary"
        style={{ width: "100%", textAlign: "center" }}
      >
        Continue with Google
      </button>
    </div>
  );
}

