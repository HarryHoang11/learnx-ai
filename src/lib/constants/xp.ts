// ================================================================
// XP & LXP CONSTANTS — Source of Truth for all calculations
// ================================================================

export const BASE_XP = {
  LESSON_COMPLETE: 10,
  EXERCISE_EASY: 10,
  EXERCISE_MEDIUM: 15,
  EXERCISE_HARD: 20,
  QUIZ_COMPLETE: 20,
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
  | 'mastery_milestone';

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
    default:
      return 0;
  }
}

export function xpToReachLevel(level: number): number {
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
  const level = calculateLevel(lifetimeXP);
  const currentThreshold = xpToReachLevel(level);
  const nextThreshold = xpToReachLevel(level + 1);
  const current = lifetimeXP - currentThreshold;
  const needed = nextThreshold - currentThreshold;
  return { 
    current, 
    next: needed, 
    percent: needed > 0 ? Math.round((current / needed) * 100) : 100, 
    level 
  };
}

export function getXPForActivity(activityType: ActivityType, options: { difficulty?: 'easy' | 'medium' | 'hard'; scorePercent?: number; isFirstCompletion?: boolean } = {}): number {
  return calculateXP({ activityType, ...options });
}

export function getLXPForActivity(activityType: ActivityType, difficulty: 'easy' | 'medium' | 'hard' = 'medium'): number {
  return calculateLXP(activityType, difficulty);
}