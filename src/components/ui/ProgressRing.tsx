// ================================================================
// <ProgressRing /> — Vòng tiến trình tròn SVG hiển thị điểm mastery
// ================================================================

import type { CSSProperties, ReactNode } from "react";

export interface ProgressRingProps {
  percent: number; // 0..100
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
  style?: CSSProperties;
}

export default function ProgressRing({
  percent,
  size = 80,
  strokeWidth = 7,
  color,
  trackColor = "rgba(255, 255, 255, 0.08)",
  children,
  style,
}: ProgressRingProps) {
  const safePercent = Math.min(100, Math.max(0, Math.round(percent)));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (safePercent / 100) * circumference;

  // Auto color by percent if not provided
  const resolvedColor =
    color ||
    (safePercent >= 80
      ? "var(--cyan)"
      : safePercent >= 50
      ? "var(--indigo)"
      : safePercent >= 30
      ? "var(--amber)"
      : "var(--rose)");

  return (
    <div
      className="progress-ring-container"
      style={{ width: size, height: size, ...style }}
    >
      <svg width={size} height={size} className="progress-ring-svg">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={resolvedColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          style={{
            transition: "stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
            transform: "rotate(-90deg)",
            transformOrigin: "50% 50%",
          }}
        />
      </svg>
      <div className="progress-ring-inner">
        {children !== undefined ? (
          children
        ) : (
          <span className="progress-ring-text">{safePercent}%</span>
        )}
      </div>
    </div>
  );
}
