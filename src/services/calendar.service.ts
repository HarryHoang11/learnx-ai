// ================================================================
// CALENDAR SERVICE — Timezone-safe date handling
// ================================================================
// KEY PRINCIPLE: All dates stored as YYYY-MM-DD strings (no time component).
// When parsing YYYY-MM-DD, use local timezone to avoid UTC shift.
// All range calculations use start-of-day in LOCAL timezone.
// ================================================================

import { prisma } from "@/lib/db/prisma";
import type { StudySessionStatus } from "@/types";

export interface StudySessionInput {
  title: string;
  subject: string;
  topic?: string;
  description?: string;
  learningGoalId?: string | null;
  startTime: Date;
  endTime: Date;
}

// TIMEZONE: Use Asia/Ho_Chi_Minh (Vietnam) for all date calculations.
// This ensures consistency between frontend, backend, and database.
const VIETNAM_TIMEZONE = 'Asia/Ho_Chi_Minh';

// --- Helper: Get current date in Vietnam timezone as YYYY-MM-DD ---
export function getTodayDateString(): string {
  const now = new Date();
  // Convert to Vietnam timezone
  const vietnamTime = new Date(now.toLocaleString('en-US', { timeZone: VIETNAM_TIMEZONE }));
  return vietnamTime.toISOString().slice(0, 10);
}

// --- Helper: Parse YYYY-MM-DD string to Date at START OF DAY in local timezone ---
// This avoids the UTC shift bug: new Date("2026-09-08") creates UTC midnight
export function parseDateString(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Create date at local midnight (no timezone shift)
  return new Date(year, month - 1, day);
}

// --- Helper: Get Date at start of day (00:00:00) in local timezone ---
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// --- Helper: Get Date at end of day (23:59:59.999) in local timezone ---
function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// --- Tính khoảng "hôm nay" [00:00:00, 24:00:00) in local timezone ---
export function getTodayRange(): { start: Date; end: Date } {
  const todayStr = getTodayDateString();
  const start = parseDateString(todayStr);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// --- Tính khoảng "tuần này", quy ước tuần bắt đầu từ Thứ 2 (Monday) ---
// Returns range in local timezone
export function getWeekRange(): { start: Date; end: Date } {
  const todayStr = getTodayDateString();
  const today = parseDateString(todayStr);
  const day = today.getDay(); // 0 = CN, 1 = T2, ..., 6 = T7
  const diffToMonday = day === 0 ? 6 : day - 1;
  
  const start = new Date(today);
  start.setDate(today.getDate() - diffToMonday);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  
  return { start, end };
}

// --- Tính khoảng "tháng này" [ngày 1, ngày 1 tháng sau) in local timezone ---
export function getMonthRange(): { start: Date; end: Date } {
  const todayStr = getTodayDateString();
  const today = parseDateString(todayStr);
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return { start, end };
}

// --- Get month range for specific year/month (for calendar navigation) ---
export function getMonthRangeFor(year: number, month: number): { start: Date; end: Date } {
  // month is 1-12
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}

// --- Get all days in a month grid (including prev/next month days for UI) ---
// Returns array of { date: Date; isCurrentMonth: boolean; dateStr: 'YYYY-MM-DD' }
export function getMonthGrid(year: number, month: number): Array<{ date: Date; isCurrentMonth: boolean; dateStr: string }> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  
  // Find first day of grid (Monday of week containing 1st)
  const firstDayOfMonth = start.getDay(); // 0 = Sun, 1 = Mon
  const diffToMonday = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
  
  const gridStart = new Date(start);
  gridStart.setDate(start.getDate() - diffToMonday);
  
  const days: Array<{ date: Date; isCurrentMonth: boolean; dateStr: string }> = [];
  const current = new Date(gridStart);
  
  // Generate 42 days (6 weeks)
  for (let i = 0; i < 42; i++) {
    const dateStr = current.toISOString().slice(0, 10);
    days.push({
      date: new Date(current),
      isCurrentMonth: current.getMonth() === month - 1,
      dateStr,
    });
    current.setDate(current.getDate() + 1);
  }
  
  return days;
}

// --- Get LearningDay records for a date range (for calendar indicators) ---
export async function getLearningDaysInRange(userId: string, start: Date, end: Date) {
  return prisma.learningDay.findMany({
    where: {
      userId,
      date: { gte: start, lt: end },
    },
    select: { date: true },
    orderBy: { date: 'asc' },
  });
}

// --- Get LearningDay records for a specific month ---
export async function getLearningDaysForMonth(userId: string, year: number, month: number) {
  const { start, end } = getMonthRangeFor(year, month);
  return getLearningDaysInRange(userId, start, end);
}

// --- Get StudySession records for a range ---
async function getSessionsInRange(userId: string, start: Date, end: Date) {
  return prisma.studySession.findMany({
    where: {
      userId,
      startTime: { gte: start, lt: end },
    },
    orderBy: { startTime: 'asc' },
  });
}

export async function getTodaySessions(userId: string) {
  const { start, end } = getTodayRange();
  return getSessionsInRange(userId, start, end);
}

export async function getWeekSessions(userId: string) {
  const { start, end } = getWeekRange();
  return getSessionsInRange(userId, start, end);
}

export async function getMonthSessions(userId: string) {
  const { start, end } = getMonthRange();
  return getSessionsInRange(userId, start, end);
}

// --- Get sessions for specific month (for calendar navigation) ---
export async function getMonthSessionsFor(userId: string, year: number, month: number) {
  const { start, end } = getMonthRangeFor(year, month);
  return getSessionsInRange(userId, start, end);
}

// --- Get sessions for an arbitrary week containing `date` (Mon–Sun) ---
export async function getWeekSessionsFor(userId: string, date: Date) {
  const day = date.getDay(); // 0 = CN
  const diffToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - diffToMonday);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return getSessionsInRange(userId, start, end);
}

// --- Get sessions for a single day (YYYY-MM-DD, local timezone) ---
export async function getDaySessions(userId: string, dateStr: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error("Ngày không hợp lệ (định dạng YYYY-MM-DD).");
  }
  const start = parseDateString(dateStr);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return getSessionsInRange(userId, start, end);
}

// --- Tạo 1 buổi học mới ---
// Nếu gắn learningGoalId thì verify goal thuộc về đúng user để chống
// IDOR (user A gắn session vào goal của user B).
export async function createStudySession(userId: string, input: StudySessionInput) {
  if (input.endTime <= input.startTime) {
    throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu.");
  }
  if (input.learningGoalId) {
    const goal = await prisma.learningGoal.findFirst({
      where: { id: input.learningGoalId, userId },
      select: { id: true },
    });
    if (!goal) throw new Error("Lộ trình liên kết không tồn tại.");
  }
  return prisma.studySession.create({
    data: {
      userId,
      title: input.title,
      subject: input.subject,
      topic: input.topic,
      description: input.description,
      learningGoalId: input.learningGoalId,
      startTime: input.startTime,
      endTime: input.endTime,
    },
  });
}

// --- Sửa 1 buổi học ---
// CHỈ lần chuyển trạng thái sang COMPLETED đầu tiên mới ghi XP/streak
// (qua recordLearningActivity) — mở/xem/reschedule/delete không farm
// được XP, và complete lặp lại cũng không cộng thêm.
export async function updateStudySession(
  id: string,
  userId: string,
  data: Partial<StudySessionInput> & { status?: StudySessionStatus; progress?: number }
) {
  const existing = await prisma.studySession.findFirst({ where: { id, userId } });
  if (!existing) return null;

  if (data.learningGoalId) {
    const goal = await prisma.learningGoal.findFirst({
      where: { id: data.learningGoalId, userId },
      select: { id: true },
    });
    if (!goal) throw new Error("Lộ trình liên kết không tồn tại.");
  }

  const updated = await prisma.studySession.update({
    where: { id },
    data,
  });

  const justCompleted = existing.status !== "COMPLETED" && updated.status === "COMPLETED";
  if (justCompleted) {
    const { recordLearningActivity } = await import("@/services/learning-activity.service");
    await recordLearningActivity({
      userId,
      type: "study_session_completed",
      difficulty: "medium",
      scorePercent: 100,
      isFirstCompletion: true,
      sourceId: updated.id,
      sourceType: "study_session",
    });
  }

  return updated;
}

export async function deleteStudySession(id: string, userId: string) {
  const existing = await prisma.studySession.findFirst({ where: { id, userId } });
  if (!existing) return false;

  await prisma.studySession.delete({ where: { id } });
  return true;
}

// --- Get streak info for user ---
export async function getUserStreak(userId: string) {
  const streak = await prisma.streak.findUnique({ where: { userId } });
  if (!streak) return { current: 0, longest: 0, lastLearningDay: null };
  return {
    current: streak.currentStreak,
    longest: streak.longestStreak,
    lastLearningDay: streak.lastLearningDay?.toISOString().slice(0, 10) || null,
  };
}

// --- Generate daily challenge for today ---
export async function generateDailyChallenge(userId: string) {
  const todayStr = getTodayDateString();
  const today = parseDateString(todayStr);
  
  const existing = await prisma.dailyChallenge.findUnique({
    where: { userId_date: { userId, date: today } },
  });
  
  if (existing) return existing;

  // Simple challenge generation - can be enhanced with AI
  const challengeTypes = ['exercise', 'quiz', 'lesson', 'review'] as const;
  const type = challengeTypes[Math.floor(Math.random() * challengeTypes.length)];
  
  const configs = {
    exercise: { target: 5, xp: 40, lxp: 20 },
    quiz: { target: 3, xp: 50, lxp: 20 },
    lesson: { target: 1, xp: 30, lxp: 15 },
    review: { target: 3, xp: 35, lxp: 15 },
  } as const;
  
  const config = configs[type] ?? configs.exercise;

  return prisma.dailyChallenge.create({
    data: {
      userId,
      date: today,
      challengeType: type,
      targetCount: config.target,
      xpReward: config.xp,
      lxpReward: config.lxp,
    },
  });
}

export async function getDailyChallenge(userId: string) {
  const todayStr = getTodayDateString();
  const today = parseDateString(todayStr);
  
  return prisma.dailyChallenge.findUnique({
    where: { userId_date: { userId, date: today } },
  });
}