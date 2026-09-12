// ================================================================
// <ContributorLeaderboard /> — Leaderboard component for contributors
// ================================================================

"use client";

import type { LeaderboardEntry } from "@/services/contribution.service";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { localeFor } from "@/lib/i18n/dictionary";

interface ContributorLeaderboardProps {
  leaderboard: LeaderboardEntry[];
  period: "weekly" | "monthly" | "alltime";
  onPeriodChange: (period: "weekly" | "monthly" | "alltime") => void;
  loading?: boolean;
}

const PERIOD_KEYS = {
  weekly: "com.lb.weekly",
  monthly: "com.lb.monthly",
  alltime: "com.lb.alltime",
} as const;

const PERIOD_ICONS: Record<"weekly" | "monthly" | "alltime", string> = {
  weekly: "📅",
  monthly: "📆",
  alltime: "🏆",
};

const MEDALS = ["🥇", "🥈", "🥉"];

export default function ContributorLeaderboard({
  leaderboard,
  period,
  onPeriodChange,
  loading = false,
}: ContributorLeaderboardProps) {
  const { t, lang } = useLanguage();
  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-dim)" }}>
        {t("com.lb.loading")}
      </div>
    );
  }

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "var(--text-dim)" }}>
        {t("lb.emptyContrib")}
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--border-soft)", borderRadius: 12, background: "var(--panel)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", borderBottom: "1px solid var(--border-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20 }}>🏆</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{t("com.lb.title").replace("🏆 ", "")}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
              {t("com.lb.subtitle")}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {(["weekly", "monthly", "alltime"] as const).map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: period === p ? "var(--indigo)" : "var(--panel-strong)",
                color: period === p ? "#0a0e16" : "var(--text)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (period !== p) {
                  e.currentTarget.style.background = "var(--indigo-soft)";
                  e.currentTarget.style.borderColor = "var(--indigo)";
                }
              }}
              onMouseLeave={(e) => {
                if (period !== p) {
                  e.currentTarget.style.background = "var(--panel-strong)";
                  e.currentTarget.style.borderColor = "var(--border)";
                }
              }}
            >
              {PERIOD_ICONS[p]} {t(PERIOD_KEYS[p])}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard List */}
      <div style={{ maxHeight: 500, overflowY: "auto" }}>
        {leaderboard.map((entry, index) => {
          const rank = entry.rank || index + 1;
          const isTop3 = rank <= 3;
          
          return (
            <div
              key={entry.userId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderBottom: "1px solid var(--border-soft)",
                background: isTop3 ? "var(--amber-soft)" : "transparent",
                transition: "background 0.15s ease",
              }}
            >
              {/* Rank */}
              <div style={{ 
                width: 50, 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                fontSize: isTop3 ? 20 : 14,
                fontWeight: isTop3 ? 700 : 600,
                color: isTop3 ? "var(--amber)" : "var(--text-dim)",
              }}>
                {isTop3 ? MEDALS[rank - 1] : `#${rank}`}
              </div>

              {/* Avatar & Name */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                {entry.image ? (
                  <img src={entry.image} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ 
                    width: 36, 
                    height: 36, 
                    borderRadius: "50%", 
                    background: "linear-gradient(135deg, var(--indigo), var(--cyan))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#0a0e16",
                    fontWeight: 700,
                    fontSize: 14,
                  }}>
                    {(entry.name || entry.nickname || "?")[0].toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ 
                    fontWeight: 600, 
                    fontSize: 14, 
                    color: "var(--text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {entry.name}
                    {entry.nickname && (
                      <span style={{ color: "var(--text-dim)", fontWeight: 400, marginLeft: 6, fontSize: 13 }}>
                        ({entry.nickname})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-faint)", display: "flex", gap: 12, marginTop: 2 }}>
                    <span>📄 {t("com.lb.uploads", { n: entry.totalUploads })}</span>
                    <span>⭐ {entry.avgQuality.toFixed(0)} {t("com.lb.quality")}</span>
                    <span>👍 {entry.helpfulVotes} {t("com.detail.helpful").toLowerCase()}</span>
                  </div>
                </div>
              </div>

              {/* CP */}
              <div style={{ textAlign: "right", minWidth: 100 }}>
                <div style={{ 
                  fontWeight: 700, 
                  fontSize: 18, 
                  color: "var(--amber)",
                  fontFamily: "var(--font-space-grotesk), sans-serif",
                }}>
                  {entry.contributionPoints.toLocaleString(localeFor(lang))}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                  CP
                </div>
                <div style={{ marginTop: 4 }}>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 99,
                      background: "var(--indigo-soft)",
                      color: "var(--indigo)",
                      fontWeight: 600,
                    }}
                  >
                    Level {entry.level}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatNumber(num: number) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}