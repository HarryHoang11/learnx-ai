// ================================================================
// ROADMAP SERVICE
// ================================================================
// Mạch tư duy: đây là nơi hiện thực hoá "AI Learning Path" — bước
// NHẬN mục tiêu (LearningGoal) + hồ sơ năng lực hiện tại
// (LearningProgress qua getSkillProfile), rồi GỌI AI để sinh lộ
// trình theo tháng, có ưu tiên ôn lại các chủ đề yếu trước.
//
// Quan trọng: mỗi lần gọi generateRoadmap() sẽ TẠO BẢN GHI MỚI thay
// vì update bản cũ (xem ghi chú trong schema.prisma) — để giữ lịch
// sử "AI đã điều chỉnh lộ trình bao nhiêu lần", một chi tiết hay để
// demo trước ban giám khảo (mục 16 "AI Learning Path không cố định").
// ================================================================

import { generateJSON } from "@/lib/ai/gemini";
import { buildRoadmapPrompt } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db/prisma";
import { getSkillProfile } from "@/services/assessment.service";
import type { RoadmapPlan } from "@/types";

interface RawMonthFromAI {
  month: number;
  topics: string[];
}

export async function generateRoadmap(params: {
  userId: string;
  learningGoalId: string;
  goalTitle: string;
  targetMonths: number;
}): Promise<RoadmapPlan[]> {
  // Bước 1: lấy hồ sơ năng lực hiện tại, lọc ra các topic đang yếu —
  // đây chính là "input cá nhân hoá" khiến lộ trình của mỗi học sinh
  // khác nhau dù cùng chung 1 mục tiêu.
  const profile = await getSkillProfile(params.userId);
  const weakTopics = profile.filter((p) => p.isWeak).map((p) => p.topic);

  // Bước 2: gọi AI sinh lộ trình thô (chỉ có tên tháng + danh sách topic)
  const prompt = buildRoadmapPrompt(params.goalTitle, params.targetMonths, weakTopics);
  const rawMonths = await generateJSON<RawMonthFromAI[]>({
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
  });

  // Bước 3: gắn trạng thái (done/current/locked) cho từng topic.
  // Quy tắc đơn giản cho MVP: tháng 1 = "current" (đang học), các
  // tháng sau = "locked" (chưa mở khoá) — trạng thái "done" sẽ được
  // service khác cập nhật dần khi học sinh hoàn thành topic thực tế
  // (ngoài phạm vi MVP, để lại comment TODO bên dưới).
  const plan: RoadmapPlan[] = rawMonths.map((m) => ({
    month: m.month,
    label: m.month === 1 ? `Tháng ${m.month} — đang học` : `Tháng ${m.month}`,
    topics: m.topics.map((name) => ({
      name,
      status: m.month === 1 ? "current" : ("locked" as const),
    })),
  }));

  // Bước 4: lưu vào DB dạng JSON (xem lý do trong schema.prisma)
  await prisma.roadmap.create({
    data: {
      userId: params.userId,
      learningGoalId: params.learningGoalId,
      months: plan as unknown as object, // Prisma Json field nhận object thuần
    },
  });

  // TODO (ngoài phạm vi MVP): khi học sinh hoàn thành 1 topic trong
  // tháng hiện tại (vd làm đủ quiz + đạt mastery > ngưỡng), gọi lại
  // generateRoadmap() để AI "đẩy sớm" topic tháng sau lên, đúng như
  // note trong bản kế hoạch gốc ("AI phát hiện bạn tiến bộ nhanh...").

  return plan;
}

// Lấy lộ trình MỚI NHẤT của user (mỗi lần generate tạo bản ghi mới,
// nên phải orderBy createdAt desc rồi lấy 1 bản ghi đầu).
export async function getLatestRoadmap(userId: string): Promise<RoadmapPlan[] | null> {
  const latest = await prisma.roadmap.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  if (!latest) return null;
  return latest.months as unknown as RoadmapPlan[];
}
