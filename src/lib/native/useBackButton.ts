"use client";

import { useEffect } from "react";
import { onNativeBackButton } from "./capacitor";

/**
 * Đóng lớp phủ (modal / drawer / bottom sheet) khi bấm nút back Android.
 *
 * Vì sao cần: WebView mặc định xử lý nút back bằng cách QUAY LẠI TRANG
 * (history.back) hoặc đóng app. Nếu đang mở modal mà bấm back lại quay
 * trang, người dùng mất trang hiện tại trong khi modal vẫn treo — rất dễ
 * chửi. Mọi lớp phủ trong app đều phải "ăn" nút back trước.
 *
 * Trên website hàm này là no-op (không có nút back vật lý), nên dùng chung
 * cho cả 2 nền tảng được.
 */
export function useBackButtonToClose(open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return;
    return onNativeBackButton(() => {
      onClose();
      return true;
    });
  }, [open, onClose]);
}
