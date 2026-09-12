// ================================================================
// GET /api/next-action — AI-powered "What should I do next?"
// ================================================================
// Mạch tư duy: endpoint này tổng hợp mọi tín hiệu học tập (skill gaps,
// due reviews, streak, daily challenge, lộ trình đang học) và dùng AI
// sinh ra 1 danh sách hành động (action) cho học sinh — trả lời trực
// tiếp câu hỏi "Hôm nay mình nên học gì?".
//
// Dùng strategy pattern: mỗi "action type" (review, practice, roadmap,
// mindmap, tutor) có 1 factory riêng, dễ mở rộng thêm action mới.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getSkillProfile } from "@/services/assessment.service";
import { getDueReviews, getOverdueReviews } from "@/services/spaced-repetition.service";
import { getDailyPlan } from "@/services/learning-agent.service";
import { getCurrentStreak, getUserProgress } from "@/services/learning-activity.service";
import { generateJSON } from "@/lib/ai/router";
import type { ApiResponse } from "@/types";
import type { ReviewItemData } from "@/services/spaced-repetition.service";

export type ActionType =
  | "review"
  | "practice"
  | "roadmap"
  | "mindmap"
  | "tutor"
  | "streak"
  | "diagnostic";

export interface NextAction {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  priority: number;
  subject: string;
  topic?: string;
  estimatedMinutes?: number;
  streakable: boolean;
  cta: string;
  href: string;
}

interface NextActionContext {
  skillMap: { subject: string; topic: string; masteryPercent: number; isWeak: boolean }[];
  dueReviews: { id: string; topic: string; concept?: string; subject?: string }[];
  overdueCount: number;
  activeGoal: { id: string; title: string; subject: string | null } | null;
  todayPlan: { mainGoal: string; tasks: { type: string; title: string; topic?: string }[]; totalEstimatedMinutes: number } | null;
  streakCurrent: number;
  streakLongest: number;
  hasLearningData: boolean;
  accuracyPercent: number;
}

// --- HÀM CHÍNH ---
export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const context = await buildContext(userId);
    const actions = buildActionsFromRules(context);
    const enriched = await enrichWithAI(actions, context);

    return NextResponse.json<ApiResponse<{ actions: NextAction[] }>>({
      success: true,
      data: { actions: enriched },
    });
  } catch (err) {
    console.error("[api/next-action] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy gợi ý hành động, thử lại sau." },
      { status: 500 }
    );
  }
}

// --- 1) THU THẬP CONTEXT TỪ CƠ SỞ DỮ LIỆU ---
async function buildContext(userId: string): Promise<NextActionContext> {
  const [skillMap, dueReviews, overdueReviews, todayPlan, streakData, progress] = await Promise.all([
    getSkillProfile(userId),
    getDueReviews(userId, 5),
    getOverdueReviews(userId),
    getDailyPlan(userId),
    getCurrentStreak(userId),
    getUserProgress(userId),
  ]);

  const activeGoal = await prisma.learningGoal.findFirst({
    where: { userId, status: "ACTIVE" },
    select: { id: true, title: true, subject: true },
  });

  const attempts = await prisma.attempt.findMany({
    where: { userId },
    select: { isCorrect: true },
  });

  const totalAttempts = attempts.length;
  const correct = attempts.filter((a) => a.isCorrect).length;
  const accuracyPercent = totalAttempts === 0 ? 0 : Math.round((correct / totalAttempts) * 100);

  return {
    skillMap: skillMap.map((s) => ({
      subject: s.subject,
      topic: s.topic,
      masteryPercent: s.masteryPercent,
      isWeak: s.isWeak,
    })),
    dueReviews: dueReviews.map((r: ReviewItemData) => ({
      id: r.id,
      topic: r.topic,
      concept: r.concept,
      subject: r.subject,
    })),
    overdueCount: overdueReviews.length,
    activeGoal: activeGoal
      ? { id: activeGoal.id, title: activeGoal.title, subject: activeGoal.subject }
      : null,
    todayPlan: todayPlan
      ? {
          mainGoal: todayPlan.mainGoal,
          tasks: todayPlan.tasks.map((t) => ({ type: t.type, title: t.title, topic: t.topic || undefined })),
          totalEstimatedMinutes: todayPlan.totalEstimatedMinutes,
        }
      : null,
    streakCurrent: streakData.current,
    streakLongest: streakData.longest,
    hasLearningData: totalAttempts > 0,
    accuracyPercent,
  };
}

// --- 2) QUY TẮC TẠO ACTION (Rule-based, không cần AI) ---
function buildActionsFromRules(ctx: NextActionContext): NextAction[] {
  const actions: NextAction[] = [];

  // Priority 99: Overdue reviews — urgent
  if (ctx.overdueCount > 0) {
    actions.push({
      id: "overdue-reviews",
      type: "review",
      title: "Bạn có ôn tập trễ hạn",
      description: `${ctx.overdueCount} chủ đề cần ôn tập đã qua hạn — số ngày càng tích lũy, kiến thức càng dễ quên.`,
      priority: 99,
      subject: "Ôn tập",
      estimatedMinutes: ctx.overdueCount * 5,
      streakable: true,
      cta: "Ôn ngay",
      href: "/practice",
    });
  }

  // Priority 90: Due reviews for today
  if (ctx.dueReviews.length > 0) {
    const topics = ctx.dueReviews.slice(0, 3).map((r) => r.topic).join(", ");
    actions.push({
      id: "due-reviews",
      type: "review",
      title: "Ôn tập hôm nay",
      description: `Hãy ôn lại: ${topics}.`,
      priority: 90,
      subject: "Ôn tập",
      estimatedMinutes: ctx.dueReviews.length * 3,
      streakable: true,
      cta: "Ôn ngay",
      href: "/practice",
    });
  }

  // Priority 80: Weak skills — need intervention
  const weakTopics = ctx.skillMap.filter((s) => s.isWeak);
  if (weakTopics.length > 0) {
    const weakest = weakTopics.sort((a, b) => a.masteryPercent - b.masteryPercent)[0];
    actions.push({
      id: `weak-${weakest.subject}-${weakest.topic}`,
      type: "practice",
      title: `Củng cố: ${weakest.topic}`,
      description: `Mastery ${weakest.masteryPercent}% — dưới ngưỡng 65%, cần luyện tập thêm.`,
      priority: 80,
      subject: weakest.subject,
      topic: weakest.topic,
      estimatedMinutes: 15,
      streakable: true,
      cta: "Luyện tập ngay",
      href: `/practice?subject=${encodeURIComponent(weakest.subject)}`,
    });
  }

  // Priority 70: Daily challenge streak
  if (ctx.streakCurrent === 0 && ctx.hasLearningData) {
    actions.push({
      id: "streak-recovery",
      type: "streak",
      title: "Hôm nay là ngày mới",
      description: `Chuỗi học của bạn dừng lại ở ${ctx.streakLongest} ngày. Hãy bắt đầu lại ngay!`,
      priority: 70,
      subject: "Toàn hợp",
      estimatedMinutes: 5,
      streakable: true,
      cta: "Bắt đầu ngay",
      href: "/tutor",
    });
  }

  // Priority 60: Continue active roadmap
  if (ctx.activeGoal) {
    actions.push({
      id: `continue-${ctx.activeGoal.id}`,
      type: "roadmap",
      title: `Ch tiếp: ${ctx.activeGoal.title}`,
      description: `Hãy tiếp tục học theo lộ trình của bạn.`,
      priority: 60,
      subject: ctx.activeGoal.subject || "Chung",
      estimatedMinutes: 20,
      streakable: true,
      cta: "Xem lộ trình",
      href: "/roadmap",
    });
  }

  // Priority 50: Today's agent plan tasks
  if (ctx.todayPlan && ctx.todayPlan.tasks.length > 0) {
    const mainTask = ctx.todayPlan.tasks[0];
    actions.push({
      id: "today-plan",
      type: mainTask.type as ActionType,
      title: `Kế hoạch hôm nay: ${mainTask.title}`,
      description: ctx.todayPlan.mainGoal,
      priority: 50,
      subject: mainTask.topic || "Chung",
      estimatedMinutes: ctx.todayPlan.totalEstimatedMinutes,
      streakable: true,
      cta: "Làm ngay",
      href: mainTask.type === "review" ? "/practice" : "/tutor",
    });
  }

  // Priority 40: Create first mindmap if they have documents but no mindmaps
  if (ctx.hasLearningData && ctx.skillMap.length > 0) {
    const masteredTopic = ctx.skillMap
      .filter((s) => s.masteryPercent >= 80)
      .sort((a, b) => b.masteryPercent - a.masteryPercent)[0];
    if (masteredTopic) {
      actions.push({
        id: "create-mindmap",
        type: "mindmap",
        title: `Tạo mind map: ${masteredTopic.topic}`,
        description: `Bạn đã thành thạo ${masteredTopic.topic} (${masteredTopic.masteryPercent}%) — hãy tạo sơ đồ để củng cố!`,
        priority: 40,
        subject: masteredTopic.subject,
        topic: masteredTopic.topic,
        estimatedMinutes: 10,
        streakable: false,
        cta: "Tạo mind map",
        href: "/mindmap",
      });
    }
  }

  // Priority 30: Low accuracy -> diagnostic
  if (ctx.hasLearningData && ctx.accuracyPercent < 60) {
    actions.push({
      id: "diagnostic",
      type: "diagnostic",
      title: "Làm lại kiểm tra năng lực",
      description: `Độ chính xác chỉ ở ${ctx.accuracyPercent}% — thời gian cập nhật hồ sơ năng lực của bạn.`,
      priority: 30,
      subject: "Chung",
      estimatedMinutes: 10,
      streakable: false,
      cta: "Làm bài kiểm tra",
      href: "/diagnostic",
    });
  }

  // Priority 20: Ask tutor
  actions.push({
    id: "ask-tutor",
    type: "tutor",
    title: "Hỏi AI Gia sư",
    description: "Bạn đang thắc mắc về bài nào đó? Hãy hỏi AI để được giải thích tận tình.",
    priority: 20,
    subject: "Chung",
    estimatedMinutes: 5,
    streakable: false,
    cta: "Mở AI Gia sư",
    href: "/tutor",
  });

  return actions.sort((a, b) => b.priority - a.priority);
}

// --- 3) AI ENRICHMENT — tinh chỉnh mô tả và title cho action ---
async function enrichWithAI(
  actions: NextAction[],
  ctx: NextActionContext
): Promise<NextAction[]> {
  if (actions.length === 0) return actions;

  try {
    const actionDescriptions = actions
      .map((a) => `${a.title}: ${a.description}`)
      .join("\n");

    const contextSummary = `Skill map: ${ctx.skillMap.map((s) => `${s.subject}/${s.topic} ${s.masteryPercent}%`).join(", ")}
Due reviews: ${ctx.dueReviews.length}
Overdue: ${ctx.overdueCount}
Streak: ${ctx.streakCurrent} (longest ${ctx.streakLongest})
Accuracy: ${ctx.accuracyPercent}%
Has learning data: ${ctx.hasLearningData}
Active goal: ${ctx.activeGoal?.title ?? "none"}
Today plan: ${ctx.todayPlan?.mainGoal ?? "none"}`;

    const enriched = await generateJSON<{
      actions: Array<{
        id: string;
        title: string;
        description: string;
      }>;
    }>({
      systemPrompt: `Bạn là AI trợ lý học tập cá nhân cho học sinh. Nhiệm vụ của bạn là viết lại tiêu đề (title) và mô tả (description) cho danh sách hành động học tập một cách ngắn gọn, tích cực, và cá nhân hóa.

Quy tắc:
- Giữ nguyên id của mỗi action.
- Title: ngắn gọn, tối đa 50 ký tự, không emoji.
- Description: 1-2 câu, tối đa 120 ký tự, giọng vui tích cực, nhắc đến lợi ích cụ thể.
- Nếu học sinh chưa có dữ liệu học tập (hasLearningData=false), hãy đề xuất làm bài kiểm tra năng lực.
- Trả về JSON chuẩn với key "actions".`,
      userPrompt: `Context:\n${contextSummary}\n\nCurrent actions to refine:\n${actionDescriptions}`,
      jsonMode: true,
    });

    return actions.map((a) => {
      const matched = enriched.actions.find((e) => e.id === a.id);
      return matched
        ? { ...a, title: matched.title, description: matched.description }
        : a;
    });
  } catch (err) {
    console.error("[api/next-action] AI enrichment failed:", err);
    return actions;
  }
}
