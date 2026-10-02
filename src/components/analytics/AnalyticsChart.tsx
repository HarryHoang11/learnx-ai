// ================================================================
// <AnalyticsChart /> — biểu đồ SVG tự vẽ cho Learning Analytics
// ================================================================
// Mạch tư duy: project CHƯA có thư viện chart. Thêm recharts (~100KB gzipped,
// cần "use client" ở mọi nơi, khó kiểm soát dark/light + mobile) chỉ để vẽ
// vài biểu đồ đơn giản là không đáng. Ở đây tự vẽ SVG: nhẹ, đúng tone app,
// và kiểm soát được accessibility.
//
// BA NGUYÊN TẮC (theo yêu cầu "chart không phải cách duy nhất để hiểu dữ liệu"):
//   1. Mọi chart có role/aria-label và luôn đi kèm bảng số ẩn (sr-only) —
//      người dùng đọc bằng screen reader vẫn lấy được con số.
//   2. Dữ liệu KHÔNG chỉ phân biệt bằng màu: có dot + bảng số + nhãn chữ.
//   3. Không animation nặng — chỉ transition màu.
// ================================================================

"use client";

export interface ChartPoint {
  day: string;
  value: number | null;
}

interface LineChartProps {
  points: ChartPoint[];
  /** Nhãn trục Y (hiện trong aria-label). */
  label: string;
  /** Định dạng giá trị, vd (v) => `${v} min`. */
  format: (value: number) => string;
  height?: number;
  /** Câu giải thích bằng lời, hiện khi chart rỗng và đọc bằng AT. */
  description?: string;
}

const WIDTH = 600;
const PADDING = { top: 12, right: 10, bottom: 22, left: 34 };

/**
 * Biểu đồ đường — study activity, progress, accuracy.
 *
 * Ngày KHÔNG có dữ liệu vẫn được giữ trên trục X (giá trị null -> khoảng
 * trống, KHÔNG nối thẳng qua). Bỏ hẳn ngày sẽ khiến đường bị nén lại và
 * nhìn như user học liên tục — sai hoàn toàn với dữ liệu thật.
 */
export function LineChart({ points, label, format, height = 180, description }: LineChartProps) {
  const innerW = WIDTH - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;

  const values = points.map((p) => p.value).filter((v): v is number => v !== null);
  const max = Math.max(1, ...values);
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

  const x = (i: number) => PADDING.left + i * stepX;
  const y = (v: number) => PADDING.top + innerH - (v / max) * innerH;

  // Tách đoạn liên tục: đoạn bị ngắt bởi ngày null KHÔNG nối vào nhau, đường
  // gãy đúng chỗ thiếu dữ liệu thay vì vẽ chéo qua.
  const segments: string[][] = [];
  let current: string[] = [];
  points.forEach((p, i) => {
    if (p.value === null) {
      if (current.length > 0) segments.push(current);
      current = [];
      return;
    }
    current.push(`${x(i)},${y(p.value)}`);
  });
  if (current.length > 0) segments.push(current);

  const hasData = values.length > 0;
  const lastIndex = points.reduce((acc, p, i) => (p.value !== null ? i : acc), -1);

  return (
    <div className="analytics-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="analytics-chart__svg"
        role="img"
        aria-label={`${label}. ${description ?? ""}`}
        preserveAspectRatio="none"
      >
        {[0, 0.5, 1].map((ratio) => {
          const gy = PADDING.top + innerH * ratio;
          return (
            <g key={ratio}>
              <line x1={PADDING.left} y1={gy} x2={WIDTH - PADDING.right} y2={gy} className="analytics-chart__grid" />
              <text x={PADDING.left - 6} y={gy + 3} className="analytics-chart__axis" textAnchor="end">
                {Math.round(max * (1 - ratio))}
              </text>
            </g>
          );
        })}

        {segments.map((seg, i) => (
          <polyline key={i} points={seg.join(" ")} className="analytics-chart__line" fill="none" />
        ))}

        {/* Chỉ vẽ dot ở mốc cuối — 90 chấm trên mobile là nhiễu, không
            giúp người dùng đọc thêm được gì. */}
        {hasData && lastIndex >= 0 && (
          <circle cx={x(lastIndex)} cy={y(points[lastIndex].value as number)} r={4} className="analytics-chart__dot" />
        )}

        <text x={PADDING.left} y={height - 6} className="analytics-chart__axis" textAnchor="start">
          {points[0]?.day ?? ""}
        </text>
        <text x={WIDTH - PADDING.right} y={height - 6} className="analytics-chart__axis" textAnchor="end">
          {points[points.length - 1]?.day ?? ""}
        </text>
      </svg>

      {!hasData && <p className="analytics-chart__empty">{description ?? "Chưa có dữ liệu."}</p>}

      {/* Bảng số ẩn: nguồn dữ liệu thật cho screen reader. */}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {points
            .filter((p) => p.value !== null)
            .map((p) => (
              <tr key={p.day}>
                <th scope="row">{p.day}</th>
                <td>{format(p.value as number)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  /** Đơn vị phụ hiển thị cạnh thanh, vd "+12". */
  caption?: string;
}

/** Biểu đồ cột ngang — so sánh skill/môn, tránh nhãn dài bị cắt. */
export function BarChart({
  data,
  label,
  format,
  description,
}: {
  data: BarDatum[];
  label: string;
  format: (v: number) => string;
  description?: string;
}) {
  if (data.length === 0) {
    return <p className="analytics-chart__empty">{description ?? "Chưa có dữ liệu."}</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="analytics-chart">
      {/* role="img" + aria-label: đây là hình ảnh của dữ liệu; số thật nằm
          ngay cạnh mỗi thanh nên không mất khả năng đọc bằng AT. */}
      <ul className="analytics-bars" aria-label={label}>
        {/*
          Key = `label + index`, KHÔNG dùng `key={d.label}`: nhãn là TÊN MÔN
          và 2 môn khác nhau vẫn có thể trùng chuỗi (vd "Kiến thức nền tảng"
          lặp lại) → React cảnh báo "two children with the same key" và
          identity của item có thể bị trộn khi re-render. Index ở đây là
          identity của VỊ TRÍ trong danh sách dữ liệu tĩnh (không có
          reorder/insert/delete), nên ổn định giữa các render — khác hẳn
          key random/time-based vốn gãy remount mỗi lần render.
          Giữ nguyên TOÀN BỘ item: KHÔNG dedupe dữ liệu.
        */}
        {data.map((d, index) => (
          <li key={`${d.label}-${index}`} className="analytics-bar">
            <span className="analytics-bar__label" title={d.label}>
              {d.label}
            </span>
            <span className="analytics-bar__track">
              {/* width inline là dữ liệu thật. */}
              <span className="analytics-bar__fill" style={{ width: `${(d.value / max) * 100}%` }} />
            </span>
            <span className="analytics-bar__value">
              {format(d.value)}
              {d.caption && <small>{d.caption}</small>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
