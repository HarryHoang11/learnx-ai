// ================================================================
// Toast system dùng chung — success/error feedback, không alert()
// ================================================================
// Mạch tư duy: app cần feedback "Đã lưu", "Nộp bài +25 XP" mà không
// chặn UI như alert(). ToastProvider đặt 1 lần ở (app)/layout, mọi
// component con gọi useToast().push(...). Tự đóng sau 3.5s, có nút
// đóng cho keyboard/screen-reader, tôn trọng reduced-motion (CSS).

"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export interface ToastItem {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
}

interface ToastContextValue {
  push: (kind: ToastItem["kind"], message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ push: () => {} });

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const push = useCallback((kind: ToastItem["kind"], message: string) => {
    const id = idRef.current++;
    setToasts((prev) => [...prev.slice(-2), { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-host" role="region" aria-label={t("toast.region")}>
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.kind} toast-enter`} role="status">
            <span aria-hidden="true">
              {toast.kind === "success" ? "✓" : toast.kind === "error" ? "⚠" : "ℹ"}
            </span>
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismiss(toast.id)}
              aria-label={t("toast.dismiss")}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
