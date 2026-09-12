// ================================================================
// <LevelHero /> — hero card Level/XP nổi bật ở đầu trang Tiến độ
// ================================================================
// Mạch tư duy: đây là biến thể "hero" của LevelProgressBar (dùng chung
// getLevelProgressDetails nên số liệu không bao giờ lệch). Hero chỉ
// render + format số, KHÔNG tự tính toán. Thanh progress animate
// 0% → progress thật lúc mount bằng requestAnimationFrame (transform/
// width transition, tôn trọng prefers-reduced-motion). recentGain là
// XP vừa nhận (nếu có) — chỉ hiển thị animation, không tạo XP giả.
// ================================================================

"use client";

import { useEffect, useState } from "react";
import { getLevelProgressDetails } from "@/lib/constants/xp";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { localeFor } from "@/lib/i18n/dictionary";

interface LevelHeroProps {
  lifetimeXP: number;
  /** XP vừa nhận, hiển thị badge "+N XP" (dữ liệu thật từ ngoài truyền vào) */
  recentGain?: number;
  /** Bật animation Level Up ngắn (khi vừa lên level) */
  leveledUp?: boolean;
  /** Tên hiển thị cấp độ (vd "Học viên mới") — optional */
  levelTitle?: string;
}

const formatNumber = (lang: "vi" | "en") => (num: number) => num.toLocaleString(localeFor(lang));

type LevelTitleKey = "level.title.50" | "level.title.30" | "level.title.20" | "level.title.10" | "level.title.5" | "level.title.1";

function levelTitleKeyFor(level: number): LevelTitleKey {
  if (level >= 50) return "level.title.50";
  if (level >= 30) return "level.title.30";
  if (level >= 20) return "level.title.20";
  if (level >= 10) return "level.title.10";
  if (level >= 5) return "level.title.5";
  return "level.title.1";
}

export default function LevelHero({ lifetimeXP, recentGain, leveledUp, levelTitle }: LevelHeroProps) {
  const { t, lang } = useLanguage();
  const format = formatNumber(lang);
  const d = getLevelProgressDetails(lifetimeXP);
  const [animatedPercent, setAnimatedPercent] = useState(0);

  // Animate 0% → progress thật lúc mount. Không dùng animation vô hạn.
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setAnimatedPercent(d.progressPercent);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 700;
    const target = d.progressPercent;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic cho chuyển động mượt, dừng hẳn ở cuối
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedPercent(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [d.progressPercent]);

  const title = levelTitle ?? t(levelTitleKeyFor(d.level));

  return (
    <section
      className={`level-hero${leveledUp ? " level-hero--leveled" : ""}`}
      aria-label={t("level.aria", { n: d.level, p: d.progressPercent })}
    >
      <div className="level-hero__glow" aria-hidden="true" />
      <div className="level-hero__row">
        {/* Badge Level */}
        <div className="level-hero__badge" aria-hidden="true">
          <span className="level-hero__badge-num">{String(d.level).padStart(2, "0")}</span>
          <span className="level-hero__badge-label">LEVEL</span>
        </div>

        {/* Thông tin Level */}
        <div className="level-hero__info">
          <div className="level-hero__top">
            <div>
              <div className="level-hero__level">LEVEL {d.level}</div>
              <div className="level-hero__title">{title}</div>
            </div>
            <div className="level-hero__xp">
              {d.isMaxLevel ? (
                <>{format(d.currentXP)} XP</>
              ) : (
                <>
                  {format(d.progressXP)} / {format(d.xpForNextLevel - d.xpForCurrentLevel)} XP
                </>
              )}
              {typeof recentGain === "number" && recentGain > 0 && (
                <span className="level-hero__gain" role="status">
                  +{format(recentGain)} XP
                </span>
              )}
            </div>
          </div>

          {/* Progress bar — role progressbar cho accessibility */}
          <div
            className="level-hero__track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={d.progressPercent}
            aria-label={t("level.progressAria", { n: d.level })}
          >
            <div className="level-hero__fill" style={{ width: `${animatedPercent}%` }} />
          </div>

          <div className="level-hero__bottom">
            {leveledUp ? (
              <span className="level-hero__levelup" role="status">
                {t("level.up")}
              </span>
            ) : d.isMaxLevel ? (
              <span>{t("level.maxedTotal", { n: format(d.currentXP) })}</span>
            ) : (
              <span>
                {t("level.remaining", { n: format(d.remainingXP), m: d.level + 1 })}
              </span>
            )}
            <span className="level-hero__percent">{d.progressPercent}%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
