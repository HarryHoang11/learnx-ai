// ================================================================
// <LanguageProvider /> — ngôn ngữ UI, persist 2 lớp
// ================================================================
// Mạch tư duy: localStorage cho tức thì (có ngay trước cả khi session
// tải xong, không nháy ngôn ngữ sau refresh); DB (User.language qua
// /api/profile) để giữ preference giữa các thiết bị/phiên đăng nhập.
// DB thắng localStorage khi cả hai có (đăng nhập = nguồn thật). Không
// đọc localStorage trong render (hydration!) — chỉ trong useEffect và
// event handler.

"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
  translate,
  type I18nKey,
  type Language,
} from "@/lib/i18n/dictionary";
import type { ApiResponse, UserProfile } from "@/types";

interface LanguageContextValue {
  lang: Language;
  t: (key: I18nKey, params?: Record<string, string | number>) => string;
  setLang: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: "vi",
  t: (key, params) => translate("vi", key, params),
  setLang: () => {},
});

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("vi");
  // t() ổn định identity + luôn đọc lang mới nhất qua ref — an toàn khi
  // dùng trong useEffect/useCallback rỗng, không stale closure.
  const langRef = useRef<Language>(lang);
  langRef.current = lang;

  // Khởi tạo 1 lần sau mount: DB (nếu đăng nhập) thắng localStorage.
  useEffect(() => {
    let cancelled = false;
    const local = normalizeLanguage(
      typeof window !== "undefined" ? window.localStorage.getItem(LANGUAGE_STORAGE_KEY) : null
    );
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: ApiResponse<UserProfile> | null) => {
        if (cancelled || !json || !json.success) {
          if (!cancelled) applyLang(local);
          return;
        }
        const dbLang = normalizeLanguage(json.data.language);
        applyLang(dbLang);
        try {
          window.localStorage.setItem(LANGUAGE_STORAGE_KEY, dbLang);
        } catch {}
      })
      .catch(() => {
        if (!cancelled) applyLang(local);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyLang(next: Language) {
    setLangState(next);
    if (typeof document !== "undefined") {
      document.documentElement.lang = next;
    }
  }

  const setLang = useCallback((next: Language) => {
    applyLang(next);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {}
    // Persist DB best-effort (không login thì 401, bỏ qua im lặng).
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: next }),
    }).catch(() => {});
  }, []);

  const t = useCallback<LanguageContextValue["t"]>(
    (key, params) => translate(langRef.current, key, params),
    []
  );

  const value = useMemo<LanguageContextValue>(() => ({ lang, t, setLang }), [lang, t, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
