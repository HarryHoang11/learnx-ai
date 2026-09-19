"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut, Loader2 } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

interface LogoutButtonProps {
  className?: string;
  variant?: "topbar" | "full" | "danger";
}

export default function LogoutButton({ className = "", variant = "topbar" }: LogoutButtonProps) {
  const { t } = useLanguage();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut({ callbackUrl: "/login" });
    } catch {
      setLoggingOut(false);
    }
  };

  if (variant === "full") {
    return (
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        aria-busy={loggingOut}
        className={`btn-danger ${className}`}
        style={{ width: "100%", justifyContent: "center", padding: "12px 20px" }}
      >
        {loggingOut ? (
          <Loader2 size={16} className="spinner" aria-hidden="true" />
        ) : (
          <LogOut size={16} aria-hidden="true" />
        )}
        <span>{loggingOut ? t("auth.loggingOut") || "Đang đăng xuất..." : t("topbar.logout")}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loggingOut}
      aria-busy={loggingOut}
      className={`btn-secondary ${className}`}
      style={{
        fontSize: 12.5,
        padding: "7px 12px",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
      title={t("topbar.logout")}
    >
      {loggingOut ? (
        <Loader2 size={14} className="spinner" aria-hidden="true" />
      ) : (
        <LogOut size={14} aria-hidden="true" />
      )}
      <span>{loggingOut ? t("auth.loggingOut") || "Đang đăng xuất..." : t("topbar.logout")}</span>
    </button>
  );
}

