// ================================================================
// TRANG ĐĂNG KÝ
// ================================================================
// Mạch tư duy: đăng ký bằng email/password gồm 2 BƯỚC nối tiếp:
//   1) POST /api/auth/register — tạo User + hash password trong DB.
//   2) signIn("credentials", ...) — đăng nhập NGAY sau khi tạo xong,
//      để học sinh không phải quay lại trang Login nhập lại lần nữa.
// 2 bước này KHÔNG gộp làm 1 vì "tạo user" (ghi DB) và "tạo session"
// (Auth.js) là 2 trách nhiệm khác nhau, xử lý bởi 2 lớp khác nhau
// trong app (route tự viết vs Auth.js).
// ================================================================

"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import OAuthButtons from "@/components/auth/OAuthButtons";
import type { ApiResponse } from "@/types";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const json: ApiResponse<{ id: string }> = await res.json();
      if (!json.success) {
        setError(json.error);
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        // Trường hợp hiếm: tạo user thành công nhưng đăng nhập lỗi —
        // vẫn đưa học sinh sang trang Login để tự thử lại, thay vì
        // kẹt ở trang Register không biết làm gì tiếp.
        router.push("/login");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Không thể kết nối tới máy chủ.");
      setLoading(false);
    }
  }

  return (
    <AuthCard title="Tạo tài khoản" subtitle="Bắt đầu hành trình học cùng LearnX AI">
      <OAuthButtons />

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>hoặc</span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input
          type="text"
          placeholder="Tên hiển thị"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Mật khẩu (tối thiểu 8 ký tự)"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        {error && <p style={{ color: "var(--rose)", fontSize: 13 }}>{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 6 }}>
          {loading ? "Đang tạo tài khoản..." : "Đăng ký"}
        </button>
      </form>

      <p style={{ fontSize: 13, color: "var(--text-dim)", textAlign: "center", marginTop: 18 }}>
        Đã có tài khoản?{" "}
        <a href="/login" style={{ color: "var(--cyan)" }}>
          Đăng nhập
        </a>
      </p>
    </AuthCard>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--panel-strong)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "11px 13px",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
};
