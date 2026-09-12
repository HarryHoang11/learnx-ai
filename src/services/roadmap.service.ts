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

import { generateJSON } from "@/lib/ai/router";
import { buildRoadmapPrompt } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db/prisma";
import { getSkillProfile } from "@/services/assessment.service";
import type { RoadmapPlan, RoadmapStatus, GoalWithRoadmap } from "@/types";

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

// ================================================================
// MULTI-ROADMAP — quản lý nhiều LearningGoal độc lập của cùng 1 user
// ================================================================
// Mạch tư duy: các hàm PHÍA TRÊN (generateRoadmap, getLatestRoadmap)
// giữ NGUYÊN VẸN, không sửa — vẫn phục vụ /api/roadmap và
// /api/roadmap/generate cũ y hệt trước đây. Các hàm DƯỚI ĐÂY là lớp
// mới, tái sử dụng generateRoadmap() làm lõi sinh plan, chỉ thêm khái
// niệm "danh sách nhiều goal" + "lifecycle" lên trên.
// ================================================================

// % hoàn thành tính từ CHÍNH plan mới nhất của goal đó — đếm số topic
// status="done" / tổng số topic trong toàn bộ các tháng. Đây là dữ
// liệu THẬT lấy từ Roadmap.months đã lưu (không bịa), dù biết hạn chế
// là months JSON không tự cập nhật real-time khi học sinh làm quiz ở
// nơi khác (hạn chế đã có sẵn từ trước, xem TODO trong generateRoadmap).
function computeProgressPercent(plan: RoadmapPlan[]): number {
  const allTopics = plan.flatMap((m) => m.topics);
  if (allTopics.length === 0) return 0;
  const done = allTopics.filter((t) => t.status === "done").length;
  return Math.round((done / allTopics.length) * 100);
}

async function toGoalWithRoadmap(goal: {
  id: string;
  title: string;
  targetMonths: number;
  status: string;
  createdAt: Date;
  subject: string | null;
  targetOutcome: string | null;
  deadline: Date | null;
}): Promise<GoalWithRoadmap> {
  const latestRoadmap = await prisma.roadmap.findFirst({
    where: { learningGoalId: goal.id },
    orderBy: { createdAt: "desc" },
  });
  const plan = latestRoadmap ? (latestRoadmap.months as unknown as RoadmapPlan[]) : null;

  return {
    id: goal.id,
    title: goal.title,
    targetMonths: goal.targetMonths,
    status: goal.status as RoadmapStatus,
    createdAt: goal.createdAt.toISOString(),
    subject: goal.subject,
    targetOutcome: goal.targetOutcome,
    deadline: goal.deadline ? goal.deadline.toISOString() : null,
    progressPercent: plan ? computeProgressPercent(plan) : 0,
    plan,
  };
}

// Danh sách TOÀN BỘ lộ trình (mọi status) của user — dùng cho màn
// "Lộ trình của tôi". ACTIVE lên đầu (đang học thì cần thấy trước),
// trong cùng status thì mới tạo lên đầu.
export async function listGoalsForUser(userId: string): Promise<GoalWithRoadmap[]> {
  const goals = await prisma.learningGoal.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }],
  });

  // status ACTIVE ưu tiên hiển thị trước COMPLETED/ARCHIVED — sort ở
  // tầng application vì Prisma không hỗ trợ "ORDER BY CASE" trực tiếp
  // qua query builder (chỉ có $queryRaw mới làm được, không đáng để
  // dùng raw SQL chỉ cho 1 phép sort đơn giản như thế này).
  const statusRank: Record<string, number> = { ACTIVE: 0, COMPLETED: 1, ARCHIVED: 2 };
  const sorted = [...goals].sort((a, b) => statusRank[a.status] - statusRank[b.status]);

  return Promise.all(sorted.map(toGoalWithRoadmap));
}

// Chi tiết 1 goal — PHẢI kiểm tra userId khớp (không chỉ id) để tránh
// user A xem được goal của user B, cùng pattern với
// api/roadmap/generate (findFirst where id+userId).
export async function getGoalForUser(userId: string, goalId: string): Promise<GoalWithRoadmap | null> {
  const goal = await prisma.learningGoal.findFirst({ where: { id: goalId, userId } });
  if (!goal) return null;
  return toGoalWithRoadmap(goal);
}

// Tạo LearningGoal MỚI + sinh Roadmap đầu tiên ngay — dùng cho nút
// "+ Tạo lộ trình mới". KHÔNG đụng tới goal/roadmap cũ của user, chỉ
// thêm bản ghi mới (LearningGoal.userId không unique, 1 user có thể có
// nhiều LearningGoal — đây chính là thay đổi UX cốt lõi được yêu cầu).
export async function createGoalWithRoadmap(params: {
  userId: string;
  goalTitle: string;
  targetMonths: number;
  subject?: string | null;
  targetOutcome?: string | null;
  deadline?: Date | null;
}): Promise<GoalWithRoadmap> {
  const goal = await prisma.learningGoal.create({
    data: {
      userId: params.userId,
      title: params.goalTitle,
      targetMonths: params.targetMonths,
      subject: params.subject ?? null,
      targetOutcome: params.targetOutcome ?? null,
      deadline: params.deadline ?? null,
    },
  });

  // Tái sử dụng NGUYÊN VẸN generateRoadmap() đã có — không viết lại
  // logic gọi AI/lấy skill profile, chỉ orchestrate thêm bước tạo goal
  // ở trên.
  await generateRoadmap({
    userId: params.userId,
    learningGoalId: goal.id,
    goalTitle: goal.title,
    targetMonths: goal.targetMonths,
  });

  const result = await toGoalWithRoadmap(goal);
  return result;
}

// Đổi trạng thái 1 goal (ACTIVE/COMPLETED/ARCHIVED) — dùng cho "Đánh
// dấu hoàn thành" và có thể mở lại (ACTIVE) sau này nếu UI cần.
// Trả về null nếu goal không tồn tại HOẶC không thuộc user này —
// route gọi hàm này phải tự trả 404 khi nhận null (không phân biệt 2
// trường hợp để tránh lộ thông tin goal của user khác tồn tại hay không).
export async function updateGoalStatus(
  userId: string,
  goalId: string,
  status: RoadmapStatus
): Promise<GoalWithRoadmap | null> {
  const goal = await prisma.learningGoal.findFirst({ where: { id: goalId, userId } });
  if (!goal) return null;

  const updated = await prisma.learningGoal.update({ where: { id: goalId }, data: { status } });
  return toGoalWithRoadmap(updated);
}

// Xoá 1 goal — dựa vào onDelete: Cascade trên FK Roadmap.learningGoalId
// (xem migration 20260906030000_learning_goal_lifecycle) để tự động
// xoá sạch mọi bản ghi Roadmap (lịch sử các lần AI sinh plan) thuộc
// goal này, KHÔNG để lại orphan record. LearningProgress/Attempt hoàn
// toàn KHÔNG bị ảnh hưởng — 2 bảng đó không có foreign key nào trỏ
// tới LearningGoal/Roadmap (đã audit toàn bộ schema + codebase), nên
// lịch sử làm bài/mastery của học sinh được giữ nguyên vẹn dù goal bị
// xoá, đúng yêu cầu "không xóa dữ liệu progress theo roadmap".
export async function deleteGoal(userId: string, goalId: string): Promise<boolean> {
  const goal = await prisma.learningGoal.findFirst({ where: { id: goalId, userId } });
  if (!goal) return false;

  await prisma.learningGoal.delete({ where: { id: goalId } });
  return true;
}

// ================================================================
// SKILL GAP — khoảng cách năng lực cho 1 goal
// ================================================================
// Mạch tư duy: gap = target − current theo từng topic trong plan MỚI
// NHẤT của goal. current lấy từ LearningProgress THẬT (evidence từ
// diagnostic/quiz/exercise qua updateMastery — KHÔNG bao giờ lấy từ
// user tự khai). Topic trong plan chưa có dữ liệu → current null,
// gap = full target + cờ hasData=false để UI ghi rõ "chưa đánh giá"
// thay vì bịa số 0%. Target mặc định 80% (ngưỡng "vững").

export interface SkillGapItem {
  topic: string;
  current: number | null;
  target: number;
  gap: number;
  hasData: boolean;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export const GAP_TARGET_DEFAULT = 80;

export async function getGoalGap(userId: string, goalId: string): Promise<SkillGapItem[] | null> {
  const goal = await prisma.learningGoal.findFirst({ where: { id: goalId, userId } });
  if (!goal) return null;

  const latestRoadmap = await prisma.roadmap.findFirst({
    where: { learningGoalId: goalId },
    orderBy: { createdAt: "desc" },
  });
  if (!latestRoadmap) return [];

  const plan = latestRoadmap.months as unknown as RoadmapPlan[];
  const topics = [...new Set(plan.flatMap((m) => m.topics.map((t) => t.name)))];
  if (topics.length === 0) return [];

  const profile = await getSkillProfile(userId);
  const byTopic = new Map(profile.map((p) => [p.topic.toLowerCase(), p.masteryPercent]));

  return topics
    .map((topic): SkillGapItem => {
      const current = byTopic.get(topic.toLowerCase()) ?? null;
      const gap = current === null ? GAP_TARGET_DEFAULT : Math.max(0, GAP_TARGET_DEFAULT - current);
      return {
        topic,
        current,
        target: GAP_TARGET_DEFAULT,
        gap,
        hasData: current !== null,
        priority: gap >= 50 ? "HIGH" : gap >= 25 ? "MEDIUM" : "LOW",
      };
    })
    .sort((a, b) => b.gap - a.gap);
}
