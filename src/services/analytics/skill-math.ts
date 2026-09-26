import type { SkillEvidence, SkillTrend } from "./types";

/**
 * Ngưỡng "kỹ năng yếu" (mastery < 65%).
 *
 * CỐ Ý khai lại ở đây thay vì import từ `assessment.service`: module toán
 * thuần này được unit-test bằng vitest, mà `assessment.service` kéo theo
 * Prisma — import nó sẽ kéo cả client DB vào test và làm test không chạy
 * được ngoài môi trường Next.js. Hằng số phải giữ đúng một nguồn: đổi ở
 * đây thì sửa luôn assessment.service.
 */
export const WEAK_THRESHOLD_PERCENT = 65;

export const MASTERED_THRESHOLD = 80;
export const TREND_POINTS = 5;
export const IMPROVEMENT_POINTS = 8;
const MIN_ATTEMPTS_FOR_TREND = 5;
const MIN_ATTEMPTS_FOR_WHY = 5;

export function masteryFromCounts(correct: number, attempts: number): number | null {
  if (attempts <= 0) return null;
  return Math.round((correct / attempts) * 100);
}

export function previousMasteryFromTotals(
  totalCorrect: number,
  totalAttempts: number,
  rangeCorrect: number,
  rangeAttempts: number
): number | null {
  const priorAttempts = totalAttempts - rangeAttempts;
  const priorCorrect = totalCorrect - rangeCorrect;
  if (priorAttempts <= 0) return null;
  if (priorCorrect < 0 || priorAttempts < 0) return null;
  return masteryFromCounts(priorCorrect, priorAttempts);
}

export function skillTrend(change: number | null, attemptsForTrend: number): SkillTrend {
  if (attemptsForTrend < MIN_ATTEMPTS_FOR_TREND || change === null) return "insufficient";
  if (change >= TREND_POINTS) return "improving";
  if (change <= -TREND_POINTS) return "declining";
  return "stable";
}

export function enoughEvidence(evidence: Pick<SkillEvidence, "exercisesCompleted" | "reviews" | "tutorSessions">, attemptsInRange: number): boolean {
  return attemptsInRange >= MIN_ATTEMPTS_FOR_WHY || evidence.exercisesCompleted + evidence.reviews + evidence.tutorSessions >= 3;
}

export function isMastered(mastery: number, attempts: number): boolean {
  return mastery >= MASTERED_THRESHOLD && attempts >= MIN_ATTEMPTS_FOR_TREND;
}

export function isWeakSkill(mastery: number): boolean {
  return mastery < WEAK_THRESHOLD_PERCENT;
}

export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 8) return null;
  const n = xs.length;
  const meanX = xs.reduce((s, v) => s + v, 0) / n;
  const meanY = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return num / den;
}

export function relativeDelta(current: number, previous: number | null): number | null {
  if (previous === null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function pointDelta(current: number, previous: number | null): number | null {
  if (previous === null) return null;
  return Math.round(current - previous);
}

export function directionFromDelta(delta: number | null): "up" | "down" | "flat" | "unknown" {
  if (delta === null) return "unknown";
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}
