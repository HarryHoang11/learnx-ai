// ================================================================
// <Avatar /> — component avatar dùng chung (Topbar + FloatingAIButton)
// ================================================================
// Mạch tư duy: trước đây Topbar.tsx tự vẽ avatar bằng inline style
// riêng của nó — nếu FloatingAIButton copy y nguyên đoạn JSX đó, sau
// này sửa 1 chỗ (vd đổi border-radius, thêm ring...) sẽ dễ quên sửa
// chỗ còn lại và 2 nơi lệch nhau. Tách ra component chung 1 LẦN, cả
// Topbar lẫn FloatingAIButton cùng import — đảm bảo "một user chỉ có
// một cách avatar được vẽ ra", không phải chỉ "một nguồn dữ liệu
// avatar" (2 khái niệm khác nhau, cả 2 đều cần cho đúng yêu cầu đồng
// bộ).
//
// KHÔNG tự fetch/tự giữ state avatar — nhận `src`/`name` từ props,
// component cha (Topbar/FloatingAIButton) chịu trách nhiệm lấy đúng
// nguồn (session.user.image) và truyền xuống.
// ================================================================

"use client";

import { useEffect, useState, type CSSProperties } from "react";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size: number;
  ringColor?: string;
  /** Vòng focus khi bàn phím điều hướng tới avatar bằng cách Tab. */
  className?: string;
}

export default function Avatar({ src, name, size, ringColor, className }: AvatarProps) {
  const initials = (name?.trim() || "?").slice(0, 2).toUpperCase();

  /**
   * Ảnh hỏng / 404 → quay về initials.
   *
   * VÌ SAO CẦN: avatar được lưu 2 kiểu khác nhau (xem `resolveAvatarUrl`):
   * URL ngoài (Google) hoặc route nội bộ `/api/profile/photo/avatar` — route
   * này trả **404** khi user chưa tải ảnh lên. Không có `onError` thì mọi
   * user mới sẽ thấy ô ảnh vỡ (icon broken) thay vì initials.
   *
   * `failed` khóa lại sau lần lỗi đầu: nếu không, mỗi lần re-render sẽ thử
   * lại URL hỏng và log lỗi mạng liên tục.
   */
  const [failed, setFailed] = useState(false);

  // Đổi user (đăng nhập tài khoản khác) hoặc đổi src → phải thử lại từ đầu.
  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !failed;

  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    ...(ringColor ? { boxShadow: `0 0 0 2px ${ringColor}` } : {}),
  };

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar
      // có thể là URL Google (domain ngoài) hoặc route nội bộ
      // /api/profile/photo/avatar — dùng <img> thường để không phải
      // khai báo domain trong next.config.js images.domains.
      <img
        src={src as string}
        alt={name ?? "Avatar"}
        className={className}
        // `width/height` CỐ ĐỊNH chống layout shift khi ảnh tải chậm.
        style={{ ...baseStyle, objectFit: "cover", display: "block" }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        ...baseStyle,
        /* Gradient nhẹ, đủ tương phản ở CẢ 2 theme: chữ dùng `--on-accent`
           (cố định theo brand, không đổi theo theme — xem note ở globals.css)
           nên trên nền gradient luôn đọc được, không bị chìm ở light mode. */
        background: "linear-gradient(135deg, var(--cyan), var(--indigo))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-space-grotesk), sans-serif",
        fontSize: Math.max(11, size * 0.38),
        fontWeight: 700,
        color: "var(--on-accent)",
        lineHeight: 1,
        userSelect: "none",
      }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
}
