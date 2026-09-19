// ================================================================
// <Drawer /> — Mobile side drawer with backdrop & scroll lock
// ================================================================

import { useEffect, type ReactNode, type CSSProperties } from "react";
import { X } from "lucide-react";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  position?: "left" | "right";
  size?: "sm" | "md" | "lg" | "full";
}

export default function Drawer({
  open,
  onClose,
  children,
  title,
  position = "left",
  size = "md",
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeStyles: Record<string, CSSProperties> = {
    sm: { maxWidth: "320px" },
    md: { maxWidth: "400px" },
    lg: { maxWidth: "560px" },
    full: { maxWidth: "100%" },
  };

  const positionStyles: Record<string, CSSProperties> = {
    left: { left: 0, right: "auto", transform: "translateX(-100%)" },
    right: { right: 0, left: "auto", transform: "translateX(100%)" },
  };

  const openStyles: Record<string, CSSProperties> = {
    left: { transform: "translateX(0)" },
    right: { transform: "translateX(0)" },
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{ alignItems: "flex-start", padding: 0 }}
    >
      <div
        className="drawer-content"
        style={{
          ...sizeStyles[size],
          ...positionStyles[position],
          ...openStyles[position],
          width: "100%",
          height: "100%",
          background: "var(--surface-elevated)",
          border: "none",
          borderRadius: 0,
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.65)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "drawer-slide-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {title && (
          <div className="drawer-header">
            <h3 className="drawer-title">{title}</h3>
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Đóng drawer"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="drawer-body" style={{ flex: 1, overflow: "auto", padding: 24 }}>
          {children}
        </div>
      </div>
    </div>
  );
}