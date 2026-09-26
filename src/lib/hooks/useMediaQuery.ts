// ================================================================
// <useMediaQuery /> — theo dõi 1 media query, an toàn SSR
// ================================================================
// Mạch tư duy: điều hướng/UI mobile cần biết "đang ở màn hình hẹp không"
// để CHỌN BỐ CỤC (vd đưa panel chi tiết của mind map vào bottom sheet
// thay vì cột bên cạnh canvas). CSS @media lo phần TRÌNH BÀY, nhưng
// không lo được phần "render cấu trúc khác nhau" — chỗ đó cần JS.
//
// Vì sao tự viết thay vì cài thư viện: chỉ cần matchMedia + 1 listener,
// thêm dependency cho 15 dòng là không đáng.
//
// SSR: giá trị khởi tạo là `false` (coi như desktop) rồi cập nhật sau khi
// mount — server không có window.matchMedia nên không thể biết trước; quy
// ước "render bố cục rộng trước, chỉnh lại sau mount" giúp HTML server và
// client render KHỚP nhau (hydration mismatch) và vẫn đúng trên máy thật.
// ================================================================

"use client";

import { useEffect, useState } from "react";

/**
 * @param query Chuỗi media query, vd "(max-width: 880px)".
 * @returns true nếu khớp; luôn false ở server và ở lần render đầu.
 */
export default function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    setMatches(list.matches);
    // addEventListener (không phải addListener) là API chuẩn hiện hành;
    // addListener đã bị gỡ ở Safari 14+ và Chrome 100+ trở đi.
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener("change", handleChange);
    return () => list.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
}

/** Breakpoint "hẹp" của app — KHỚP breakpoint trong globals.css (880px). */
export const MOBILE_QUERY = "(max-width: 880px)";

/** Hook rút gọn: màn hình hẹp (mobile) hay không. */
export function useIsMobile(): boolean {
  return useMediaQuery(MOBILE_QUERY);
}
