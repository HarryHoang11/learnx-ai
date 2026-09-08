// ================================================================
// <DeleteRoadmapDialog /> — xác nhận trước khi xoá 1 lộ trình
// ================================================================
"use client";

interface DeleteRoadmapDialogProps {
  goalTitle: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteRoadmapDialog({ goalTitle, deleting, onCancel, onConfirm }: DeleteRoadmapDialogProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>
          Bạn có chắc muốn xóa lộ trình này?
        </div>

        <div
          style={{
            background: "var(--panel-strong)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>Lộ trình:</div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>&quot;{goalTitle}&quot;</div>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6, marginBottom: 20 }}>
          Tiến độ và các bản kế hoạch (roadmap) liên quan tới lộ trình này sẽ bị xoá vĩnh viễn.
          Lịch sử làm bài/đánh giá năng lực của bạn ở các môn khác sẽ KHÔNG bị ảnh hưởng.
        </p>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={onCancel} disabled={deleting}>
            Hủy
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              background: "var(--rose, #f87171)",
              color: "#1a0a0a",
              border: "none",
              borderRadius: 10,
              padding: "9px 18px",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: deleting ? "not-allowed" : "pointer",
              opacity: deleting ? 0.7 : 1,
            }}
          >
            {deleting ? "Đang xoá..." : "Xoá lộ trình"}
          </button>
        </div>
      </div>
    </div>
  );
}
