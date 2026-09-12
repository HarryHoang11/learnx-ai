// ================================================================
// <GlassCard /> — Reusable glassmorphic container with subtle glow on hover
// ================================================================

import type { CSSProperties, ReactNode } from "react";

export interface GlassCardProps {
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
  hoverable?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

export default function GlassCard({
  children,
  style,
  className = "",
  hoverable = false,
  padding = "md",
}: GlassCardProps) {
  const paddingStyles: Record<string, CSSProperties> = {
    none: { padding: 0 },
    sm: { padding: "12px 14px" },
    md: { padding: "22px 24px" },
    lg: { padding: "28px 32px" },
  };

  return (
    <div
      className={`panel ${hoverable ? "glass-card--hoverable" : ""} ${className}`}
      style={{ ...paddingStyles[padding], ...style }}
    >
      {children}
    </div>
  );
}