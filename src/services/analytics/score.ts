import type { LearningScoreBreakdown, LearningScoreResult } from "./types";

const WEIGHTS: Record<keyof LearningScoreBreakdown, number> = {
  consistency: 0.22,
  practice: 0.22,
  skill: 0.2,
  review: 0.14,
  goal: 0.12,
  improvement: 0.1,
};

function clamp100(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeConsistencyScore(activeDays: number, windowDays: number): number | null {
  if (windowDays <= 0) return null;
  const expected = Math.max(3, Math.min(windowDays, Math.ceil(windowDays * (3 / 7))));
  if (activeDays === 0) return 0;
  return clamp100((activeDays / expected) * 100);
}

export function computePracticeScore(accuracyPercent: number | null, attempts: number, targetAttempts: number): number | null {
  if (attempts === 0 || accuracyPercent === null) return null;
  const volume = Math.min(1, attempts / Math.max(8, targetAttempts));
  const volumeBoost = 0.45 + 0.55 * volume;
  return clamp100(accuracyPercent * volumeBoost);
}

export function computeSkillScore(masteries: number[], minAttempts: boolean[]): number | null {
  const usable = masteries.filter((_, i) => minAttempts[i]);
  if (usable.length === 0) return null;
  const avg = usable.reduce((sum, n) => sum + n, 0) / usable.length;
  return clamp100(avg);
}

export function computeReviewScore(reviewsCompleted: number, reviewItems: number, windowDays: number): number | null {
  if (reviewItems === 0 && reviewsCompleted === 0) return null;
  const expected = Math.max(3, Math.min(reviewItems, Math.ceil(windowDays / 3)));
  return clamp100((reviewsCompleted / expected) * 100);
}

export function computeGoalScore(progressPercents: number[]): number | null {
  if (progressPercents.length === 0) return null;
  const avg = progressPercents.reduce((sum, n) => sum + n, 0) / progressPercents.length;
  return clamp100(avg);
}

export function computeImprovementScore(deltas: Array<number | null>): number | null {
  const known = deltas.filter((d): d is number => d !== null);
  if (known.length === 0) return null;
  const avg = known.reduce((sum, n) => sum + n, 0) / known.length;
  return clamp100(50 + avg * 2);
}

export function composeLearningScore(breakdown: LearningScoreBreakdown): LearningScoreResult {
  const used = (Object.keys(WEIGHTS) as Array<keyof LearningScoreBreakdown>).filter(
    (key) => breakdown[key] !== null
  );
  if (used.length === 0) {
    return { score: null, lowConfidence: true, usedComponents: [], breakdown };
  }
  const weightSum = used.reduce((sum, key) => sum + WEIGHTS[key], 0);
  const weighted = used.reduce((sum, key) => sum + (breakdown[key] as number) * WEIGHTS[key], 0);
  return {
    score: clamp100(weighted / weightSum),
    lowConfidence: used.length < 3,
    usedComponents: used,
    breakdown,
  };
}
