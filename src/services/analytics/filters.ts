// ================================================================
// FILTERS — chuẩn hoá query string thành bộ lọc an toàn
// ================================================================
// Mạch tư duy: bộ lọc tới từ HTTP nên KHÔNG được nội suy thẳng vào SQL.
// Mọi giá trị đều đi qua đây trước khi chạm DB:
//   - chuẩn hoá (trim, cắt độ dài) để URL bẩn không làm query nặng;
//   - CHỈ chấp nhận danh sách trắng cho `difficulty` — giá trị lạ sẽ sinh
//     ra các "môn" ma quỷ trong dropdown filter của chính người dùng.
//
// `subject`/`topic` cố ý KHÔNG so với danh sách cứng: tên môn trong DB là
// dữ liệu thực (community upload, tài liệu người dùng) nên không thể đoán
// trước. Truy vấn vẫn an toàn vì mọi giá trị đều được bind như tham số.
// ================================================================

import type { AnalyticsFilters } from "./types";

/** Độ khó hợp lệ — khớp cột `difficulty` của Attempt. */
const ALLOWED_DIFFICULTIES = new Set(["easy", "medium", "hard"]);

const MAX_FILTER_LENGTH = 64;

function clean(value: string | null | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, MAX_FILTER_LENGTH);
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Đọc bộ lọc từ URLSearchParams.
 * Giá trị rỗng = không lọc, để "?subject=" không làm hỏng trang.
 */
export function parseAnalyticsFilters(params: URLSearchParams | null | undefined): AnalyticsFilters {
  if (!params) return {};
  const subject = clean(params.get("subject"));
  const topic = clean(params.get("topic"));
  const rawDifficulty = clean(params.get("difficulty"))?.toLowerCase();
  const difficulty = rawDifficulty && ALLOWED_DIFFICULTIES.has(rawDifficulty) ? rawDifficulty : undefined;
  return { subject, topic, difficulty };
}

/** WHERE cho Prisma; bỏ qua các điều kiện không lọc. */
export function toAttemptWhere(
  userId: string,
  filters: AnalyticsFilters,
  time?: { gte?: Date; lt?: Date }
): Record<string, unknown> {
  const where: Record<string, unknown> = { userId };
  if (filters.subject) where.subject = filters.subject;
  if (filters.topic) where.topic = filters.topic;
  if (filters.difficulty) where.difficulty = filters.difficulty;
  if (time?.gte || time?.lt) {
    where.createdAt = { ...(time.gte ? { gte: time.gte } : {}), ...(time.lt ? { lt: time.lt } : {}) };
  }
  return where;
}
