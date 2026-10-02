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
import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { resolvePublicUrl } from "@/config/app";
import SessionProviderWrapper from "@/components/providers/SessionProviderWrapper";
import { LanguageProvider } from "@/components/providers/LanguageProvider";
import { ThemeProvider, THEME_STORAGE_KEY } from "@/components/providers/ThemeProvider";
import NativeShell from "@/components/native/NativeShell";
import "katex/dist/katex.min.css";
import "./globals.css";

// Chạy ĐỒNG BỘ trước khi React hydrate (đặt trong <head>, không phải
// component React) — set data-theme lên <html> NGAY khi HTML tải
// xong, tránh "nháy" theme sai 1 khung hình rồi mới đổi lại đúng.
// Không dùng biến JS ngoài chuỗi literal vì nội dung này chạy trong
// trình duyệt, tách biệt hoàn toàn khỏi runtime Node của phần còn lại
// file — nhúng trực tiếp key storage vào chuỗi để không lệch nếu
// THEME_STORAGE_KEY đổi sau này.
const themeInitScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;

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

/**
 * Gốc URL tuyệt đối cho metadata (OpenGraph, Twitter, canonical).
 *
 * VÌ SAO CẦN: Next.js cảnh báo `metadataBase property is not set` và thay mọi
 * URL tương đối (`/brand/...`) bằng `http://localhost:3000` — lên production thì
 * ảnh OG/Twitter trong link chia sẻ hỏng hết (Zalo/Facebook không tải được).
 *
 * VÌ SAO KHÔNG hardcode domain production: domain LearnX đổi theo môi trường
 * (staging, domain riêng, deploy thử). Nên đọc từ env và CHỈ chấp nhận khi
 * parse được thành URL tuyệt đối — `.env` có thể để trống hoặc còn sót dấu
 * nháy kép (`APP_URL=""`) mà `new URL()` sẽ throw ngay lúc build.
 *
 * Thứ tự: env hợp lệ → localhost ở dev → localhost cảnh báo ở prod (build vẫn
 * chạy được thay vì sập).
 */
function resolveMetadataBase(): URL {
  // Dùng CHUNG `resolvePublicUrl()` với auth.ts (tầng config) — trước đây 2
  // chỗ tự liệt kê env khác nhau nên project đặt `APP_URL` thì metadataBase
  // chạy được còn `trustHost` thì không ⇒ toàn bộ /api/auth/* trả 503.
  const found = resolvePublicUrl();
  if (found) {
    try {
      return new URL(found);
    } catch {
      // resolvePublicUrl chỉ trả về URL đã parse được — nhánh này chỉ để
      // TypeScript thỏa mãn kiểu trả về, không xảy ra thực tế.
    }
  }
  return new URL("http://localhost:3000");
}


/**
 * Metadata toàn site — nơi DUY NHẤT khai báo tên + icon + link chia sẻ.
 *
 * Icon trỏ về `/brand/learnx-mark.svg` — cùng asset với logo trong UI, nên đổi
 * logo một lần là tab browser + PWA + app cùng đổi, không bao giờ lệch.
 *
 * `app/favicon.ico` (sinh bởi `npm run favicon` từ icon launcher Android) là
 * file convention của Next: phục vụ `/favicon.ico` mà browser LUÔN gọi khi mở
 * tab. Thiếu nó thì mọi trang đều 404 đỏ ở dòng favicon dù đã có `<link rel=icon>`.
 * Nội dung .ico vẫn là logo LearnX — không phải icon riêng.
 */
export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: "LearnX AI",
  description: "Trợ lý học tập cá nhân hoá bằng AI",
  applicationName: "LearnX AI",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/brand/learnx-mark.svg", type: "image/svg+xml" }],
    // Safari chỉ hiển thị favicon SVG từ Safari 16+; các bản cũ sẽ dùng mặc
    // định. Chấp nhận hơn là tạo thêm file .ico riêng cho 1 trình duyệt.
    apple: [{ url: "/brand/learnx-mark.svg" }],
  },
  openGraph: {
    type: "website",
    siteName: "LearnX AI",
    title: "LearnX AI — Trợ lý học tập cá nhân hoá bằng AI",
    description: "Lộ trình học cá nhân hoá, AI gia sư và bài tập theo đúng năng lực của bạn.",
    locale: "vi_VN",
    images: [{ url: "/brand/learnx-mark.svg", width: 512, height: 512, alt: "LearnX AI" }],
  },
  twitter: {
    card: "summary",
    title: "LearnX AI",
    description: "Trợ lý học tập cá nhân hoá bằng AI",
    images: ["/brand/learnx-mark.svg"],
  },
};


/**
 * Viewport — BẮT BUỘC cho app Android.
 *
 * `viewportFit: "cover"` là điều kiện để `env(safe-area-inset-*)` trả về giá
 * trị khác 0. Không có nó, mọi padding safe-area trong globals.css bằng 0 và
 * nội dung bị chồng lên notch / thanh home indicator trên iPhone — trên
 * Android thường là vùng camera punch-hole và thanh điều hướng gesture.
 *
 * `maximumScale` cố ý KHÔNG đặt: chặn zoom làm người dùng khó đọc khi
 * phóng chữ (WCAG). Zoom trong WebView vẫn chạy bình thường.
 */
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // `interactive-widget` giúp bàn phím không che ô nhập ở Chrome Android;
  // WebView Capacitor bỏ qua giá trị này và dùng resize: native của
  // @capacitor/keyboard, nên đặt sẵn là vô hại và đúng cho web.
  interactiveWidget: "resizes-content",
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
      <head>
        {/* Chặn hydrate: đọc theme đã lưu và set data-theme lên <html>
            TRƯỚC KHI trang vẽ khung hình đầu tiên — đây là kỹ thuật
            chuẩn (giống next-themes) để đổi theme không bị "nháy"
            sáng/tối 1 nhịp rồi mới đổi lại đúng theo lựa chọn cũ. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
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
          <ThemeProvider>
            <SessionProviderWrapper>
              {/* NativeShell bọc ngoài cùng: gắn nút back Android, status bar,
                  bàn phím, splash và băng cảnh báo offline. Trên website nó là
                  no-op nên không đổi hành vi gì cả. */}
              <NativeShell>{children}</NativeShell>
            </SessionProviderWrapper>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
