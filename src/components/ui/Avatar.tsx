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

import type { CSSProperties } from "react";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size: number;
  ringColor?: string;
}

export default function Avatar({ src, name, size, ringColor }: AvatarProps) {
  const initials = (name?.trim() || "?").slice(0, 2).toUpperCase();

  const baseStyle: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    ...(ringColor ? { boxShadow: `0 0 0 2px ${ringColor}` } : {}),
  };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatar
      // có thể là URL Google (domain ngoài) hoặc route nội bộ
      // /api/profile/photo/avatar — dùng <img> thường để không phải
      // khai báo domain trong next.config.js images.domains.
      <img
        src={src}
        alt={name ?? "Avatar"}
        style={{ ...baseStyle, objectFit: "cover" }}
      />
    );
  }

  return (
    <div
      style={{
        ...baseStyle,
        background: "linear-gradient(135deg, var(--cyan), var(--indigo))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(11, size * 0.38),
        fontWeight: 700,
        color: "#0a0e16",
      }}
    >
      {initials}
    </div>
  );
}
