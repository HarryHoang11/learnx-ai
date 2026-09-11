// ================================================================
// ROADMAP ↔ RESOURCE/EXERCISE — gắn tài liệu & bài tập vào task
// ================================================================
// Mạch tư duy: RoadmapPlan lưu trong JSON (months → topics) nên
// "task" được định danh bằng (learningGoalId, topic) — KHÔNG có
// bảng task riêng (tránh duplicate model). RoadmapResource là bảng
// nối: mỗi dòng gắn 1 resource HOẶC 1 exercise vào đúng 1 topic của
// 1 goal. Mọi thao tác đều verify goal thuộc về user (chống IDOR).

import { prisma } from "@/lib/db/prisma";
import { getSkillProfile } from "@/services/assessment.service";
import type { ApiResponse } from "@/types";

async function assertOwnGoal(userId: string, learningGoalId: string) {
  const goal = await prisma.learningGoal.findFirst({
    where: { id: learningGoalId, userId },
    select: { id: true },
  });
  if (!goal) throw new Error("Không tìm thấy lộ trình.");
}

export async function listRoadmapLinks(
  userId: string,
  learningGoalId: string,
  topic?: string
): Promise<ApiResponse<any>> {
  try {
    await assertOwnGoal(userId, learningGoalId);
    const links = await prisma.roadmapResource.findMany({
      where: { learningGoalId, ...(topic && { topic }) },
      orderBy: { createdAt: "asc" },
      include: {
        resource: {
          select: {
            id: true,
            title: true,
            type: true,
            url: true,
            subject: true,
            topic: true,
            difficulty: true,
            ratingSum: true,
            ratingCount: true,
            qualityScore: true,
          },
        },
        exercise: {
          select: { id: true, title: true, subject: true, topic: true, difficulty: true },
        },
      },
    });
    return { success: true, data: { links } };
  } catch (err) {
    console.error("[listRoadmapLinks] Error:", err);
    const message = err instanceof Error ? err.message : "Không thể tải liên kết.";
    return { success: false, error: message };
  }
}

export async function linkRoadmapItem(
  userId: string,
  learningGoalId: string,
  topic: string,
  target: { resourceId?: string; exerciseId?: string; kind?: string }
): Promise<ApiResponse<any>> {
  try {
    if (!topic.trim()) return { success: false, error: "Thiếu topic." };
    const { resourceId, exerciseId, kind } = target;
    // Đúng 1 trong 2 loại link — chống dòng nối "treo" không trỏ đâu.
    if ((resourceId ? 1 : 0) + (exerciseId ? 1 : 0) !== 1) {
      return { success: false, error: "Mỗi liên kết cần đúng 1 resourceId hoặc 1 exerciseId." };
    }
    await assertOwnGoal(userId, learningGoalId);

    if (resourceId) {
      const r = await prisma.learningResource.findUnique({
        where: { id: resourceId },
        select: { id: true, status: true },
      });
      if (!r || r.status !== "ACTIVE") return { success: false, error: "Tài liệu không tồn tại." };
      const dup = await prisma.roadmapResource.findFirst({
        where: { learningGoalId, topic, resourceId },
        select: { id: true },
      });
      if (dup) return { success: false, error: "Tài liệu này đã được gắn vào task." };
    } else {
      const e = await prisma.exercise.findUnique({ where: { id: exerciseId }, select: { id: true } });
      if (!e) return { success: false, error: "Bài tập không tồn tại." };
      const dup = await prisma.roadmapResource.findFirst({
        where: { learningGoalId, topic, exerciseId },
        select: { id: true },
      });
      if (dup) return { success: false, error: "Bài tập này đã được gắn vào task." };
    }

    const created = await prisma.roadmapResource.create({
      data: { learningGoalId, topic, kind: kind || (exerciseId ? "PRACTICE" : "LEARN"), resourceId, exerciseId },
    });
    return { success: true, data: created };
  } catch (err) {
    console.error("[linkRoadmapItem] Error:", err);
    const message = err instanceof Error ? err.message : "Không thể gắn liên kết.";
    return { success: false, error: message };
  }
}

export async function unlinkRoadmapItem(
  userId: string,
  learningGoalId: string,
  linkId: string
): Promise<ApiResponse<any>> {
  try {
    await assertOwnGoal(userId, learningGoalId);
    const link = await prisma.roadmapResource.findFirst({
      where: { id: linkId, learningGoalId },
      select: { id: true },
    });
    if (!link) return { success: false, error: "Không tìm thấy liên kết." };
    await prisma.roadmapResource.delete({ where: { id: linkId } });
    return { success: true, data: { deleted: true } };
  } catch (err) {
    console.error("[unlinkRoadmapItem] Error:", err);
    const message = err instanceof Error ? err.message : "Không thể gỡ liên kết.";
    return { success: false, error: message };
  }
}

export interface RecommendationStep {
  order: number;
  title: string;
  detail: string;
  kind: "REVIEW" | "READ" | "PRACTICE" | "ASSESS";
}

// Gợi ý học tập theo skill profile THẬT + nội dung THẬT trong DB.
// Xác định (deterministic, không gọi AI tốn phí mỗi click): bước đi
// từ mastery hiện tại của topic, còn resource/exercise cụ thể lấy
// từ catalog/bank đã lọc đúng (subject, topic, độ khó phù hợp).
export async function recommendForTopic(
  userId: string,
  learningGoalId: string,
  topic: string
): Promise<ApiResponse<any>> {
  try {
    await assertOwnGoal(userId, learningGoalId);
    const t = topic.trim();
    if (!t) return { success: false, error: "Thiếu topic." };

    const profile = await getSkillProfile(userId);
    const match = profile.find(
      (p) => p.topic.toLowerCase() === t.toLowerCase() || p.topic.toLowerCase().includes(t.toLowerCase())
    );
    const mastery = match?.masteryPercent ?? null;

    const [resources, exercises] = await Promise.all([
      prisma.learningResource.findMany({
        where: { status: "ACTIVE", topic: { equals: t, mode: "insensitive" } },
        orderBy: { qualityScore: "desc" },
        take: 5,
        select: { id: true, title: true, type: true, url: true, difficulty: true, ratingSum: true, ratingCount: true, qualityScore: true },
      }),
      prisma.exercise.findMany({
        where: { topic: { equals: t, mode: "insensitive" } },
        orderBy: { difficulty: "asc" },
        take: 10,
        select: { id: true, title: true, difficulty: true, subject: true, topic: true },
      }),
    ]);

    const steps: RecommendationStep[] = [];
    let order = 1;
    if (mastery === null) {
      steps.push({
        order: order++,
        title: "Làm bài kiểm tra năng lực",
        detail: `Chưa có dữ liệu mastery cho "${t}" — hãy làm diagnostic để AI biết bạn đang ở đâu.`,
        kind: "ASSESS",
      });
    } else if (mastery < 40) {
      steps.push(
        { order: order++, title: "Ôn lại kiến thức cơ bản", detail: `Mastery ${mastery}% — bắt đầu từ tài liệu nền tảng bên dưới.`, kind: "REVIEW" },
        { order: order++, title: "Đọc giải thích trực quan", detail: "Ưu tiên video/bài viết trước khi làm bài.", kind: "READ" },
        { order: order++, title: "Làm 3 bài Easy", detail: "Chắc tay phần cơ bản trước.", kind: "PRACTICE" },
        { order: order++, title: "Làm 2 bài Medium", detail: "Nâng dần độ khó khi đã đúng liên tục.", kind: "PRACTICE" },
        { order: order++, title: "Re-assessment", detail: "Kiểm tra lại để cập nhật mastery.", kind: "ASSESS" }
      );
    } else if (mastery < 70) {
      steps.push(
        { order: order++, title: "Luyện 2 bài Medium", detail: `Mastery ${mastery}% — củng cố phần còn hổng.`, kind: "PRACTICE" },
        { order: order++, title: "Thử 1 bài Hard", detail: "Kiểm tra giới hạn hiện tại.", kind: "PRACTICE" },
        { order: order++, title: "Ôn tập ngắt quãng", detail: "Dùng Review để giữ kiến thức lâu.", kind: "REVIEW" }
      );
    } else {
      steps.push(
        { order: order++, title: "Chinh phục bài Hard", detail: `Mastery ${mastery}% — sẵn sàng cho thử thách khó.`, kind: "PRACTICE" },
        { order: order++, title: "Dạy lại cho người khác", detail: "Giải thích lại khái niệm bằng lời của bạn để khóa kiến thức.", kind: "REVIEW" }
      );
    }

    const easy = exercises.filter((e) => e.difficulty === "easy").slice(0, 3);
    const medium = exercises.filter((e) => e.difficulty === "medium").slice(0, 2);
    const hard = exercises.filter((e) => e.difficulty === "hard").slice(0, 2);

    return {
      success: true,
      data: {
        topic: t,
        mastery,
        steps,
        resources: resources.map((r) => ({
          ...r,
          averageRating: r.ratingCount > 0 ? r.ratingSum / r.ratingCount : 0,
        })),
        practice: { easy, medium, hard },
      },
    };
  } catch (err) {
    console.error("[recommendForTopic] Error:", err);
    const message = err instanceof Error ? err.message : "Không thể tạo gợi ý.";
    return { success: false, error: message };
  }
}
