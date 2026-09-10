// ================================================================
// LEARNING ACTIVITY SERVICE — Centralized XP/LXP/Streak recording
// ================================================================
// Single source of truth for all learning activities. All features
// (quiz, exercise, lesson, diagnostic, tutor, document, roadmap)
// must call recordLearningActivity() to award XP/LXP and update streak.
// ================================================================

import { prisma } from "@/lib/db/prisma";
import { 
  calculateXP, 
  calculateLXP, 
  calculateLevel, 
  xpToReachLevel,
  getLevelProgress,
  type ActivityType 
} from "@/lib/constants/xp";

export interface LearningActivityInput {
  userId: string;
  type: ActivityType;
  difficulty?: 'easy' | 'medium' | 'hard';
  scorePercent?: number;
  isFirstCompletion?: boolean;
  sourceId?: string;
  sourceType?: string;
  metadata?: Record<string, unknown>;
}

export interface ActivityResult {
  xpEarned: number;
  lxpEarned: number;
  learningDayCreated: boolean;
  streakUpdated: { current: number; longest: number };
  leveledUp: boolean;
  newLevel?: number;
  previousLevel: number;
}

function getUserLocalDate(): Date {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localTime = now.getTime() - (offset * 60 * 1000);
  const localDate = new Date(localTime);
  localDate.setHours(0, 0, 0, 0);
  return localDate;
}

function getDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function getLXPBalance(tx: any, userId: string): Promise<number> {
  const result = await tx.pointTransaction.aggregate({
    where: { userId },
    _sum: { amount: true },
  });
  return result._sum.amount || 0;
}

async function updateStreak(tx: any, userId: string, date: Date, isNewLearningDay: boolean) {
  const dateStr = getDateString(date);
  
  const streak = await tx.streak.upsert({
    where: { userId },
    create: {
      userId,
      currentStreak: isNewLearningDay ? 1 : 0,
      longestStreak: isNewLearningDay ? 1 : 0,
      lastLearningDay: isNewLearningDay ? date : null,
    },
    update: {},
  });

  if (!isNewLearningDay) {
    return { current: streak.currentStreak, longest: streak.longestStreak };
  }

  const lastDate = streak.lastLearningDay ? getDateString(streak.lastLearningDay) : null;
  
  let newCurrentStreak = streak.currentStreak;
  
  if (!lastDate) {
    newCurrentStreak = 1;
  } else {
    const last = new Date(lastDate + 'T00:00:00');
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getDateString(yesterday);
    
    if (lastDate === yesterdayStr) {
      newCurrentStreak = streak.currentStreak + 1;
    } else if (lastDate === dateStr) {
      newCurrentStreak = streak.currentStreak;
    } else {
      newCurrentStreak = 1;
    }
  }

  const newLongestStreak = Math.max(streak.longestStreak, newCurrentStreak);

  await tx.streak.update({
    where: { userId },
    data: {
      currentStreak: newCurrentStreak,
      longestStreak: newLongestStreak,
      lastLearningDay: date,
    },
  });

  return { current: newCurrentStreak, longest: newLongestStreak };
}

async function checkAndUpdateDailyChallenge(tx: any, userId: string, activityType: ActivityType, date: Date) {
  const dateStr = getDateString(date);
  
  const challenge = await tx.dailyChallenge.findUnique({
    where: { userId_date: { userId, date } },
  });

  if (!challenge || challenge.completed || challenge.claimed) return;

  const challengeMap: Record<ActivityType, string> = {
    lesson_complete: 'lesson',
    exercise_easy: 'exercise',
    exercise_medium: 'exercise',
    exercise_hard: 'exercise',
    quiz_complete: 'quiz',
    quiz_80_percent: 'quiz',
    daily_challenge: 'challenge',
    daily_mission: 'mission',
    weekly_mission: 'mission',
    mastery_milestone: 'mastery',
  };

  if (challengeMap[activityType] !== challenge.challengeType) return;

  const newCount = challenge.completedCount + 1;
  const isCompleted = newCount >= challenge.targetCount;

  await tx.dailyChallenge.update({
    where: { id: challenge.id },
    data: {
      completedCount: newCount,
      completed: isCompleted,
    },
  });
}

async function checkAchievements(tx: any, userId: string, activityType: ActivityType, date: Date) {
  const streak = await tx.streak.findUnique({ where: { userId } });
  if (!streak) return;

  const achievements: { code: string; condition: boolean }[] = [
    { code: 'first_lesson', condition: activityType === 'lesson_complete' },
    { code: 'first_quiz', condition: activityType === 'quiz_complete' },
    { code: 'first_exercise', condition: activityType.startsWith('exercise_') },
    { code: 'streak_3', condition: streak.currentStreak >= 3 },
    { code: 'streak_7', condition: streak.currentStreak >= 7 },
    { code: 'streak_30', condition: streak.currentStreak >= 30 },
  ];

  for (const ach of achievements) {
    if (!ach.condition) continue;
    
    const existing = await tx.achievement.findUnique({
      where: { userId_code: { userId, code: ach.code } },
    });
    
    if (!existing) {
      await tx.achievement.create({
        data: { userId, code: ach.code },
      });
    }
  }
}

async function checkLevelUpRewards(tx: any, userId: string, oldLevel: number, newLevel: number) {
  const milestoneLevels = [5, 10, 20, 30, 50, 100];
  
  for (const milestone of milestoneLevels) {
    if (oldLevel < milestone && newLevel >= milestone) {
      const reward = await tx.reward.findFirst({
        where: { 
          type: 'MILESTONE',
          requirements: { path: ['levelMin'], equals: milestone },
          active: true,
        },
      });
      
      if (reward) {
        const existing = await tx.userReward.findUnique({
          where: { userId_rewardId: { userId, rewardId: reward.id } },
        });
        
        if (!existing) {
          await tx.userReward.create({
            data: { userId, rewardId: reward.id, status: 'OWNED' },
          });
        }
      }
    }
  }
}

export async function recordLearningActivity(input: LearningActivityInput): Promise<ActivityResult> {
  const { 
    userId, 
    type, 
    difficulty = 'medium', 
    scorePercent = 0, 
    isFirstCompletion = true,
    sourceId,
    sourceType = type,
  } = input;

  const date = getUserLocalDate();
  const dateStr = getDateString(date);

  const xpEarned = calculateXP({ activityType: type, difficulty, scorePercent, isFirstCompletion });
  const lxpEarned = calculateLXP(type, difficulty);

  return await prisma.$transaction(async (tx) => {
    const learningDay = await tx.learningDay.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, xpEarned: 0, lxpEarned: 0 },
      update: {},
    });

    const isNewLearningDay = learningDay.xpEarned === 0 && learningDay.lxpEarned === 0;

    await tx.learningDay.update({
      where: { id: learningDay.id },
      data: {
        xpEarned: { increment: xpEarned },
        lxpEarned: { increment: lxpEarned },
      },
    });

    await tx.xPTransaction.create({
      data: {
        userId,
        amount: xpEarned,
        reason: type,
        sourceType,
        sourceId,
      },
    });

    const currentLXPBalance = await getLXPBalance(tx, userId);
    await tx.pointTransaction.create({
      data: {
        userId,
        amount: lxpEarned,
        reason: type,
        sourceType,
        sourceId,
        balanceAfter: currentLXPBalance + lxpEarned,
      },
    });

    const user = await tx.user.update({
      where: { id: userId },
      data: {
        lifetimeXP: { increment: xpEarned },
        lifetimeLXP: { increment: lxpEarned },
        lxpBalance: { increment: lxpEarned },
      },
      select: { lifetimeXP: true, level: true },
    });

    const oldLevel = user.level;
    const newLevel = calculateLevel(user.lifetimeXP);
    const leveledUp = newLevel > oldLevel;

    if (leveledUp) {
      await tx.user.update({ where: { id: userId }, data: { level: newLevel } });
      await checkLevelUpRewards(tx, userId, oldLevel, newLevel);
    }

    const streakResult = await updateStreak(tx, userId, date, isNewLearningDay);
    await checkAndUpdateDailyChallenge(tx, userId, type, date);
    await checkAchievements(tx, userId, type, date);

    return {
      xpEarned,
      lxpEarned,
      learningDayCreated: isNewLearningDay,
      streakUpdated: streakResult,
      leveledUp,
      newLevel: leveledUp ? newLevel : undefined,
      previousLevel: oldLevel,
    };
  });
}

export async function getCurrentStreak(userId: string) {
  const streak = await prisma.streak.findUnique({ where: { userId } });
  if (!streak) return { current: 0, longest: 0, lastLearningDay: null };
  return {
    current: streak.currentStreak,
    longest: streak.longestStreak,
    lastLearningDay: streak.lastLearningDay,
  };
}

export async function getUserProgress(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lifetimeXP: true, lifetimeLXP: true, lxpBalance: true, level: true },
  });
  
  if (!user) return null;

  const levelProgress = getLevelProgress(user.lifetimeXP);
  const streak = await getCurrentStreak(userId);

  return {
    lifetimeXP: user.lifetimeXP,
    lifetimeLXP: user.lifetimeLXP,
    lxpBalance: user.lxpBalance,
    level: user.level,
    levelProgress,
    streak,
  };
}

export async function getXPHistory(userId: string, page = 1, limit = 20) {
  const [transactions, total] = await Promise.all([
    prisma.xPTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.xPTransaction.count({ where: { userId } }),
  ]);

  return { transactions, total, page, limit };
}

export async function getLXPHistory(userId: string, page = 1, limit = 20) {
  const [transactions, total] = await Promise.all([
    prisma.pointTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.pointTransaction.count({ where: { userId } }),
  ]);

  return { transactions, total, page, limit };
}

export async function getLearningDays(userId: string, startDate: Date, endDate: Date) {
  return prisma.learningDay.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  });
}