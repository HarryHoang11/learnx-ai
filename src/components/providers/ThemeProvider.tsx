// ================================================================
// <ThemeProvider /> — dark/light theme, persist localStorage
// ================================================================
// Mạch tư duy: KHÔNG đọc localStorage trong lúc render lần đầu (sẽ
// gây hydration mismatch vì server không biết giá trị này) — giống
// nguyên tắc LanguageProvider đã áp dụng. Việc set `data-theme` lên
// <html> TRƯỚC KHI React hydrate được xử lý bởi inline script trong
// layout.tsx (chạy đồng bộ, chặn render đầu tiên) — ThemeProvider chỉ
// cần ĐỌC LẠI giá trị `<html>` đã có (do script đặt) trong effect đầu
// tiên để đồng bộ state React, rồi từ đó `setTheme()` mới cần ghi.
// <html> vốn đã có `suppressHydrationWarning` (xem layout.tsx — dùng
// cho browser extension), nên thêm/đổi data-theme ở đây không tạo
// warning mới.
// ================================================================

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "learnx-theme";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

function applyThemeToDom(theme: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Mặc định "dark" khớp với những gì server render (không có
  // data-theme -> CSS mặc định = dark) — tránh mismatch. Effect đầu
  // tiên đọc lại attribute thật (đã được inline script set trước khi
  // hydrate) để đồng bộ, KHÔNG phải nguồn sự thật ban đầu.
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") {
      setThemeState(current);
    }
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    applyThemeToDom(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage có thể bị chặn (chế độ ẩn danh nghiêm ngặt) — theme
      // vẫn áp dụng đúng cho phiên hiện tại, chỉ không nhớ lần sau.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const value = useMemo<ThemeContextValue>(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
