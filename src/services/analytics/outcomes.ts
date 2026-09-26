// ================================================================
// PHÂN BỔ THỜI GIAN & KẾT QUẢ LUYỆN TẬP — hàm thuần
// ================================================================
//
// Tách riêng khỏi learning-analytics.service.ts vì đây là phần quyết định
// "con số trên màn hình có đúng không". Công thức sai ở đây không làm app
// crash — nó chỉ hiển thị SAI, và người dùng tin theo. Đó là loại bug tệ nhất,
// nên phải test được bằng hàm thuần thay vì nằm trong khối gọi DB.
//
// Cả hai hàm đều LÀM TRÒN ở đây chứ không ở component: server là nơi duy
// nhất được phép quyết định cách hiển thị số, để client không tự làm tròn khác.
// ================================================================

import type { OutcomeBreakdown, SubjectTimeShare } from "./types";

/** Một dòng thô từ SQL (`GROUP BY subject`). */
export interface SubjectTimeRow {
  subject: string;
  minutes: number;
  sessions: number;
}

/** Một dòng thô từ SQL (đếm đúng/sai). */
export interface OutcomeRow {
  correct: number;
  incorrect: number;
}

/** Chuyển số có thể null/NaN (aggregate SQL) thành số an toàn. */
function num(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Tính phần trăm thời gian của từng môn.
 *
 * Mẫu số là TỔNG CỦA CHÍNH CÁC DÒNG trả về, KHÔNG phải tổng thời gian của
 * KPI. Lý do: KPI thời gian học gồm cả phiên không gắn môn, còn biểu đồ này
 * chỉ kể phần có môn — lấy nhầm mẫu số sẽ khiến các cột cộng lên dưới 100%
 * và người dùng nghĩ phần trăm bị sai.
 *
 * Cột "0 phút" bị loáy bằng `HAVING minutes > 0` ngay ở SQL, nên ở đây chỉ
 * còn xử lý phòng thủ trường hợp 0 (tránh chia cho 0).
 */
export function buildSubjectTimeShare(rows: SubjectTimeRow[]): SubjectTimeShare[] {
  const cleaned = rows.map((r) => ({
    subject: r.subject,
    minutes: Math.max(0, Math.round(num(r.minutes))),
    sessions: Math.max(0, Math.round(num(r.sessions))),
  }));
  const total = cleaned.reduce((sum, r) => sum + r.minutes, 0);
  return cleaned.map((r) => ({
    subject: r.subject,
    minutes: r.minutes,
    sessions: r.sessions,
    // 1 chữ số thập phân: tổng các phần trăm đọy đủ 100.0 mà vẫn đủ
    // chính xác để phân biệt 33.3% với 34%.
    sharePercent: total > 0 ? Math.round((r.minutes / total) * 1000) / 10 : 0,
  }));
}

/**
 * Tính Đúng / Sai / Chưa hoàn thành.
 *
 * `accuracy` trả `null` khi chưa có lượt nào — UI hiện "chưa đủ dữ liệu"
 * thay vì "0%", vì 0% cho người chưa làm bài là một tuyên bố sai.
 *
 * `incomplete` là số phiên học BỎ DỞ, truyền vào từ `LearningSession`
 * (đã trả lời ≥1 câu nhưng chưa completedAt). Nó KHÔNG nằm trong mẫu số
 * của accuracy vì người học chưa có câu trả lời để tính đúng/sai.
 */
export function buildOutcomeBreakdown(
  rows: OutcomeRow[],
  incomplete: number
): OutcomeBreakdown {
  // SQL luôn trả đúng 1 dòng (dù 0 phần tử con) nhưng vẫn phòng thủ mảng
  // rỗng: aggregate trả về 0 khi union không có dòng nào.
  const correct = Math.max(0, Math.round(num(rows[0]?.correct)));
  const incorrect = Math.max(0, Math.round(num(rows[0]?.incorrect)));
  const answered = correct + incorrect;
  return {
    correct,
    incorrect,
    incomplete: Math.max(0, Math.round(num(incomplete))),
    answered,
    accuracy: answered > 0 ? Math.round((correct / answered) * 100) : null,
  };
}
