// ================================================================
// ROOT LAYOUT
// ================================================================
// Mạch tư duy: dùng next/font để nạp 2 font (Space Grotesk cho tiêu
// đề, Inter cho phần thân) — 2 family khác nhau tạo độ tương phản
// "tiêu đề nổi bật, nội dung dễ đọc", đúng tinh thần đã chọn từ bản
// demo HTML. next/font tự tối ưu (không kéo font ngoài lúc runtime
// như <link> trong bản demo HTML thuần), phù hợp hơn cho Next.js thật.
// ================================================================

import type { ReactNode } from "react";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata = {
  title: "LearnX AI",
  description: "Trợ lý học tập cá nhân hoá bằng AI",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="vi" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
