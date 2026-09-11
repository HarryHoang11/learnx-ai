// ================================================================
// CONTRIBUTION SERVICE — CP System, Events, Leaderboards, Levels
// ================================================================
// Manages Contribution Points (CP), event logging, leaderboards,
// contributor levels, and anti-spam mechanisms.
// ================================================================

import { prisma } from "@/lib/db/prisma";
import { recordLearningActivity } from "@/services/learning-activity.service";

export interface ContributionConfig {
  // Base CP rewards
  baseUpload: number;
  qualityBonusThreshold: number;
  qualityBonusHigh: number;
  helpfulVoteReward: number;
  downloadReward: number;
  saveReward: number;
  reflectionReward: number;
  
  // Penalties
  duplicatePenalty: number;
  reportPenalty: number;
  spamPenalty: number;
  
  // Caps
  dailyCPCap: number;
  weeklyCPCap: number;
  maxUploadsPerDay: number;
  
  // Level thresholds
  levelThresholds: number[];
  
  // Quality thresholds
  minQualityForReward: number;
  highQualityThreshold: number;
}

export const DEFAULT_CONTRIBUTION_CONFIG: ContributionConfig = {
  baseUpload: 10,
  qualityBonusThreshold: 70,
  qualityBonusHigh: 40,
  helpfulVoteReward: 5,
  downloadReward: 2,
  saveReward: 2,
  reflectionReward: 10,
  
  duplicatePenalty: -20,
  reportPenalty: -30,
  spamPenalty: -50,
  
  dailyCPCap: 500,
  weeklyCPCap: 2000,
  maxUploadsPerDay: 20,
  
  levelThresholds: [0, 100, 300, 700, 1500, 3000, 5000, 10000, 20000, 50000],
  
  minQualityForReward: 50,
  highQualityThreshold: 80,
};

// --- 1) CONTRIBUTOR PROFILE MANAGEMENT ---
export async function getOrCreateContributorProfile(userId: string) {
  let profile = await prisma.contributorProfile.findUnique({ where: { userId } });
  
  if (!profile) {
    profile = await prisma.contributorProfile.create({
      data: { userId },
    });
  }
  
  return profile;
}

export async function getContributorProfile(userId: string) {
  const profile = await prisma.contributorProfile.findUnique({
    where: { userId },
    include: {
      user: { select: { id: true, name: true, nickname: true, image: true } },
    },
  });
  
  if (!profile) return null;
  
  // Calculate progress to next level
  const nextLevelThreshold = getNextLevelThreshold(profile.contributionPoints);
  const currentLevelThreshold = getCurrentLevelThreshold(profile.contributionPoints);
  const progress = nextLevelThreshold > currentLevelThreshold
    ? ((profile.contributionPoints - currentLevelThreshold) / (nextLevelThreshold - currentLevelThreshold)) * 100
    : 100;
  
  return {
    ...profile,
    nextLevelCP: nextLevelThreshold,
    progressPercent: Math.round(progress),
  };
}

function getCurrentLevelThreshold(cp: number): number {
  const thresholds = DEFAULT_CONTRIBUTION_CONFIG.levelThresholds;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (cp >= thresholds[i]) return thresholds[i];
  }
  return 0;
}

function getNextLevelThreshold(cp: number): number {
  const thresholds = DEFAULT_CONTRIBUTION_CONFIG.levelThresholds;
  for (const threshold of thresholds) {
    if (cp < threshold) return threshold;
  }
  return thresholds[thresholds.length - 1];
}

export function calculateLevelFromCP(cp: number): number {
  const thresholds = DEFAULT_CONTRIBUTION_CONFIG.levelThresholds;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (cp >= thresholds[i]) return i + 1;
  }
  return 1;
}

// --- 2) CONTRIBUTION EVENT LOGGING ---
export async function logContributionEvent(input: {
  userId: string;
  type: "UPLOAD_ACCEPTED" | "QUALITY_BONUS" | "HELPFUL_VOTE" | "DOWNLOAD_REWARD" | "SAVE_REWARD" | "DUPLICATE_PENALTY" | "REPORT_PENALTY" | "MODERATOR_ADJUSTMENT" | "DAILY_CAP" | "WEEKLY_CAP";
  points: number;
  documentId?: string;
  description?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  await prisma.contributionEvent.create({
    data: {
      userId: input.userId,
      type: input.type,
      points: input.points,
      documentId: input.documentId,
      description: input.description,
      metadata: input.metadata,
    },
  });
  
  // Update contributor profile
  await updateContributorStats(input.userId, input.type, input.points);
}

async function updateContributorStats(
  userId: string,
  type: string,
  points: number
): Promise<void> {
  const profile = await getOrCreateContributorProfile(userId);
  
  const updates: any = {
    contributionPoints: { increment: points },
    updatedAt: new Date(),
  };
  
  // Update specific counters based on event type
  switch (type) {
    case "UPLOAD_ACCEPTED":
      updates.totalUploads = { increment: 1 };
      break;
    case "QUALITY_BONUS":
      // Quality stats updated separately
      break;
    case "HELPFUL_VOTE":
      updates.helpfulVotes = { increment: 1 };
      break;
    case "DOWNLOAD_REWARD":
      updates.totalDownloads = { increment: 1 };
      break;
    case "SAVE_REWARD":
      updates.totalSaves = { increment: 1 };
      break;
    case "REFLECTION_REWARD":
      break;
    case "DUPLICATE_PENALTY":
      updates.totalReports = { increment: 1 };
      break;
    case "REPORT_PENALTY":
      updates.totalReports = { increment: 1 };
      break;
  }
  
  // Update streak
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (profile.lastContributionAt) {
    const lastDate = new Date(profile.lastContributionAt);
    lastDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      updates.currentStreak = { increment: 1 };
      updates.longestStreak = { increment: Math.max(0, profile.currentStreak + 1 - profile.longestStreak) };
    } else if (diffDays > 1) {
      updates.currentStreak = { set: 1 };
    }
    // diffDays === 0: same day, no streak change
  } else {
    updates.currentStreak = { set: 1 };
    updates.longestStreak = { set: Math.max(profile.longestStreak, 1) };
  }
  
  updates.lastContributionAt = today;
  
  // Check for level up
  const newCP = profile.contributionPoints + points;
  const newLevel = calculateLevelFromCP(newCP);
  
  if (newLevel > profile.level) {
    updates.level = newLevel;
  }

  await prisma.contributorProfile.update({
    where: { userId },
    data: updates,
  });
}

// --- 3) AWARD CONTRIBUTION POINTS ---
export async function awardContributionPoints(
  userId: string,
  eventType: "UPLOAD_ACCEPTED" | "QUALITY_BONUS" | "HELPFUL_VOTE" | "DOWNLOAD_REWARD" | "SAVE_REWARD",
  documentId?: string,
  qualityScore?: number
): Promise<{ success: boolean; pointsAwarded: number; newTotal: number; capped: boolean }> {
  const config = DEFAULT_CONTRIBUTION_CONFIG;
  const profile = await getOrCreateContributorProfile(userId);
  
  // Check daily/weekly caps
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  
  const [dailyEvents, weeklyEvents] = await Promise.all([
    prisma.contributionEvent.aggregate({
      where: { userId, createdAt: { gte: today } },
      _sum: { points: true },
    }),
    prisma.contributionEvent.aggregate({
      where: { userId, createdAt: { gte: weekStart } },
      _sum: { points: true },
    }),
  ]);
  
  const dailyCP = dailyEvents._sum.points || 0;
  const weeklyCP = weeklyEvents._sum.points || 0;
  
  if (dailyCP >= config.dailyCPCap) {
    await logContributionEvent({
      userId,
      type: "DAILY_CAP",
      points: 0,
      description: "Daily CP cap reached",
    });
    return { success: false, pointsAwarded: 0, newTotal: profile.contributionPoints, capped: true };
  }
  
  if (weeklyCP >= config.weeklyCPCap) {
    await logContributionEvent({
      userId,
      type: "WEEKLY_CAP",
      points: 0,
      description: "Weekly CP cap reached",
    });
    return { success: false, pointsAwarded: 0, newTotal: profile.contributionPoints, capped: true };
  }
  
  // Calculate points based on event type and quality
  let points = 0;
  
  switch (eventType) {
    case "UPLOAD_ACCEPTED":
      points = config.baseUpload;
      break;
    case "QUALITY_BONUS":
      if (qualityScore && qualityScore >= config.qualityBonusThreshold) {
        points = qualityScore >= config.highQualityThreshold ? config.qualityBonusHigh : 20;
      }
      break;
    case "HELPFUL_VOTE":
      points = config.helpfulVoteReward;
      break;
    case "DOWNLOAD_REWARD":
      points = config.downloadReward;
      break;
    case "SAVE_REWARD":
      points = config.saveReward;
      break;
  }
  
  if (points <= 0) {
    return { success: false, pointsAwarded: 0, newTotal: profile.contributionPoints, capped: false };
  }
  
  // Apply remaining cap space
  const remainingDaily = config.dailyCPCap - dailyCP;
  const remainingWeekly = config.weeklyCPCap - weeklyCP;
  const maxAllowed = Math.min(remainingDaily, remainingWeekly);
  
  if (points > maxAllowed) {
    points = maxAllowed;
  }
  
  if (points <= 0) {
    return { success: false, pointsAwarded: 0, newTotal: profile.contributionPoints, capped: true };
  }
  
  // Log event and update stats
  await logContributionEvent({
    userId,
    type: eventType,
    points,
    documentId,
    metadata: { qualityScore },
  });
  
  // Update CP balance (using pointTransaction or just profile)
  const newTotal = profile.contributionPoints + points;
  const newLevel = calculateLevelFromCP(newTotal);
  const updateData = {
    contributionPoints: newTotal,
    level: newLevel,
  };
  await prisma.contributorProfile.update({ where: { userId }, data: updateData });

  return { success: true, pointsAwarded: points, newTotal, capped: false };
}

// --- 4) APPLY PENALTIES ---
export async function applyPenalty(
  userId: string,
  penaltyType: "DUPLICATE_PENALTY" | "REPORT_PENALTY",
  documentId?: string,
  description?: string
): Promise<void> {
  const config = DEFAULT_CONTRIBUTION_CONFIG;
  let points = 0;
  
  switch (penaltyType) {
    case "DUPLICATE_PENALTY":
      points = config.duplicatePenalty;
      break;
    case "REPORT_PENALTY":
      points = config.reportPenalty;
      break;
  }
  
  if (points >= 0) return;
  
  const profile = await getOrCreateContributorProfile(userId);
  const newTotal = Math.max(0, profile.contributionPoints + points);

  await prisma.contributorProfile.update({
    where: { userId },
    data: {
      contributionPoints: newTotal,
      level: calculateLevelFromCP(newTotal),
    },
  });
}

// --- 5) ANTI-SPAM CHECKS ---
export async function checkSpamLimits(userId: string): Promise<{ allowed: boolean; reason?: string }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayUploads = await prisma.communityDocument.count({
    where: {
      ownerId: userId,
      uploadedAt: { gte: today },
    },
  });
  
  if (todayUploads >= DEFAULT_CONTRIBUTION_CONFIG.maxUploadsPerDay) {
    return { allowed: false, reason: "Daily upload limit reached" };
  }
  
  // Check for rapid repeated uploads
  const recentUploads = await prisma.communityDocument.count({
    where: {
      ownerId: userId,
      uploadedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) }, // Last 5 minutes
    },
  });
  
  if (recentUploads >= 3) {
    return { allowed: false, reason: "Uploading too frequently, please wait" };
  }
  
  // Check daily/weekly CP caps
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const [dailyAgg, weeklyAgg] = await Promise.all([
    prisma.contributionEvent.aggregate({
      where: { userId: userId, createdAt: { gte: todayStart } },
      _sum: { points: true },
    }),
    prisma.contributionEvent.aggregate({
      where: { userId: userId, createdAt: { gte: weekStart } },
      _sum: { points: true },
    }),
  ]);

  const dailyCP = dailyAgg._sum.points || 0;
  const weeklyCP = weeklyAgg._sum.points || 0;
  
  if (dailyCP >= DEFAULT_CONTRIBUTION_CONFIG.dailyCPCap) {
    return { allowed: false, reason: "Daily contribution limit reached" };
  }
  
  if (weeklyCP >= DEFAULT_CONTRIBUTION_CONFIG.weeklyCPCap) {
    return { allowed: false, reason: "Weekly contribution limit reached" };
  }
  
  return { allowed: true };
}

// --- 6) LEADERBOARDS ---
export interface LeaderboardEntry {
  userId: string;
  name: string;
  nickname?: string;
  image?: string;
  contributionPoints: number;
  level: number;
  totalUploads: number;
  avgQuality: number;
  helpfulVotes: number;
  rank: number;
}

export async function getLeaderboard(
  period: "weekly" | "monthly" | "alltime" = "alltime",
  subjectId?: string,
  limit = 50
): Promise<LeaderboardEntry[]> {
  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date;
  
  switch (period) {
    case "weekly":
      periodStart = new Date();
      periodStart.setDate(now.getDate() - now.getDay());
      periodStart.setHours(0, 0, 0, 0);
      periodEnd = new Date(periodStart);
      periodEnd.setDate(periodEnd.getDate() + 7);
      break;
    case "monthly":
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case "alltime":
    default:
      periodStart = new Date(0);
      periodEnd = new Date();
  }
  
  // ContributionEvent has no `document` relation, so filter by subject
  // via the documents belonging to that subject first.
  let subjectDocIds: string[] | undefined;
  if (subjectId) {
    const docs = await prisma.communityDocument.findMany({
      where: { subjectId },
      select: { id: true },
    });
    subjectDocIds = docs.map((d) => d.id);
    if (subjectDocIds.length === 0) return [];
  }

  // Get users with contribution events in period
  const events = await prisma.contributionEvent.findMany({
    where: {
      createdAt: { gte: periodStart, lte: periodEnd },
      ...(subjectDocIds && { documentId: { in: subjectDocIds } }),
    },
    include: {
      user: { select: { id: true, name: true, nickname: true, image: true } },
    },
  });
  
  // Aggregate by user
  const userStats = new Map<string, {
    userId: string;
    name: string;
    nickname?: string;
    image?: string;
    points: number;
    uploads: number;
    qualitySum: number;
    qualityCount: number;
    helpfulVotes: number;
  }>();
  
  for (const event of events) {
    const stats = userStats.get(event.userId) || {
      userId: event.userId,
      name: event.user.name || "",
      nickname: event.user.nickname ?? undefined,
      image: event.user.image ?? undefined,
      points: 0,
      uploads: 0,
      qualitySum: 0,
      qualityCount: 0,
      helpfulVotes: 0,
    };

    stats.points += event.points;

    if (event.type === "UPLOAD_ACCEPTED") stats.uploads++;
    if (event.type === "QUALITY_BONUS") {
      const qs = (event.metadata as { qualityScore?: unknown } | null)?.qualityScore;
      if (typeof qs === "number" && Number.isFinite(qs)) {
        stats.qualitySum += qs;
        stats.qualityCount++;
      }
    }
    if (event.type === "HELPFUL_VOTE") stats.helpfulVotes++;
    
    userStats.set(event.userId, stats);
  }
  
  // Convert to leaderboard entries
  const entries: LeaderboardEntry[] = Array.from(userStats.values())
    .map(stat => ({
      userId: stat.userId,
      name: stat.name,
      nickname: stat.nickname,
      image: stat.image,
      contributionPoints: stat.points,
      level: calculateLevelFromCP(stat.points),
      totalUploads: stat.uploads,
      avgQuality: stat.qualityCount > 0 ? stat.qualitySum / stat.qualityCount : 0,
      helpfulVotes: stat.helpfulVotes,
      rank: 0, // Will be set after sorting
    }))
    .sort((a, b) => b.contributionPoints - a.contributionPoints)
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  
  return entries;
}

// --- 7) SUBJECT-SPECIFIC LEADERBOARD ---
export async function getSubjectLeaderboard(
  subjectId: string,
  period: "weekly" | "monthly" | "alltime" = "alltime",
  limit = 20
): Promise<LeaderboardEntry[]> {
  // Get documents in this subject
  const documents = await prisma.communityDocument.findMany({
    where: { subjectId, visibility: "COMMUNITY", status: "READY" },
    select: { id: true, ownerId: true, qualityScore: true },
  });
  
  const docIds = documents.map(d => d.id);
  const ownerCounts = new Map<string, { uploads: number; qualitySum: number; qualityCount: number }>();
  
  for (const doc of documents) {
    const stats = ownerCounts.get(doc.ownerId) || { uploads: 0, qualitySum: 0, qualityCount: 0 };
    stats.uploads++;
    if (doc.qualityScore) {
      stats.qualitySum += doc.qualityScore;
      stats.qualityCount++;
    }
    ownerCounts.set(doc.ownerId, stats);
  }
  
  // Get user profiles
  const userIds = Array.from(ownerCounts.keys());
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, nickname: true, image: true },
  });
  
  const userMap = new Map(users.map(u => [u.id, u]));
  
  const entries: LeaderboardEntry[] = Array.from(ownerCounts.entries())
    .map(([userId, stats]) => {
      const user = userMap.get(userId);
      return {
        userId,
        name: user?.name || "Unknown",
        nickname: user?.nickname ?? undefined,
        image: user?.image ?? undefined,
        contributionPoints: 0, // Subject-specific CP
        level: 1,
        totalUploads: stats.uploads,
        avgQuality: stats.qualityCount > 0 ? stats.qualitySum / stats.qualityCount : 0,
        helpfulVotes: 0,
        rank: 0,
      };
    })
    .sort((a, b) => b.avgQuality - a.avgQuality || b.totalUploads - a.totalUploads)
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
  
  return entries;
}

// --- 8) CONTRIBUTOR PROFILE PAGE DATA ---
export async function getContributorProfileData(userId: string) {
  const [profile, documents, events, recentActivity] = await Promise.all([
    getContributorProfile(userId),
    prisma.communityDocument.findMany({
      where: { ownerId: userId, visibility: "COMMUNITY", status: "READY" },
      orderBy: { uploadedAt: "desc" },
      take: 20,
      include: { subject: true, topic: true },
    }),
    prisma.contributionEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.learningActivity.findMany({
      where: { userId },
      orderBy: { occurredAt: "desc" },
      take: 20,
    }),
  ]);
  
  // Calculate stats
  const totalQuality = documents.reduce((sum, d) => sum + (d.qualityScore || 0), 0);
  const avgQuality = documents.length > 0 ? totalQuality / documents.length : 0;
  const totalDownloads = documents.reduce((sum, d) => sum + (d.downloadCount || 0), 0);
  const totalSaves = documents.reduce((sum, d) => sum + (d.saveCount || 0), 0);
  const totalViews = documents.reduce((sum, d) => sum + (d.viewCount || 0), 0);
  const totalHelpful = documents.reduce((sum, d) => sum + (d.helpfulVotes || 0), 0);
  
  return {
    profile,
    documents,
    events,
    recentActivity,
    stats: {
      totalDocuments: documents.length,
      avgQuality: Math.round(avgQuality),
      totalDownloads,
      totalSaves,
      totalViews,
      totalHelpful,
    },
  };
}

