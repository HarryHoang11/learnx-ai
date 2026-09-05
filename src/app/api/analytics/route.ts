// ================================================================
// GET /api/analytics
// ================================================================
// Mạch tư duy: /api/progress trả DỮ LIỆU THÔ (số liệu) để vẽ biểu đồ;
// route này trả NHẬN XÉT bằng lời do AI sinh ra (vd "Graph tăng 14%
// trong 7 ngày qua, bạn có thể học Shortest Path tiếp theo") — tách
// riêng vì đây là lời gọi AI (tốn phí, chậm hơn), không nên gọi mỗi
// lần dashboard render lại như /api/progress (chỉ query DB, rẻ).
// Gợi ý dùng: gọi route này khi mount trang Progress, cache vài phút
// ở frontend, KHÔNG gọi lại mỗi lần re-render.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/ai/router";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    // Lấy các Attempt trong 7 ngày gần nhất để AI so sánh xu hướng —
    // KHÔNG lấy toàn bộ lịch sử vì sẽ làm prompt quá dài và nhận xét
    // mất tính "gần đây" (recency) mà tính năng này cần.
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentAttempts = await prisma.attempt.findMany({
      where: { userId, createdAt: { gte: sevenDaysAgo } },
      select: { subject: true, topic: true, isCorrect: true, createdAt: true },
    });

    if (recentAttempts.length === 0) {
      return NextResponse.json<ApiResponse<{ insight: string }>>({
        success: true,
        data: { insight: "Chưa có đủ dữ liệu 7 ngày gần đây để đưa ra nhận xét." },
      });
    }

    // Tóm tắt số liệu thô thành text ngắn gọn TRƯỚC khi đưa cho AI —
    // để AI chỉ cần "diễn giải thành lời" thay vì tự tính toán (tính
    // toán bằng code JS đáng tin cậy hơn để AI tự cộng trừ trong đầu).
    const byTopic = new Map<string, { correct: number; total: number }>();
    for (const a of recentAttempts) {
      const key = `${a.subject} - ${a.topic}`;
      const entry = byTopic.get(key) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (a.isCorrect) entry.correct += 1;
      byTopic.set(key, entry);
    }
    const summaryLines = Array.from(byTopic.entries()).map(
      ([topic, s]) => `${topic}: ${s.correct}/${s.total} câu đúng`
    );

    const insight = await generateText({
      systemPrompt: `Bạn là AI phân tích tiến độ học tập. Dựa trên số liệu 7 ngày gần đây,
viết 1-2 câu nhận xét ngắn gọn, tích cực, chỉ ra CHỦ ĐỀ tiến bộ rõ nhất và
gợi ý 1 chủ đề nên học tiếp theo. Tiếng Việt, giọng thân thiện.`,
      userPrompt: summaryLines.join("\n"),
    });

    return NextResponse.json<ApiResponse<{ insight: string }>>({ success: true, data: { insight } });
  } catch (err) {
    console.error("[api/analytics] Lỗi:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo nhận xét, thử lại sau." },
      { status: 500 }
    );
  }
}
