// ================================================================
// <DocumentDetailModal /> — xem tóm tắt AI đầy đủ + tải xuống
// ================================================================
// Mạch tư duy: GET /api/documents (danh sách) đã trả "summary" ĐẦY ĐỦ,
// không cắt ngắn (xem api/documents/route.ts) — nên modal này nhận
// thẳng document object từ state của trang Library để mở TỨC THÌ,
// không cần gọi thêm API/hiện loading spinner khi user vừa click "Xem
// tóm tắt". API GET /api/documents/:id vẫn tồn tại độc lập (phục vụ
// nhu cầu khác như link chia sẻ trực tiếp), nhưng KHÔNG bắt buộc phải
// gọi lại ở đây — gọi thêm sẽ chỉ làm chậm UX mà không có lợi ích gì
// (dữ liệu y hệt, document đã "ready" thì summary không đổi nữa).
// ================================================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MarkdownLite from "./MarkdownLite";
import { useToast } from "@/components/ui/Toast";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { localeFor } from "@/lib/i18n/dictionary";
import { downloadSummaryAsMarkdown } from "@/lib/documents/downloadSummary";

export interface LibraryDocument {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  summary: string | null;
  // Lý do lỗi có prefix [CODE] khi status="failed" (GET /api/documents
  // chỉ expose khi failed) — UI suy ra nguyên nhân + gợi ý cụ thể qua
  // describeDocumentError(), không hiện raw message kỹ thuật.
  errorMessage: string | null;
  // Metadata học tập khai lúc upload (subject bắt buộc từ API).
  subject: string | null;
  topic: string | null;
  difficulty: string | null;
  description: string | null;
  hasOriginalFile: boolean;
  uploadedAt: string;
  updatedAt: string;
}

interface DocumentDetailModalProps {
  doc: LibraryDocument;
  onClose: () => void;
}

const FORMATS = [
  { value: 'md', label: 'Markdown (.md)', icon: '📝' },
  { value: 'txt', label: 'Text (.txt)', icon: '📄' },
  { value: 'pdf', label: 'PDF (.pdf)', icon: '📕' },
  { value: 'docx', label: 'Word (.docx)', icon: '📘' },
] as const;

type Format = typeof FORMATS[number]['value'];

export default function DocumentDetailModal({ doc, onClose }: DocumentDetailModalProps) {
  const { t, lang } = useLanguage();
  const [showFormatModal, setShowFormatModal] = useState(false);
  const [creatingMap, setCreatingMap] = useState(false);
  const router = useRouter();
  const { push } = useToast();

  async function handleCreateMindMap() {
    if (creatingMap) return;
    setCreatingMap(true);
    try {
      const res = await fetch("/api/mindmap/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: doc.id }),
      });
      const json = await res.json();
      if (!json.success) {
        push("error", json.error ?? t("doc.mindmapFail"));
        return;
      }
      push("success", t("doc.mindmapDone"));
      onClose();
      router.push(`/mindmap?id=${json.data.id}`);
    } catch {
      push("error", t("doc.mindmapFailRetry"));
    } finally {
      setCreatingMap(false);
    }
  }

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
        throw new Error(err.error || t("doc.downloadFail"));
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 600, wordBreak: "break-word" }}>{doc.fileName}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
              {doc.fileType.toUpperCase()} · {t("doc.updatedAt", { d: new Date(doc.updatedAt).toLocaleString(localeFor(lang)) })}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              fontSize: 20,
              cursor: "pointer",
              lineHeight: 1,
              padding: 4,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div className="modal-body-scroll">
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: 0.5,
              color: "var(--cyan)",
              marginBottom: 14,
            }}
          >
            {t("doc.summaryTitle")}
          </div>

          {doc.summary ? (
            <MarkdownLite content={doc.summary} />
          ) : (
            <p style={{ color: "var(--text-dim)", fontSize: 14 }}>{t("doc.noSummary")}</p>
          )}
        </div>

        <div className="modal-footer-row">
          {doc.summary && (
            <>
              <button
                className="btn-secondary"
                onClick={handleCreateMindMap}
                disabled={creatingMap}
              >
                {creatingMap ? t("doc.creatingMindmap") : t("doc.createMindmap")}
              </button>
              <button
                className="btn-secondary"
                onClick={() => setShowFormatModal(true)}
              >
                {t("doc.downloadSummary")}
              </button>
            </>
          )}
          {doc.hasOriginalFile && (
            <a className="btn-secondary" href={`/api/documents/${doc.id}/download`} download>
              {t("doc.downloadOriginal")}
            </a>
          )}
        </div>
      </div>

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