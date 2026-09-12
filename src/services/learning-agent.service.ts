// ================================================================
// LEARNING AGENT SERVICE — AI Learning Agent với Adaptive Planning
// ================================================================
// Mạch tư duy: service này quản lý learning plans, tasks, và adaptive orchestration.
// Agent đọc skill profile, learning history, và tạo kế hoạch học tập cá nhân hóa.
// ================================================================

import { prisma } from "@/lib/db/prisma";
import { generateJSON, generateText } from "@/lib/ai/router";
import { buildAgentPlannerPrompt } from "@/lib/ai/prompts";
import { getSkillProfile } from "@/services/assessment.service";
import { getDueReviews } from "@/services/spaced-repetition.service";
import { recordLearningActivity } from "@/services/learning-activity.service";
import type { LearningAgentPlan, LearningAgentTask } from "@/types";
import type { ActivityType } from "@/lib/constants/xp";

export interface AgentPlanInput {
  userId: string;
  goal: string;
  targetDate?: Date;
  subject?: string;
  preferredHoursPerWeek?: number;
}

export interface AgentTaskInput {
  planId: string;
  userId: string;
  title: string;
  description?: string;
  type: "diagnostic" | "lesson" | "practice" | "review" | "mindmap" | "roadmap" | "reflection";
  topic?: string;
  priority?: number;
  dueDate?: Date;
  metadata?: any;
}

export interface DailyPlan {
  date: Date;
  mainGoal: string;
  tasks: Array<{
    id: string;
    title: string;
    type: string;
    topic?: string;
    estimatedMinutes: number;
    priority: number;
    metadata?: any;
  }>;
  totalEstimatedMinutes: number;
}

// --- 1) CREATE LEARNING AGENT PLAN ---
export async function createAgentPlan(input: AgentPlanInput): Promise<LearningAgentPlan> {
  // Get user's skill profile
  const skillProfile = await getSkillProfile(input.userId);
  
  // Get recent learning history
  const recentActivity = await prisma.learningActivity.findMany({
    where: { userId: input.userId },
    orderBy: { occurredAt: "desc" },
    take: 20,
  });

  // Get current roadmaps
  const roadmaps = await prisma.roadmap.findMany({
    where: { userId: input.userId },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  // Build prompt for AI planner
  const prompt = buildAgentPlannerPrompt({
    goal: input.goal,
    subject: input.subject,
    targetDate: input.targetDate?.toISOString(),
    preferredHoursPerWeek: input.preferredHoursPerWeek ?? 10,
    skillProfile: skillProfile.map(s => ({
      topic: `${s.subject} - ${s.topic}`,
      mastery: s.masteryPercent,
      isWeak: s.isWeak,
    })),
    recentActivity: recentActivity.map(a => ({
      type: a.type,
      topic: a.topic || "",
      subject: a.subject || "",
      occurredAt: a.occurredAt,
    })),
    currentRoadmaps: roadmaps.map(r => r.months),
  });

  // Generate plan using AI
  const aiPlan = await generateJSON<{
    title: string;
    phases: Array<{
      phase: number;
      title: string;
      durationWeeks: number;
      focus: string;
      tasks: Array<{
        title: string;
        type: string;
        topic?: string;
        description?: string;
        estimatedMinutes: number;
        priority: number;
      }>;
    }>;
  }>({
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
    jsonMode: true,
  });

  // Create plan in database
  const plan = await prisma.learningAgentPlan.create({
    data: {
      userId: input.userId,
      title: aiPlan.title,
      goal: input.goal,
      status: "active",
      startDate: new Date(),
      targetDate: input.targetDate,
      currentPhase: 1,
      metadata: {
        phases: aiPlan.phases,
        skillProfileSnapshot: JSON.parse(JSON.stringify(skillProfile)),
      },
    },
  });

  // Create tasks for phase 1
  if (aiPlan.phases.length > 0) {
    const phase1 = aiPlan.phases[0];
    for (const task of phase1.tasks) {
      await prisma.learningAgentTask.create({
        data: {
          planId: plan.id,
          userId: input.userId,
          title: task.title,
          description: task.description,
          type: task.type as any,
          topic: task.topic,
          priority: task.priority,
          estimatedMinutes: task.estimatedMinutes,
          status: "pending",
          metadata: { phase: 1, focus: phase1.focus },
        },
      });
    }
  }

  return plan as LearningAgentPlan;
}

// --- 2) GET DAILY PLAN ---
export async function getDailyPlan(userId: string, date: Date = new Date()): Promise<DailyPlan> {
  // Get active plan
  const activePlan = await prisma.learningAgentPlan.findFirst({
    where: { userId, status: "active" },
    include: {
      tasks: {
        where: { status: { in: ["pending", "in_progress"] } },
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
        take: 10,
      },
    },
  });

  if (!activePlan) {
    return {
      date,
      mainGoal: "Chưa có kế hoạch học tập",
      tasks: [],
      totalEstimatedMinutes: 0,
    };
  }

  // Get due reviews
  const dueReviews = await getDueReviews(userId, 5);
  
  // Build daily tasks
  const tasks = [
    // Add plan tasks
    ...activePlan.tasks.map(t => ({
      id: t.id,
      title: t.title,
      type: t.type,
      topic: t.topic || undefined,
      estimatedMinutes: t.estimatedMinutes || 30,
      priority: t.priority,
      metadata: t.metadata,
    })),
    // Add review tasks
    ...dueReviews.map(r => ({
      id: `review-${r.id}`,
      title: `Ôn tập: ${r.topic}${r.concept ? ` - ${r.concept}` : ""}`,
      type: "review",
      topic: r.topic,
      estimatedMinutes: 10,
      priority: 100, // High priority for overdue
      metadata: { reviewItemId: r.id, overdue: r.nextReviewAt && r.nextReviewAt < new Date() },
    })),
  ];

  // Sort by priority
  tasks.sort((a, b) => b.priority - a.priority);

  // Limit to reasonable daily workload
  const dailyTasks = tasks.slice(0, 8);
  const totalMinutes = dailyTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  return {
    date,
    mainGoal: activePlan.goal,
    tasks: dailyTasks,
    totalEstimatedMinutes: totalMinutes,
  };
}

// --- 3) GET AGENT PLAN ---
export async function getAgentPlan(userId: string): Promise<LearningAgentPlan | null> {
  const plan = await prisma.learningAgentPlan.findFirst({
    where: { userId, status: "active" },
    include: {
      tasks: {
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      },
    },
  });
  return plan as LearningAgentPlan | null;
}

// --- 4) GET ALL AGENT PLANS ---
export async function getAgentPlans(userId: string): Promise<LearningAgentPlan[]> {
  const plans = await prisma.learningAgentPlan.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      tasks: {
        orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      },
    },
  });
  return plans as LearningAgentPlan[];
}

// --- 5) UPDATE TASK STATUS ---
export async function updateTaskStatus(params: {
  taskId: string;
  userId: string;
  status: "pending" | "in_progress" | "completed" | "skipped" | "cancelled";
}): Promise<LearningAgentTask> {
  const task = await prisma.learningAgentTask.findFirst({
    where: { id: params.taskId, userId: params.userId },
    include: { plan: true },
  });

  if (!task) throw new Error("Task not found");

  // Deduplication: if task was already completed, don't award XP again
  if (task.status === "completed" && params.status === "completed") {
    // Status hasn't changed from completed — return without awarding XP
    return task as LearningAgentTask;
  }

  const updated = await prisma.learningAgentTask.update({
    where: { id: params.taskId },
    data: {
      status: params.status,
      completedAt: params.status === "completed" ? new Date() : null,
    },
  });

  // If completed, record learning activity and check for phase progression
  if (params.status === "completed") {
    await recordLearningActivity({
      userId: params.userId,
      type: mapTaskTypeToActivity(task.type),
      difficulty: "medium",
      isFirstCompletion: true,
      sourceId: task.id,
      sourceType: "agent_task",
      metadata: { taskType: task.type, taskTitle: task.title },
    });

    // Check if all tasks in current phase are completed
    await checkPhaseProgression(task.planId);
  }

  return updated as LearningAgentTask;
}

// --- 6) CHECK PHASE PROGRESSION ---
async function checkPhaseProgression(planId: string): Promise<void> {
  const plan = await prisma.learningAgentPlan.findUnique({
    where: { id: planId },
    include: { tasks: true },
  });

  if (!plan) return;

  const metadata = plan.metadata as any;
  const phases = metadata?.phases || [];
  const currentPhase = plan.currentPhase;

  if (currentPhase >= phases.length) return;

  const currentPhaseTasks = plan.tasks.filter(t => (t.metadata as any)?.phase === currentPhase);
  const pendingTasks = currentPhaseTasks.filter(t => t.status === "pending" || t.status === "in_progress");

  if (pendingTasks.length === 0 && currentPhaseTasks.length > 0) {
    // All tasks in current phase completed - advance to next phase
    const nextPhase = currentPhase + 1;
    
    await prisma.learningAgentPlan.update({
      where: { id: planId },
      data: { currentPhase: nextPhase },
    });

    // Create tasks for next phase
    if (nextPhase <= phases.length) {
      const nextPhaseData = phases[nextPhase - 1];
      for (const task of nextPhaseData.tasks) {
        await prisma.learningAgentTask.create({
          data: {
            planId,
            userId: plan.userId,
            title: task.title,
            description: task.description,
            type: task.type as any,
            topic: task.topic,
            priority: task.priority,
            estimatedMinutes: task.estimatedMinutes,
            status: "pending",
            metadata: { phase: nextPhase, focus: nextPhaseData.focus },
          },
        });
      }
    }
  }
}

// --- 7) ADAPT PLAN BASED ON PERFORMANCE ---
export async function adaptPlan(userId: string): Promise<LearningAgentPlan | null> {
  const plan = await getAgentPlan(userId);
  if (!plan) return null;

  // Get recent performance
  const recentActivity = await prisma.learningActivity.findMany({
    where: { userId },
    orderBy: { occurredAt: "desc" },
    take: 30,
  });

  const skillProfile = await getSkillProfile(userId);
  const weakTopics = skillProfile.filter(s => s.isWeak).map(s => s.topic);

  // Check if plan needs adaptation
  const needsAdaptation = weakTopics.length > 0 && 
    !plan.tasks?.some(t => weakTopics.some(w => t.topic?.includes(w)));

  if (needsAdaptation) {
    // Add review tasks for weak topics
    for (const topic of weakTopics.slice(0, 3)) {
      await prisma.learningAgentTask.create({
        data: {
          planId: plan.id,
          userId,
          title: `Ôn tập lại: ${topic}`,
          description: `Chủ đề này cần củng cố thêm dựa trên kết quả gần đây`,
          type: "review",
          topic,
          priority: 90,
          estimatedMinutes: 20,
          status: "pending",
          metadata: { adaptive: true, reason: "weak_topic", originalTopic: topic },
        },
      });
    }
  }

  return plan;
}

// --- 8) PAUSE/RESUME PLAN ---
export async function pausePlan(planId: string, userId: string): Promise<LearningAgentPlan> {
  const plan = await prisma.learningAgentPlan.update({
    where: { id: planId, userId },
    data: { status: "paused" },
  });
  return plan as LearningAgentPlan;
}

export async function resumePlan(planId: string, userId: string): Promise<LearningAgentPlan> {
  const plan = await prisma.learningAgentPlan.update({
    where: { id: planId, userId },
    data: { status: "active" },
  });
  return plan as LearningAgentPlan;
}

// --- 9) COMPLETE PLAN ---
export async function completePlan(planId: string, userId: string): Promise<LearningAgentPlan> {
  const existingPlan = await prisma.learningAgentPlan.findUnique({
    where: { id: planId, userId },
    select: { status: true },
  });

  if (!existingPlan) throw new Error("Plan not found");

  // Deduplication: if plan was already completed, don't award XP again
  if (existingPlan.status === "completed") {
    return existingPlan as unknown as LearningAgentPlan;
  }

  const plan = await prisma.learningAgentPlan.update({
    where: { id: planId, userId },
    data: { status: "completed" },
  });

  // Record completion activity
  await recordLearningActivity({
    userId,
    type: "roadmap_completed",
    difficulty: "hard",
    isFirstCompletion: true,
    sourceId: planId,
    sourceType: "roadmap",
  });

  // Check achievement
  // Achievement check would be handled by achievement service

  return plan as LearningAgentPlan;
}

// --- 10) DELETE PLAN ---
export async function deletePlan(planId: string, userId: string): Promise<void> {
  await prisma.learningAgentPlan.delete({
    where: { id: planId, userId },
  });
}

// --- HELPER: MAP TASK TYPE TO ACTIVITY ---
function mapTaskTypeToActivity(type: string): ActivityType {
  const map: Record<string, ActivityType> = {
    diagnostic: "diagnostic_completed",
    lesson: "lesson_complete",
    practice: "exercise_medium",
    review: "review_completed",
    mindmap: "mindmap_created",
    roadmap: "roadmap_completed",
    reflection: "reflection_completed",
  };
  return map[type] || "task_completed";
}