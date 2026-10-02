// ================================================================
// <AnimatedNumber /> — số đếm chạy từ giá trị cũ sang giá trị mới
// ================================================================
// Mạch tư duy (VÌ SAO CẦN — đây là "động lực học tập", không chỉ cho đẹp):
//   Trước đây XP hiện bằng `lifetimeXP` thẳng. Người dùng làm 1 bài, quay
//   lại thấy con số nhảy từ 1,240 → 1,265 trong 1 khung hình — KHÔNG CẢM
//   NHẬN ĐƯỢC là mình vừa kiếm được gì. Số chạy chậm ~700ms khiến não
//   "thấy" khối lượng vừa nhận, và đó chính là phần cảm giác được thưởng.
//
// Nguyên tắc thiết kế:
//   - `requestAnimationFrame` + easing ease-out, KHÔNG setInterval (rễ ràng,
//     bị lệch khi tab ẩn).
//   - Dùng `transform`/`opacity` cho phần phản hồi, con số chỉ đổi textContent
//     (không kích hoạt layout nặng trong lúc chạy).
//   - `prefers-reduced-motion`: nhảy thẳng tới giá trị cuối (đã có rule toàn
//     app; component này cũng tự kiểm tra để không phụ thuộc).
//   - Không bắt đầu animation nếu không có thay đổi (tránh nháy vô nghĩa).
// ================================================================

"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  /** Giá trị đích. */
  value: number;
  /** Số chữ hiển thị sau dấu phẩy (XP không cần, XP reward giá có). */
  decimals?: number;
  /** Tiền tố, ví dụ "+" cho XP vừa nhận. */
  prefix?: string;
  /** Hậu tố, ví dụ " XP". */
  suffix?: string;
  /** Thời gian chạy (ms). Mặc định 700ms — đủ thấy nhưng không chờ. */
  durationMs?: number;
  /** Dùng khi muốn tự kiểm tra animation chạy (vd highlight khi XP tăng). */
  className?: string;
  /** Bỏ qua animation, hiện thẳng — dùng cho SSR/skeleton hoặc test. */
  animate?: boolean;
}

function easeOutCubic(t: number): number {
  // 1 - (1 - t)^3: nhanh ở đầu, chậm dần về cuối — giống cảm giác "đang
  // gần tới con số đích", không bị dừng lại đột ngột ở cuối.
  return 1 - Math.pow(1 - t, 3);
}

function formatValue(value: number, decimals: number, locale: string): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export default function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  durationMs = 700,
  className,
  animate = true,
}: AnimatedNumberProps) {
  // Locale lấy từ trình duyệt — dùng để format 1,240 (vi/en) và 1.240 (de).
  // Lưu 1 lần vào ref vì không cần re-render khi locale đổi giữa lúc chạy.
  const localeRef = useRef(typeof navigator !== "undefined" ? navigator.language : "vi-VN");

  const [display, setDisplay] = useState(animate ? 0 : value);
  const prevValueRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const target = value;
    const from = prevValueRef.current;
    prevValueRef.current = value;

    if (!animate) {
      setDisplay(target);
      return;
    }

    // Không có gì để chạy (giá trị không đổi, hoặc lần đầu mount với giá trị
    // đã bằng 0) -> hiện thẳng, tránh nháy 1 frame.
    if (from === target) {
      setDisplay(target);
      return;
    }

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduceMotion || durationMs <= 0) {
      setDisplay(target);
      return;
    }

    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(t);
      setDisplay(from + (target - from) * eased);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        // Chốt đúng giá trị đích (tránh sai số làm tròn từ easing).
        setDisplay(target);
        frameRef.current = null;
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [value, durationMs, animate]);

  const text = formatValue(display, decimals, localeRef.current);

  return (
    <span className={className} aria-label={`${prefix}${formatValue(value, decimals, localeRef.current)}${suffix}`}>
      {/* aria-hidden: screen reader đọc aria-label 1 lần với giá trị CUỐI,
          không đọc từng frame số đang chạy (sẽ thành spam). */}
      <span aria-hidden="true">
        {prefix}
        {text}
        {suffix}
      </span>
    </span>
  );
}