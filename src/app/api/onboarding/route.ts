// ================================================================
// /api/onboarding — trạng thái + hành động của Welcome Experience
// ================================================================
// Mạch tư duy: Welcome Experience cần đọc/ghi trạng thái onboarding từ
// nhiều nơi (Welcome, Quick Setup, Dashboard, proxy). Gom vào 1 route
// thay vì rải nhiều endpoint nhỏ để client chỉ cần nhớ 1 URL.
//
//   GET  -> trạng thái hiện tại (status, welcomeSeenAt, profile...)
//   PATCH -> { action, ... }  xem OnboardingAction trong lib/onboarding/state
//
// Route này KHÔNG bao giờ chặn người dùng: mọi hành động đều trả 200 kể cả
// khi đã ở trạng thái đích (idempotent) — nếu lỗi thì client vẫn điều
// hướng được, chỉ mất trạng thái lưu. Onboarding đứt mạch còn tệ hơn là
// người dùng bị kẹt không vào được app.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import {
  getOnboardingState,
  markFirstLearningSession,
  markSurveyDecided,
  markWelcomeSeen,
  updateOnboardingStatus,
} from "@/services/onboarding.service";
import { saveLearningProfile } from "@/services/personalization.service";
import { nextStatusForAction, type OnboardingAction } from "@/lib/onboarding/state";
import { sanitizeLearningProfile } from "@/lib/onboarding/profile";
import type { ApiResponse } from "@/types";

/** Action hợp lệ — chống payload gõ bừa gây lỗi switch im lặng. */
const ACTIONS: ReadonlySet<string> = new Set<OnboardingAction>([
  "complete_welcome",
  "start_setup",
  "complete_setup",
  "mark_first_session",
  "save_learning_profile",
  "skip_onboarding",
  "complete_survey",
]);

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();
    const state = await getOnboardingState(userId);
    return NextResponse.json({ success: true, data: state } satisfies ApiResponse<typeof state>);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Không đọc được trạng thái onboarding." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    // XÁC THỰC: userId LUÔN lấy từ session Auth.js, TUYỆT ĐỐI không đọc
    // `body.userId`. Nếu tin body, user A sẽ sửa được hồ sơ của user B.
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = (await req.json()) as {
      action?: OnboardingAction;
      goal?: string;
      subjects?: string[];
      level?: string;
      completed?: boolean;
      educationStage?: unknown;
      grade?: unknown;
      track?: unknown;
      intents?: unknown;
      goalCategory?: unknown;
      goals?: unknown;
      otherSubject?: unknown;
      careerStatus?: unknown;
      careerFields?: unknown;
      studyTime?: unknown;
      studyTimePreference?: unknown;
      aiPreferences?: unknown;
      learningPreferences?: unknown;
      // Field của khảo sát 5 phase (ngành/nghề, chủ đề, định hướng tương lai).
      field?: unknown;
      topics?: unknown;
      futureGoal?: unknown;
    };

    const action = body.action;
    if (!action || !ACTIONS.has(action)) {
      return NextResponse.json({ success: false, error: "Thiếu action." }, { status: 400 });
    }

    const current = await getOnboardingState(userId);
    const next = nextStatusForAction(current.status, action);

    // Mỗi hành động có cách ghi riêng vì chúng set thêm cột khác nhau
    // (welcomeSeenAt, learningProfile, firstLearningSessionAt) — gom chung
    // vào 1 update sẽ dễ sót nhánh.
    switch (action) {
      case "complete_welcome":
        await markWelcomeSeen(userId);
        break;
      case "start_setup":
        await updateOnboardingStatus(userId, next);
        break;
      case "complete_setup":
        await saveLearningProfile(
          userId,
          {
            version: 1,
            // Trim + lọc rỗng: form có thể gửi khoảng trắng do user gõ dở,
            // lưu vào DB sẽ thành dữ liệu rác ảnh hưởng prompt của AI.
            goalCategory: body.goal?.trim() || undefined,
            subjects: (body.subjects ?? []).map((s) => s.trim()).filter(Boolean),
            level: body.level?.trim() || undefined,
          },
          { completed: true }
        );
        break;
      case "save_learning_profile": {
        // VALIDATE Ở SERVER: client gửi payload JSON bất kỳ, chỉ dữ liệu đã
        // qua sanitizeLearningProfile() mới được ghi. Giá trị sai bị loại và
        // log, không làm hỏng những phần user đã trả lời hợp lệ.
        // Client gửi field ĐỜ (flat) để khởp với `sendOnboardingAction`
        // ({ action, ...profile }) — nên đọc trực tiếp từ đây. Đớc
        // `body.profile` thì mọi request đệu "thành công" nhưng không lưu
        // gí đâm: lỗi im lặng, không phải 500 — nguy hiểm hơn nhiệu.
        const { profile, errors } = sanitizeLearningProfile({
          educationStage: body.educationStage,
          grade: body.grade,
          track: body.track,
          intents: body.intents,
          goalCategory: body.goalCategory,
          goals: body.goals,
          subjects: body.subjects,
          otherSubject: body.otherSubject,
          careerStatus: body.careerStatus,
          careerFields: body.careerFields,
          studyTime: body.studyTime,
          studyTimePreference: body.studyTimePreference,
          aiPreferences: body.aiPreferences,
          learningPreferences: body.learningPreferences,
          // Field của khảo sát 5 phase.
          field: body.field,
          topics: body.topics,
          futureGoal: body.futureGoal,
          level: body.level,
          version: 1,
        });
        if (errors.length > 0) {
          console.warn("[api/onboarding] Loại bỏ field không hợp lệ:", errors);
        }
        const result = await saveLearningProfile(userId, profile, {
          // Chỉ đánh dấu hoàn tất khi client nói rõ đây là bước cuối và user
          // không bấm bỏ qua.
          completed: body.completed === true,
        });
        // Chỉ nâng lên PERSONALIZED ở bước cuối — xem nextStatusForAction.
        if (body.completed === true) await updateOnboardingStatus(userId, "PERSONALIZED");
        else if (result.createdGoals > 0) await updateOnboardingStatus(userId, "PERSONALIZED");
        break;
      }
      case "skip_onboarding":
        // KHÔNG xoá dữ liệu đã trả lời ở các bước trước.
        // Chỉ ghi trạng thái để Dashboard biết mà gợi ý hoàn thiện.
        await updateOnboardingStatus(userId, next);
        break;
      case "complete_survey":
        // User đi tới cuối luồng (hoặc bấm "làm sau" ở bước kiểm tra năng
        // lực). Ghi mốc chốt khảo sát để Dashboard tắt banner ưu tiên.
        // KHÔNG nâng onboardingStatus: xem markSurveyDecided.
        await markSurveyDecided(userId);
        break;
      case "mark_first_session":
        await markFirstLearningSession(userId);
        await updateOnboardingStatus(userId, next);
        break;
    }

    const state = await getOnboardingState(userId);
    return NextResponse.json({ success: true, data: state } satisfies ApiResponse<typeof state>);
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Không cập nhật được onboarding." },
      { status: 500 }
    );
  }
}
