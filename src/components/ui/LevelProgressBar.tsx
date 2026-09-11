// ================================================================
// <LevelProgressBar /> — thanh tiến độ Level dùng chung (bản gọn)
// ================================================================
// Mạch tư duy: bản gọn dùng ở dashboard/profile/friends/leaderboard.
// Logic số học nằm gọn trong getLevelProgressDetails() (lib/constants/
// xp.ts) — component chỉ render + format số. Props nhận lifetimeXP
// thô (number), không nhận percent tính sẵn từ ngoài để tránh 2 nguồn
// sự thật. Animate 0% → progress thật lúc mount, tôn trọng
// prefers-reduced-motion, không animation vô hạn.
// ================================================================

"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import { getLevelProgressDetails } from "@/lib/constants/xp";

interface LevelProgressBarProps {
  lifetimeXP: number;
}

const formatNumber = (num: number) => num.toLocaleString("vi-VN");

export default function LevelProgressBar({ lifetimeXP }: LevelProgressBarProps) {
  const d = getLevelProgressDetails(lifetimeXP);
  const [animatedPercent, setAnimatedPercent] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setAnimatedPercent(d.progressPercent);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const duration = 600;
    const target = d.progressPercent;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedPercent(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [d.progressPercent]);

  return (
    <Panel style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          LEVEL {d.level}
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
          {d.isMaxLevel ? (
            <>Đã đạt cấp tối đa</>
          ) : (
            <>{formatNumber(d.progressXP)} / {formatNumber(d.xpForNextLevel - d.xpForCurrentLevel)} XP · {d.progressPercent}%</>
          )}
        </div>
      </div>
      <div
        className="bar-track"
        style={{ height: 12 }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={d.progressPercent}
        aria-label={`Tiến độ Level ${d.level}`}
      >
        <div
          className="bar-fill"
          style={{
            width: `${animatedPercent}%`,
            background: "linear-gradient(90deg, var(--cyan), var(--indigo))",
            transition: "width 0.15s ease-out",
          }}
        />
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 8 }}>
        {d.isMaxLevel
          ? `Tổng ${formatNumber(d.currentXP)} XP — giữ vững phong độ!`
          : `Còn ${formatNumber(d.remainingXP)} XP để lên Level ${d.level + 1}`}
      </div>
    </Panel>
  );
}
