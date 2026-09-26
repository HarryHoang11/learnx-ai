// ================================================================
// <AppDownloadBlock /> — khối "tải app Android" dùng chung
//
// Mạch tư duy: LearnX có sẵn bản Android nên cần một lối vào rõ ràng. Khối này
// xuất hiện ở 3 nơi (Welcome, màn Hồ sơ sẵn sàng, Dashboard) nên nó PHẢI là 1
// component duy nhất — 3 bản CSS riêng sẽ lệch và lại sinh bug chồng chữ.
//
// BA THỨ PHẢI ĐÚNG, KHÔNG ĐƯỢC LÀM ẢO:
//   1. Link tải trỏ tới `getAndroidApp().apkUrl` — file APK THẬT đã nằm trong
//      public/downloads (xem src/config/app.ts). Không tự bịa URL.
//   2. Không ép chuyển hướng: ai cũng phải có đường ở lại web, nên `onContinueWeb`
//      là BẮT BUỘC ở mức type chứ không phải tuỳ chọn.
//   3. KHÔNG render URL tương đối vào QR: quét mã `/downloads/...` trên điện
//      thoại là vô nghĩa vì máy đó không biết domain của bạn.
//
// BỐ CỤC — MỘT CỘT TUẦN TỰ (tiêu đề → QR → mô tả → tải → ở lại web):
//   Đây là hệ quả trực tiếp của bug cũ: bản trước xếp QR + chữ + 2 nút vào
//   MỘT hàng `flex-wrap: nowrap`, rồi ép chữ `white-space: nowrap`. Khi khung
//   hẹp, hộp chữ bị co về 0 nhưng chữ vẫn vẽ ra ngoài nên ĐÈ LÊN 2 nút; thẻ
//   còn dùng `margin-left:50% + translateX(-50%)` (kỹ thuật "breakout" chỉ
//   đúng khi cha rộng bằng viewport) nên vỡ ngay khi dùng lại trong khung hẹp
//   hơn. Cột dọc + normal flow là cách DUY NHẤT không thể chồng ở mọi kích
//   thước, và không cần z-index hay chiều cao cố định.
// ================================================================

"use client";

import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { ArrowRight, Download, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { getAndroidApp } from "@/config/app";
import "./app-download.css";

export type AppDownloadVariant = "full" | "compact";

interface AppDownloadBlockProps {
  /** BẮT BUỘC: luôn phải có lối ở lại web, không ai bị ép rời web. */
  onContinueWeb: () => void;
  /** `full` = khối đầy đủ (Welcome, màn hồ sơ); `compact` = thẻ nhỏ (Dashboard). */
  variant?: AppDownloadVariant;
}

export default function AppDownloadBlock({
  onContinueWeb,
  variant = "full",
}: AppDownloadBlockProps) {
  const { t } = useLanguage();
  const app = getAndroidApp();
  const compact = variant === "compact";

  // URL TUYỆT ĐỐI cho QR — chỉ biết được SAU KHI MOUNT (server không có
  // window.location). Trước lúc đó hiện khung trống cùng kích thước để
  // không nhảy layout (CLS) khi QR dựng lên.
  const [absoluteUrl, setAbsoluteUrl] = useState<string | null>(null);
  useEffect(() => {
    if (/^https?:\/\//i.test(app.apkUrl)) {
      setAbsoluteUrl(app.apkUrl);
    } else if (typeof window !== "undefined") {
      setAbsoluteUrl(new URL(app.apkUrl, window.location.origin).toString());
    }
  }, [app.apkUrl]);

  // Kiểm tra file APK có tồn tại thật không.
  //
  // VÌ SAO CẦN: nút tải hỏng (404) nhìn GIỐNG HỆT nút tải chạy được — người
  // dùng bấm, không có gì xảy ra, đánh giá app là hỏng. HEAD 1 lần rẻ và cho
  // phép nói thẳng sự thật thay vì im lặng.
  const [apkAvailable, setApkAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(app.apkUrl, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setApkAvailable(res.ok);
      })
      .catch(() => {
        // Lỗi mạng KHÔNG phải bằng chứng file hỏng — giữ "chưa biết" để
        // không tắt nhầm nút tải khi người dùng đang offline.
        if (!cancelled) setApkAvailable(null);
      });
    return () => {
      cancelled = true;
    };
  }, [app.apkUrl]);

  const unavailable = apkAvailable === false;
  const qrSize = compact ? 76 : 104;

  // APK vài MB, bấm xong có cảm giác "không phản ứng gì". Cờ này đổi icon nút
  // sang spinner ngay khi bấm để người dùng biết thao tác đã được nhận.
  // KHÔNG tự reset — vì không có sự kiện "tải xong" nào báo về (download do
  // trình duyệt quản lý), nên giữ nguyên cho tới khi họ đóng/reload trang là
  // đúng và trung thực: ta biết đã bắt đầu, không biết đã xong.
  const [downloading, setDownloading] = useState(false);

  return (
    <section
      className={`app-dl app-dl--${variant}`}
      aria-labelledby="app-dl-title"
      data-testid="app-download-block"
    >
      <h3 id="app-dl-title" className="app-dl__title">
        {compact ? t("welcome.apk.mobileTitle") : t("welcome.apk.title")}
      </h3>

      {/* QR LUÔN hiển thị ở mọi kích thước. Bản cũ `display:none` dưới
          1099px vì QR nằm chung hàng chật; nay nó nằm trên 1 dòng riêng nên
          không còn lý do ẩn — mà người dùng mobile lại cần nó nhất. */}
      <div className="app-dl__qr" role="img" aria-label={t("welcome.apk.qrLabel")}>
        {absoluteUrl ? (
          <QRCode
            value={absoluteUrl}
            size={qrSize}
            bgColor="#0b1120"
            fgColor="#f5f7ff"
            level="M"
          />
        ) : (
          // Khung giữ chỗ CÙNG KÍCH THƯỚC — tránh nhảy layout khi QR dựng.
          <span className="app-dl__qr-placeholder" style={{ width: qrSize, height: qrSize }} />
        )}
        <span className="app-dl__qr-hint">{t("welcome.apk.qrHint")}</span>
      </div>

      <p className="app-dl__desc">{t("welcome.apk.subtitle")}</p>

      {unavailable && (
        <p className="app-dl__warn" role="status">
          {t("welcome.apk.unavailable")}
        </p>
      )}

      <a
        className="app-dl__btn app-dl__btn--primary"
        href={app.apkUrl}
        download
        rel="noopener"
        aria-disabled={unavailable}
        onClick={(e) => {
          if (unavailable) {
            e.preventDefault();
            return;
          }
          // APK nặng vài MB: bấm xong có cảm giác như không có phản hồi. Đánh dấu
          // "đang tải" ngay để nút đổi trạng thái. KHÔNG chặn điều hướng — trình
          // duyệt tự tải file, nếu ta preventDefault thì tải không bao giờ chạy.
          setDownloading(true);
        }}
      >
        {downloading ? (
          <Loader2 size={16} className="app-dl__spin" aria-hidden="true" />
        ) : (
          <Download size={16} aria-hidden="true" />
        )}
        {compact ? t("welcome.apk.ctaShort") : t("welcome.apk.cta")}
      </a>

      {/* Luôn có lối ở lại web — không bao giờ ép chuyển hướng sang APK. */}
      <button type="button" className="app-dl__btn app-dl__btn--ghost" onClick={onContinueWeb}>
        {t("welcome.apk.continueWeb")}
        <ArrowRight size={15} aria-hidden="true" />
      </button>
    </section>
  );
}