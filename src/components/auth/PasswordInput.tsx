// ================================================================
// <PasswordInput /> — input mật khẩu có nút mắt ẩn/hiện
// ================================================================
// Mạch tư duy: tách riêng thành component dùng chung (thay vì viết
// trực tiếp trong RegisterPage) vì cả Login lẫn Register đều cần y
// hệt hành vi này — sau này nếu muốn thêm ở Login chỉ cần import lại,
// không phải copy-paste logic toggle.
// ================================================================

"use client";

import { useState, type CSSProperties } from "react";

interface PasswordInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
}

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--panel-strong)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "11px 40px 11px 13px", // chừa chỗ bên phải cho nút mắt
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
};

export default function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  required,
  minLength,
  autoComplete,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        title={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 6,
          color: "var(--text-dim)",
          display: "flex",
          alignItems: "center",
        }}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.94 10.94 0 0112 19c-7 0-11-7-11-7a18.5 18.5 0 015.06-5.94M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 7 11 7a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}