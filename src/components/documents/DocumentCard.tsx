// ================================================================
// <DocumentCard /> — 1 tài liệu trong danh sách Thư viện
// ================================================================
// Mạch tư duy: trước đây card chỉ hiện 1 dòng text ghép trạng thái +
// 60 ký tự đầu summary, không có cách nào xem tiếp hay tải xuống. Card
// mới tách rõ 3 trạng thái (processing/ready/failed) — MỖI trạng thái
// có bố cục và hành động khác nhau, thay vì cố nhồi chung 1 layout.
// ================================================================

"use client";

import { downloadSummaryAsMarkdown } from "@/lib/documents/downloadSummary";
import type { LibraryDocument } from "./DocumentDetailModal";

interface DocumentCardProps {
  doc: LibraryDocument;
  onOpenSummary: () => void;
  onRetry: () => void;
  retrying: boolean;
}

// Preview 2-3 dòng: cắt theo ký tự (đơn giản, đủ dùng) rồi giới hạn
// chiều cao bằng CSS line-clamp — tránh 1 tài liệu có summary dài phá
// vỡ chiều cao đều nhau của các card khác trong danh sách.
const PREVIEW_MAX_CHARS = 220;

function previewText(summary: string): string {
  // Bỏ heading Markdown (##, **) khỏi preview cho gọn — chỉ cần đọc
  // lướt nội dung, không cần thấy ký tự markdown thô trong 2-3 dòng
  // preview (Markdown thật sự chỉ hiển thị đẹp trong modal chi tiết).
  const plain = summary
    .replace(/^#{1,3}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[-*•]\s+/g, "")
    .replace(/\n+/g, " ")
    .trim();
  return plain.length > PREVIEW_MAX_CHARS ? `${plain.slice(0, PREVIEW_MAX_CHARS)}...` : plain;
}

export default function DocumentCard({ doc, onOpenSummary, onRetry, retrying }: DocumentCardProps) {
  return (
    <div
      style={{
        padding: "16px 4px",
        borderBottom: "1px solid var(--border-soft)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 500, wordBreak: "break-word" }}>{doc.fileName}</div>
        <span
          style={{
            fontSize: 11.5,
            color: "var(--text-dim)",
            background: "var(--panel-strong)",
            padding: "4px 9px",
            borderRadius: 7,
            flexShrink: 0,
          }}
        >
          {doc.fileType.toUpperCase()}
        </span>
      </div>

      <StatusLine status={doc.status} />

      {doc.status === "ready" && doc.summary && (
        <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.55 }}>
          <span style={{ color: "var(--text-faint)" }}>Tóm tắt: </span>
          {previewText(doc.summary)}
        </div>
      )}

      {doc.status === "ready" && (
        <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={onOpenSummary} style={{ fontSize: 12.5, padding: "7px 14px" }}>
            Xem tóm tắt
          </button>
          {doc.summary && (
            <button
              className="btn-secondary"
              onClick={() => downloadSummaryAsMarkdown(doc.fileName, doc.summary!)}
              style={{ fontSize: 12.5, padding: "7px 14px" }}
            >
              Tải xuống
            </button>
          )}
        </div>
      )}

      {doc.status === "failed" && (
        <div style={{ marginTop: 4 }}>
          <button
            className="btn-secondary"
            onClick={onRetry}
            disabled={retrying}
            style={{ fontSize: 12.5, padding: "7px 14px", opacity: retrying ? 0.6 : 1 }}
          >
            {retrying ? "Đang thử lại..." : "Thử lại"}
          </button>
        </div>
      )}
    </div>
  );
}

function StatusLine({ status }: { status: string }) {
  if (status === "processing") {
    return (
      <div style={{ fontSize: 12.5, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 6 }}>
        <span className="spinner-dot" aria-hidden />
        Đang phân tích tài liệu...
      </div>
    );
  }
  if (status === "ready") {
    return <div style={{ fontSize: 12.5, color: "var(--success, #4ade80)" }}>✓ Đã xử lý</div>;
  }
  if (status === "failed") {
    return <div style={{ fontSize: 12.5, color: "var(--danger, #f87171)" }}>✕ Không thể xử lý tài liệu</div>;
  }
  return <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{status}</div>;
}
