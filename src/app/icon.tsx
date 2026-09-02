// ================================================================
// app/icon.tsx — FAVICON (Next.js file convention)
// ================================================================
// Mạch tư duy: lỗi "favicon.ico 404" xảy ra vì project trước đó
// KHÔNG có file favicon nào, kể cả trong public/. Thay vì thêm 1 file
// .ico tĩnh (khó tạo đúng định dạng binary nếu không có công cụ thiết
// kế), dùng ĐÚNG convention của Next.js App Router: file `icon.tsx`
// trong app/ tự động được Next.js build thành route `/icon` và tự
// khai báo thẻ <link rel="icon"> trong <head> — không cần sửa
// layout.tsx hay metadata thủ công.
// ================================================================

import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #7c6cf0, #35d0d8)",
          borderRadius: 7,
          color: "#0a0e16",
          fontWeight: 700,
          fontSize: 20,
        }}
      >
        X
      </div>
    ),
    { ...size }
  );
}
