// ================================================================
// <Skeleton /> — khung chờ loading dùng chung (không màn hình trắng)
// ================================================================
// Mạch tư duy: thay vì <p>Đang tải...</p> khô cứng, skeleton giữ đúng
// layout sắp hiện ra nên không layout shift khi data về. Animation
// shimmer chỉ dùng opacity (rẻ), tắt hẳn khi reduced-motion.

"use client";

interface SkeletonProps {
  /** Chiều cao (px hoặc CSS) */
  height?: number | string;
  /** Chiều rộng */
  width?: number | string;
  /** Bo góc */
  radius?: number | string;
  style?: React.CSSProperties;
}

export default function Skeleton({ height = 16, width = "100%", radius = 8, style }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      aria-hidden="true"
      style={{ height, width, borderRadius: radius, ...style }}
    />
  );
}
