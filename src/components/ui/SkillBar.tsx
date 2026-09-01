// ================================================================
// <SkillBar /> — 1 dòng "tên kiến thức + thanh % + cờ yếu ⚠"
// ================================================================
// Mạch tư duy: đây là đơn vị hiển thị NHỎ NHẤT của "hồ sơ năng lực"
// (SkillMasteryPoint, xem types/index.ts) — dùng lặp lại ở 3 nơi
// (kết quả Diagnostic Test, trang Progress, sidebar AI Tutor). Tách
// component để 3 nơi đó luôn hiển thị ĐÚNG MỘT kiểu, tránh lệch nhau
// khi 1 trang sửa style mà quên sửa trang kia.
// ================================================================

interface SkillBarProps {
  name: string;
  percent: number;
  isWeak?: boolean;
}

export default function SkillBar({ name, percent, isWeak }: SkillBarProps) {
  const color = isWeak ? "var(--amber)" : "var(--cyan)";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0" }}>
      <div style={{ width: 160, fontSize: 13.5, flexShrink: 0 }}>{name}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${percent}%`, background: color }} />
      </div>
      <div style={{ width: 44, textAlign: "right", fontSize: 13, color: "var(--text-dim)", flexShrink: 0 }}>
        {percent}%
      </div>
      <div style={{ width: 16, textAlign: "center" }}>{isWeak ? "⚠" : ""}</div>
    </div>
  );
}
