// ================================================================
// Tổng hợp tiến bộ THEO MÔN — hàm thuần, không query DB
// ================================================================
//
// Mạch tư duy: Dashboard (yêu cầu §25) phải trả lời "học môn nào, mạnh/yếu gì,
// làm gì tiếp" bằng DỮ LIỆU THẬT. `skillMap` đã có sẵn từ GET /api/progress
// (đọc LearningProgress — xem updateMastery), nên ở đây chỉ GỘP lại theo môn.
//
// VÌ SAO HÀM THUẦN:
//   - Test được không cần DB (nhanh, ổn định trong CI).
//   - Chạy được cả server component lẫn client, không kéo theo prisma.
//   - Quy tắc "xếp hạng yếu" nằm MỘT chỗ, không mỗi lần vẽ lại một kiểu.
//
// KHÔNG BỊA: hàm này chỉ TÁCH CHỌN và SẮP XẾP dữ liệu đã có. Không có dữ liệu
// thì trả mảng rỗng — UI phải hiện empty state chứ không được tự điền 0%.
// ================================================================

import { withSubject } from "./engine";

/** 1 dòng hồ sơ năng lực (đúng shape `SkillMasteryPoint` từ /api/progress). */
export interface SkillPoint {
  subject: string;
  topic: string;
  masteryPercent: number;
  isWeak: boolean;
}

export interface SubjectProgress {
  subject: string;
  /** Số chủ đề đã có dữ liệu học thật. */
  topicCount: number;
  /** Mastery trung bình của môn, 0..100. */
  masteryPercent: number;
  /** Chủ đề mạnh nhất — dùng để khen đúng thứ học sinh giỏi. */
  strongestTopic: string | null;
  /** Chủ đề yếu nhất — dùng để gợi ý luyện. */
  weakestTopic: string | null;
  /** Có ít nhất 1 chủ đề dưới ngưỡng yếu không. */
  hasWeakTopic: boolean;
  icon: string;
}

/** Ngưỡng "yếu" — dùng CHUNG với WEAK_THRESHOLD_PERCENT của hồ sơ năng lực. */
export const SUBJECT_WEAK_THRESHOLD = 65;

/**
 * Gom skillMap theo môn, tính mastery trung bình, tìm mạnh nhất / yếu nhất.
 *
 * Sắp xếp: môn có NHIỀU dữ liệu học thật nhất lên trước. Vì sao không sắp theo
 * mastery? Vì mastery thấp lúc đầu không có nghĩa là "môn quan trọng nhất" —
 * người mới bắt đầu có mastery thấp ở mọi môn. Số chủ đề đã học mới phản ánh
 * "môn này học sinh đang thực sự đầu tư".
 */
export function summarizeBySubject(skills: readonly SkillPoint[]): SubjectProgress[] {
  const groups = new Map<string, SkillPoint[]>();
  for (const point of skills) {
    const key = point.subject.trim();
    if (!key) continue;
    const list = groups.get(key);
    if (list) list.push(point);
    else groups.set(key, [point]);
  }

  const summaries: SubjectProgress[] = [];
  for (const [subject, points] of groups) {
    const mastery =
      Math.round(points.reduce((sum, p) => sum + p.masteryPercent, 0) / points.length);

    // Tìm trong 1 lượt duyệt thay vì sort 2 lần: dữ liệu môn nhỏ (vài chủ đề)
    // nên ưu tiên code đọc dễ hơn là tối ưu vô nghĩa.
    let strongest: SkillPoint | null = null;
    let weakest: SkillPoint | null = null;
    for (const point of points) {
      if (!strongest || point.masteryPercent > strongest.masteryPercent) strongest = point;
      if (!weakest || point.masteryPercent < weakest.masteryPercent) weakest = point;
    }

    summaries.push({
      subject,
      topicCount: points.length,
      masteryPercent: mastery,
      strongestTopic: strongest?.topic ?? null,
      weakestTopic: weakest?.topic ?? null,
      hasWeakTopic: points.some((p) => p.isWeak || p.masteryPercent < SUBJECT_WEAK_THRESHOLD),
      icon: withSubject(subject).icon,
    });
  }

  return summaries.sort((a, b) => b.topicCount - a.topicCount || a.subject.localeCompare(b.subject, "vi"));
}

/** Môn đang nên học tiếp: nhiều dữ liệu nhất, ưu tiên môn đang còn yếu. */
export function pickFocusSubject(subjects: readonly SubjectProgress[]): SubjectProgress | null {
  if (subjects.length === 0) return null;
  // Đã sắp theo topicCount giảm dần, nên chỉ cần ưu tiên yếu trong nhóm đầu.
  const withWeak = subjects.filter((s) => s.hasWeakTopic);
  return withWeak[0] ?? subjects[0];
}

/**
 * Chủ đề cần luyện gấp nhất trong 1 môn.
 *
 * Trả `null` khi môn không có chủ đề nào dưới ngưỡng — lúc đó UI nên khen
 * "môn này đang ổn" thay vì bắt luyện vô lý.
 */
export function pickWeakestTopic(
  subject: string,
  skills: readonly SkillPoint[]
): SkillPoint | null {
  let weakest: SkillPoint | null = null;
  for (const point of skills) {
    if (point.subject !== subject) continue;
    if (point.masteryPercent >= SUBJECT_WEAK_THRESHOLD) continue;
    if (!weakest || point.masteryPercent < weakest.masteryPercent) weakest = point;
  }
  return weakest;
}