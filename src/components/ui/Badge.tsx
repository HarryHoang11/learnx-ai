// ================================================================
// <Badge /> — nhãn trạng thái dùng chung (rarity phần thưởng, trạng thái
// đổi thưởng, achievement, level...)
// ================================================================
// Mạch tư duy: trước đây mỗi chỗ tự dựng badge bằng inline style
// (`padding: 3px 8px, borderRadius: 99px, fontSize: 11`) với màu tuỳ ý —
// cùng 1 khái niệm "nhãn" nhưng nhiều kiểu khác nhau, và màu không theme
// hoá được. Gom về 1 component + token `--rarity-*` trong globals.css để
// nhất quán và đổi theme được.
// ================================================================

import type { CSSProperties, ReactNode } from "react";

/**
 * Rarity của phần thưởng — KHỚP enum `RewardRarity` trong prisma/schema.prisma.
 * Khai báo string thay vì import type từ `@prisma/client` vì component này
 * chạy ở client, nơi không được import Prisma client (xem types/index.ts —
 * cùng lý do với `RoadmapStatus`).
 */
export type Rarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export interface BadgeProps {
  children: ReactNode;
  /**
   * Sắc màu chức năng. Khi truyền `rarity` thì tone bị bỏ qua (màu do
   * rarity quyết định — đó là ý nghĩa của nó).
   */
  tone?: "neutral" | "indigo" | "cyan" | "green" | "amber" | "rose";
  /** Ghi đè tone bằng bảng màu độ hiếm. */
  rarity?: Rarity;
  /** Badge tròn chỉ có icon, không text. */
  iconOnly?: boolean;
  style?: CSSProperties;
  title?: string;
}

const RARITY_CLASS: Record<Rarity, string> = {
  COMMON: "badge--common",
  RARE: "badge--rare",
  EPIC: "badge--epic",
  LEGENDARY: "badge--legendary",
};

export default function Badge({
  children,
  tone = "neutral",
  rarity,
  iconOnly = false,
  style,
  title,
}: BadgeProps) {
  const className = rarity
    ? `badge badge--reward ${RARITY_CLASS[rarity]}`
    : `badge badge--${tone}`;

  return (
    <span className={`${className}${iconOnly ? " badge--icon" : ""}`} style={style} title={title}>
      {children}
    </span>
  );
}