// ================================================================
// CALENDAR SERVICE
// ================================================================
// Mạch tư duy: đây là nơi DUY NHẤT tính toán khoảng thời gian
// "hôm nay / tuần này / tháng này" — route chỉ gọi đúng hàm tương
// ứng, không tự tính lại ngày giờ (tránh 3 route tự viết 3 công thức
// tính "đầu tuần" khác nhau, dễ lệch nhau).
//
// TIMEZONE: MVP xử lý theo giờ SERVER (múi giờ của máy chạy Node),
// KHÔNG theo múi giờ trình duyệt của học sinh. Với đối tượng học sinh
// Việt Nam và server thường deploy ở khu vực gần (hoặc set TZ=
// Asia/Ho_Chi_Minh trong môi trường production), sai lệch không đáng
// kể — nhưng đây là điểm cần nâng cấp nếu mở rộng ra nhiều múi giờ
// (xem ghi chú "TODO timezone" bên dưới).
// ================================================================

import { prisma } from "@/lib/db/prisma";
import type { StudySessionStatus } from "@/types";

export interface StudySessionInput {
  title: string;
  subject: string;
  topic?: string;
  startTime: Date;
  endTime: Date;
}

// --- Tính khoảng "hôm nay" [00:00:00, 24:00:00) ---
function getTodayRange(): { start: Date; end: Date } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

// --- Tính khoảng "tuần này", quy ước tuần bắt đầu từ Thứ 2 ---
// (khớp UI mẫu trong yêu cầu: "T2 T3 T4 T5 T6 T7 CN")
function getWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0 = CN, 1 = T2, ..., 6 = T7
  // Số ngày cần lùi về để tới Thứ 2: nếu hôm nay là CN (0), lùi 6 ngày
  const diffToMonday = day === 0 ? 6 : day - 1;

  const start = new Date(now);
  start.setDate(now.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

// --- Tính khoảng "tháng này" [ngày 1, ngày 1 tháng sau) ---
function getMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

// Hàm dùng chung cho cả 3 API (today/week/month) — CHỈ khác khoảng
// [start, end) truyền vào, logic query hoàn toàn giống nhau.
async function getSessionsInRange(userId: string, start: Date, end: Date) {
  return prisma.studySession.findMany({
    where: {
      userId,
      startTime: { gte: start, lt: end },
    },
    orderBy: { startTime: "asc" },
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

// --- Tạo 1 buổi học mới ---
export async function createStudySession(userId: string, input: StudySessionInput) {
  if (input.endTime <= input.startTime) {
    throw new Error("Thời gian kết thúc phải sau thời gian bắt đầu.");
  }
  return prisma.studySession.create({
    data: {
      userId,
      title: input.title,
      subject: input.subject,
      topic: input.topic,
      startTime: input.startTime,
      endTime: input.endTime,
    },
  });
}

// --- Sửa 1 buổi học ---
// QUAN TRỌNG: luôn where { id, userId } CÙNG LÚC, không chỉ where { id }
// — đây là điểm chốt chặn user A sửa/xoá lịch của user B. Prisma
// update/delete theo where không khớp sẽ throw lỗi "Record not found",
// route sẽ bắt lỗi này và trả 404 thay vì 200 (xem route.ts).
export async function updateStudySession(
  id: string,
  userId: string,
  data: Partial<StudySessionInput> & { status?: StudySessionStatus; progress?: number }
) {
  const existing = await prisma.studySession.findFirst({ where: { id, userId } });
  if (!existing) return null; // null nghĩa là không tìm thấy HOẶC không thuộc user này

  return prisma.studySession.update({
    where: { id },
    data,
  });
}

export async function deleteStudySession(id: string, userId: string) {
  const existing = await prisma.studySession.findFirst({ where: { id, userId } });
  if (!existing) return false;

  await prisma.studySession.delete({ where: { id } });
  return true;
}

// TODO (timezone): khi có học sinh ở nhiều múi giờ khác nhau, thay
// getTodayRange/getWeekRange/getMonthRange bằng version nhận thêm
// tham số `timezone` (lưu trong User khi đăng ký) và dùng thư viện
// như date-fns-tz để tính đúng ranh giới ngày theo múi giờ đó.
