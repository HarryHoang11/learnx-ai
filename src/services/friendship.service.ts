// ================================================================
// FRIENDSHIP SERVICE — kết bạn & hồ sơ bạn bè
// ================================================================
// Mạch tư duy: Friendship lưu theo HƯỚNG requester -> addressee để
// UX phân biệt "lời mời đã gửi" / "lời mời được nhận". Tính đối xứng
// (2 user chỉ có 1 relationship) được đảm bảo bằng cách kiểm tra CẢ
// 2 chiều trước mọi thao tác ghi — vì unique DB chỉ chặn trùng đúng
// 1 chiều. Mọi hàm đều nhận userId từ session (server), KHÔNG BAO
// GIỜ tin userId do client gửi lên.

import { prisma } from "@/lib/db/prisma";
import { getUserProgress, getCurrentStreak } from "@/services/learning-activity.service";
import { getSkillProfile } from "@/services/assessment.service";
import { getUserAchievements } from "@/services/achievement.service";

export type FriendshipStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface FriendUser {
  id: string;
  name: string | null;
  nickname: string | null;
  image: string | null;
  level: number;
  lifetimeXP: number;
}

export interface FriendshipWithUser {
  id: string;
  status: FriendshipStatus;
  isRequester: boolean;
  createdAt: Date;
  friend: FriendUser;
}

// Tìm quan hệ giữa 2 user theo CẢ 2 chiều (đối xứng).
async function findRelation(a: string, b: string) {
  return prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
  });
}

const friendSelect = {
  id: true,
  name: true,
  nickname: true,
  image: true,
  level: true,
  lifetimeXP: true,
} as const;

// --- Tìm kiếm user khác (loại trừ chính mình) ---
export async function searchUsers(userId: string, query: string, limit = 10) {
  const q = query.trim();
  if (!q) return [];
  const users = await prisma.user.findMany({
    where: {
      id: { not: userId },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { nickname: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { ...friendSelect, email: true },
    take: Math.min(Math.max(limit, 1), 20),
  });
  // Kèm trạng thái quan hệ hiện tại để UI hiện đúng nút.
  const relations = await prisma.friendship.findMany({
    where: {
      OR: [
        { requesterId: userId, addresseeId: { in: users.map((u) => u.id) } },
        { addresseeId: userId, requesterId: { in: users.map((u) => u.id) } },
      ],
    },
  });
  const relByOther = new Map<string, { status: FriendshipStatus; isRequester: boolean }>();
  for (const r of relations) {
    const other = r.requesterId === userId ? r.addresseeId : r.requesterId;
    relByOther.set(other, { status: r.status as FriendshipStatus, isRequester: r.requesterId === userId });
  }
  return users.map((u) => ({ ...u, relation: relByOther.get(u.id) ?? null }));
}

// --- Gửi lời mời kết bạn ---
export async function sendFriendRequest(userId: string, addresseeId: string) {
  if (!addresseeId || addresseeId === userId) {
    throw new Error("Không thể kết bạn với chính mình.");
  }
  const target = await prisma.user.findUnique({ where: { id: addresseeId }, select: { id: true } });
  if (!target) throw new Error("Không tìm thấy người dùng.");

  const existing = await findRelation(userId, addresseeId);
  if (existing) {
    if (existing.status === "PENDING") throw new Error("Đã có lời mời kết bạn đang chờ.");
    if (existing.status === "ACCEPTED") throw new Error("Hai bạn đã là bạn bè.");
    // REJECTED -> cho gửi lại bằng cách chuyển về PENDING (giữ đúng hướng mới).
    if (existing.requesterId === userId && existing.addresseeId === addresseeId) {
      return prisma.friendship.update({
        where: { id: existing.id },
        data: { status: "PENDING" },
      });
    }
    // Lời mời cũ ngược chiều đang REJECTED -> xóa và tạo mới đúng chiều.
    await prisma.friendship.delete({ where: { id: existing.id } });
  }

  return prisma.friendship.create({
    data: { requesterId: userId, addresseeId, status: "PENDING" },
  });
}

// --- Chấp nhận / từ chối (chỉ addressee của lời mời PENDING) ---
export async function respondToRequest(userId: string, friendshipId: string, action: "accept" | "reject") {
  const rel = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!rel || rel.addresseeId !== userId || rel.status !== "PENDING") {
    throw new Error("Lời mời không tồn tại hoặc đã được xử lý.");
  }
  return prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: action === "accept" ? "ACCEPTED" : "REJECTED" },
  });
}

// --- Hủy lời mời đã gửi (requester, PENDING) / Xóa bạn (ACCEPTED, 2 chiều) ---
export async function removeRelation(userId: string, friendshipId: string) {
  const rel = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!rel || (rel.requesterId !== userId && rel.addresseeId !== userId)) {
    throw new Error("Không tìm thấy mối quan hệ.");
  }
  if (rel.status === "PENDING" && rel.requesterId !== userId) {
    throw new Error("Chỉ người gửi mới được hủy lời mời.");
  }
  await prisma.friendship.delete({ where: { id: friendshipId } });
  return { deleted: true };
}

// --- Danh sách bạn + lời mời đến/đi ---
export async function listFriends(userId: string): Promise<{
  friends: FriendshipWithUser[];
  incoming: FriendshipWithUser[];
  outgoing: FriendshipWithUser[];
}> {
  const rows = await prisma.friendship.findMany({
    where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
    include: {
      requester: { select: friendSelect },
      addressee: { select: friendSelect },
    },
    orderBy: { updatedAt: "desc" },
  });

  const friends: FriendshipWithUser[] = [];
  const incoming: FriendshipWithUser[] = [];
  const outgoing: FriendshipWithUser[] = [];

  for (const r of rows) {
    const isRequester = r.requesterId === userId;
    const friend = isRequester ? r.addressee : r.requester;
    const entry: FriendshipWithUser = {
      id: r.id,
      status: r.status as FriendshipStatus,
      isRequester,
      createdAt: r.createdAt,
      friend: {
        id: friend.id,
        name: friend.name,
        nickname: friend.nickname,
        image: friend.image,
        level: friend.level,
        lifetimeXP: friend.lifetimeXP,
      },
    };
    if (r.status === "ACCEPTED") friends.push(entry);
    else if (r.status === "PENDING") (isRequester ? outgoing : incoming).push(entry);
  }

  return { friends, incoming, outgoing };
}

// --- Hồ sơ bạn bè: chỉ expose field công khai, KHÔNG lộ email/private ---
export async function getFriendProfile(userId: string, friendId: string) {
  if (friendId === userId) throw new Error("Dùng trang cá nhân của bạn thay vì hồ sơ bạn bè.");
  const rel = await findRelation(userId, friendId);
  if (!rel || rel.status !== "ACCEPTED") {
    throw new Error("Hai bạn chưa phải là bạn bè.");
  }

  const [user, progress, skillMap, achievements, recentActivity] = await Promise.all([
    prisma.user.findUnique({
      where: { id: friendId },
      select: { id: true, name: true, nickname: true, image: true, level: true, lifetimeXP: true, lifetimeLXP: true },
    }),
    getUserProgress(friendId),
    getSkillProfile(friendId),
    getUserAchievements(friendId),
    prisma.learningActivity.findMany({
      where: { userId: friendId },
      orderBy: { occurredAt: "desc" },
      take: 10,
      select: { type: true, subject: true, topic: true, xpAwarded: true, occurredAt: true },
    }),
  ]);

  if (!user) throw new Error("Không tìm thấy người dùng.");

  const masteryAvg =
    skillMap.length > 0
      ? Math.round(skillMap.reduce((s, p) => s + p.masteryPercent, 0) / skillMap.length)
      : 0;

  return {
    user,
    streak: progress?.streak ?? (await getCurrentStreak(friendId)),
    masteryAvg,
    skillCount: skillMap.length,
    achievements: achievements.map(
      (a: {
        achievement: { code: string; title: string; icon: string | null };
        unlockedAt: Date;
      }) => ({
        code: a.achievement.code,
        title: a.achievement.title,
        icon: a.achievement.icon,
        unlockedAt: a.unlockedAt,
      })
    ),
    recentActivity,
  };
}
