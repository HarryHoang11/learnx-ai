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
      {/* suppressHydrationWarning cũng cần ở <body>: attribute
          data-gr-ext-installed / data-new-gr-c-s-check-loaded là do
          extension Grammarly chèn vào body sau khi HTML server đã tải
          xong — cùng lý do như <html> ở trên, không phải lỗi code. */}
      <body suppressHydrationWarning>
        <SessionProviderWrapper>{children}</SessionProviderWrapper>
      </body>
    </html>
  );
}
