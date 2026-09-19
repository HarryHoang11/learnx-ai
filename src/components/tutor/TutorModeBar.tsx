// ================================================================
// <TutorModeBar /> — 6 chế độ đồng hành của AI Gia sư
// ================================================================
// Mạch tư duy: mỗi nút KHÔNG chỉ đổi màu — nó gửi `mode` xuống backend
// để AI thực sự đổi instruction (xem TUTOR_MODE_INSTRUCTIONS). Nút
// đang chọn có active state rõ ràng (aria-pressed + viền/nền cyan) và
// bị khoá khi AI đang trả lời, tránh double-submit.
// ================================================================

"use client";

import { TUTOR_MODE_META, type TutorMode } from "./types";

interface TutorModeBarProps {
  activeMode: TutorMode;
  onSelect: (mode: TutorMode) => void;
  disabled?: boolean;
}

export default function TutorModeBar({ activeMode, onSelect, disabled = false }: TutorModeBarProps) {
  return (
    <div>
      <div
        className="eyebrow"
        style={{ color: "var(--cyan)", fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}
      >
        Cách AI đồng hành
      </div>
      <div className="action-grid" style={{ marginTop: 12 }}>
        {TUTOR_MODE_META.map(({ mode, label, hint }) => {
          const active = mode === activeMode;
          return (
            <button
              key={mode}
              type="button"
              className={`tutor-mode-btn${active ? " tutor-mode-btn--active" : ""}`}
              onClick={() => onSelect(mode)}
              disabled={disabled}
              aria-pressed={active}
              title={hint}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
