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

interface LevelHeroProps {
  lifetimeXP: number;
  /** XP vừa nhận, hiển thị badge "+N XP" (dữ liệu thật từ ngoài truyền vào) */
  recentGain?: number;
  /** Bật animation Level Up ngắn (khi vừa lên level) */
  leveledUp?: boolean;
  /** Tên hiển thị cấp độ (vd "Học viên mới") — optional */
  levelTitle?: string;
}

const formatNumber = (num: number) => num.toLocaleString("vi-VN");

function levelTitleFor(level: number): string {
  if (level >= 50) return "Bậc thầy LearnX";
  if (level >= 30) return "Chuyên gia";
  if (level >= 20) return "Học viên nâng cao";
  if (level >= 10) return "Học viên chăm chỉ";
  if (level >= 5) return "Học viên tiến bộ";
  return "Học viên mới";
}

export default function LevelHero({ lifetimeXP, recentGain, leveledUp, levelTitle }: LevelHeroProps) {
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

  const title = levelTitle ?? levelTitleFor(d.level);

  return (
    <section
      className={`level-hero${leveledUp ? " level-hero--leveled" : ""}`}
      aria-label={`Cấp độ ${d.level}, ${d.progressPercent}% tới cấp tiếp theo`}
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
                <>{formatNumber(d.currentXP)} XP</>
              ) : (
                <>
                  {formatNumber(d.progressXP)} / {formatNumber(d.xpForNextLevel - d.xpForCurrentLevel)} XP
                </>
              )}
              {typeof recentGain === "number" && recentGain > 0 && (
                <span className="level-hero__gain" role="status">
                  +{formatNumber(recentGain)} XP
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
            aria-label={`Tiến độ Level ${d.level}`}
          >
            <div className="level-hero__fill" style={{ width: `${animatedPercent}%` }} />
          </div>

          <div className="level-hero__bottom">
            {leveledUp ? (
              <span className="level-hero__levelup" role="status">
                Level Up! Chúc mừng bạn 🎉
              </span>
            ) : d.isMaxLevel ? (
              <span>Tổng {formatNumber(d.currentXP)} XP — đã đạt cấp tối đa, giữ vững phong độ!</span>
            ) : (
              <span>
                Còn {formatNumber(d.remainingXP)} XP để đạt Level {d.level + 1}
              </span>
            )}
            <span className="level-hero__percent">{d.progressPercent}%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
