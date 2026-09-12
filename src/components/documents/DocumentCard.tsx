// ================================================================
// <DocumentCard /> — 1 tài liệu trong danh sách Thư viện
// ================================================================
// Mạch tư duy: trước đây card chỉ hiện 1 dòng text ghép trạng thái +
// 60 ký tự đầu summary, không có cách nào xem tiếp hay tải xuống. Card
// mới tách rõ 3 trạng thái (processing/ready/failed) — MỖI trạng thái
// có bố cục và hành động khác nhau, thay vì cố nhồi chung 1 layout.
// ================================================================

"use client";

import { useState } from "react";
import { downloadSummaryAsMarkdown } from "@/lib/documents/downloadSummary";
import { describeDocumentError } from "@/lib/documents/docErrors";
import { useToast } from "@/components/ui/Toast";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { localeFor } from "@/lib/i18n/dictionary";
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

const FORMATS = [
  { value: 'md', label: 'Markdown (.md)', icon: '📝' },
  { value: 'txt', label: 'Text (.txt)', icon: '📄' },
  { value: 'pdf', label: 'PDF (.pdf)', icon: '📕' },
  { value: 'docx', label: 'Word (.docx)', icon: '📘' },
] as const;

type Format = typeof FORMATS[number]['value'];

export default function DocumentCard({ doc, onOpenSummary, onRetry, retrying }: DocumentCardProps) {
  const { t, lang } = useLanguage();
  const [showFormatModal, setShowFormatModal] = useState(false);
  const { push } = useToast();

  async function handleDownload(format: Format) {
    setShowFormatModal(false);
    try {
      const res = await fetch(`/api/documents/${doc.id}/summary/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Không thể tải file');
      }
      
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.fileName.replace(/\.[^/.]+$/, '')}_summary.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      push("error", err instanceof Error ? err.message : t("doc.downloadFail"));
    }
  }

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

      {/* Metadata học tập khai lúc upload — phục vụ nhận biết/lọc nhanh. */}
      {(doc.subject || doc.topic || doc.difficulty) && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }} aria-label="Thông tin tài liệu">
          {doc.subject && (
            <span style={{ fontSize: 11.5, background: "var(--indigo-soft)", color: "var(--indigo)", padding: "3px 9px", borderRadius: 99, fontWeight: 600 }}>
              {doc.subject}
            </span>
          )}
          {doc.topic && (
            <span style={{ fontSize: 11.5, background: "var(--panel-strong)", border: "1px solid var(--border)", color: "var(--text-dim)", padding: "3px 9px", borderRadius: 99 }}>
              {doc.topic}
            </span>
          )}
          {doc.difficulty && (
            <span style={{ fontSize: 11.5, background: "var(--cyan-soft)", color: "var(--cyan)", padding: "3px 9px", borderRadius: 99 }}>
              {doc.difficulty === "easy" ? t("doc.difficulty.easy") : doc.difficulty === "hard" ? t("doc.difficulty.hard") : t("doc.difficulty.medium")}
            </span>
          )}
        </div>
      )}
      {doc.description && (
        <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.55 }}>{doc.description}</div>
      )}

      {doc.status === "ready" && doc.summary && (
        <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.55 }}>
          <span style={{ color: "var(--text-faint)" }}>{t("doc.summaryLabel")} </span>
          {previewText(doc.summary)}
        </div>
      )}

      {doc.status === "ready" && (
        <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={onOpenSummary} style={{ fontSize: 12.5, padding: "7px 14px" }}>
            {t("doc.viewSummary")}
          </button>
          {doc.summary && (
            <button
              className="btn-secondary"
              onClick={() => setShowFormatModal(true)}
              style={{ fontSize: 12.5, padding: "7px 14px" }}
            >
              {t("doc.download")}
            </button>
          )}
        </div>
      )}

      {doc.status === "failed" && (
        <div style={{ marginTop: 4 }}>
          {/* Nguyên nhân CỤ THỂ suy từ error code lưu DB (PDF hỏng /
              scan / quá lớn / AI quá tải...) + gợi ý khắc phục — không
              bao giờ hiện "File bị khóa" mơ hồ. */}
          <FailedCause errorMessage={doc.errorMessage} />
          <button
            className="btn-secondary"
            onClick={onRetry}
            disabled={retrying}
            style={{ fontSize: 12.5, padding: "7px 14px", opacity: retrying ? 0.6 : 1, marginTop: 8 }}
          >
            {retrying ? t("doc.retrying") : t("doc.retry")}
          </button>
        </div>
      )}

      {/* Format Selection Modal */}
      {showFormatModal && (
        <div className="modal-overlay" onClick={() => setShowFormatModal(false)} style={{ zIndex: 200 }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{t("doc.pickFormat")}</div>
              <button 
                onClick={() => setShowFormatModal(false)} 
                style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 20, cursor: "pointer", lineHeight: 1 }}
              >
                ×
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {FORMATS.map((fmt) => (
                <button
                  key={fmt.value}
                  onClick={() => handleDownload(fmt.value)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    background: "var(--panel-strong)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    color: "var(--text)",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 150ms ease",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--indigo-soft)"; e.currentTarget.style.borderColor = "var(--indigo)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--panel-strong)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  <span style={{ fontSize: 20 }}>{fmt.icon}</span>
                  <span>{fmt.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FailedCause({ errorMessage }: { errorMessage: string | null }) {
  const { t, lang } = useLanguage();
  const { userMessage, suggestion } = describeDocumentError(errorMessage, lang);
  return (
    <div
      role="alert"
      style={{
        fontSize: 12.5,
        lineHeight: 1.6,
        background: "rgba(239,106,125,0.08)",
        border: "1px solid rgba(239,106,125,0.3)",
        borderRadius: 8,
        padding: "9px 12px",
      }}
    >
      <div style={{ fontWeight: 600, color: "var(--rose)" }}>{t("doc.failTitle")} {userMessage}</div>
      <div style={{ color: "var(--text-dim)", marginTop: 2 }}>{t("doc.failHint")} {suggestion}</div>
    </div>
  );
}

function StatusLine({ status }: { status: string }) {
  const { t } = useLanguage();
  if (status === "processing") {
    return (
      <div style={{ fontSize: 12.5, color: "var(--cyan)", display: "flex", alignItems: "center", gap: 6 }}>
        <span className="spinner-dot" aria-hidden />
        {t("doc.processing")}
      </div>
    );
  }
  if (status === "ready") {
    return <div style={{ fontSize: 12.5, color: "var(--success, #4ade80)" }}>{t("doc.ready")}</div>;
  }
  if (status === "failed") {
    return <div style={{ fontSize: 12.5, color: "var(--danger, #f87171)" }}>{t("doc.failed")}</div>;
  }
  return <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{status}</div>;
}