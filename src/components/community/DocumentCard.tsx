// ================================================================
// <CommunityDocumentCard /> — Community document card for browse page
// ================================================================

"use client";

import type { CommunityDocumentWithRelations } from "@/types";

interface CommunityDocumentCardProps {
  document: CommunityDocumentWithRelations;
  onClick: () => void;
  onSave: () => void;
  onDownload: () => void;
  saved?: boolean;
}

export default function CommunityDocumentCard({ 
  document, 
  onClick, 
  onSave, 
  onDownload,
  saved = false,
}: CommunityDocumentCardProps) {
  const { trustLevel, qualityScore, trustScore, viewCount, downloadCount, saveCount, helpfulVotes, ratingCount, averageRating, owner, subject, topic, tags, uploadedAt, publishedAt } = document;

  const trustColors: Record<string, string> = {
    HIGH_QUALITY: "var(--cyan)",
    COMMUNITY_VERIFIED: "var(--indigo)",
    NEW: "var(--amber)",
    NEEDS_REVIEW: "var(--rose)",
    LOW_QUALITY: "var(--text-dim)",
  };

  const trustLabels: Record<string, string> = {
    HIGH_QUALITY: "Chất lượng cao",
    COMMUNITY_VERIFIED: "Đã xác minh",
    NEW: "Mới",
    NEEDS_REVIEW: "Cần xem xét",
    LOW_QUALITY: "Chất lượng thấp",
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const trustColor = trustColors[trustLevel] || "var(--text-dim)";
  const trustLabel = trustLabels[trustLevel] || trustLevel;

  return (
    <div
      onClick={onClick}
      style={{
        padding: "16px",
        borderRadius: 12,
        border: "1px solid var(--border-soft)",
        background: "var(--panel-strong)",
        cursor: "pointer",
        transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
      }}
      onMouseEnter={(e) => { 
        e.currentTarget.style.transform = "translateY(-2px)"; 
        e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.3)";
        e.currentTarget.style.borderColor = "var(--indigo)";
      }}
      onMouseLeave={(e) => { 
        e.currentTarget.style.transform = "translateY(0)"; 
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.borderColor = "var(--border-soft)";
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.4, margin: 0, flex: 1, marginRight: 12 }}>
          {document.title}
        </h3>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 8px",
            borderRadius: 99,
            background: `${trustColor}20`,
            color: trustColor,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {trustLabel}
        </span>
      </div>

      {/* Meta */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, fontSize: 12, color: "var(--text-dim)" }}>
        {subject && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {subject.icon || "📚"} {subject.name}
          </span>
        )}
        {topic && (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {topic.icon || "📁"} {topic.name}
          </span>
        )}
        {document.difficulty && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
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
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 12, paddingTop: 12, borderTop: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)", fontSize: 12 }}>
          <span style={{ color: "var(--cyan)" }}>⭐</span>
          <span>{averageRating > 0 ? averageRating.toFixed(1) : "—"}</span>
          <span style={{ color: "var(--text-faint)", marginLeft: 4 }}>({ratingCount})</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)", fontSize: 12 }}>
          <span style={{ color: "var(--indigo)" }}>👁</span>
          <span>{formatNumber(viewCount)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)", fontSize: 12 }}>
          <span style={{ color: "var(--indigo)" }}>⬇</span>
          <span>{formatNumber(downloadCount)}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)", fontSize: 12 }}>
          <span style={{ color: "var(--amber)" }}>💾</span>
          <span>{formatNumber(saveCount)}</span>
        </div>
        {helpfulVotes > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-dim)", fontSize: 12 }}>
            <span style={{ color: "var(--green)" }}>👍</span>
            <span>{formatNumber(helpfulVotes)}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {tags && tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {tags.slice(0, 5).map((tag) => (
            <span
              key={tag}
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 99,
                background: "var(--panel)",
                border: "1px solid var(--border-soft)",
                color: "var(--text-dim)",
              }}
            >
              #{tag}
            </span>
          ))}
          {tags.length > 5 && (
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
              +{tags.length - 5} khác
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 12, borderTop: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
{owner.image ? (
              <img src={owner.image} alt={owner.name || ""} style={{ width: 28, height: 28, borderRadius: "50%" }} />
            ) : (
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, var(--indigo), var(--cyan))", display: "flex", alignItems: "center", justifyContent: "center", color: "#0a0e16", fontWeight: 700, fontSize: 12 }}>
              {(owner.name || owner.nickname || "?")[0].toUpperCase()}
            </div>
          )}
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
            {owner.name || owner.nickname || "Ẩn danh"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
            {publishedAt ? new Date(publishedAt).toLocaleDateString("vi-VN") : new Date(uploadedAt).toLocaleDateString("vi-VN")}
          </span>
        </div>
      </div>

      {/* Action buttons (overlay on hover) */}
      <div style={{ display: "flex", gap: 8, marginTop: 12, opacity: 0, transition: "opacity 0.15s ease", justifyContent: "flex-end" }} className="card-actions">
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--panel-strong)",
            color: "var(--text)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--indigo-soft)"; e.currentTarget.style.borderColor = "var(--indigo)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--panel-strong)"; e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          {saved ? "✓ Đã lưu" : "💾 Lưu"}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--panel-strong)",
            color: "var(--text)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--indigo-soft)"; e.currentTarget.style.borderColor = "var(--indigo)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--panel-strong)"; e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          ⬇ Tải
        </button>
      </div>

      <style jsx>{`
        .card-actions { opacity: 0; }
        :host:hover .card-actions { opacity: 1; }
      `}</style>
    </div>
  );
}