// ================================================================
// LEADERBOARD SERVICE — xếp hạng XP / bạn bè / môn học
// ================================================================
// Mạch tư duy: mọi con số đều đọc TRỰC TIẾP từ DB (User.lifetimeXP,
// LearningProgress.mastery, Friendship) — KHÔNG hardcode, KHÔNG cache
// RAM (leaderboard luôn tươi). Contributor leaderboard đã có riêng ở
// contribution.service.ts (tính theo CP) nên file này KHÔNG viết lại.

import { prisma } from "@/lib/db/prisma";

export interface XpLeaderboardEntry {
  userId: string;
  name: string | null;
  nickname: string | null;
  image: string | null;
  level: number;
  lifetimeXP: number;
  rank: number;
}

export interface SubjectLeaderboardEntry extends XpLeaderboardEntry {
  avgMastery: number;
  topicCount: number;
}

const publicSelect = {
  id: true,
  name: true,
  nickname: true,
  image: true,
  level: true,
  lifetimeXP: true,
} as const;

function clampLimit(limit?: number): number {
  const n = Number(limit);
  if (!Number.isFinite(n)) return 20;
  return Math.min(Math.max(Math.floor(n), 1), 100);
}

// --- Global: top lifetimeXP toàn hệ thống ---
export async function getGlobalXpLeaderboard(limit = 20): Promise<XpLeaderboardEntry[]> {
  const users = await prisma.user.findMany({
    orderBy: { lifetimeXP: "desc" },
    take: clampLimit(limit),
    select: publicSelect,
  });
  return users.map((u, i) => ({
    userId: u.id,
    name: u.name,
    nickname: u.nickname,
    image: u.image,
    level: u.level,
    lifetimeXP: u.lifetimeXP,
    rank: i + 1,
  }));
}

// --- Thứ hạng của chính user trên bảng global (để highlight) ---
export async function getMyGlobalRank(userId: string): Promise<number | null> {
  const me = await prisma.user.findUnique({ where: { id: userId }, select: { lifetimeXP: true } });
  if (!me) return null;
  const better = await prisma.user.count({ where: { lifetimeXP: { gt: me.lifetimeXP } } });
  return better + 1;
}

// --- Friends: chỉ user + bạn ACCEPTED, xếp theo lifetimeXP ---
export async function getFriendsXpLeaderboard(userId: string, limit = 20): Promise<XpLeaderboardEntry[]> {
  const relations = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
    select: { requesterId: true, addresseeId: true },
  });
  const ids = new Set<string>([userId]);
  for (const r of relations) {
    ids.add(r.requesterId === userId ? r.addresseeId : r.requesterId);
  }
  const users = await prisma.user.findMany({
    where: { id: { in: [...ids] } },
    orderBy: { lifetimeXP: "desc" },
    take: clampLimit(limit),
    select: publicSelect,
  });
  return users.map((u, i) => ({
    userId: u.id,
    name: u.name,
    nickname: u.nickname,
    image: u.image,
    level: u.level,
    lifetimeXP: u.lifetimeXP,
    rank: i + 1,
  }));
}

// --- Subject: trung bình mastery theo môn + XP làm tiebreak ---
export async function getSubjectMasteryLeaderboard(
  subject: string,
  limit = 20
): Promise<SubjectLeaderboardEntry[]> {
  const q = subject.trim();
  if (!q) return [];
  const rows = await prisma.learningProgress.groupBy({
    by: ["userId"],
    where: { subject: { equals: q, mode: "insensitive" } },
    _avg: { mastery: true },
    _count: { topic: true },
  });
  if (rows.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: publicSelect,
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return rows
    .map((r) => {
      const u = userMap.get(r.userId);
      if (!u) return null;
      return {
        userId: u.id,
        name: u.name,
        nickname: u.nickname,
        image: u.image,
        level: u.level,
        lifetimeXP: u.lifetimeXP,
        avgMastery: Math.round((r._avg.mastery ?? 0) * 100),
        topicCount: r._count.topic,
        rank: 0,
      };
    })
    .filter((e): e is SubjectLeaderboardEntry => e !== null)
    .sort((a, b) => b.avgMastery - a.avgMastery || b.lifetimeXP - a.lifetimeXP)
    .slice(0, clampLimit(limit))
    .map((e, i) => ({ ...e, rank: i + 1 }));
}
