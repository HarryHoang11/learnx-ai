// ================================================================
// XP & LXP CONSTANTS — Source of Truth for all calculations
// ================================================================

export const BASE_XP = {
  LESSON_COMPLETE: 10,
  EXERCISE_EASY: 10,
  EXERCISE_MEDIUM: 15,
  EXERCISE_HARD: 20,
  QUIZ_COMPLETE: 20,
  STUDY_SESSION_COMPLETE: 25,
  QUIZ_80_PERCENT_BONUS: 10,
  DAILY_CHALLENGE_MIN: 30,
  DAILY_CHALLENGE_MAX: 50,
  DAILY_MISSION_MIN: 20,
  DAILY_MISSION_MAX: 40,
  WEEKLY_MISSION: 100,
  MASTERY_MILESTONE_MIN: 50,
  MASTERY_MILESTONE_MAX: 200,
} as const;

export const DIFFICULTY_MULTIPLIER = {
  easy: 1.0,
  medium: 1.5,
  hard: 2.0,
} as const;

export const QUALITY_BONUS = [
  { min: 0, max: 49, bonus: 0 },
  { min: 50, max: 69, bonus: 2 },
  { min: 70, max: 84, bonus: 5 },
  { min: 85, max: 99, bonus: 8 },
  { min: 100, max: 100, bonus: 10 },
] as const;

export const COMPLETION_BONUS = 5;

export const LXP_REWARDS = {
  LESSON_COMPLETE: 5,
  EXERCISE_EASY: 5,
  EXERCISE_MEDIUM: 7,
  EXERCISE_HARD: 10,
  QUIZ_COMPLETE: 10,
  STUDY_SESSION_COMPLETE: 10,
  DAILY_CHALLENGE: 20,
  DAILY_MISSION: 30,
  WEEKLY_MISSION: 100,
  MASTERY_MILESTONE: 50,
} as const;

export type ActivityType = 
  | 'lesson_complete'
  | 'exercise_easy'
  | 'exercise_medium'
  | 'exercise_hard'
  | 'quiz_complete'
  | 'quiz_80_percent'
  | 'daily_challenge'
  | 'daily_mission'
  | 'weekly_mission'
  | 'mastery_milestone'
  | 'achievement_unlocked'
  | 'tutor_session_completed'
  | 'mindmap_created'
  | 'document_analyzed'
  | 'reflection_completed'
  | 'task_completed'
  | 'diagnostic_completed'
  | 'roadmap_completed'
  | 'review_completed'
  | 'study_session_completed';

export interface XPCalculationInput {
  activityType: ActivityType;
  difficulty?: 'easy' | 'medium' | 'hard';
  scorePercent?: number;
  isFirstCompletion?: boolean;
}

export function calculateXP(input: XPCalculationInput): number {
  const { activityType, difficulty = 'medium', scorePercent = 0, isFirstCompletion = true } = input;
  
  let baseXP = 0;
  
  switch (activityType) {
    case 'lesson_complete':
      baseXP = BASE_XP.LESSON_COMPLETE;
      break;
    case 'exercise_easy':
      baseXP = BASE_XP.EXERCISE_EASY;
      break;
    case 'exercise_medium':
      baseXP = BASE_XP.EXERCISE_MEDIUM;
      break;
    case 'exercise_hard':
      baseXP = BASE_XP.EXERCISE_HARD;
      break;
    case 'quiz_complete':
      baseXP = BASE_XP.QUIZ_COMPLETE;
      break;
    case 'quiz_80_percent':
      baseXP = BASE_XP.QUIZ_80_PERCENT_BONUS;
      break;
    case 'daily_challenge':
      baseXP = Math.floor((BASE_XP.DAILY_CHALLENGE_MIN + BASE_XP.DAILY_CHALLENGE_MAX) / 2);
      break;
    case 'daily_mission':
      baseXP = Math.floor((BASE_XP.DAILY_MISSION_MIN + BASE_XP.DAILY_MISSION_MAX) / 2);
      break;
    case 'weekly_mission':
      baseXP = BASE_XP.WEEKLY_MISSION;
      break;
    case 'mastery_milestone':
      baseXP = Math.floor((BASE_XP.MASTERY_MILESTONE_MIN + BASE_XP.MASTERY_MILESTONE_MAX) / 2);
      break;
    case 'achievement_unlocked':
      baseXP = 100;
      break;
    case 'tutor_session_completed':
      baseXP = 30;
      break;
    case 'mindmap_created':
      baseXP = 50;
      break;
    case 'document_analyzed':
      baseXP = 20;
      break;
    case 'reflection_completed':
      baseXP = 40;
      break;
    case 'task_completed':
      baseXP = 25;
      break;
    case 'diagnostic_completed':
      baseXP = 50;
      break;
    case 'roadmap_completed':
      baseXP = 200;
      break;
    case 'review_completed':
      baseXP = 30;
      break;
    case 'study_session_completed':
      baseXP = BASE_XP.STUDY_SESSION_COMPLETE;
      break;
  }

  const difficultyMult = DIFFICULTY_MULTIPLIER[difficulty] ?? 1.0;
  let xp = Math.floor(baseXP * difficultyMult);

  const qualityEntry = QUALITY_BONUS.find(q => scorePercent >= q.min && scorePercent <= q.max);
  if (qualityEntry) {
    xp += qualityEntry.bonus;
  }

  if (isFirstCompletion) {
    xp += COMPLETION_BONUS;
  }

  return xp;
}

export function calculateLXP(activityType: ActivityType, difficulty: 'easy' | 'medium' | 'hard' = 'medium'): number {
  switch (activityType) {
    case 'lesson_complete':
      return LXP_REWARDS.LESSON_COMPLETE;
    case 'exercise_easy':
      return LXP_REWARDS.EXERCISE_EASY;
    case 'exercise_medium':
      return LXP_REWARDS.EXERCISE_MEDIUM;
    case 'exercise_hard':
      return LXP_REWARDS.EXERCISE_HARD;
    case 'quiz_complete':
    case 'quiz_80_percent':
      return LXP_REWARDS.QUIZ_COMPLETE;
    case 'daily_challenge':
      return LXP_REWARDS.DAILY_CHALLENGE;
    case 'daily_mission':
      return LXP_REWARDS.DAILY_MISSION;
    case 'weekly_mission':
      return LXP_REWARDS.WEEKLY_MISSION;
    case 'mastery_milestone':
      return LXP_REWARDS.MASTERY_MILESTONE;
    case 'achievement_unlocked':
      return 20;
    case 'tutor_session_completed':
      return 10;
    case 'mindmap_created':
      return 15;
    case 'document_analyzed':
      return 5;
    case 'reflection_completed':
      return 10;
    case 'task_completed':
      return 5;
    case 'diagnostic_completed':
      return 15;
    case 'roadmap_completed':
      return 50;
    case 'review_completed':
      return 10;
    case 'study_session_completed':
      return LXP_REWARDS.STUDY_SESSION_COMPLETE;
    default:
      return 0;
  }
}

export function xpToReachLevel(level: number): number {
  // Level 1 là cấp khởi đầu — cần 0 XP để đạt. Công thức lũy thừa chỉ
  // áp dụng từ Level 2 trở lên. Trước đây xpToReachLevel(1) trả về 100
  // nên user mới (0 XP) bị tính progress = 0 - 100 = -100 → hiển thị
  // "-55%" và "-100 / 182 XP". Sửa floor Level 1 về 0 để không bao giờ
  // có số âm; ngưỡng Level 2+ giữ nguyên nên level hiện tại của user
  // cũ không thay đổi (calculateLevel cho cùng kết quả với mọi XP).
  if (level <= 1) return 0;
  return Math.floor(100 * Math.pow(level, 1.5));
}

export function calculateLevel(lifetimeXP: number): number {
  let level = 1;
  while (xpToReachLevel(level + 1) <= lifetimeXP) {
    level++;
  }
  return level;
}

export function getLevelProgress(lifetimeXP: number): { current: number; next: number; percent: number; level: number } {
  // Nguồn sự thật duy nhất cho shape {current,next,percent} mà API trả
  // về — ủy thác toàn bộ số học cho getLevelProgressDetails để API và
  // mọi component client luôn đồng nhất, không bao giờ lệch nhau.
  // current = XP đã kiếm trong level hiện tại, next = XP cần để lên
  // level tiếp theo, percent đã clamp 0..100.
  const d = getLevelProgressDetails(lifetimeXP);
  const span = d.xpForNextLevel - d.xpForCurrentLevel;
  return {
    current: d.progressXP,
    next: span,
    percent: d.progressPercent,
    level: d.level,
  };
}

// Mức level tối đa hiển thị — trùng với mốc milestone reward cao nhất
// (level 100 trong learning-activity.service.ts). Công thức XP gốc
// (xpToReachLevel) không có trần nên đây CHỈ là trần hiển thị/trao
// thưởng, không thay đổi cách tính level đã lưu trong DB.
export const MAX_LEVEL = 100;

export interface LevelProgressDetails {
  level: number;
  currentXP: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  progressXP: number;
  progressPercent: number;
  remainingXP: number;
  isMaxLevel: boolean;
}

// Hàm DUY NHẤT mọi UI dùng để vẽ thanh Level (dashboard, profile,
// leaderboard...) — input là lifetimeXP thô, output đã normalize nên
// component gọi không bao giờ phải tự tính toán hay lo undefined.
// Giữ nguyên công thức xpToReachLevel/calculateLevel hiện có.
export function getLevelProgressDetails(lifetimeXP: number): LevelProgressDetails {
  const safeXP =
    typeof lifetimeXP === "number" && Number.isFinite(lifetimeXP)
      ? Math.max(0, Math.floor(lifetimeXP))
      : 0;

  const rawLevel = calculateLevel(safeXP);

  if (rawLevel >= MAX_LEVEL) {
    const floor = xpToReachLevel(MAX_LEVEL);
    return {
      level: MAX_LEVEL,
      currentXP: safeXP,
      xpForCurrentLevel: floor,
      xpForNextLevel: floor,
      progressXP: 0,
      progressPercent: 100,
      remainingXP: 0,
      isMaxLevel: true,
    };
  }

  const floor = xpToReachLevel(rawLevel);
  const next = xpToReachLevel(rawLevel + 1);
  const span = next - floor;
  const progressXP = Math.max(0, Math.min(safeXP - floor, span));
  return {
    level: rawLevel,
    currentXP: safeXP,
    xpForCurrentLevel: floor,
    xpForNextLevel: next,
    progressXP,
    progressPercent: span > 0 ? Math.min(100, Math.max(0, Math.round((progressXP / span) * 100))) : 100,
    remainingXP: Math.max(0, next - safeXP),
    isMaxLevel: false,
  };
}

export function getXPForActivity(activityType: ActivityType, options: { difficulty?: 'easy' | 'medium' | 'hard'; scorePercent?: number; isFirstCompletion?: boolean } = {}): number {
  return calculateXP({ activityType, ...options });
}

export function getLXPForActivity(activityType: ActivityType, difficulty: 'easy' | 'medium' | 'hard' = 'medium'): number {
  return calculateLXP(activityType, difficulty);
}