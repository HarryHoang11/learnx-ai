// ================================================================
// PERSONALIZATION SERVICE — lấy dữ liệu thật rồi dựng ngữ cảnh AI
//
// Mạch tư duy: đây là nơi DUY NHẤT đi từ DB sang tầng personalization. Tách
// "đọc DB" (file này) khỏi "diễn giải" (lib/personalization/context.ts) để:
//   - phần diễn giải test được không cần database;
//   - mọi tính năng AI đều lấy ngữ cảnh theo CÙNG một cách.
//
// DATA ISOLATION: mọi hàm nhận `userId` do SERVER xác định qua
// getCurrentUserId() rồi truyền vào — không bao giờ đọc userId từ request.
// ================================================================

import { prisma } from "@/lib/db/prisma";
import {
  buildLearningContext,
  gradeLevelText,
  readGradeLevel,
  suggestDiagnosticSubjects,
  type LearningContext,
  type SkillSignal,
} from "@/lib/personalization/context";
import {
  mergeLearningProfile,
  type LearningGoalDraft,
  type LearningProfile,
} from "@/lib/onboarding/profile";
// Nguồn danh sách lớp theo cấp — dùng chung với onboarding để UI và
// validate không lệch nhau (không hardcode "10/11/12" ở 2 nơi).
import { gradeOptionsFor, isValidGradeForStage } from "@/lib/onboarding/options";
import { getSkillProfile } from "@/services/assessment.service";

/** Mục tiêu đang ACTIVE, sắp theo ưu tiên rồi mới tới mới nhất. */
async function listActiveGoalDrafts(userId: string): Promise<LearningGoalDraft[]> {
  const goals = await prisma.learningGoal.findMany({
    where: { userId, status: "ACTIVE" },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    take: 5,
    select: { title: true, category: true, target: true, deadline: true, priority: true },
  });
  return goals.map((g) => ({
    title: g.title,
    ...(g.category ? { category: g.category } : {}),
    ...(g.target ? { target: g.target } : {}),
    ...(g.deadline ? { deadline: g.deadline.toISOString().slice(0, 10) } : {}),
    ...(g.priority ? { priority: g.priority } : {}),
  }));
}

/** Hồ sơ năng lực thật -> dạng phẳng cho context (lỗi thì coi như chưa có). */
async function listSkillSignals(userId: string): Promise<SkillSignal[]> {
  try {
    const profile = await getSkillProfile(userId);
    return profile.map((p) => ({
      subject: p.subject,
      topic: p.topic,
      masteryPercent: p.masteryPercent,
      isWeak: p.isWeak,
    }));
  } catch (err) {
    // Không để thiếu dữ liệu kỹ năng làm hỏng cả Tutor/Diagnostic.
    console.warn("[personalization] Không đọc được hồ sơ năng lực:", err);
    return [];
  }
}

/**
 * Dựng ngữ cảnh đầy đủ cho 1 user.
 *
 * `options.goals` cho phép truyền sẵn (khi call site đã có danh sách goal, ví
 * dụ roadmap service) để khỏi query lại — cùng kết quả, ít query hơn.
 */
export async function getLearningContext(
  userId: string,
  options: { goals?: LearningGoalDraft[]; language?: "vi" | "en" } = {}
): Promise<LearningContext> {
  const [user, goals, skills] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { learningProfile: true, language: true },
    }),
    options.goals ? Promise.resolve(options.goals) : listActiveGoalDrafts(userId),
    listSkillSignals(userId),
  ]);

  const profile = (user?.learningProfile as LearningProfile | null) ?? null;
  return buildLearningContext({
    profile,
    goals,
    skills,
    language: options.language ?? (user?.language === "en" ? "en" : "vi"),
  });
}

// ------------------------------------------------------------
// GHI HỒ SƠ + ĐỒNG BỘ MỤC TIÊU
// ------------------------------------------------------------

/** Kết quả ghi profile — profile đã lưu + số mục tiêu mới tạo. */
export interface SaveProfileResult {
  profile: LearningProfile;
  createdGoals: number;
}

/**
 * Lưu hồ sơ và ĐỒNG BỘ mục tiêu trong 1 transaction.
 *
 * VÌ SAO 1 TRANSACTION: hồ sơ và mục tiêu là hai mặt của cùng một dữ liệu.
 * Nếu lưu hồ sơ xong mà tạo mục tiêu lỗi, user thấy "đã lưu" nhưng mục tiêu
 * biến mất — trạng thái nửa vời khó chịu hơn cả lỗi rõ ràng.
 *
 * CHỐNG TẠO TRÙNG (yêu cầu §16): mục tiêu từ onboarding được đánh dấu
 * `source = "onboarding"`. Trước khi tạo, hàm đối chiếu với các mục tiêu
 * `source = "onboarding"` đã có; trùng title thì CẬP NHẬT chứ không tạo mới.
 * Nhờ vậy bấm "Hoàn tất" 2 lần (double click, React Strict Mode, retry sau
 * lỗi mạng) cũng không sinh bản ghi trùng. Mục tiêu người dùng tự tạo
 * (`source = "manual"`) không bao giờ bị đụng tới.
 */
export async function saveLearningProfile(
  userId: string,
  incoming: LearningProfile,
  options: { completed: boolean }
): Promise<SaveProfileResult> {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { learningProfile: true },
  });
  const merged = mergeLearningProfile(
    (current?.learningProfile as LearningProfile | null) ?? null,
    incoming
  );

  const createdGoals = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        learningProfile: merged as unknown as object,
        // Chỉ set mốc hoàn tất khi user KHÔNG bỏ qua. Không xoá mốc cũ nếu
        // đã có: onboarding chạy lại không được xoá dấu vết "đã từng hoàn thiện".
        ...(options.completed ? { learningProfileCompletedAt: new Date() } : {}),
      },
    });

    // Không có mục tiêu mới -> khỏi đụng bảng LearningGoal.
    if (!merged.goals?.length) return 0;

    const existing = await tx.learningGoal.findMany({
      where: { userId, source: "onboarding" },
      select: { id: true, title: true },
    });
    const existingIds = new Map(existing.map((g) => [g.title.trim().toLowerCase(), g.id]));
    let created = 0;

    for (const goal of merged.goals) {
      const key = goal.title.trim().toLowerCase();
      const data = {
        title: goal.title,
        // `subject` gán từ môn đầu tiên user quan tâm: đây là dữ liệu user
        // ĐÃ cung cấp, không phải suy diễn. `targetOutcome` (mô tả định tính)
        // và `target` (kết quả đo được) cùng lấy từ ô "kết quả mong muốn".
        subject: merged.subjects?.[0] ?? null,
        targetOutcome: goal.target ?? null,
        target: goal.target ?? null,
        category: goal.category ?? null,
        priority: goal.priority ?? 2,
        deadline: goal.deadline ? new Date(goal.deadline) : null,
        source: "onboarding",
      };

      const existingId = existingIds.get(key);
      if (existingId) {
        await tx.learningGoal.update({ where: { id: existingId }, data });
      } else {
        // `targetMonths` là BẮT BUỘC trong schema (Roadmap dùng nó để chia
        // tháng). Onboarding không hỏi "kết hoạch mấy tháng" vì đó là quyết
        // định của AI, không phải dữ liệu user — nên đặt mặc định 3 tháng,
        // đủ để sinh roadmap hợp lý và user chỉnh được sau ở màn Lộ trình.
        await tx.learningGoal.create({ data: { ...data, userId, targetMonths: 3 } });
        existingIds.set(key, "");
        created += 1;
      }
    }
    return created;
  });

  return { profile: merged, createdGoals };
}

/**
 * Môn nên đánh giá năng lực trước, theo hồ sơ.
 *
 * Trả về danh sách RỐNG khi hồ sơ không có tín hiệu nào — khi đó UI hiển thị
 * danh sách môn đầy đủ như cũ. Tức là hàm này chỉ SẮP XẾP, không chặn.
 */
export async function getSuggestedDiagnosticSubjects(userId: string): Promise<string[]> {
  const context = await getLearningContext(userId);
  return suggestDiagnosticSubjects(context.summary);
}

/** Cấp/lớp dùng cho 1 BÀI KIỂM TRA — tách biệt `currentGrade` của hồ sơ. */
export interface DiagnosticLevel {
  /** Cấp học trong hồ sơ (THCS/THPT/...), null nếu user chưa khai. */
  educationStage: string | null;
  /** Lớp SẼ kiểm tra (diagnosticGrade) — null nghĩa là chưa xác định. */
  grade: string | null;
  /** Câu mô tả trình độ để nhét vào prompt AI. */
  gradeLevel: string | undefined;
  /** Danh sách lớp hợp lệ theo cấp — UI render, KHÔNG hardcode ở frontend. */
  availableGrades: string[];
}

/**
 * Xác định lớp cho bài kiểm tra năng lực (yêu cầu §4 + §12).
 *
 * NGUYÊN TẮC:
 *  1. Nguồn sự thật là `User.learningProfile` trong DB — KHÔNG tin giá trị
 *     client gửi lên (client chỉ được "xin kiểm tra lớp khác").
 *  2. Lớp xin kiểm tra PHẢI hợp lệ với cấp đã khai, mới được dùng; lớp
 *     không hợp lệ rơi về lớp hiện tại của hồ sơ.
 *  3. TUYỆT ĐỐI KHÔNG ghi lại vào hồ sơ — kiểm tra lớp 10 không được đổi
 *     `currentGrade` của người đang học lớp 11 (giữ đúng yêu cầu §12).
 */
export async function resolveDiagnosticLevel(
  userId: string,
  requestedGrade?: string | null
): Promise<DiagnosticLevel> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { learningProfile: true },
  });
  const profile = (user?.learningProfile as LearningProfile | null) ?? null;
  const educationStage = profile?.educationStage ?? null;
  const availableGrades = gradeOptionsFor(educationStage ?? undefined)
    .map((option) => option.value)
    .filter((value) => value !== "OTHER");

  const requested = typeof requestedGrade === "string" ? requestedGrade.trim() : "";
  const validRequested =
    requested !== "" && isValidGradeForStage(educationStage ?? undefined, requested);
  const currentGrade =
    profile?.grade && isValidGradeForStage(educationStage ?? undefined, profile.grade)
      ? profile.grade
      : null;
  const grade = validRequested ? requested : currentGrade;

  return {
    educationStage,
    grade,
    // Câu mô tả trình độ cho prompt, dùng CHUNG helper với profile
    // ("học sinh lớp 10") — không mỗi nơi tự chế một cách nói.
    gradeLevel: gradeLevelText(grade) ?? readGradeLevel(profile),
    availableGrades,
  };
}
