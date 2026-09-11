// ================================================================
// ACHIEVEMENT SERVICE — Achievement Engine với Unlock Logic
// ================================================================
// Mạch tư duy: service này quản lý achievement definitions, 
// unlock events, và reward distribution.
// ================================================================

import { prisma } from "@/lib/db/prisma";
import { recordLearningActivity } from "@/services/learning-activity.service";

export interface AchievementDefinition {
  code: string;
  title: string;
  description: string;
  icon?: string;
  category: string;
  xpReward: number;
  lxpReward: number;
  condition: AchievementCondition;
}

export type AchievementCondition = 
  | { type: "first_lesson" }
  | { type: "first_solve" }
  | { type: "topic_mastered"; threshold: number }
  | { type: "streak_days"; days: number }
  | { type: "lessons_completed"; count: number }
  | { type: "problems_solved"; count: number }
  | { type: "diagnostic_completed" }
  | { type: "mindmap_created" }
  | { type: "review_completed"; count: number }
  | { type: "roadmap_completed" }
  | { type: "xp_earned"; amount: number }
  | { type: "level_reached"; level: number }
  | { type: "document_analyzed"; count: number };

export interface UnlockResult {
  unlocked: boolean;
  achievement?: {
    code: string;
    title: string;
    description: string;
    icon?: string;
    xpReward: number;
    lxpReward: number;
  };
  reason?: string;
}

// --- ACHIEVEMENT DEFINITIONS ---
const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  // Learning achievements
  {
    code: "FIRST_LESSON",
    title: "Bước Đầu Tiên",
    description: "Hoàn thành bài học đầu tiên",
    icon: "🎓",
    category: "learning",
    xpReward: 50,
    lxpReward: 20,
    condition: { type: "first_lesson" },
  },
  {
    code: "CONCEPT_MASTER",
    title: "Chuyên Gia Chủ Đề",
    description: "Đạt mastery >= 90% cho bất kỳ chủ đề nào",
    icon: "🏆",
    category: "mastery",
    xpReward: 200,
    lxpReward: 50,
    condition: { type: "topic_mastered", threshold: 90 },
  },
  {
    code: "DEEP_LEARNER",
    title: "Người Học Sâu",
    description: "Hoàn thành 10 bài học",
    icon: "📚",
    category: "learning",
    xpReward: 300,
    lxpReward: 100,
    condition: { type: "lessons_completed", count: 10 },
  },
  {
    code: "LEARNING_MARATHON",
    title: "Người Học Marathon",
    description: "Hoàn thành 50 bài học",
    icon: "🏃",
    category: "learning",
    xpReward: 1000,
    lxpReward: 300,
    condition: { type: "lessons_completed", count: 50 },
  },

  // Practice achievements
  {
    code: "FIRST_SOLVE",
    title: "Người Giải Bài Đầu Tiên",
    description: "Giải đúng bài tập đầu tiên",
    icon: "🧩",
    category: "practice",
    xpReward: 50,
    lxpReward: 20,
    condition: { type: "first_solve" },
  },
  {
    code: "PROBLEM_SOLVER",
    title: "Người Giải Vấn Đề",
    description: "Giải đúng 10 bài tập",
    icon: "🔧",
    category: "practice",
    xpReward: 200,
    lxpReward: 50,
    condition: { type: "problems_solved", count: 10 },
  },
  {
    code: "ALGORITHM_HUNTER",
    title: "Kẻ Săn Thuật Toán",
    description: "Giải đúng 20 bài thuật toán",
    icon: "🏹",
    category: "practice",
    xpReward: 500,
    lxpReward: 150,
    condition: { type: "problems_solved", count: 20 },
  },
  {
    code: "CODE_WARRIOR",
    title: "Chiến Binh Code",
    description: "Giải đúng 100 bài code",
    icon: "⚔️",
    category: "practice",
    xpReward: 2000,
    lxpReward: 500,
    condition: { type: "problems_solved", count: 100 },
  },

  // Consistency achievements
  {
    code: "THREE_DAY_STREAK",
    title: "Khởi Động",
    description: "Học liên tục 3 ngày",
    icon: "🔥",
    category: "consistency",
    xpReward: 100,
    lxpReward: 30,
    condition: { type: "streak_days", days: 3 },
  },
  {
    code: "SEVEN_DAY_STREAK",
    title: "Tuần Hoàn Hảo",
    description: "Học liên tục 7 ngày",
    icon: "🌟",
    category: "consistency",
    xpReward: 300,
    lxpReward: 100,
    condition: { type: "streak_days", days: 7 },
  },
  {
    code: "THIRTY_DAY_STREAK",
    title: "Thiền Học Tháng",
    description: "Học liên tục 30 ngày",
    icon: "🧘",
    category: "consistency",
    xpReward: 2000,
    lxpReward: 500,
    condition: { type: "streak_days", days: 30 },
  },
  {
    code: "HUNDRED_DAY_STREAK",
    title: "Trăm Ngày Kiên Trì",
    description: "Học liên tục 100 ngày",
    icon: "💎",
    category: "consistency",
    xpReward: 10000,
    lxpReward: 2000,
    condition: { type: "streak_days", days: 100 },
  },

  // Exploration achievements
  {
    code: "DIAGNOSTIC_EXPLORER",
    title: "Nhà Thám Hiểm Kiến Thức",
    description: "Hoàn thành bài kiểm tra năng lực",
    icon: "🔍",
    category: "exploration",
    xpReward: 100,
    lxpReward: 30,
    condition: { type: "diagnostic_completed" },
  },
  {
    code: "MIND_MAPPER",
    title: "Người Vẽ Bản Đồ Tư Duy",
    description: "Tạo Mind Map đầu tiên",
    icon: "🗺️",
    category: "exploration",
    xpReward: 150,
    lxpReward: 50,
    condition: { type: "mindmap_created" },
  },
  {
    code: "REVIEW_MASTER",
    title: "Chuyên Gia Ôn Tập",
    description: "Hoàn thành 10 lần ôn tập",
    icon: "🔄",
    category: "review",
    xpReward: 300,
    lxpReward: 100,
    condition: { type: "review_completed", count: 10 },
  },
  {
    code: "ROADMAP_TRAVELER",
    title: "Người Du Hành Lộ Trình",
    description: "Hoàn thành một lộ trình học tập",
    icon: "🗺️",
    category: "roadmap",
    xpReward: 500,
    lxpReward: 200,
    condition: { type: "roadmap_completed" },
  },
  {
    code: "DOCUMENT_EXPLORER",
    title: "Người Khám Phá Tài Liệu",
    description: "Phân tích 5 tài liệu",
    icon: "📄",
    category: "exploration",
    xpReward: 300,
    lxpReward: 100,
    condition: { type: "document_analyzed", count: 5 },
  },

  // XP/Level achievements
  {
    code: "XP_NOVICE",
    title: "Tân Binh XP",
    description: "Kiếm được 500 XP",
    icon: "⭐",
    category: "progression",
    xpReward: 100,
    lxpReward: 50,
    condition: { type: "xp_earned", amount: 500 },
  },
  {
    code: "XP_EXPERT",
    title: "Chuyên Gia XP",
    description: "Kiếm được 5000 XP",
    icon: "⭐⭐",
    category: "progression",
    xpReward: 500,
    lxpReward: 200,
    condition: { type: "xp_earned", amount: 5000 },
  },
  {
    code: "XP_MASTER",
    title: "Đại Sư XP",
    description: "Kiếm được 20000 XP",
    icon: "⭐⭐⭐",
    category: "progression",
    xpReward: 2000,
    lxpReward: 1000,
    condition: { type: "xp_earned", amount: 20000 },
  },
  {
    code: "LEVEL_5",
    title: "Cấp Độ 5",
    description: "Đạt Level 5",
    icon: "5️⃣",
    category: "progression",
    xpReward: 200,
    lxpReward: 100,
    condition: { type: "level_reached", level: 5 },
  },
  {
    code: "LEVEL_10",
    title: "Cấp Độ 10",
    description: "Đạt Level 10",
    icon: "🔟",
    category: "progression",
    xpReward: 500,
    lxpReward: 200,
    condition: { type: "level_reached", level: 10 },
  },
  {
    code: "LEVEL_20",
    title: "Cấp Độ 20",
    description: "Đạt Level 20",
    icon: "🎖️",
    category: "progression",
    xpReward: 2000,
    lxpReward: 500,
    condition: { type: "level_reached", level: 20 },
  },
];

// --- 1) INITIALIZE ACHIEVEMENTS ---
export async function initializeAchievements(): Promise<void> {
  for (const def of ACHIEVEMENT_DEFINITIONS) {
    await prisma.achievement.upsert({
      where: { code: def.code },
      create: {
        code: def.code,
        title: def.title,
        description: def.description,
        icon: def.icon,
        category: def.category,
        xpReward: def.xpReward,
        lxpReward: def.lxpReward,
        metadata: { condition: def.condition },
      },
      update: {
        title: def.title,
        description: def.description,
        icon: def.icon,
        category: def.category,
        xpReward: def.xpReward,
        lxpReward: def.lxpReward,
        metadata: { condition: def.condition },
      },
    });
  }
}

// --- 2) CHECK AND UNLOCK ACHIEVEMENTS ---
export async function checkAndUnlockAchievements(userId: string, event: {
  type: string;
  data?: any;
}): Promise<UnlockResult[]> {
  const results: UnlockResult[] = [];

  // Get user stats needed for conditions
  const [
    user,
    streak,
    progress,
    stats,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { lifetimeXP: true, level: true } }),
    prisma.streak.findUnique({ where: { userId } }),
    prisma.learningProgress.findMany({ where: { userId } }),
    getUserStats(userId),
  ]);

  if (!user) return results;

  for (const def of ACHIEVEMENT_DEFINITIONS) {
    // Check if already unlocked
    const existing = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId, achievementId: (await getAchievementId(def.code))! } },
    });

    if (existing) continue; // Already unlocked

    // Check condition
    const shouldUnlock = await evaluateCondition(def.condition, {
      user,
      streak,
      progress,
      stats,
      event,
    });

    if (shouldUnlock) {
      const achievement = await unlockAchievement(userId, def.code);
      if (achievement) {
        results.push({
          unlocked: true,
          achievement: {
            code: def.code,
            title: def.title,
            description: def.description,
            icon: def.icon,
            xpReward: def.xpReward,
            lxpReward: def.lxpReward,
          },
        });
      }
    }
  }

  return results;
}

// --- 3) UNLOCK SPECIFIC ACHIEVEMENT ---
async function unlockAchievement(userId: string, code: string): Promise<any> {
  const achievement = await prisma.achievement.findUnique({ where: { code } });
  if (!achievement) return null;

  // Check if already unlocked
  const existing = await prisma.userAchievement.findUnique({
    where: { userId_achievementId: { userId, achievementId: achievement.id } },
  });
  if (existing) return existing;

  // Create user achievement
  const userAchievement = await prisma.userAchievement.create({
    data: {
      userId,
      achievementId: achievement.id,
    },
  });

  // Award XP and LXP
  if (achievement.xpReward > 0 || achievement.lxpReward > 0) {
    await recordLearningActivity({
      userId,
      type: "achievement_unlocked",
      difficulty: "medium",
      isFirstCompletion: true,
      sourceId: achievement.id,
      sourceType: "achievement",
      metadata: { achievementCode: code },
    });
  }

  return userAchievement;
}

// --- 4) GET ACHIEVEMENT ID ---
async function getAchievementId(code: string): Promise<string | null> {
  const achievement = await prisma.achievement.findUnique({ where: { code } });
  return achievement?.id || null;
}

// --- 5) EVALUATE CONDITION ---
async function evaluateCondition(
  condition: AchievementCondition,
  context: {
    user: any;
    streak: any;
    progress: any[];
    stats: any;
    event: any;
  }
): Promise<boolean> {
  const { user, streak, progress, stats, event } = context;

  switch (condition.type) {
    case "first_lesson":
      return event.type === "lesson_completed" && stats.lessonsCompleted === 1;

    case "first_solve":
      return event.type === "exercise_correct" && stats.exercisesSolved === 1;

    case "topic_mastered":
      return progress.some(p => p.mastery * 100 >= condition.threshold);

    case "streak_days":
      return (streak?.currentStreak ?? 0) >= condition.days;

    case "lessons_completed":
      return stats.lessonsCompleted >= condition.count;

    case "problems_solved":
      return stats.exercisesSolved >= condition.count;

    case "diagnostic_completed":
      return event.type === "diagnostic_completed";

    case "mindmap_created":
      return event.type === "mindmap_created";

    case "review_completed":
      return stats.reviewsCompleted >= condition.count;

    case "roadmap_completed":
      return event.type === "roadmap_completed";

    case "xp_earned":
      return user.lifetimeXP >= condition.amount;

    case "level_reached":
      return user.level >= condition.level;

    case "document_analyzed":
      return stats.documentsAnalyzed >= condition.count;

    default:
      return false;
  }
}

// --- 6) GET USER STATS ---
async function getUserStats(userId: string): Promise<{
  lessonsCompleted: number;
  exercisesSolved: number;
  reviewsCompleted: number;
  documentsAnalyzed: number;
}> {
  // These would come from LearningActivity or other tracking tables
  // For now, return defaults - can be enhanced with actual queries
  const [lessons, exercises, reviews, docs] = await Promise.all([
    prisma.learningActivity.count({ where: { userId, type: "lesson_completed" } }),
    prisma.learningActivity.count({ where: { userId, type: "exercise_correct" } }),
    prisma.learningActivity.count({ where: { userId, type: "review_completed" } }),
    prisma.learningActivity.count({ where: { userId, type: "document_analyzed" } }),
  ]);

  return {
    lessonsCompleted: lessons,
    exercisesSolved: exercises,
    reviewsCompleted: reviews,
    documentsAnalyzed: docs,
  };
}

// --- 7) GET USER ACHIEVEMENTS ---
export async function getUserAchievements(userId: string): Promise<any[]> {
  return prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
    orderBy: { unlockedAt: "desc" },
  });
}

// --- 8) GET ACHIEVEMENT PROGRESS ---
export async function getAchievementProgress(userId: string): Promise<any[]> {
  const userAchievements = await getUserAchievements(userId);
  const unlockedCodes = new Set(userAchievements.map(ua => ua.achievement.code));

  return ACHIEVEMENT_DEFINITIONS.map(def => ({
    ...def,
    unlocked: unlockedCodes.has(def.code),
    progress: 0, // Can be enhanced with actual progress calculation
  }));
}