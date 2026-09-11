// ================================================================
// <ReportModal /> — Report document modal
// ================================================================

"use client";

import { useState } from "react";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, description: string) => void;
  disabled?: boolean;
}

const REPORT_REASONS = [
  { value: "WRONG_INFO", label: "Sai thông tin" },
  { value: "SPAM", label: "Spam" },
  { value: "DUPLICATE", label: "Trùng lặp" },
  { value: "MISLEADING", label: "Gây hiểu lầm" },
  { value: "INAPPROPRIATE", label: "Nội dung không phù hợp" },
  { value: "COPYRIGHT", label: "Vi phạm bản quyền" },
  { value: "WRONG_SUBJECT", label: "Sai môn học/chủ đề" },
  { value: "OTHER", label: "Khác" },
];

export default function ReportModal({
  isOpen,
  onClose,
  onSubmit,
  disabled = false,
}: ReportModalProps) {
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");

  const handleSubmit = () => {
    if (!reportReason) return;
    onSubmit(reportReason, reportDescription);
    onClose();
    setReportReason("");
    setReportDescription("");
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 300 }}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Báo cáo tài liệu</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 24, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-dim)", marginBottom: 8 }}>Lý do báo cáo</label>
          <select
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "var(--panel-strong)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
              fontSize: 14,
            }}
          >
            <option value="">Chọn lý do</option>
            {REPORT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-dim)", marginBottom: 8 }}>Mô tả chi tiết (tùy chọn)</label>
          <textarea
            value={reportDescription}
            onChange={(e) => setReportDescription(e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: "10px 12px",
              background: "var(--panel-strong)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text)",
              fontSize: 14,
              fontFamily: "inherit",
              resize: "vertical",
            }}
            placeholder="Mô tả chi tiết vấn đề..."
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={onClose}>Hủy</button>
          <button
            className="btn-secondary"
            onClick={handleSubmit}
            style={{ background: "var(--rose)", borderColor: "var(--rose)", color: "#0a0e16" }}
            disabled={!reportReason || disabled}
          >
            Gửi báo cáo
          </button>
        </div>
      </div>
    </div>
  );
}