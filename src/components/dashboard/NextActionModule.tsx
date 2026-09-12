// ================================================================
// <NextActionModule /> — "Bạn nên làm gì tiếp theo?"
// ================================================================
// Component hiển thị danh sách hành động học tập được AI đề xuất.
// Fetch từ /api/next-action, render dạng list card có action riêng.
// ================================================================

"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import Skeleton from "@/components/ui/Skeleton";
import StateMessage from "@/components/ui/StateMessage";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { hasKey, type I18nKey } from "@/lib/i18n/dictionary";
import type { ApiResponse } from "@/types";
import type { NextAction } from "@/app/api/next-action/route";
import { useRouter } from "next/navigation";

export default function NextActionModule() {
  const router = useRouter();
  const { t } = useLanguage();
  const [actions, setActions] = useState<NextAction[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/next-action")
      .then((res) => res.json())
      .then((json: ApiResponse<{ actions: NextAction[] }>) => {
        if (json.success) setActions(json.data.actions);
        else setError(json.error);
      })
      .catch(() => setError(t("common.connectionError")))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Panel>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{t("dashboard.nextActionTitle")}</div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Skeleton height={60} radius={8} />
          <Skeleton height={60} radius={8} />
          <Skeleton height={60} radius={8} />
        </div>
      ) : error ? (
        <StateMessage kind="error" text={error} />
      ) : !actions || actions.length === 0 ? (
        <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
          {t("dashboard.nextActionEmpty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {actions.slice(0, 3).map((action) => (
            <NextActionCard key={action.id} action={action} onClick={() => router.push(action.href)} />
          ))}
        </div>
      )}
    </Panel>
  );
}

function NextActionCard({ action, onClick }: { action: NextAction; onClick: () => void }) {
  const { t } = useLanguage();

  const typeLabelKey = `dashboard.actionType.${action.type}` as I18nKey;
  const typeLabel = hasKey(typeLabelKey) ? t(typeLabelKey) : action.type;

  return (
    <div
      className="action-card"
      onClick={onClick}
      style={{
        padding: "12px 14px",
        borderRadius: 10,
        background: "var(--panel)",
        border: "1px solid var(--border)",
        cursor: "pointer",
        transition: "border-color 0.2s, background 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--cyan)";
        e.currentTarget.style.background = "var(--cyan-soft)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.background = "var(--panel)";
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 12,
                background: getPriorityColor(action.priority),
                color: "#fff",
                fontWeight: 600,
              }}
            >
              {typeLabel}
            </span>
            {action.topic && <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{action.topic}</span>}
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>{action.title}</div>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.5 }}>{action.description}</div>
        </div>
        {action.estimatedMinutes && (
          <div style={{ fontSize: 11, color: "var(--text-dim)", whiteSpace: "nowrap" }}>
            {action.estimatedMinutes} phút
          </div>
        )}
      </div>
      <button
        className="btn-primary"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        style={{ marginTop: 8, fontSize: 12 }}
      >
        {action.cta}
      </button>
    </div>
  );
}

function getPriorityColor(priority: number): string {
  if (priority >= 90) return "#ef4444";
  if (priority >= 70) return "#f59e0b";
  if (priority >= 50) return "#3b82f6";
  if (priority >= 30) return "#10b981";
  return "#8b5cf6";
}
