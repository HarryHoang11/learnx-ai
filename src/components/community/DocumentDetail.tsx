// ================================================================
// <CommunityDocumentDetail /> — Full document detail view
// ================================================================

"use client";

import { useState } from "react";
import type { CommunityDocumentWithRelations } from "@/types";
import MarkdownLite from "@/components/documents/MarkdownLite";
import ReportModal from "@/components/community/ReportModal";

interface CommunityDocumentDetailProps {
  document: CommunityDocumentWithRelations;
  onClose: () => void;
  onRate: (rating: number) => void;
  onSave: () => void;
  onDownload: () => void;
  onReport: (reason: string, description: string) => void;
  userRating?: number;
  saved?: boolean;
}

const TRUST_LABELS: Record<string, string> = {
  HIGH_QUALITY: "Chất lượng cao",
  COMMUNITY_VERIFIED: "Đã xác minh",
  NEW: "Mới",
  NEEDS_REVIEW: "Cần xem xét",
  LOW_QUALITY: "Chất lượng thấp",
};

const TRUST_COLORS: Record<string, string> = {
  HIGH_QUALITY: "var(--cyan)",
  COMMUNITY_VERIFIED: "var(--indigo)",
  NEW: "var(--amber)",
  NEEDS_REVIEW: "var(--rose)",
  LOW_QUALITY: "var(--text-dim)",
};

export default function CommunityDocumentDetail({
  document,
  onClose,
  onRate,
  onSave,
  onDownload,
  onReport,
  userRating,
  saved = false,
}: CommunityDocumentDetailProps) {
  const [showReportModal, setShowReportModal] = useState(false);

  const { trustLevel, qualityScore, averageRating, ratingCount, helpfulVotes, viewCount, downloadCount, saveCount, owner, subject, topic, tags, summary, aiQuality, aiEvaluatedAt } = document;

  const trustColor = TRUST_COLORS[trustLevel] || "var(--text-dim)";
  const trustLabel = TRUST_LABELS[trustLevel] || trustLevel;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const handleReportSubmit = (reason: string, description: string) => {
    onReport(reason, description);
    setShowReportModal(false);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card-wide" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header-row">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{document.title}</h2>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 99,
                  background: `${TRUST_COLORS[trustLevel] || "var(--text-dim)"}20`,
                  color: TRUST_COLORS[trustLevel] || "var(--text-dim)",
                }}
              >
                {TRUST_LABELS[trustLevel] || trustLevel}
              </span>
              {document.qualityScore >= 0 && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    padding: "4px 10px",
                    borderRadius: 99,
                    background: "var(--cyan-soft)",
                    color: "var(--cyan)",
                  }}
                >
                  Quality: {document.qualityScore.toFixed(0)}/100
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4, display: "flex", flexWrap: "wrap", gap: 12 }}>
              {subject && <span>{subject.icon || "📚"} {subject.name}</span>}
              {topic && <span>{topic.icon || "📁"} {topic.name}</span>}
              {document.difficulty && (
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 600,
                    background:
                      document.difficulty === "easy" ? "var(--cyan-soft)" :
                      document.difficulty === "medium" ? "var(--indigo-soft)" :
                      "var(--amber-soft)",
                    color:
                      document.difficulty === "easy" ? "var(--cyan)" :
                      document.difficulty === "medium" ? "var(--indigo)" :
                      "var(--amber)",
                  }}
                >
                  {document.difficulty === "easy" ? "Dễ" : document.difficulty === "medium" ? "Trung bình" : "Khó"}
                </span>
              )}
              <span>{document.language?.toUpperCase() || "VI"}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              fontSize: 24,
              cursor: "pointer",
              lineHeight: 1,
              padding: 4,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="modal-body-scroll" style={{ maxHeight: "60vh" }}>
          {/* Stats */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--border-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--panel)", borderRadius: 8, border: "1px solid var(--border-soft)" }}>
              <span style={{ color: "var(--cyan)", fontSize: 16 }}>⭐</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
                  {document.averageRating > 0 ? document.averageRating.toFixed(1) : "—"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)" }}>
                  {document.ratingCount} đánh giá
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--panel)", borderRadius: 8, border: "1px solid var(--border-soft)" }}>
              <span style={{ color: "var(--cyan)" }}>👁</span>
              <div style={{ fontWeight: 600 }}>Lượt xem</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{formatNumber(document.viewCount)}</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--panel)", borderRadius: 8, border: "1px solid var(--border-soft)" }}>
              <span style={{ color: "var(--indigo)" }}>⬇</span>
              <div style={{ fontWeight: 600 }}>Tải về</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{formatNumber(document.downloadCount)}</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--panel)", borderRadius: 8, border: "1px solid var(--border-soft)" }}>
              <span style={{ color: "var(--amber)" }}>💾</span>
              <div style={{ fontWeight: 600 }}>Lưu</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{formatNumber(document.saveCount)}</div>
            </div>

            {document.helpfulVotes > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--panel)", borderRadius: 8, border: "1px solid var(--border-soft)" }}>
                <span style={{ color: "var(--green)" }}>👍</span>
                <div style={{ fontWeight: 600 }}>Hữu ích</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{formatNumber(document.helpfulVotes)}</div>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--panel)", borderRadius: 8, border: "1px solid var(--border-soft)" }}>
              <span style={{ color: "var(--cyan)" }}>⭐</span>
              <div style={{ fontWeight: 600 }}>Chất lượng</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--cyan)" }}>{document.qualityScore.toFixed(0)}/100</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--panel)", borderRadius: 8, border: "1px solid var(--border-soft)" }}>
              <span style={{ color: TRUST_COLORS[trustLevel] }}>✓</span>
              <div style={{ fontWeight: 600 }}>Độ tin cậy</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: TRUST_COLORS[trustLevel] }}>{TRUST_LABELS[trustLevel] || trustLevel}</div>
            </div>
          </div>

          {/* Tags */}
          {tags && tags.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
              {tags.slice(0, 8).map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 12,
                    padding: "4px 10px",
                    borderRadius: 99,
                    background: "var(--panel)",
                    border: "1px solid var(--border-soft)",
                    color: "var(--text-dim)",
                  }}
                >
                  #{tag}
                </span>
              ))}
              {tags.length > 8 && (
                <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  +{tags.length - 8} tag khác
                </span>
              )}
            </div>
          )}

          {/* AI Quality Details */}
          {aiQuality && (
            <div style={{ marginBottom: 20, padding: 16, background: "var(--indigo-soft)", borderRadius: 12, border: "1px solid var(--indigo)" }}>
              <div style={{ fontWeight: 600, marginBottom: 12, color: "var(--indigo)", display: "flex", alignItems: "center", gap: 8 }}>
                <span>🤖</span>
                Đánh giá chất lượng bởi AI
                {aiEvaluatedAt && (
                  <span style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 400 }}>
                    Đã đánh giá: {new Date(aiEvaluatedAt).toLocaleDateString("vi-VN")}
                  </span>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
{Object.entries(aiQuality).map(([key, value]) => {
                  return (
                    <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "capitalize" }}>{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ flex: 1, height: 6, background: "var(--panel)", borderRadius: 3, overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, Number(value) || 0))}%`,
                              height: "100%",
                              background: Number(value) >= 70 ? "var(--cyan)" : Number(value) >= 40 ? "var(--amber)" : "var(--rose)",
                              borderRadius: 3,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 35, textAlign: "right" }}>
                          {Math.round(Number(value) || 0)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary */}
          {summary && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, color: "var(--cyan)", marginBottom: 12 }}>
                TÓM TẮT AI
              </div>
              <MarkdownLite content={summary} />
            </div>
          )}

          {/* Footer Actions */}
          <div className="modal-footer-row" style={{ paddingTop: 16, borderTop: "1px solid var(--border-soft)" }}>
            <button
              className="btn-secondary"
              onClick={onSave}
              style={{ opacity: saved ? 0.7 : 1 }}
            >
              {saved ? "✓ Đã lưu" : "💾 Lưu tài liệu"}
            </button>
            <button className="btn-secondary" onClick={onDownload}>
              ⬇ Tải tài liệu
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowReportModal(true)}
              style={{ borderColor: "var(--rose)", color: "var(--rose)" }}
            >
              🚩 Báo cáo
            </button>
            {userRating && (
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                Bạn đã đánh giá: {"⭐".repeat(userRating)}
              </span>
            )}
          </div>
        </div>

        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          onSubmit={handleReportSubmit}
        />
      </div>
    </div>
  );
}