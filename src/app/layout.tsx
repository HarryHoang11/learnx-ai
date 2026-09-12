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
import SessionProviderWrapper from "@/components/providers/SessionProviderWrapper";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import "katex/dist/katex.min.css";
import "./globals.css";

// next/font: nạp thêm subset "vietnamese" (cả 2 family đều hỗ trợ) —
// trước đây chỉ có "latin" nên chữ Việt có dấu rơi về font fallback
// của hệ điều hành, gây vỡ nét và layout shift giữa các máy.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
});

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata = {
  title: "LearnX AI",
  description: "Trợ lý học tập cá nhân hoá bằng AI",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning ĐẶT ĐÚNG Ở ĐÂY (thẻ <html>), không phải
    // để "che lỗi" — đây là trường hợp Next.js CHÍNH THỨC khuyến nghị
    // dùng suppressHydrationWarning: một số tiện ích mở rộng trình
    // duyệt (browser extension) tự chèn thêm class vào thẻ <html> SAU
    // khi HTML từ server đã tải xong (vd class "mdl-js" trong lỗi gốc
    // — đây là dấu hiệu đặc trưng của các extension nhận diện trang
    // dùng Material Design Lite, KHÔNG phải class do code của LearnX
    // sinh ra — đã grep toàn bộ source, không có chỗ nào chứa chuỗi
    // "mdl-js"). React không thể biết trước class này để render khớp
    // ở server, nên luôn cảnh báo mismatch dù ứng dụng hoàn toàn đúng.
    // suppressHydrationWarning chỉ tắt cảnh báo CHO ĐÚNG THẺ NÀY, không
    // ảnh hưởng tới việc phát hiện mismatch thật ở bất kỳ thẻ con nào.
    <html lang="vi" className={`${spaceGrotesk.variable} ${inter.variable}`} suppressHydrationWarning>
      {/* suppressHydrationWarning Ở <body> chỉ tắt cảnh báo cho chính
          attributes của thẻ body (React chỉ áp dụng 1 cấp, children vẫn
          warn bình thường). Lý do duy nhất: extension trình duyệt
          (Grammarly...) tự chèn data-new-gr-c-s-check-loaded /
          data-gr-ext-installed vào body SAU khi HTML server đã tải —
          đã audit toàn project, không có mismatch thật nào ở body.
          Bug thật duy nhất đã tìm thấy (calendar anchor theo TZ) được
          sửa bằng mounted-pattern, KHÔNG phải bằng suppress. */}
      <body suppressHydrationWarning>
        {/* LanguageProvider ở root (ngoài SessionProvider) để phủ TOÀN
            app kể cả /login và /register — 1 provider duy nhất, không
            lồng 2 tầng (xem (app)/layout.tsx). */}
        <LanguageProvider>
          <SessionProviderWrapper>{children}</SessionProviderWrapper>
        </LanguageProvider>
      </body>
    </html>
  );
}
