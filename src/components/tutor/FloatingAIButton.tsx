// ================================================================
// <FloatingAIButton /> — nút AI Gia sư nổi góc màn hình
// ================================================================
// Mạch tư duy:
//   - Avatar hiển thị lấy THẲNG từ session.user.image (useSession) —
//     CÙNG một nguồn dữ liệu với Topbar và trang Profile, KHÔNG lưu
//     riêng 1 bản avatar nào cho nút này. Khi user đổi avatar ở trang
//     Profile và gọi `update()` của next-auth (xem profile/page.tsx),
//     session ở ĐÂY tự re-render theo vì cùng đọc từ useSession() —
//     không cần prop-drilling, không cần state management mới.
//   - Chưa có avatar (session.user.image null, vd tài khoản đăng ký
//     bằng email/password chưa từng upload ảnh) -> fallback icon AI
//     mặc định, KHÔNG để ảnh vỡ (broken image).
//   - Ẩn khi đang loading session lần đầu (status === "loading") để
//     tránh nháy icon fallback rồi đổi ngay sang avatar thật.
// ================================================================

"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import Avatar from "@/components/ui/Avatar";

const SIZE = 56;

export default function FloatingAIButton() {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  const name = session?.user?.name ?? session?.user?.email ?? "AI Gia sư";
  const image = session?.user?.image;

  return (
    <Link
      href="/tutor"
      aria-label="Mở AI Gia sư"
      title="AI Gia sư"
      style={{
        position: "fixed",
        right: 22,
        bottom: 22,
        zIndex: 60,
        width: SIZE,
        height: SIZE,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--panel-strong)",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        overflow: "hidden",
      }}
      className="floating-ai-button"
    >
      {image ? (
        <Avatar src={image} name={name} size={SIZE} ringColor="var(--cyan)" />
      ) : (
        <span style={{ fontSize: 24, lineHeight: 1 }} aria-hidden>
          ✺
        </span>
      )}
    </Link>
  );
}
