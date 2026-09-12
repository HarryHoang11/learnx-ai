// ================================================================
// <Badge /> — Nhãn trạng thái, độ khó, trust level
// ================================================================

import type { CSSProperties, ReactNode } from "react";

export type BadgeVariant =
  | "indigo"
  | "cyan"
  | "amber"
  | "rose"
  | "gray"
  | "success"
  | "warning"
  | "error";

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  icon?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export default function Badge({
  variant = "indigo",
  children,
  icon,
  style,
  className = "",
}: BadgeProps) {
  const variantClass = `badge badge--${variant}`;

  return (
    <span className={`${variantClass} ${className}`} style={style}>
      {icon && <span className="badge-icon" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}
