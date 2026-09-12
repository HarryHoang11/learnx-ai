// ================================================================
// <EmptyState /> — trạng thái trống dùng chung, có CTA
// ================================================================
// Mạch tư duy: mọi danh sách rỗng (skill map, activity, mind map...)
// đều cần cùng 1 mẫu: icon + tiêu đề + mô tả + nút hành động — tách
// riêng để không mỗi trang tự bịa 1 kiểu empty khác nhau.

"use client";

import Panel from "./Panel";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon = "📭", title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Panel style={{ textAlign: "center", padding: "30px 22px" }}>
      <div style={{ fontSize: 30, marginBottom: 10 }} aria-hidden="true">
        {icon}
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>{title}</div>
      {description && (
        <p style={{ fontSize: 13.5, color: "var(--text-dim)", margin: "0 0 14px", lineHeight: 1.6 }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <button type="button" className="btn-primary" onClick={onAction} style={{ fontSize: 13.5 }}>
          {actionLabel}
        </button>
      )}
    </Panel>
  );
}
