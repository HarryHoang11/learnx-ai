// ================================================================
// <Topbar /> — thanh trên cùng của mọi trang trong (app)
// ================================================================
// Mạch tư duy: dùng useSession() để lấy tên/avatar THẬT của user đã
// đăng nhập (Google trả về `image`, đăng ký email/password
// thì `image` sẽ là null — component tự fallback về chữ cái đầu tên
// khi không có ảnh). Nút đăng xuất gọi signOut() của next-auth, tự
// xoá session cookie và điều hướng về /login.
// ================================================================

"use client";

import { useSession, signOut } from "next-auth/react";

export default function Topbar() {
  const { data: session } = useSession();
  const name = session?.user?.name ?? session?.user?.email ?? "Học sinh";
  const image = session?.user?.image;
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 14, marginBottom: 30 }}>
      <span style={{ fontSize: 13, color: "var(--text-dim)" }}>{name}</span>

      {image ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar
        // từ Google là URL bên ngoài, dùng <img> thường để
        // tránh phải khai báo domain trong next.config.js images.domains
        <img
          src={image}
          alt={name}
          style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            background: "linear-gradient(135deg, var(--cyan), var(--indigo))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            color: "#0a0e16",
          }}
        >
          {initials}
        </div>
      )}

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="btn-secondary"
        style={{ fontSize: 12.5, padding: "7px 12px" }}
      >
        Đăng xuất
      </button>
    </div>
  );
}
