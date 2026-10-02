// ================================================================
// <CommunityDocumentCard /> — Community document card for browse page
// ================================================================

"use client";

import type { CommunityDocumentWithRelations } from "@/types";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { localeFor, type I18nKey } from "@/lib/i18n/dictionary";

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
  const { t, lang } = useLanguage();

  const trustColors: Record<string, string> = {
    HIGH_QUALITY: "var(--cyan)",
    COMMUNITY_VERIFIED: "var(--indigo)",
    NEW: "var(--amber)",
    NEEDS_REVIEW: "var(--rose)",
    LOW_QUALITY: "var(--text-dim)",
  };

  const trustKeys: Record<string, I18nKey> = {
    HIGH_QUALITY: "com.trust.HIGH_QUALITY",
    COMMUNITY_VERIFIED: "com.trust.COMMUNITY_VERIFIED",
    NEW: "com.trust.NEW",
    NEEDS_REVIEW: "com.trust.NEEDS_REVIEW",
    LOW_QUALITY: "com.trust.LOW_QUALITY",
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const trustColor = trustColors[trustLevel] || "var(--text-dim)";
  const trustLabel = trustKeys[trustLevel] ? t(trustKeys[trustLevel]) : trustLevel;

  return (
    <div
      className="community-doc-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
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
            borderRadius: "var(--radius-pill)",
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
              borderRadius: "var(--radius-pill)",
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
            {document.difficulty === "easy" ? t("com.diff.easy") : document.difficulty === "medium" ? t("com.diff.medium") : t("com.diff.hard")}
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
                borderRadius: "var(--radius-pill)",
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
              {t("com.card.moreTags", { n: tags.length - 5 })}
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
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, var(--indigo), var(--cyan))", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--on-accent)", fontWeight: 700, fontSize: 12 }}>
              {(owner.name || owner.nickname || "?")[0].toUpperCase()}
            </div>
          )}
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
            {owner.name || owner.nickname || t("com.card.anonymous")}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
            {publishedAt ? new Date(publishedAt).toLocaleDateString(localeFor(lang)) : new Date(uploadedAt).toLocaleDateString(localeFor(lang))}
          </span>
        </div>
      </div>

      {/* Action buttons.
          On touch (mobile/APK) there is no hover, so these are ALWAYS
          visible there and only fade in on hover-capable pointers.
          The previous version used `<style jsx>` + `:host:hover`, which
          never matches in styled-jsx => the row stayed at opacity 0
          and the Save/Download buttons were permanently invisible. */}
      <div className="community-doc-card__actions">
        <button
          type="button"
          className="btn-secondary community-doc-card__action"
          onClick={(e) => { e.stopPropagation(); onSave(); }}
        >
          {saved ? t("com.card.saved") : t("com.card.save")}
        </button>
        <button
          type="button"
          className="btn-secondary community-doc-card__action"
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
        >
          {t("com.card.download")}
        </button>
      </div>
    </div>
  );
}
