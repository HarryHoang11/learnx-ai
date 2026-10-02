// ================================================================
// TRANG CHỦ (Home) — trung tâm học tập: hôm nay + skills + activity
// ================================================================
// Mạch tư duy: dashboard không chỉ là statistic — nó trả lời 4 câu
// hỏi của học sinh: "Hôm nay học gì?" (lịch + ôn tập đến hạn),
// "Mình đang ở đâu?" (skill overview), "Vừa qua mình đã làm gì?"
// (recent XP activity), "Học tiếp ở đâu?" (continue roadmap).
// Mọi số liệu đọc từ API thật, không hardcode.

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import StatCard from "@/components/ui/StatCard";
import StateMessage from "@/components/ui/StateMessage";
import { useToast } from "@/components/ui/Toast";
import EmptyState from "@/components/ui/EmptyState";
import GettingStarted from "@/components/dashboard/GettingStarted";
import SubjectProgressPanel from "@/components/subject/SubjectProgressPanel";
import OnboardingBanner from "@/components/onboarding/OnboardingBanner";
import Skeleton from "@/components/ui/Skeleton";
import LevelProgressBar from "@/components/ui/LevelProgressBar";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import DailyChallengeCard from "@/components/rewards/DailyChallengeCard";
import "@/components/rewards/rewards.css";
import TodaySchedule from "@/components/calendar/TodaySchedule";
import NextActionModule from "@/components/dashboard/NextActionModule";
import { getLevelProgressDetails } from "@/lib/constants/xp";
import { useCountUp } from "@/lib/hooks/useCountUp";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { hasKey, localeFor, type I18nKey } from "@/lib/i18n/dictionary";
import { fetchOnboardingState } from "@/lib/onboarding/client";
import { fetchDueReviews, type DueReviewsData } from "@/lib/api/reviewDue";
// LXP / thử thách ngày — cùng nguồn với trang /rewards để số dư khớp 2 nơi.
import { fetchDailyChallenge, claimDailyChallenge } from "@/lib/api/rewardsApi";
import { describeError } from "@/lib/api/readApi";
import type { OnboardingState } from "@/lib/onboarding/state";
import type {
  ApiResponse,
  DailyChallengeData,
  GoalWithRoadmap,
  SkillMasteryPoint,
} from "@/types";

interface ProgressData {
  skillMap: SkillMasteryPoint[];
  totalAttempts: number;
  accuracyPercent: number;
  streakDays: number;
}

interface ProgressResponse {
  lifetimeXP: number;
  lifetimeLXP: number;
  lxpBalance: number;
  level: number;
  levelProgress: { current: number; next: number; percent: number; level: number };
  streak: { current: number; longest: number; lastLearningDay: string | null };
}

interface StreakResponse {
  streak: { current: number; longest: number; lastLearningDay: string | null };
  progress: ProgressResponse | null;
}

interface XPHistoryItem {
  id: string;
  amount: number;
  reason: string;
  createdAt: string;
}

// Nhãn XP reason theo ngôn ngữ UI — key `xp.reason.*` trong dictionary,
// reason lạ fallback prettify (không crash khi backend thêm type mới).
function reasonLabel(t: (key: I18nKey) => string, reason: string): string {
  const key = `xp.reason.${reason}`;
  return hasKey(key) ? t(key) : reason.replace(/_/g, " ");
}

export default function HomePage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  // Toast cho phản hồi claim thử thách (nút nhận thưởng ở DailyChallengeCard).
  const { push } = useToast();
  const [askValue, setAskValue] = useState("");
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [xpData, setXpData] = useState<StreakResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewDue, setReviewDue] = useState<DueReviewsData | null>(null);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [recentXP, setRecentXP] = useState<XPHistoryItem[] | null>(null);
  const [goals, setGoals] = useState<GoalWithRoadmap[] | null>(null);
  const [streakError, setStreakError] = useState<string | null>(null);
  // Thử thách hôm nay — /api/daily-challenge tự sinh challenge nếu hôm nay
  // chưa có, nên gọi 1 lần lúc mount là đủ (không cần poll).
  const [challenge, setChallenge] = useState<DailyChallengeData | null>(null);
  const [claiming, setClaiming] = useState(false);
  // null = chưa biết; false = user mới (chưa có dữ liệu học); true = đã có.
  // Ba trạng thái thay vì boolean để không nháy layout: trong lúc fetch
  // chưa xong thì vẫn hiện skeleton chứ không đoán sai rồi đổi layout.
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);

  // Tách thành hàm có tên (thay vì code nằm thẳng trong useEffect) để nút
  // "Thử lại" ở trạng thái lỗi gọi lại được đúng những gì trang vừa tải.
  // Trước đây không có đường thoát: gặp lỗi mạng chỉ còn cách bấm tải lại
  // trang, tức mất hết trạng thái và phải chờ 5 request lần nữa.
  const loadProgress = useCallback(() => {
    fetch("/api/progress")
      .then((res) => res.json())
      .then((json: ApiResponse<ProgressData>) => {
        if (json.success) setProgress(json.data);
        else setError(json.error);
      })
      .catch(() => setError(t("common.connectionError")))
      .finally(() => setLoading(false));
  }, [t]);

  const loadStreak = useCallback(() => {
    setStreakError(null);
    fetch("/api/streak")
      .then((res) => res.json())
      .then((json: ApiResponse<StreakResponse>) => {
        if (json.success) setXpData(json.data);
        else setStreakError(json.error);
      })
      .catch(() => setStreakError(t("common.connectionError")));
  }, [t]);

  // Thử thách hôm nay: gọi RIÊNG khỏi loadStreak vì nó độc lập với streak —
  // lỗi challenge không được làm hỏng hiển thị streak (và ngược lại).
  const loadChallenge = useCallback(async () => {
    try {
      setChallenge(await fetchDailyChallenge());
    } catch {
      setChallenge(null);
    }
  }, []);

  async function handleClaimChallenge() {
    setClaiming(true);
    try {
      await claimDailyChallenge();
      setChallenge((prev) => (prev ? { ...prev, claimed: true } : prev));
      // Claim cộng XP/LXP vào tài khoản -> số dư đã đổi, phải nạp lại streak
      // để ô LXP ở trên cùng cập nhật theo (không hiển thị số cũ).
      await loadStreak();
      push("success", t("challenge.claimSuccess"));
    } catch (err) {
      push("error", describeError(err, t("common.connectionError")));
    } finally {
      setClaiming(false);
    }
  }

  useEffect(() => {
    loadProgress();
    loadStreak();
    void loadChallenge();
    // Dùng chung helper với trang Review: request đang bay của cùng URL
    // được gộp làm một (StrictMode dev gọi effect 2 lần / remount nhanh
    // không còn bắn trùng request + query Prisma).
    fetchDueReviews(5)
      .then((json) => {
        if (json.success) setReviewDue(json.data);
        else setReviewDue(null);
      })
      .catch(() => setReviewDue(null))
      .finally(() => setReviewLoading(false));

    fetch("/api/xp/history?page=1&limit=5")
      .then((res) => res.json())
      .then((json: ApiResponse<{ transactions: XPHistoryItem[] }>) => {
        if (json.success) setRecentXP(json.data.transactions);
        else setRecentXP([]);
      })
      .catch(() => setRecentXP([]));

    fetch("/api/roadmaps")
      .then((res) => res.json())
      .then((json: ApiResponse<GoalWithRoadmap[]>) => {
        if (json.success) setGoals(json.data);
        else setGoals([]);
      })
      .catch(() => setGoals([]));

    // Trạng thái onboarding quyết định hiện Getting Started hay Dashboard
    // đầy đủ. Gọi chung promise, không chặn các fetch khác.
    void fetchOnboardingState().then(setOnboarding);
    // `loadProgress`/`loadStreak`/`loadChallenge` được đưa vào deps (chúng đã bọc
    // useCallback theo `t`) để effect chạy lại khi ngôn ngữ đổi — trước đây
    // deps rỗng khiến các fetch này không bao giờ chạy lại.
  }, [loadProgress, loadStreak, loadChallenge]);

  function goToTutor() {
    const q = askValue.trim();
    router.push(q ? `/tutor?q=${encodeURIComponent(q)}` : "/tutor");
  }

  const weakest = progress?.skillMap
    .filter((s) => s.isWeak)
    .sort((a, b) => a.masteryPercent - b.masteryPercent)[0];

  const formatNumber = (num: number) => num.toLocaleString(localeFor(lang));

  // Lời chào theo giờ trình duyệt — tính SAU mount (useEffect) để SSR
  // và client render cùng fallback, tránh hydration mismatch khi giờ
  // server khác giờ trình duyệt (cùng class bug với calendar anchor).
  const [greetingKey, setGreetingKey] = useState<
    "dashboard.greeting.morning" | "dashboard.greeting.afternoon" | "dashboard.greeting.evening"
  >("dashboard.greeting.evening");
  useEffect(() => {
    const h = new Date().getHours();
    setGreetingKey(h < 11 ? "dashboard.greeting.morning" : h < 18 ? "dashboard.greeting.afternoon" : "dashboard.greeting.evening");
  }, []);

  const xp = xpData?.progress;
  const streak = xpData?.streak;
  // Số dư LXP để đổi thưởng — cùng nguồn với trang /rewards (đều đọc
  // `progress` của GET /api/streak) nên số hiển thị ở 2 nơi luôn khớp.
  const lxpBalance = xp?.lxpBalance ?? 0;
  // Single source: % hiển thị suy từ lifetimeXP, đồng nhất với
  // LevelProgressBar bên dưới (không dùng percent thô từ API).
  const levelDetails = xp ? getLevelProgressDetails(xp.lifetimeXP) : null;
  const animatedXP = useCountUp(xp?.lifetimeXP ?? 0);

  const mastered = progress?.skillMap.filter((s) => s.masteryPercent >= 80).length ?? 0;
  const weakCount = progress?.skillMap.filter((s) => s.isWeak).length ?? 0;
  const learningCount = Math.max(0, (progress?.skillMap.length ?? 0) - mastered - weakCount);
  const continueGoal = goals?.find((g) => g.status === "ACTIVE") ?? null;

  // User mới = chưa có bài làm/tài liệu/lộ trình nào. CHỈ quyết định bố cục,
  // KHÔNG chặn gì: dù có hay không thì mọi tính năng đều truy cập được từ
  // thanh điều hướng. Người dùng có thể đã tự học ở nơi khác — họ vẫn cần
  // thấy Dashboard đầy đủ nếu backend có dữ liệu.
  const isNewUser = onboarding !== null && !onboarding.hasLearningData;
  // Chỉ hiện nhắc hoàn thiện khi hồ sơ CÒN THIẾU. Đã hoàn tất thì không gỡi
  // để nhắc nữa — tránh nhắc nhiễu. Điều kiện hiển thị chi tiết nằm trong
  // `OnboardingBanner` (dùng chung `needsLearningProfile()` với proxy).
  const profileIncomplete = onboarding !== null && !onboarding.profileComplete;

  return (
    <section className="page-enter">
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 27, fontWeight: 600 }}>{t(greetingKey)}</h1>
        <p style={{ color: "var(--text-dim)", fontSize: 14.5, marginTop: 6 }}>
          {t("dashboard.subtitle")}
        </p>

        {/* Ô "hỏi AI ngay" trên Trang chủ — cùng bài toán ô nhập của Tutor:
            minWidth: 0 để input co lại được trong flex (không có nó, input giữ
            chiều rộng nội tại và đẩy nút "Hỏi" tràn ra ngoài ở 320px), và
            fontSize để CSS quyết định (16px trên mobile) thay vì ghim 14.5px
            inline — cùng lý do iOS zoom toàn trang. */}
        <div
          className="dashboard-ask"
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--panel-strong)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "13px 16px",
          }}
        >
          <span style={{ opacity: 0.5 }} aria-hidden="true">✺</span>
          <input
            value={askValue}
            onChange={(e) => setAskValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && goToTutor()}
            placeholder={t("dashboard.askPlaceholder")}
            aria-label={t("dashboard.askAria")}
            // enterKeyHint: trên điện thoại bàn phím hiện nút "Gửi" thay vì
            // "xuống dòng" — đúng thao tác gõ nhanh rồi Enter.
            enterKeyHint="send"
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
            }}
          />
          <button type="button" className="btn-primary dashboard-ask__btn" onClick={goToTutor}>
            {t("common.ask")}
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
          <Skeleton height={96} radius={16} />
          <Skeleton height={120} radius={16} />
        </div>
      )}
      {error && (
        <StateMessage
          kind="error"
          text={error}
          onRetry={loadProgress}
          retryLabel={t("common.retry")}
        />
      )}

      {/* GETTING STARTED (Explore Mode) — thay thế Dashboard đầy đủ khi
          user chưa có dữ liệu học. Hiển thị TRƯỚC các panel số liệu vì với
          user mới, "tiến độ = 0" không có ý nghĩa gì. */}
      {isNewUser && (
        <div className="enter enter--1">
          <GettingStarted />
        </div>
      )}

      {/*
        Thến nhắc HOÀN THIỆN HỒ SƠ HỌC TẬP — LỜI MỜI, KHÔNG PHẢI NGHẼN.
          - 1 card duy nhất, nằm TRÊN Getting Started để thấy ngay.
          - Điều kiện hiện do `needsLearningProfile()` quyết định (cùng hàm mà
            proxy dùng) nên proxy và UI không lệch nhau.
          - Không chặn Dashboard: bấm "Bỏ qua" chỉ ẩn banner, không điều hướng.
          - Ẩn với user mới vì Getting Started đã có lời mời riêng gới, tránh
            lặp 2 lần trên cùng 1 màn.
      */}
      {!isNewUser && onboarding && profileIncomplete && (
        <div className="enter enter--1">
          <OnboardingBanner onboarding={onboarding} />
        </div>
      )}

      {progress && (
        <>
          <Panel className="dashboard-focus enter enter--1">
            <div>
              <span className="workspace-eyebrow">{t("dashboard.focusEyebrow")}</span>
              <h2>{weakest ? `${weakest.subject} · ${weakest.topic}` : t("dashboard.focusEmpty")}</h2>
              <p>
                {weakest
                  ? t("dashboard.focusReason", { n: weakest.masteryPercent })
                  : t("dashboard.focusEmptyDesc")}
              </p>
            </div>
            <button className="btn-primary" onClick={() => router.push(weakest ? "/workspace" : "/diagnostic")}>
              {weakest ? t("dashboard.focusCta") : t("common.assessment")}
            </button>
          </Panel>

          {/* XP / Level / LXP Stats */}
          <div className="grid-stats enter enter--1" style={{ marginBottom: 20 }}>
            <StatCard
              value={t("common.level", { n: levelDetails?.level ?? 1 })}
              label={t("common.xpLabel", { n: formatNumber(animatedXP) })}
            />
            <StatCard
              value={`${levelDetails?.progressPercent ?? 0}%`}
              label={t("common.toLevel", { n: (levelDetails?.level ?? 1) + 1 })}
            />
            <StatCard
              value={`${formatNumber(xp?.lxpBalance ?? 0)} LXP`}
              label={t("dashboard.lxpLabel")}
            />
            <StatCard value={`🔥 ${streak?.current ?? 0}`} label={t("common.longestDays", { n: streak?.longest ?? 0 })} />
          </div>

          {/* XP Progress Bar — dùng component chung, cùng 1 công thức */}
          {xp !== null && (
            <LevelProgressBar lifetimeXP={xp?.lifetimeXP ?? 0} />
          )}
          {streakError && (
            <StateMessage
              kind="error"
              text={streakError}
              onRetry={loadStreak}
              retryLabel={t("common.retry")}
            />
          )}

          {/* LXP SỐ DƯ + THỬ THÁCH HÔM NAY — "mảnh ghép động lực" của
              Dashboard. Trước đây XP/streak hiện nhưng LXP (tiền tệ để đổi
              thưởng) và thử thách ngày KHÔNG hiện ở đâu, dù backend đã có
              (`/api/streak` trả `progress.lxpBalance`, `/api/daily-challenge`
              tự sinh challenge). Người học không biết mình kiếm được gì và
              hôm nay cần làm gì => dùng thẻ này để trả lời cả 2.

              Số LXP đọc từ `xp.lxpBalance` — CÙNG nguồn với trang /rewards
              (đều gọi /api/streak), không phải nguồn riêng. */}
          <div className="dash-motivation">
            {/* Số dư LXP + lối vào cửa hàng.
                *
                * SỬA LỖI "Số dư LXP279LXPĐổi thưởng →" (spec §1):
                * 3 khối label / value+currency / action TRƯỚC đây là 3 thẻ
                * `<span>` inline liền nhau trong một `<button>` — không có
                * khoảng trắng giữa các text node nên chúng dính thành 1 chuỗi.
                * Nay mỗi khối là `<span class="...__label|__value|__cta">` với
                * CSS `display:block` + `gap` → tách hẳn 3 dòng, và tiêu đề value
                * có sẵn dấu hai chấm trong bản dịch ("Số dư LXP:").
                *
                * Dùng `router.push` (thay vì <Link>) để ĐỒNG NHẤT với các
                * nút điều hướng còn lại của trang này. */}
            <button
              type="button"
              className="dash-lxp"
              onClick={() => router.push("/rewards")}
              aria-label={`${t("rewards.balanceLabel")} ${lxpBalance ?? 0} LXP — ${t("rewards.title")}`}
            >
              <span className="dash-lxp__label">{t("rewards.balanceLabel")}</span>
              <span className="dash-lxp__value">
                {/* tabular-nums + 1 khối riêng cho số và đơn vị: số lớn
                    (12.450) không làm "LXP" bị đẩy xuống dòng. */}
                <AnimatedNumber
                  className="dash-lxp__number animated-number"
                  value={lxpBalance ?? 0}
                  durationMs={600}
                />
                <span className="dash-lxp__unit">LXP</span>
              </span>
              <span className="dash-lxp__cta">{t("rewards.title")} →</span>
            </button>

            {/* Thử thách hôm nay — nhịp học ngày, có nút nhận thưởng ngay khi
                hoàn thành. Cùng component với trang /rewards để không lệch. */}
            <DailyChallengeCard
              challenge={challenge}
              claiming={claiming}
              onClaim={() => void handleClaimChallenge()}
            />
          </div>

          {/* MÔN ĐANG HỌC (đa môn) — trả lời "hôm nay học gì / yếu môn nào".
              Dùng `progress.skillMap` ĐÃ fetch sẵn ở trên: không phát sinh
              request thứ hai cho cùng một dữ liệu. */}
          <div className="enter enter--2">
            <SubjectProgressPanel skillMap={progress.skillMap} />
          </div>

          {/* Hôm nay: lịch học + ôn tập đến hạn + học tiếp */}
          <div className="grid-progress enter enter--2" style={{ marginBottom: 20 }}>
            <div>
              <TodaySchedule />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Panel>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{t("dashboard.reviewDue")}</div>
                {reviewDue ? (
                  reviewDue.stats.due > 0 ? (
                    <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
                      <span style={{ color: "var(--amber)", fontWeight: 700 }}>{reviewDue.stats.due}</span>{" "}
                      {t("dashboard.reviewDueLine", { n: reviewDue.stats.due })}
                      {reviewDue.stats.overdue > 0 && (
                        <> {t("dashboard.reviewOverdue", { n: reviewDue.stats.overdue })}</>
                      )}
                      <ul style={{ margin: "8px 0 12px", paddingLeft: 18 }}>
                        {reviewDue.reviews.slice(0, 3).map((r) => (
                          <li key={r.id}>
                            {r.subject ? `${r.subject} · ` : ""}{r.topic}
                          </li>
                        ))}
                      </ul>
                      <button className="btn-secondary" onClick={() => router.push("/practice")} style={{ fontSize: 12.5 }}>
                        {t("common.practiceNow")}
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13.5, color: "var(--text-dim)" }}>
                      {t("dashboard.reviewEmpty")}
                    </div>
                  )
                ) : reviewLoading ? (
                  <Skeleton height={40} />
                ) : (
                  <StateMessage kind="error" text={t("common.connectionError")} />
                )}
              </Panel>

              <Panel>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{t("dashboard.continue")}</div>
                {goals === null ? (
                  <Skeleton height={40} />
                ) : continueGoal ? (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{continueGoal.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-dim)", margin: "4px 0 10px" }}>
                      {t("common.progressPercent", { n: continueGoal.progressPercent })}
                    </div>
                    <div className="bar-track" style={{ marginBottom: 12 }}>
                      <div className="bar-fill" style={{ width: `${continueGoal.progressPercent}%` }} />
                    </div>
                    <button className="btn-primary" onClick={() => router.push("/roadmap")} style={{ fontSize: 12.5 }}>
                      {t("common.continueRoadmap")}
                    </button>
                  </div>
                ) : (
                  <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
                    {t("dashboard.noActiveGoal")}
                    <div style={{ marginTop: 10 }}>
                      <button className="btn-secondary" onClick={() => router.push("/roadmap")} style={{ fontSize: 12.5 }}>
                        {t("common.createRoadmap")}
                      </button>
                    </div>
                  </div>
                )}
              </Panel>
            </div>
          </div>

          {/* Skill overview + Recent activity */}
          <div className="grid-progress enter enter--3" style={{ marginBottom: 20 }}>
            <Panel>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{t("dashboard.skillOverview")}</div>
              {(progress.skillMap.length === 0) ? (
                <div style={{ fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.6 }}>
                  {t("dashboard.skillEmptyA")}{" "}
                  <a href="/diagnostic" style={{ color: "var(--cyan)" }}>{t("common.assessment")}</a>{" "}
                  {t("dashboard.skillEmptyB")}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ flex: 1, textAlign: "center", padding: "10px 6px", background: "var(--cyan-soft)", borderRadius: 10 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--cyan)" }}>{mastered}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{t("dashboard.skillMastered")}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", padding: "10px 6px", background: "var(--indigo-soft)", borderRadius: 10 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--indigo)" }}>{learningCount}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{t("dashboard.skillLearning")}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: "center", padding: "10px 6px", background: "var(--amber-soft)", borderRadius: 10 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--amber)" }}>{weakCount}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{t("dashboard.skillWeak")}</div>
                  </div>
                </div>
              )}
            </Panel>

            <Panel>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{t("dashboard.recentActivity")}</div>
              {recentXP === null ? (
                <Skeleton height={40} />
              ) : recentXP.length === 0 ? (
                <div style={{ fontSize: 13.5, color: "var(--text-dim)" }}>
                  {t("dashboard.activityEmpty")}
                </div>
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {recentXP.map((tx) => (
                    <li key={tx.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                      <span style={{ color: "var(--text-dim)" }}>{reasonLabel(t, tx.reason)}</span>
                      <span style={{ color: "var(--cyan)", fontWeight: 600, whiteSpace: "nowrap" }}>+{tx.amount} XP</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          {weakest ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, margin: "30px 0 14px" }}>{t("dashboard.suggestTitle")}</div>
              <Panel style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                    {t("dashboard.suggestLine", { subject: weakest.subject, topic: weakest.topic })}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3 }}>
                    {t("dashboard.suggestDetail", { n: weakest.masteryPercent })}
                  </div>
                </div>
                <button className="btn-primary" onClick={() => router.push("/roadmap")}>
                  {t("common.viewRoadmap")}
                </button>
              </Panel>
            </>
          ) : (
            <EmptyState
              icon="🧭"
              title={t("dashboard.noSkillTitle")}
              description={t("dashboard.noSkillDesc")}
              actionLabel={t("common.assessment")}
              onAction={() => router.push("/diagnostic")}
            />
          )}

          <div className="enter enter--4" style={{ marginTop: 20 }}>
            <NextActionModule />
          </div>
        </>
      )}
    </section>
  );
}
