// ================================================================
// TRANG ĐỔI THƯỞNG (/rewards)
// ================================================================
// Mạch tư duy: trang này KHÔI PHỤC một feature đã mất khỏi UI nhưng backend
// vẫn còn đầy đủ:
//   - Prisma: model Reward, UserReward, PointTransaction, enum RewardType /
//     RewardRarity / RewardStatus
//   - API: /api/rewards/{shop,redeem,inventory,history}, /api/achievements,
//     /api/daily-challenge, /api/streak
// Trước đợt này KHÔNG có file .tsx nào gọi tới các endpoint đó — economy
// hoàn toàn bị "mồ côi". Đây là lớp UI kết nối lại, không phát minh hệ
// thống mới và không hardcode số dư (mọi con số đến từ API).
//
// 4 tab tương ứng 4 nhu cầu thật của người học:
//   Tổng quan — số dư LXP + XP + level + streak + thử thách hôm nay.
//   Cửa hàng  — danh sách phần thưởng, đổi bằng LXP.
//   Túi đồ   — những gì đã đổi.
//   Lịch sử  — dòng tiền LXP (kiếm/tiêu), có bộ lọc.
//
// Dữ liệu: `fetchEconomy()` là nguồn SỐ DƯ duy nhất. Sau khi đổi, dùng
// `newLXPBalance` do SERVER trả về (không tự trừ tay) rồi đồng bộ lại các
// tab khác để không hiện số liệu cũ.
"use client";

import { useCallback, useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import StateMessage from "@/components/ui/StateMessage";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import LevelProgressBar from "@/components/ui/LevelProgressBar";
import RewardCard from "@/components/rewards/RewardCard";
import DailyChallengeCard from "@/components/rewards/DailyChallengeCard";
import "@/components/rewards/rewards.css";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { I18nKey } from "@/lib/i18n/dictionary";
import { describeError } from "@/lib/api/readApi";
import {
  claimDailyChallenge,
  fetchAchievements,
  fetchDailyChallenge,
  fetchEconomy,
  fetchRewardHistory,
  fetchRewardInventory,
  fetchRewardShop,
  redeemReward,
  type EconomySnapshot,
  type RewardHistoryFilter,
} from "@/lib/api/rewardsApi";
import type {
  AchievementWithProgress,
  DailyChallengeData,
  InventoryItem,
  LXPTransaction,
  RewardOwnershipStatus,
  RewardRarity,
  ShopReward,
} from "@/types";

type Tab = "overview" | "shop" | "inventory" | "history";

export default function RewardsPage() {
  const { t, lang } = useLanguage();
  const { push } = useToast();

  const [tab, setTab] = useState<Tab>("overview");

  // ---- Economy (nguồn số dư duy nhất) ----
  const [economy, setEconomy] = useState<EconomySnapshot | null>(null);
  const [economyError, setEconomyError] = useState<string | null>(null);

  // ---- Thử thách hôm nay ----
  const [challenge, setChallenge] = useState<DailyChallengeData | null>(null);
  const [claiming, setClaiming] = useState(false);

  // ---- Achievement ----
  const [achievements, setAchievements] = useState<AchievementWithProgress[] | null>(null);

  // ---- Shop ----
  const [shop, setShop] = useState<ShopReward[] | null>(null);
  const [shopError, setShopError] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  /** Phần thưởng đang chờ xác nhận — đổi mất LXP nên cần 1 bước xác nhận
   *  rõ ràng thay vì bấm là mất luôn. */
  const [confirming, setConfirming] = useState<ShopReward | null>(null);

  // ---- Túi đồ ----
  const [inventory, setInventory] = useState<InventoryItem[] | null>(null);

  // ---- Lịch sử ----
  const [historyFilter, setHistoryFilter] = useState<RewardHistoryFilter>("all");
  const [history, setHistory] = useState<LXPTransaction[] | null>(null);
  const [historyTotal, setHistoryTotal] = useState(0);

  /** Format số theo ngôn ngữ đang chọn (vi: 1.240 · en: 1,240). Dùng chung
   *  cho mọi con số hiển thị để không lẫn 2 kiểu phân cách trong 1 trang. */
  const format = useCallback(
    (n: number) => n.toLocaleString(lang === "en" ? "en-US" : "vi-VN"),
    [lang]
  );

  // ================================================================
  // LOADERS — tách riêng để mỗi tab chỉ gọi đúng endpoint nó cần (không
  // tải shop khi user chỉ xem lịch sử). Điểm #29: không request thừa.
  // ================================================================
  const loadEconomy = useCallback(async () => {
    setEconomyError(null);
    try {
      setEconomy(await fetchEconomy());
    } catch (err) {
      setEconomyError(describeError(err, t("common.connectionError")));
    }
  }, [t]);

  const loadShop = useCallback(async () => {
    setShopError(null);
    try {
      setShop(await fetchRewardShop());
    } catch (err) {
      setShopError(describeError(err, t("common.connectionError")));
    }
  }, [t]);

  const loadInventory = useCallback(async () => {
    try {
      setInventory(await fetchRewardInventory());
    } catch {
      // Túi đồ không quan trọng bằng việc đổi — lỗi thì hiện rỗng, shop vẫn
      // dùng được. Không chặn user bằng 1 lỗi phụ.
      setInventory([]);
    }
  }, []);

  const loadHistory = useCallback(async (filter: RewardHistoryFilter) => {
    try {
      const data = await fetchRewardHistory(filter, 1, 30);
      setHistory(data.transactions);
      setHistoryTotal(data.total);
    } catch {
      setHistory([]);
      setHistoryTotal(0);
    }
  }, []);

  const loadChallenge = useCallback(async () => {
    try {
      setChallenge(await fetchDailyChallenge());
    } catch {
      setChallenge(null);
    }
  }, []);

  const loadAchievements = useCallback(async () => {
    try {
      setAchievements(await fetchAchievements());
    } catch {
      setAchievements(null);
    }
  }, []);

  useEffect(() => {
    void loadEconomy();
    void loadChallenge();
    void loadAchievements();
  }, [loadEconomy, loadChallenge, loadAchievements]);

  /** Đánh dấu tab đã tải để chuyển qua lại không bắn lại request (giữ tab
   *  đã xem không nhảy skeleton). */
  const [loaded, setLoaded] = useState<Record<Tab, boolean>>({
    overview: true,
    shop: false,
    inventory: false,
    history: false,
  });

  useEffect(() => {
    if (loaded[tab]) return;
    setLoaded((prev) => ({ ...prev, [tab]: true }));
    if (tab === "shop") void loadShop();
    if (tab === "inventory") void loadInventory();
    if (tab === "history") void loadHistory(historyFilter);
  }, [tab, loaded, loadShop, loadInventory, loadHistory, historyFilter]);

  // Đổi bộ lọc lịch sử -> nạp lại (giữ đúng filter trên server).
  function handleHistoryFilterChange(next: RewardHistoryFilter) {
    setHistoryFilter(next);
    setHistory(null);
    void loadHistory(next);
  }

  // ================================================================
  // HÀNH ĐỘNG
  // ================================================================
  async function handleRedeem(reward: ShopReward) {
    if (!confirming || confirming.id !== reward.id) return;
    setRedeemingId(reward.id);
    try {
      const result = await redeemReward(reward.id);
      // Cập nhật số dư bằng giá trị SERVER trả về (đã trừ) — không tự tính
      // để tránh lệch nếu server chặn việc đổi trùng.
      setEconomy((prev) =>
        prev && prev.progress
          ? { ...prev, progress: { ...prev.progress, lxpBalance: result.newLXPBalance } }
          : prev
      );
      // Refresh shop để cập nhật isOwned/canAfford + túi đồ + lịch sử.
      await Promise.all([loadShop(), loadInventory()]);
      void loadHistory(historyFilter);
      push("success", t("rewards.success", { name: reward.name }));
      push("info", t("rewards.successNewBalance", { n: format(result.newLXPBalance) }));
      setConfirming(null);
    } catch (err) {
      push("error", describeError(err, t("rewards.error")));
    } finally {
      setRedeemingId(null);
    }
  }

  async function handleClaimChallenge() {
    setClaiming(true);
    try {
      await claimDailyChallenge();
      setChallenge((prev) => (prev ? { ...prev, claimed: true } : prev));
      // Claim cộng XP/LXP -> số dư thay đổi, phải nạp lại economy.
      await loadEconomy();
      push("success", t("challenge.claimSuccess"));
    } catch (err) {
      push("error", describeError(err, t("common.connectionError")));
    } finally {
      setClaiming(false);
    }
  }

  const lxpBalance = economy?.progress?.lxpBalance ?? null;
  const unlockedCount = achievements?.filter((a) => a.unlocked).length ?? null;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "overview", label: t("nav.tabs.overview") },
    { id: "shop", label: t("nav.tabs.shop") },
    { id: "inventory", label: t("nav.tabs.inventory"), count: inventory?.length },
    { id: "history", label: t("nav.tabs.history") },
  ];


  return (
    <section className="page-enter rewards-page">
      <header className="rewards-head">
        <div>
          <h1 className="page-title">{t("rewards.title")}</h1>
          <p className="rewards-sub">{t("rewards.subtitle")}</p>
        </div>
        {/* Số dư LXP nổi bật ngay đầu trang — đây là con số người dùng
            vào trang này để nhìn trước tiên. */}
        {lxpBalance !== null && (
          <div className="rewards-balance">
            <span className="rewards-balance__label">{t("rewards.balanceLabel")}</span>
            <AnimatedNumber
              className="rewards-balance__value animated-number"
              value={lxpBalance}
              suffix=" LXP"
              durationMs={500}
            />
          </div>
        )}
      </header>

      {/* Tabs — role="tablist" để screen reader điều hướng bằng phím mũi tên
          được. Trên mobile cuộn ngang. */}
      <div className="rewards-tabs" role="tablist" aria-label={t("rewards.title")}>
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`rewards-tab${tab === item.id ? " is-active" : ""}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
            {item.count !== undefined && item.count > 0 && (
              <span className="rewards-tab__count">{item.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ---------------- TỔNG QUAN ---------------- */}
      {tab === "overview" && (
        <div className="rewards-panel" role="tabpanel">
          {economyError ? (
            <StateMessage
              kind="error"
              text={economyError}
              onRetry={() => void loadEconomy()}
              retryLabel={t("common.retry")}
            />
          ) : (
            <>
              <div className="rewards-stats">
                <StatTile
                  label={t("rewards.levelLabel")}
                  value={economy?.progress ? String(economy.progress.level) : null}
                  accent="indigo"
                />
                <StatTile
                  label={t("rewards.xpLabel")}
                  value={economy?.progress ? economy.progress.lifetimeXP : null}
                  format={format}
                  accent="cyan"
                />
                <StatTile
                  label={t("rewards.lifetimeLabel")}
                  value={economy?.progress ? economy.progress.lifetimeLXP : null}
                  format={format}
                  accent="amber"
                />
                <StatTile
                  label={t("rewards.streakLabel")}
                  value={economy?.streak ? economy.streak.current : null}
                  suffix="🔥"
                  accent="rose"
                />
              </div>

              {economy?.progress && (
                <LevelProgressBar lifetimeXP={economy.progress.lifetimeXP} />
              )}

              <DailyChallengeCard
                challenge={challenge}
                claiming={claiming}
                onClaim={() => void handleClaimChallenge()}
              />

              <AchievementPreview achievements={achievements} unlockedCount={unlockedCount} />
            </>
          )}
        </div>
      )}

      {/* ---------------- CỬA HÀNG ---------------- */}
      {tab === "shop" && (
        <div className="rewards-panel" role="tabpanel">
          {shopError ? (
            <StateMessage
              kind="error"
              text={shopError}
              onRetry={() => void loadShop()}
              retryLabel={t("common.retry")}
            />
          ) : shop === null ? (
            // Skeleton giữ đúng hình dạng card thật -> không layout shift khi
            // dữ liệu về (thay vì toàn trang trắng + spinner).
            <div className="reward-grid">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} height={220} radius={18} />
              ))}
            </div>
          ) : shop.length === 0 ? (
            <EmptyState
              icon="🎁"
              title={t("rewards.shop.empty")}
              description={t("rewards.shop.emptyDesc")}
            />
          ) : (
            <div className="reward-grid">
              {shop.map((reward) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  balance={lxpBalance ?? 0}
                  redeeming={redeemingId === reward.id}
                  onRedeem={(r) => setConfirming(r)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- TÚI ĐỒ ---------------- */}
      {tab === "inventory" && (
        <div className="rewards-panel" role="tabpanel">
          {inventory === null ? (
            <div className="reward-grid">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={180} radius={18} />
              ))}
            </div>
          ) : inventory.length === 0 ? (
            <EmptyState
              icon="🎒"
              title={t("rewards.inventory.empty")}
              description={t("rewards.inventory.emptyDesc")}
              actionLabel={t("nav.tabs.shop")}
              onAction={() => setTab("shop")}
            />
          ) : (
            <div className="reward-grid">
              {inventory.map((item) => (
                <article key={item.id} className="reward-card is-owned">
                  <div className="reward-card__media" aria-hidden="true">
                    <span className="reward-card__icon">
                      {item.reward.icon ?? item.reward.name.charAt(0).toUpperCase()}
                    </span>
                    <Badge rarity={item.reward.rarity} style={{ position: "absolute", top: 8, right: 8 }}>
                      {t(rarityKey(item.reward.rarity))}
                    </Badge>
                  </div>
                  <div className="reward-card__body">
                    <h3 className="reward-card__title">{item.reward.name}</h3>
                    <p className="reward-card__desc">{item.reward.description}</p>
                  </div>
                  <div className="reward-card__footer">
                    <Badge
                      tone={
                        item.status === "ACTIVE"
                          ? "green"
                          : item.status === "EXPIRED"
                            ? "rose"
                            : "neutral"
                      }
                    >
                      {t(statusKeyFor(item.status))}
                    </Badge>
                    <span className="reward-card__cost">
                      {format(item.reward.costLXP)}
                      <span className="reward-card__cost-unit">LXP</span>
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- LỊCH SỬ ---------------- */}
      {tab === "history" && (
        <div className="rewards-panel" role="tabpanel">
          <div className="rewards-filters" role="group" aria-label={t("rewards.history.title")}>
            {HISTORY_FILTERS.map(([value, labelKey]) => (
              <button
                key={value}
                type="button"
                className={`rewards-filter${historyFilter === value ? " is-active" : ""}`}
                aria-pressed={historyFilter === value}
                onClick={() => handleHistoryFilterChange(value)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>

          {history === null ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} height={56} radius={12} />
              ))}
            </div>
          ) : history.length === 0 ? (
            <EmptyState
              icon="📜"
              title={t("rewards.history.empty")}
              description={t("rewards.history.emptyDesc")}
            />
          ) : (
            <ul className="txn-list">
              {history.map((tx) => {
                const earned = tx.amount > 0;
                return (
                  <li key={tx.id} className="txn">
                    <span className="txn__icon" aria-hidden="true">
                      {tx.reward?.icon ?? (earned ? "+" : "−")}
                    </span>
                    <span className="txn__body">
                      <span className="txn__title">{transactionLabel(tx, t)}</span>
                      <span className="txn__date">
                        {new Date(tx.createdAt).toLocaleDateString(
                          lang === "en" ? "en-US" : "vi-VN"
                        )}
                      </span>
                    </span>
                    <span className={`txn__amount${earned ? " is-earned" : " is-spent"}`}>
                      {earned ? "+" : ""}
                      {format(tx.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {historyTotal > (history?.length ?? 0) && (
            <p className="rewards-hint">
              {t("rewards.history.title")}: {history?.length}/{historyTotal}
            </p>
          )}
        </div>
      )}

      {/* Xác nhận đổi — mất LXP nên cần bước xác nhận nói rõ số dư còn lại. */}
      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={t("rewards.confirmTitle")}
      >
        {confirming && (
          <div className="confirm-body">
            <p>
              {t("rewards.confirmBody", {
                cost: format(confirming.costLXP),
                name: confirming.name,
                left: format(Math.max(0, (lxpBalance ?? 0) - confirming.costLXP)),
              })}
            </p>
            <div className="confirm-actions">
              <button type="button" className="btn-secondary" onClick={() => setConfirming(null)}>
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={redeemingId === confirming.id}
                onClick={() => void handleRedeem(confirming)}
              >
                {redeemingId === confirming.id ? t("rewards.redeeming") : t("rewards.redeem")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}

/** Bộ lọc lịch sử — khai báo ngoài component để không tạo mảng mới mỗi
 *  lần render (đồng thời giữ `as const` cho key i18n). */
const HISTORY_FILTERS = [
  ["all", "rewards.history.filterAll"],
  ["EARNED", "rewards.history.filterEarned"],
  ["SPENT", "rewards.history.filterSpent"],
] as const;

/** Map rarity của DB sang key i18n (đã khai báo trong dictionary). */
function rarityKey(rarity: RewardRarity): I18nKey {
  return `rewards.rarity.${rarity}`;
}

/** Map trạng thái sở hữu của DB sang key i18n. */
function statusKeyFor(status: RewardOwnershipStatus): I18nKey {
  switch (status) {
    case "ACTIVE":
      return "rewards.active";
    case "OWNED":
      return "rewards.owned";
    case "USED":
      return "rewards.used";
    case "EXPIRED":
      return "rewards.expired";
    default:
      return "rewards.owned";
  }
}

/**
 * Nhãn cho 1 dòng lịch sử LXP.
 *
 * `PointTransaction.reason` có 2 dạng:
 *   - Lần đổi thưởng: server ghi `redeem_<tên reward>` — nhưng khi đó API đã
 *     attach sẵn `tx.reward.name`, nên nhánh này chỉ là dự phòng.
 *   - Lần kiếm LXP: `reason` là tên hoạt động (`quiz_complete`, `lesson_complete`...)
 *     và ĐÃ có sẵn key i18n `xp.reason.*` trong dictionary.
 *
 * Nếu không có key dịch (hoạt động mới thêm sau này chưa kịp dịch) thì trả về
 * chính `reason` thay vì hiện chuỗi rỗng.
 */
function transactionLabel(tx: LXPTransaction, t: (key: I18nKey, params?: Record<string, string>) => string): string {
  if (tx.reward?.name) return tx.reward.name;
  const key = `xp.reason.${tx.reason}` as I18nKey;
  const translated = t(key);
  // `translate` trả về chính key khi không tìm thấy — dùng đây làm cách
  // phát hiện "chưa có bản dịch" mà không cần tra cứu dictionary.
  return translated === key ? tx.reason : translated;
}

/** 1 ô số liệu nhỏ (level / XP / LXP / streak). */
function StatTile({
  label,
  value,
  format,
  suffix,
  accent,
}: {
  label: string;
  value: number | string | null;
  format?: (n: number) => string;
  suffix?: string;
  accent: "indigo" | "cyan" | "amber" | "rose";
}) {
  return (
    <div className={`stat-tile stat-tile--${accent}`}>
      <span className="stat-tile__label">{label}</span>
      {value === null ? (
        <Skeleton height={26} width="70%" radius={6} />
      ) : typeof value === "number" && format ? (
        <AnimatedNumber className="stat-tile__value animated-number" value={value} suffix={suffix} />
      ) : (
        <span className="stat-tile__value">
          {typeof value === "number" ? format?.(value) ?? value : value}
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Tóm tắt achievement ở tab Tổng quan. */
function AchievementPreview({
  achievements,
  unlockedCount,
}: {
  achievements: AchievementWithProgress[] | null;
  unlockedCount: number | null;
}) {
  const { t } = useLanguage();
  if (achievements === null) {
    return (
      <Panel>
        <Skeleton height={90} radius={14} />
      </Panel>
    );
  }
  if (achievements.length === 0) {
    return (
      <Panel>
        <p className="rewards-sub">{t("achievements.empty")}</p>
      </Panel>
    );
  }
  const recent = achievements.filter((a) => a.unlocked).slice(0, 6);
  return (
    <Panel>
      <div className="rewards-preview-head">
        <span className="rewards-preview-title">{t("achievements.title")}</span>
        {unlockedCount !== null && (
          <Badge tone="indigo">
            {unlockedCount}/{achievements.length}
          </Badge>
        )}
      </div>
      <div className="achievement-row">
        {recent.map((a) => (
          <span key={a.code} className="achievement-chip" title={a.title}>
            <span aria-hidden="true">{a.icon ?? "🏅"}</span>
            {a.title}
          </span>
        ))}
        {recent.length === 0 && <p className="rewards-sub">{t("achievements.emptyDesc")}</p>}
      </div>
    </Panel>
  );
}
