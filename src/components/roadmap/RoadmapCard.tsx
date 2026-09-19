// ================================================================
// <RoadmapCard /> — 1 lộ trình trong "Lộ trình của tôi"
// ================================================================
"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { GoalWithRoadmap } from "@/types";

interface RoadmapCardProps {
  goal: GoalWithRoadmap;
  isSelected: boolean;
  onSelect: () => void;
  onMarkCompleted: () => void;
  onReactivate: () => void;
  onDelete: () => void;
}

export default function RoadmapCard({
  goal,
  isSelected,
  onSelect,
  onMarkCompleted,
  onReactivate,
  onDelete,
}: RoadmapCardProps) {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Đóng menu khi click ra ngoài — hành vi chuẩn cho menu dạng "•••",
  // tránh menu bị "kẹt mở" khi user click sang chỗ khác trong trang.
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const isCompleted = goal.status === "COMPLETED";

  return (
    <div
      onClick={onSelect}
      style={{
        padding: "16px 18px",
        borderRadius: 12,
        border: `1.5px solid ${isSelected ? "var(--indigo)" : "var(--border)"}`,
        background: "var(--panel-strong)",
        cursor: "pointer",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ fontSize: 14.5, fontWeight: 600 }}>{goal.title}</div>

        {/* Menu ••• — stopPropagation để click vào nút/menu không kích
            hoạt onSelect của cả card. */}
        <div ref={menuRef} style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={t("roadmap.card.menu")}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              fontSize: 16,
              cursor: "pointer",
              padding: "2px 6px",
              lineHeight: 1,
            }}
          >
            •••
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                right: 0,
                top: "100%",
                marginTop: 4,
                background: "var(--surface-elevated)",
                border: "1px solid var(--border)",
                borderRadius: 10,
                minWidth: 170,
                zIndex: 20,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                overflow: "hidden",
              }}
            >
              {!isCompleted ? (
                <MenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    onMarkCompleted();
                  }}
                >
                  {t("roadmap.card.complete")}
                </MenuItem>
              ) : (
                <MenuItem
                  onClick={() => {
                    setMenuOpen(false);
                    onReactivate();
                  }}
                >
                  {t("roadmap.card.reopen")}
                </MenuItem>
              )}
              <MenuItem
                onClick={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                danger
              >
                {t("roadmap.card.delete")}
              </MenuItem>
            </div>
          )}
        </div>
      </div>

      <div style={{ fontSize: 12.5, color: isCompleted ? "var(--cyan)" : "var(--text-dim)" }}>
        {isCompleted ? t("roadmap.card.done") : goal.progressPercent > 0 ? t("roadmap.card.learning") : t("roadmap.card.notStarted")}
      </div>

      <div>
        <div style={{ height: 6, borderRadius: 4, background: "var(--panel-strong)", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${goal.progressPercent}%`,
              background: isCompleted ? "var(--cyan)" : "var(--indigo)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 5 }}>
          {t("roadmap.card.progress", { n: goal.progressPercent })}
        </div>
      </div>

      <button
        className="btn-secondary"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        style={{ fontSize: 12.5, padding: "7px 14px", alignSelf: "flex-start" }}
      >
        {isCompleted ? t("roadmap.card.review") : goal.progressPercent > 0 ? t("roadmap.card.continue") : t("roadmap.card.start")}
      </button>
    </div>
  );
}

function MenuItem({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        background: "none",
        border: "none",
        padding: "10px 14px",
        fontSize: 13,
        color: danger ? "var(--rose, #f87171)" : "var(--text)",
        cursor: "pointer",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel-strong)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
    >
      {children}
    </button>
  );
}
