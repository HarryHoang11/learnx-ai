// ================================================================
// <SummaryDrawer /> — đọc tóm tắt AI đầy đủ trong drawer/modal
// ================================================================
// Mạch tư duy: Workspace phải gọn như "learning dashboard" — chỉ meta +
// actions + preview 1-3 dòng. Nội dung Markdown/LaTeX DÀI nằm sau nút
// "Xem tóm tắt" (drawer) để không đẩy các action quan trọng xuống dưới.
//
// Tái dùng pattern modal chuẩn của project (.modal-overlay + .modal-card-wide
// + .modal-header-row/.modal-body-scroll/.modal-footer-row — cùng hệ với
// DocumentDetailModal, đã có responsive + dark glassmorphism sẵn), và
// MarkdownLite (renderer markdown+KaTeX duy nhất) nên công thức hiển thị
// đúng như trong Library.
//
// Download KHÔNG gọi AI lại: summary đã có sẵn trong state — component gọi
// POST /api/documents/[id]/summary/download (route server đã tồn tại, hỗ
// trợ md/txt/pdf/docx) rồi trigger Blob download ở client.
// ================================================================

"use client";

import { useEffect, useState } from "react";
import MarkdownLite from "./MarkdownLite";
import { useToast } from "@/components/ui/Toast";
import { useLanguage } from "@/components/providers/LanguageProvider";

const FORMATS = [
  { value: "md", label: "Markdown (.md)", icon: "📝" },
  { value: "txt", label: "Text (.txt)", icon: "📄" },
  { value: "pdf", label: "PDF (.pdf)", icon: "📕" },
  { value: "docx", label: "Word (.docx)", icon: "📘" },
] as const;

type Format = (typeof FORMATS)[number]["value"];

interface SummaryDrawerProps {
  documentId: string;
  fileName: string;
  summary: string;
  onClose: () => void;
}

export default function SummaryDrawer({ documentId, fileName, summary, onClose }: SummaryDrawerProps) {
  const { t } = useLanguage();
  const { push } = useToast();
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Khóa scroll nền + đóng bằng Escape — cùng UX với DocumentDetailModal.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function handleDownload(format: Format) {
    if (downloading) return;
    setShowFormatPicker(false);
    setDownloading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/summary/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error ?? t("doc.downloadFail"));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName.replace(/\.[^/.]+$/, "")}_summary.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      push("error", err instanceof Error ? err.message : t("doc.downloadFail"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={t("workspace.summaryDrawerTitle")}>
      <div className="modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div style={{ minWidth: 0 }}>
            <div className="workspace-kicker">{t("workspace.summaryLabel")}</div>
            <h2 style={{ fontSize: 17, margin: "6px 0 0", overflowWrap: "anywhere" }}>{fileName}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("common.close")}
            style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 24, cursor: "pointer", lineHeight: 1, flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        <div className="modal-body-scroll">
          <MarkdownLite content={summary} />
        </div>

        <div className="modal-footer-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setShowFormatPicker((v) => !v)}
            disabled={downloading}
            aria-expanded={showFormatPicker}
          >
            {downloading ? t("doc.downloading") : `⬇ ${t("workspace.downloadGuide")}`}
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {t("common.close")}
          </button>
          {showFormatPicker && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: "100%", marginTop: 4 }}>
              {FORMATS.map((fmt) => (
                <button
                  key={fmt.value}
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleDownload(fmt.value)}
                  style={{ fontSize: 12.5, padding: "7px 12px" }}
                >
                  <span aria-hidden="true">{fmt.icon}</span> {fmt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
