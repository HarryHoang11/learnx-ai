// ================================================================
// <Topbar /> — thanh trên cùng của mọi trang trong (app)
// ================================================================
// Mạch tư duy: dùng useSession() để lấy tên/avatar THẬT của user đã
// đăng nhập (Google trả về `image`, đăng ký email/password
// thì `image` sẽ là null — component tự fallback về chữ cái đầu tên
// khi không có ảnh). Nút đăng xuất gọi signOut() của next-auth, tự
// xoá session cookie và điều hướng về /login. Sticky + gọn chiều cao
// để không chiếm không gian nội dung.
// ================================================================

"use client";

import { useSession, signOut } from "next-auth/react";
import Avatar from "@/components/ui/Avatar";

interface TopbarProps {
  onMenuClick?: () => void;
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { data: session } = useSession();
  const name = session?.user?.name ?? session?.user?.email ?? "Học sinh";
  const image = session?.user?.image;

  return (
    <header className="topbar">
      {/* Nút hamburger CHỈ hiển thị trên mobile (ẩn bằng CSS ở
          globals.css qua class "menu-btn") — trên desktop Sidebar luôn
          hiện sẵn nên không cần nút này. */}
      <button
        type="button"
        className="menu-btn"
        onClick={onMenuClick}
        aria-label="Mở menu điều hướng"
      >
        ☰
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginLeft: "auto" }}>
        <span
          style={{
            fontSize: 13,
            color: "var(--text-dim)",
            maxWidth: 220,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={name}
        >
          {name}
        </span>

        <Avatar src={image} name={name} size={34} />

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="btn-secondary"
          style={{ fontSize: 12.5, padding: "7px 12px" }}
        >
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
