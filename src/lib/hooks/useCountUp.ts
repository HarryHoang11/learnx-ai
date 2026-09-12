// ================================================================
// useCountUp — animate số từ cũ → mới (XP counter, thống kê)
// ================================================================
// Mạch tư duy: khi XP/tổng số thay đổi (sau nộp bài, sau fetch), số
// nhảy cóc trông rẻ tiền — hook này nội suy mượt bằng rAF với
// ease-out, tôn trọng prefers-reduced-motion (nhảy ngay tới số mới).
// Chỉ animate khi `value` đổi, không animation vô hạn.

"use client";

import { useEffect, useRef, useState } from "react";

export function useCountUp(value: number, durationMs = 600): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    if (from === value) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = value;
    };
  }, [value, durationMs]);

  return display;
}
