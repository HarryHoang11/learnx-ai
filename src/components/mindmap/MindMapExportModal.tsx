// ================================================================
// <MindMapExportModal /> — Modal chọn định dạng export mind map
// ================================================================
// Khi click "Tải xuống"/"Export" trên trang mind map, mở modal này
// thay vì download ngay — người dùng chọn format (PNG/SVG/PDF/JSON/
// Markdown), xem mô tả, rồi bấm "Xuất file".
//
// Modal có: selected state, loading state, success/error toast, và
// responsive mobile (modal-card co giãn, options xếp dọc).
//
// Toàn bộ logic sinh file nằm trong service (lib/mindmap/export.ts)
// + API route cho PDF — component chỉ render UI và điều phối.
// ================================================================

"use client";

import { useState } from "react";
import { Download, X } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { I18nKey } from "@/lib/i18n/dictionary";
import {
  type ExportFormat,
  sanitizeFilename,
  generateMindMapSVG,
  svgToPngBlob,
  generateMindMapMarkdown,
  toMindMapJsonExport,
  downloadBlob,
  downloadText,
} from "@/lib/mindmap/export";
import type { MindMapData } from "@/lib/mindmap/graph";

interface MindMapExportModalProps {
  open: boolean;
  onClose: () => void;
  /** Tên mind map — dùng làm tên file (đã sanitize). */
  title: string;
  data: MindMapData;
  /** Node đang thu gọn — nhánh con của chúng bị bỏ khỏi export. */
  collapsed?: Set<string>;
}

interface FormatMeta {
  value: ExportFormat;
  label: string;
  descriptionKey: I18nKey;
  icon: string;
}

const FORMAT_META: FormatMeta[] = [
  { value: "png", label: "PNG", descriptionKey: "mm.fmtPng", icon: "🖼️" },
  { value: "svg", label: "SVG", descriptionKey: "mm.fmtSvg", icon: "📐" },
  { value: "pdf", label: "PDF", descriptionKey: "mm.fmtPdf", icon: "📕" },
  { value: "json", label: "JSON", descriptionKey: "mm.fmtJson", icon: "📦" },
  { value: "md", label: "Markdown", descriptionKey: "mm.fmtMd", icon: "📝" },
];

export default function MindMapExportModal({
  open,
  onClose,
  title,
  data,
  collapsed = new Set(),
}: MindMapExportModalProps) {
  const { t } = useLanguage();
  const { push } = useToast();
  const [selected, setSelected] = useState<ExportFormat>("png");
  const [exporting, setExporting] = useState(false);

  /**
   * Sinh và tải file theo format đang chọn.
   * PNG/SVG/Markdown/JSON sinh hoàn toàn ở client; PDF cần gửi PNG
   * lên server vì pdfkit chỉ chạy được ở Node runtime.
   */
  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    const filename = sanitizeFilename(title, selected);

    try {
      if (selected === "json") {
        downloadText(toMindMapJsonExport(data, title), filename, "application/json;charset=utf-8");
      } else if (selected === "md") {
        downloadText(generateMindMapMarkdown(data, title), filename, "text/markdown;charset=utf-8");
      } else if (selected === "svg") {
        downloadText(
          generateMindMapSVG(data, { collapsed, title }),
          filename,
          "image/svg+xml;charset=utf-8"
        );
      } else if (selected === "png") {
        // scale 2 giữ nét chữ khi xem trên màn hình retina hoặc phóng to.
        const svg = generateMindMapSVG(data, { collapsed, title });
        downloadBlob(await svgToPngBlob(svg, 2), filename);
      } else if (selected === "pdf") {
        const svg = generateMindMapSVG(data, { collapsed, title });
        const pngBlob = await svgToPngBlob(svg, 2);
        const form = new FormData();
        form.append("title", title);
        form.append("image", pngBlob, sanitizeFilename(title, "png"));
        form.append("mimeType", "image/png");

        const res = await fetch("/api/mindmap/export", { method: "POST", body: form });
        if (!res.ok) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(err?.error ?? t("mm.exportFail"));
        }
        downloadBlob(await res.blob(), filename);
      }

      const label = FORMAT_META.find((f) => f.value === selected)?.label ?? selected;
      push("success", t("mm.exportSuccess", { f: label }));
    } catch (err) {
      push("error", err instanceof Error ? err.message : t("mm.exportFail"));
    } finally {
      setExporting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={t("mm.exportTitle")}
      onClick={() => !exporting && onClose()}
    >
      <div className="modal-card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <h3 className="modal-title">{t("mm.exportTitle")}</h3>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={exporting}
            aria-label={t("common.close")}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {FORMAT_META.map((fmt) => {
            const isSelected = selected === fmt.value;
            return (
              <button
                key={fmt.value}
                type="button"
                onClick={() => setSelected(fmt.value)}
                disabled={exporting}
                aria-pressed={isSelected}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: isSelected ? "2px solid var(--cyan)" : "1px solid var(--border)",
                  background: isSelected ? "var(--cyan-soft)" : "var(--panel-strong)",
                  cursor: exporting ? "default" : "pointer",
                  opacity: exporting ? 0.6 : 1,
                  textAlign: "left",
                  font: "inherit",
                }}
              >
                <span aria-hidden="true" style={{ fontSize: 20, flexShrink: 0 }}>
                  {fmt.icon}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: 14,
                      fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? "var(--cyan)" : "var(--text)",
                    }}
                  >
                    {fmt.label}
                  </span>
                  <span style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                    {t(fmt.descriptionKey)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={exporting}
            style={{ flex: 1, minWidth: 110, justifyContent: "center" }}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleExport}
            disabled={exporting}
            style={{ flex: 2, minWidth: 130, justifyContent: "center" }}
          >
            {exporting ? (
              <>
                <span className="spinner-dot" aria-hidden="true" />
                {t("mm.exporting")}
              </>
            ) : (
              <>
                <Download size={14} aria-hidden="true" />
                {t("mm.exportFile")}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}