// ================================================================
// <StatCard /> — thẻ hiển thị 1 con số + nhãn
// ================================================================
// Mạch tư duy: cả trang Home lẫn Progress đều có hàng thẻ số liệu
// (streak, giờ học, độ chính xác...) giống hệt nhau về layout, chỉ
// khác nội dung — tách thành component để 2 trang không copy-paste
// cùng 1 đoạn JSX.
// ================================================================

import Panel from "./Panel";

interface StatCardProps {
  value: string | number;
  label: string;
}

export default function StatCard({ value, label }: StatCardProps) {
  return (
    <Panel style={{ padding: "18px 18px" }}>
      <div
        style={{
          fontFamily: "var(--font-space-grotesk), sans-serif",
          fontSize: 26,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>{label}</div>
    </Panel>
  );
}
