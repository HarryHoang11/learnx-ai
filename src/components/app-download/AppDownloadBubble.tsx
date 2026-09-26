// ================================================================
// <AppDownloadBubble /> — bubble tải app Android (hành động nổi THỨ CẤP)
// ================================================================
//
// Mạch tư duy sản phẩm: LearnX có sẵn app Android nhưng CTA này KHÔNG được
// tranh sự chú ý với việc học. Thứ tự ưu tiên trong app:
//
//   1. AI Assistant   (hành động nổi chính)
//   2. Nội dung học tập
//   3. App Download   (bubble nhỏ, góc dưới)
//   4. Các hành động phụ
//
// Vì vậy bubble này:
//   - NHỎ (52px), đứng trong cùng cột `.floating-actions` với nút AI, TỰ ĐỘNG
//     dồn lên trên chứ không tự `position: fixed` (xem FloatingActions.tsx) —
//     nên không bao giờ đè lên AI.
//   - Mở popover nhỏ, KHÔNG phải modal toàn màn hình.
//   - Người dùng đóng 1 lần là không tự mở lại, nhưng bubble vẫn còn để họ
//     chủ động bấm lại. Không ép xem quảng cáo tải app.
//
// DÙNG CHUNG config với AppDownloadBlock (khối ở Welcome / màn hồ sơ):
// `getAndroidApp()` là nguồn sự thật DUY NHẤT cho URL, nên đổi APK sau này
// chỉ sửa 1 chỗ.
// ================================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { getAndroidApp } from "@/config/app";
import { isNativeApp } from "@/lib/native/capacitor";
import "./app-download-bubble.css";

/**
 * Đã đóng popover -> không tự mở lại.
 *
 * VÌ SAO CHỈ GIỮ 1 CỜ ĐƠN GIẢN, KHÔNG LƯU THỜI ĐIỂM/HẾT HẠN: người dùng đóng
 * popover = câu trả lời "không quan tâm lúc này". Cứ hỏi lại sau vài ngày
 * chính là thứ khiến họ bấm chặn ứng dụng. Bubble vẫn còn để họ mở lại bất cứ
 * lúc nào — đó mới là cách tôn trọng.
 *
 * Đọc trong `useEffect` (phía client) để không gây hydration mismatch.
 */
const DISMISSED_KEY = "learnx-app-download-dismissed";

export default function AppDownloadBubble() {
  const { t } = useLanguage();
  const app = getAndroidApp();

  const [open, setOpen] = useState(false);
  // Người dùng đã bấm "x": KHÔNG tự mở lại, nhưng bubble vẫn còn để họ chủ
  // động bấm (yêu cầu: đóng popover không được xoá bubble).
  const [dismissed, setDismissed] = useState(false);
  // Người dùng đã bấm tải: bubble ẩn hẳn — nhắc "tải app" cho người đã có app
  // là nhiễu. Chỉ giữ trong phiên (không ghi DB): xoá app rồi vào lại vẫn thấy.
  const [downloaded, setDownloaded] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // `isNativeApp()` đọc `window` -> chỉ gọi SAU MOUNT để server render và
  // client render khớp nhau (hydration mismatch).
  useEffect(() => {
    setIsClient(true);
    try {
      setDismissed(window.localStorage.getItem(DISMISSED_KEY) === "1");
    } catch {
      // Private mode / chặn storage: coi như chưa đóng, không sao.
    }
  }, []);

  // Đóng khi bấm ra ngoài. Dùng `pointerdown` để phản ứng nhanh hơn `click`
  // và bắt được cả chạm trên mobile.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Escape đóng + trả focus về bubble (bắt buộc cho điều hướng bằng bàn phím).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Không lưu được thì chỉ ẩn trong phiên này — không ném lỗi.
    }
    buttonRef.current?.focus();
  }

  // Đang chạy trong app native (APK) thì không quảng bá app: người dùng đã cài.
  //
  // `dismissed` (đã bấm "x") KHÔNG ẩn bubble — người dùng phải còn đường mở
  // lại. Nó chỉ tắt hiệu ứng "xuất hiện" để bubble không nháy mỗi lần vào lại
  // trang. Ngược lại, `downloaded` (đã bấm tải) thì ẨN HẲN: nhắc "tải app"
  // cho người đã có app là nhiễu.
  if (!isClient || isNativeApp() || downloaded) return null;

  return (
    <div
      className={`app-bubble-root${dismissed ? " app-bubble-root--calm" : ""}`}
      ref={rootRef}
    >
      {open && (
        <div
          className="app-bubble-popover"
          role="dialog"
          aria-modal="false"
          aria-label={t("appDownload.title")}
        >
          <div className="app-bubble-popover__head">
            <span className="app-bubble-popover__icon" aria-hidden="true">
              <Smartphone size={16} />
            </span>
            <h2 className="app-bubble-popover__title">{t("appDownload.title")}</h2>
            <button
              type="button"
              className="app-bubble-popover__close"
              onClick={close}
              aria-label={t("appDownload.dismiss")}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>

          <p className="app-bubble-popover__desc">{t("appDownload.desc")}</p>

          <a
            className="app-bubble-popover__cta"
            href={app.apkUrl}
            download
            rel="noopener"
            onClick={() => {
              // Đã lấy app -> ẩn hẳn bubble. Nhắc "tải app" cho người đã tải là
              // nhiễu vô nghĩa. Nút vẫn có thể hiện lại nếu họ xoá app rồi
              // tải lại (cờ chỉ lưu trong phiên, không ghi DB).
              setOpen(false);
              setDownloaded(true);
            }}
          >
            <Download size={16} aria-hidden="true" />
            {t("appDownload.cta")}
          </a>

          {/* Chỉ nói đúng sự thật: hiện chỉ có Android, KHÔNG bịa iOS. */}
          <p className="app-bubble-popover__meta">
            {t("appDownload.platform")}
            {app.versionName ? ` · v${app.versionName}` : ""}
          </p>
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        className="app-bubble"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("appDownload.bubbleLabel")}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Smartphone size={19} aria-hidden="true" className="app-bubble__phone" />
        <Download size={13} aria-hidden="true" className="app-bubble__arrow" />
      </button>

      {/*
        Tooltip: pseudo-element, không thêm phần tử DOM -> không ảnh hưởng
        layout, không gây layout shift. Ẩn trên mobile (không có hover) và
        khi popover đang mở.
      */}
      {!open && (
        <span className="app-bubble__tip" aria-hidden="true">
          {t("appDownload.tooltip")}
        </span>
      )}
    </div>
  );
}
