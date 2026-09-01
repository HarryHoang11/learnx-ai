// ================================================================
// GET /api/progress
// ================================================================
// Mạch tư duy: đây là data nguồn cho màn hình "Tiến độ" (Progress
// dashboard) — gộp 2 nguồn: (1) getSkillProfile() có sẵn từ
// assessment.service.ts (KHÔNG viết lại), và (2) vài số liệu thống
// kê đơn giản tính trực tiếp từ bảng Attempt (streak ngày học liên
// tục, tổng số bài, độ chính xác trung bình).
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getSessionOrDemoUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSkillProfile } from "@/services/assessment.service";
import type { ApiResponse, SkillMasteryPoint } from "@/types";

interface ProgressResponse {
  skillMap: SkillMasteryPoint[];
  totalAttempts: number;
  accuracyPercent: number;
  streakDays: number;
}

export async function GET(req: NextRequest) {
  try {
    const session = getSessionOrDemoUser(req);

    const [skillMap, attempts] = await Promise.all([
      getSkillProfile(session.userId),
      prisma.attempt.findMany({
        where: { userId: session.userId },
        select: { isCorrect: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const totalAttempts = attempts.length;
    const correctCount = attempts.filter((a) => a.isCorrect).length;
    const accuracyPercent = totalAttempts === 0 ? 0 : Math.round((correctCount / totalAttempts) * 100);

    const streakDays = computeStreakDays(attempts.map((a) => a.createdAt));

    return NextResponse.json<ApiResponse<ProgressResponse>>({
      success: true,
      data: { skillMap, totalAttempts, accuracyPercent, streakDays },
    });
  } catch (err) {
    console.error("[api/progress] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy dữ liệu tiến độ, thử lại sau." },
      { status: 500 }
    );
  }
}

// Tính số ngày học LIÊN TỤC gần nhất (streak), dựa trên các ngày có
// ít nhất 1 Attempt. Thuật toán: gom timestamp về "ngày" (bỏ giờ:phút),
// loại trùng, rồi đếm từ hôm nay lùi về trước cho tới khi gặp ngày
// bị "đứt quãng" (thiếu 1 ngày liên tiếp).
function computeStreakDays(timestamps: Date[]): number {
  if (timestamps.length === 0) return 0;

  const uniqueDayStrings = new Set(
    timestamps.map((t) => t.toISOString().slice(0, 10)) // "YYYY-MM-DD"
  );

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (uniqueDayStrings.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1); // lùi về 1 ngày trước
  }

  return streak;
}
