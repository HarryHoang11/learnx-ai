// ================================================================
// <Modal /> — Hộp thoại Accessible với backdrop blur & scroll lock
// ================================================================

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  maxWidth?: number | string;
  showCloseButton?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = 560,
  showCloseButton = true,
}: ModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Khóa scroll body khi modal mở + lắng nghe phím ESC
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

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        ref={contentRef}
        className="modal-content"
        style={{ maxWidth }}
      >
        <div className="modal-header">
          <div>
            {title && (
              <h3 id="modal-title" className="modal-title">
                {title}
              </h3>
            )}
            {description && (
              <p className="modal-description">{description}</p>
            )}
          </div>
          {showCloseButton && (
            <button
              type="button"
              className="modal-close"
              onClick={onClose}
              aria-label="Đóng hộp thoại"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
