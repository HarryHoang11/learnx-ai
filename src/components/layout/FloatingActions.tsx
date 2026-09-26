// ================================================================
// <FloatingActions /> — cột nút nổi góc phải dưới (nguồn sự thật duy nhất)
// ================================================================
//
// Mạch tư duy: TRƯỚC đây mỗi nút nổi tự khai báo `position: fixed` với toạ độ
// riêng trong globals.css. Hai nút cùng góc phải dưới (AI Assistant + App
// Download) là bản lề buộc phải chồng nhau — và cách "giải quyết" bằng cách
// tăng z-index chỉ đổi thứ tự vẽ, không đổi việc chúng đè nhau.
//
// Nay chỉ có MỘT lớp quản lý vị trí: cột flex này. Thứ tự ưu tiên được khai
// báo bằng THỨ TỰ RENDER (không phải z-index):
//
//   ┌──────────────────────────┐
//   │  App Download   (thứ cấp)│  ← render trước -> nằm TRÊN
//   ├──────── ── 14px ─────────┤
//   │  AI Assistant (chính)   │  ← render sau  -> nằm DƯỚI, giữ vị trí quen thuộc
//   └──────────────────────────┘
//
// Nhờ cấu trúc flex, chúng KHÔNG THỂ chồng nhau kể cả khi kích thước thay đổi
// hoặc khi thêm/bớt action — không phụ thuộc magic number cho z-index.
//
// Toạ độ, safe-area, và khoảng cách nằm ở `.floating-actions` trong
// globals.css (dùng biến `--fab-*`). Component này chỉ lo bố cục và quyết
// định action nào được hiện.
// ================================================================

"use client";

import { usePathname } from "next/navigation";
import AppDownloadBubble from "@/components/app-download/AppDownloadBubble";
import FloatingAIButton from "@/components/tutor/FloatingAIButton";
import { isAppDownloadHiddenRoute } from "@/lib/app/download";

// Quy tắc route nào ẩn bubble nằm ở lib/app/download.ts (hàm thuần, có test)
// chứ không nhúng trong component — xem file đó để biết lý do từng route.

export default function FloatingActions() {
  const pathname = usePathname() ?? "";
  const showAppDownload = !isAppDownloadHiddenRoute(pathname);

  return (
    <div className="floating-actions">
      {/* ƯU TIÊN THẤP — render TRƯỚC để nằm phía TRÊN trong cột flex. */}
      {showAppDownload && <AppDownloadBubble />}
      {/* ƯU TIÊN CAO — luôn giữ vị trí đáy cột, không bao giờ bị dồn đi. */}
      <FloatingAIButton />
    </div>
  );
}