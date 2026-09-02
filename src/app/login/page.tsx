// ================================================================
// TRANG ĐĂNG NHẬP
// ================================================================
// Mạch tư duy: form email/password gọi signIn("credentials", {...})
// — ĐÂY LÀ ĐÚNG PROVIDER đã cấu hình trong src/auth.ts (authorize()).
// redirect: false để tự xử lý lỗi hiển thị trong trang (thay vì
// Auth.js tự redirect sang trang lỗi mặc định, trải nghiệm xấu hơn).
// ================================================================

"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import AuthCard from "@/components/auth/AuthCard";
import OAuthButtons from "@/components/auth/OAuthButtons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      setError("Email hoặc mật khẩu không đúng.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <AuthCard title="Đăng nhập" subtitle="Chào mừng bạn quay lại LearnX">
      <OAuthButtons />

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>hoặc</span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
          placeholder="Mật khẩu"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        {error && <p style={{ color: "var(--rose)", fontSize: 13 }}>{error}</p>}
        <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 6 }}>
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>

      <p style={{ fontSize: 13, color: "var(--text-dim)", textAlign: "center", marginTop: 18 }}>
        Chưa có tài khoản?{" "}
        <a href="/register" style={{ color: "var(--cyan)" }}>
          Đăng ký
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
