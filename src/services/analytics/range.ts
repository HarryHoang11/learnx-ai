// ================================================================
// TIME RANGE — cửa sổ phân tích + kỳ so sánh liền trước
// ================================================================
// All-time không có previous period (tránh so sánh giả). Các range
// hữu hạn dùng đúng độ dài bằng nhau ngay trước current window.

export type AnalyticsRangeId = "7d" | "14d" | "30d" | "90d" | "all";

export interface AnalyticsWindow {
  id: AnalyticsRangeId;
  start: Date;
  end: Date;
  previousStart: Date | null;
  previousEnd: Date | null;
  dayCount: number;
}

const RANGE_DAYS: Record<Exclude<AnalyticsRangeId, "all">, number> = {
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "90d": 90,
};

export function parseAnalyticsRange(raw: string | null | undefined): AnalyticsRangeId {
  if (raw === "7d" || raw === "14d" || raw === "30d" || raw === "90d" || raw === "all") return raw;
  return "30d";
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function enumerateDayKeys(start: Date, end: Date): string[] {
  const keys: string[] = [];
  let cursor = startOfUtcDay(start);
  const last = startOfUtcDay(end);
  while (cursor < last) {
    keys.push(toDayKey(cursor));
    cursor = addUtcDays(cursor, 1);
  }
  return keys;
}

export function resolveAnalyticsWindow(rangeId: AnalyticsRangeId, now = new Date()): AnalyticsWindow {
  const end = now;
  if (rangeId === "all") {
    return {
      id: "all",
      start: new Date(0),
      end,
      previousStart: null,
      previousEnd: null,
      dayCount: Math.max(1, Math.ceil((end.getTime() - new Date(0).getTime()) / 86_400_000)),
    };
  }
  const days = RANGE_DAYS[rangeId];
  // Cả kỳ hiện tại VÀ kỳ trước phải DÀI BẰNG NHAU, nếu không phép so sánh
  // "% tăng so với kỳ trước" là so trên 2 cửa sổ khác nhau và ra số sai.
  //
  // Vì sao dễ sai: nếu start được snap về 00:00 nhưng end là "bây giờ"
  // (12:00), thì kỳ hiện tại dài 30.5 ngày còn kỳ trước đúng 30 — lệch 1.7%,
  // đủ để làm sai cả chuỗi delta của Dashboard. Ở đây cắt theo đúng số
  // mili-giây cho cả hai.
  const start = new Date(end.getTime() - days * 86_400_000);
  const previousStart = new Date(start.getTime() - days * 86_400_000);
  return {
    id: rangeId,
    start,
    end,
    previousStart,
    previousEnd: start,
    dayCount: days,
  };
}

export function fillDailySeries<T extends { day: string }>(
  days: string[],
  rows: T[],
  empty: Omit<T, "day">
): T[] {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return days.map((day) => {
    const existing = byDay.get(day);
    if (existing) return existing;
    return { ...(empty as T), day };
  });
}
