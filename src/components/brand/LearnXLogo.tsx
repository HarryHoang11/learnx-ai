// ================================================================
// <LearnXLogo /> — component DUY NHẤT được phép render logo LearnX AI
// ================================================================
//
// VÌ SAO CÓ COMPONENT NÀY: trước đây logo được vẽ lại ở từng nơi —
// Sidebar dùng chữ "X" trong ô bo gốc, AuthCard dùng div gradient + "X",
// Welcome dùng SVG tự vẽ 2 đường chéo. Ba cách khác nhau cho cùng một
// thương hiệu là ba cách để sản phẩm trông như không cùng một công ty.
// Nay mọi nơi gọi LearnXLogo, và nó luôn trỏ về MỘT asset.
//
// ASSET: /brand/learnx-mark.svg (public/brand/) — nguồn sự thật duy nhất,
// dùng chung cả web lẫn Android. Thay file đó là cả hệ thống đổi logo.
//
// VỀ MÀU: logo là gradient (navy -> indigo -> cyan) nên ĐỒNG NHẤT trên cả
// nền tối lẫn nền sáng — không cần biến thể light/dark. Đây là chủ ý để
// không phá brand bằng cách tự đổi màu logo theo theme.
// ================================================================

import Image from "next/image";
import "./learnx-logo.css";

/** Đường dẫn asset — hằng số để không lặp chuỗi ở nhiều file. */
export const LEARNX_LOGO_SRC = "/brand/learnx-mark.svg";

/** Tên thương hiệu, dùng cho alt/aria nên không hard-code rải rác. */
export const LEARNX_BRAND_NAME = "LearnX AI";

type LogoSize = "sm" | "md" | "lg" | "xl";

/**
 * Kích thước (px) theo ngữ cảnh dùng:
 *  - sm: sidebar, topbar nhỏ, footer
 *  - md: auth card, menu ngữ cảnh
 *  - lg: welcome hero
 *  - xl: trang giới thiệu / splash
 */
const SIZE_PX: Record<LogoSize, number> = {
  sm: 28,
  md: 34,
  lg: 48,
  xl: 72,
};

export interface LearnXLogoProps {
  /**
   * - `full` (mặc định): logo + chữ "LearnX" cạnh nhau.
   * - `icon`: chỉ mark — dùng khi không có chỗ cho chữ (mobile navbar hẹp).
   */
  variant?: "full" | "icon";
  size?: LogoSize;
  /**
   * Cỡ chữ đi cùng logo khi `variant="full"`. Mặc định bám theo size để
   * sidebar/hero không lệch nhau.
   */
  withWordmark?: boolean;
  /** Ghi đè class để chỉnh vị trí/hiệu ứng từ nơi gọi. */
  className?: string;
  /**
   * Khi bọc trong thẻ link tới trang chủ, truyền `false` để tránh hai tầng
   * link (a > a) — lỗi a11y nghiêm trọng, trình đọc màn hình đọc sai.
   */
  decorative?: boolean;
}

export default function LearnXLogo({
  variant = "full",
  size = "md",
  withWordmark = true,
  className = "",
  decorative = false,
}: LearnXLogoProps) {
  const px = SIZE_PX[size];
  // Chữ to hơn logo một chút ở cỡ lớn để nhìn cân, nhỏ hơn ở cỡ nhỏ để
  // navbar không bị cao lên bất thường.
  const wordFontSize = Math.round(px * (size === "lg" || size === "xl" ? 0.5 : 0.53));

  return (
    <span
      className={`learnx-logo learnx-logo--${variant} ${className}`.trim()}
      // Nhận diện thương hiệu là thông tin quan trọng cho screen reader, nên
    >
      <Image
        src={LEARNX_LOGO_SRC}
        alt={decorative ? "" : LEARNX_BRAND_NAME}
        aria-hidden={decorative || undefined}
        width={px}
        height={px}
        // Logo luôn vuông vì viewBox 512x512 -> object-fit cover là thừa,
        // nhưng đặt sẵn để sau này đổi sang asset không vuông không vỡ layout.
        className="learnx-logo__mark"
        priority={false}
      />
      {variant === "full" && withWordmark && (
        <span
          className="learnx-logo__word"
          style={{ fontSize: wordFontSize }}
          aria-hidden={decorative || undefined}
        >
          LearnX
        </span>
      )}
    </span>
  );
}
