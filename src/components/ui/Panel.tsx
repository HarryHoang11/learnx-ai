// ================================================================
// <Panel /> — khối "card" glassmorphism dùng chung
// ================================================================
// Mạch tư duy: mọi khối nội dung trong app (stat card, chat box, khối
// roadmap...) đều là 1 "tấm kính" nền mờ + viền mảnh. Thay vì lặp lại
// class "panel" (globals.css) ở khắp nơi, bọc thành component để nếu
// sau này panel cần thêm hành vi (vd click để mở rộng), chỉ sửa 1 chỗ.
// ================================================================

import type { CSSProperties, ReactNode } from "react";

interface PanelProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export default function Panel({ children, style, className }: PanelProps) {
  return (
    <div className={`panel ${className ?? ""}`} style={style}>
      {children}
    </div>
  );
}
