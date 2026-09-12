// ================================================================
// <ReportModal /> — Report document modal
// ================================================================

"use client";

import { useState } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { I18nKey } from "@/lib/i18n/dictionary";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, description: string) => void;
  disabled?: boolean;
}

const REPORT_REASON_KEYS = [
  "com.report.r.WRONG_INFO",
  "com.report.r.SPAM",
  "com.report.r.DUPLICATE",
  "com.report.r.MISLEADING",
  "com.report.r.INAPPROPRIATE",
  "com.report.r.COPYRIGHT",
  "com.report.r.WRONG_SUBJECT",
  "com.report.r.OTHER",
] as const;

const REASON_VALUES = [
  "WRONG_INFO",
  "SPAM",
  "DUPLICATE",
  "MISLEADING",
  "INAPPROPRIATE",
  "COPYRIGHT",
  "WRONG_SUBJECT",
  "OTHER",
] as const;

export default function ReportModal({
  isOpen,
  onClose,
  onSubmit,
  disabled = false,
}: ReportModalProps) {
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const { t } = useLanguage();

  const reasonLabel = (value: string): string => {
    const idx = REASON_VALUES.indexOf(value as (typeof REASON_VALUES)[number]);
    return idx >= 0 ? t(REPORT_REASON_KEYS[idx] as I18nKey) : value;
  };

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
          <div style={{ fontWeight: 600, fontSize: 16 }}>{t("com.report.title")}</div>
          <button onClick={onClose} aria-label={t("common.close")} style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 24, cursor: "pointer", lineHeight: 1, padding: 4 }}>×</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-dim)", marginBottom: 8 }}>{t("com.report.reason")}</label>
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
            <option value="">{t("com.report.pickReason")}</option>
            {REASON_VALUES.map((v, i) => (
              <option key={v} value={v}>{t(REPORT_REASON_KEYS[i])}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-dim)", marginBottom: 8 }}>{t("com.report.descLabel")}</label>
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
            placeholder={t("com.report.details")}
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn-secondary" onClick={onClose}>{t("com.report.cancel")}</button>
          <button
            className="btn-secondary"
            onClick={handleSubmit}
            style={{ background: "var(--rose)", borderColor: "var(--rose)", color: "#0a0e16" }}
            disabled={!reportReason || disabled}
          >
            {t("com.report.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}