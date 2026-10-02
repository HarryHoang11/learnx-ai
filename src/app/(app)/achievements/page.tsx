// ================================================================
// TRANG THÀNH TỰU (/achievements)
// ================================================================
// Mạch tư duy: KHÔI PHỤC UI cho backend đã có (`/api/achievements`,
// ACHIEVEMENT_DEFINITIONS trong services/achievement.service.ts, model
// Achievement/UserAchievement trong Prisma) — trước đợt này không có file
// .tsx nào gọi endpoint này.
//
// Trang cố ý CHỈ hiển thị dữ liệu thật:
//   - Danh sách đầy đủ lấy từ `?progress=true` (route mặc định chỉ trả
//     achievement ĐÃ mở khoá).
//   - Vì `getAchievementProgress()` hiện trả `progress: 0` cho mọi mục (có
//     TODO trong service — xem AchievementCard), ta KHÔNG hiện % tiến độ giả,
//     mà hiện ĐIỀU KIỆN thật lấy từ trường `condition`.
// Bộ lọc (tất cả / đã đạt / chưa đạt) giúp người học tập trung vào cái
// gần đạt thay vì cuộn giữa hàng chục thẻ.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Panel from "@/components/ui/Panel";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import StateMessage from "@/components/ui/StateMessage";
import Badge from "@/components/ui/Badge";
import AchievementCard from "@/components/rewards/AchievementCard";
import "@/components/rewards/rewards.css";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { describeError } from "@/lib/api/readApi";
import { fetchAchievements } from "@/lib/api/rewardsApi";
import type { AchievementWithProgress } from "@/types";
import type { I18nKey } from "@/lib/i18n/dictionary";

type Filter = "all" | "unlocked" | "locked";

export default function AchievementsPage() {
  const { t } = useLanguage();
  const [data, setData] = useState<AchievementWithProgress[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await fetchAchievements());
    } catch (err) {
      setError(describeError(err, t("common.connectionError")));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const unlockedCount = useMemo(() => data?.filter((a) => a.unlocked).length ?? 0, [data]);

  // Lọc ở client (danh sách nhỏ, ~20 mục) — không cần thêm query param lên
  // server vì API không hỗ trợ và lọc client giữ được filter khi quay lại tab.
  const visible = useMemo(() => {
    if (!data) return null;
    if (filter === "unlocked") return data.filter((a) => a.unlocked);
    if (filter === "locked") return data.filter((a) => !a.unlocked);
    return data;
  }, [data, filter]);

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: t("achievements.showAll") },
    { id: "unlocked", label: t("achievements.showUnlocked") },
    { id: "locked", label: t("achievements.showLocked") },
  ];

  return (
    <section className="page-enter rewards-page">
      <header className="rewards-head">
        <div>
          <h1 className="page-title">{t("achievements.title")}</h1>
          <p className="rewards-sub">{t("achievements.subtitle")}</p>
        </div>
        {data && (
          <div className="rewards-balance">
            <span className="rewards-balance__label">{t("achievements.title")}</span>
            <span className="rewards-balance__value">
              {t("achievements.unlockedCount", {
                done: String(unlockedCount),
                total: String(data.length),
              })}
            </span>
          </div>
        )}
      </header>

      {error ? (
        <StateMessage
          kind="error"
          text={error}
          onRetry={() => void load()}
          retryLabel={t("common.retry")}
        />
      ) : (
        <>
          <div className="rewards-filters" role="group" aria-label={t("achievements.title")}>
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rewards-filter${filter === item.id ? " is-active" : ""}`}
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {visible === null ? (
            <div className="ach-grid">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} height={200} radius={18} />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon="🏅"
              title={filter === "locked" ? t("achievements.empty") : t("achievements.emptyDesc")}
              description={filter === "unlocked" ? t("achievements.emptyDesc") : undefined}
              actionLabel={filter === "unlocked" ? t("achievements.showAll") : undefined}
              onAction={filter === "unlocked" ? () => setFilter("all") : undefined}
            />
          ) : (
            <div className="ach-grid">
              {visible.map((a) => (
                <AchievementCard key={a.code} achievement={a} />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
