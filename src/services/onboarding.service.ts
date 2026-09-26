// ================================================================
// ONBOARDING SERVICE — đọc/ghi trạng thái onboarding của user
// ================================================================
// Mạch tư duy: gom mọi truy vấn liên quan onboarding vào 1 chỗ để:
//   - Dashboard, Welcome, Quick Setup và proxy đều đọc CÙNG một nguồn;
//   - chỉ 1 nơi biết "user đã có dữ liệu học thật chưa" (dùng để quyết
//     định profile có dùng được để cá nhân hoá chưa);
//   - dễ test, dễ đổi nguồn sự thật sau này.
//
// "Có dữ liệu học" được suy ra từ hành vi thật (bài làm / tài liệu / lộ
// trình) thay vì hỏi user — đúng nguyên tắc LearnX AI: profile xây từ
// observed behavior, không phải từ questionnaire.
// ================================================================

import { prisma } from "@/lib/db/prisma";
import {
  normalizeOnboardingStatus,
  type OnboardingState,
  type OnboardingStatus,
} from "@/lib/onboarding/state";
import {
  computeProfileCompletion,
  isProfileComplete,
  type LearningProfile,
} from "@/lib/onboarding/profile";

/** Đọc trạng thái onboarding đầy đủ của 1 user. */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      onboardingStatus: true,
      welcomeSeenAt: true,
      firstLearningSessionAt: true,
      learningProfile: true,
      learningProfileCompletedAt: true,
      _count: { select: { attempts: true, documents: true, roadmaps: true } },
    },
  });

  // User không tồn tại: trả về trạng thái mặc định thay vì throw — route đã
  // kiểm tra session nên trường hợp này hiếm, nhưng nếu có thì trả "chưa
  // onboarding" vẫn hơn là làm 500.
  if (!user) {
    return {
      status: "NEW",
      welcomeSeenAt: null,
      firstLearningSessionAt: null,
      learningProfile: null,
      profileCompletion: 0,
      profileCompletedAt: null,
      profileComplete: false,
      hasLearningData: false,
    };
  }

  const learningProfile = (user.learningProfile as LearningProfile | null) ?? null;

  return {
    status: normalizeOnboardingStatus(user.onboardingStatus),
    welcomeSeenAt: user.welcomeSeenAt,
    firstLearningSessionAt: user.firstLearningSessionAt,
    learningProfile,
    // Phần trăm + cờ hoàn tất tính SẴN ở server để mọi nơi (Dashboard,
    // Account, onboarding) hiển thị giống hệt nhau, không mỗi màn tự tính
    // lại — dễ lệch số khi thêm field mới.
    profileCompletion: computeProfileCompletion(learningProfile),
    profileCompletedAt: user.learningProfileCompletedAt,
    profileComplete: isProfileComplete(learningProfile),
    hasLearningData: hasLearningDataFlags(user._count),
  };
}

interface LearningCounts {
  attempts: number;
  documents: number;
  roadmaps: number;
}

interface LearningCounts {
  attempts: number;
  documents: number;
  roadmaps: number;
}

/** User có dữ liệu học thật chưa (1 trong 3 nguồn là đủ). */
function hasLearningDataFlags(counts: LearningCounts): boolean {
  return counts.attempts > 0 || counts.documents > 0 || counts.roadmaps > 0;
}

/** Ghi trạng thái onboarding sau 1 hành động. */
export async function updateOnboardingStatus(
  userId: string,
  next: OnboardingStatus
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { onboardingStatus: next },
  });
}

/** Đánh dấu đã xem Welcome + chuyển sang EXPLORING. */
export async function markWelcomeSeen(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    // `welcomeSeenAt: null` trong điều kiện để chỉ set lần đầu — giữ lại
    // mốc thời gian user thực sự lần đầu bước vào app.
    data: {
      welcomeSeenAt: new Date(),
      onboardingStatus: "EXPLORING",
    },
  });
}

/**
 * LƯU Ý: hàm ghi learningProfile KHÔNG còn nằm ở file này.
 *
 * Trước đây `saveLearningProfile` ở đây chỉ ghi 1 object JSON. Nay hồ sơ học
 * tập còn phải đồng bộ với bảng `LearningGoal` trong CÙNG một transaction và
 * phải chống tạo trùng, nên logic đó chuyển sang
 * `services/personalization.service.ts -> saveLearningProfile()`.
 * Giữ một nơi duy nhất để tránh 2 hàm ghi cùng 1 cột với hành vi khác nhau.
 */

/**
 * Đánh dấu user ĐÃ CHỐT khảo sát (hoàn tất hoặc bấm bỏ qua).
 *
 * Ghi mốc vào `learningProfile.surveyDecidedAt` chứ KHÔNG thêm cột DB mới: mốc
 * này là quyết định của người dùng về chính hồ sơ đó, và nó luôn đi cùng
 * `learningProfile` — tách ra thành cột riêng sẽ tạo 2 nơi nói về cùng 1 sự
 * thật (đúng lỗi mà nguyên tắc "không trùng lặp nguồn sự thật" cảnh báo).
 *
 * IDEMPOTENT: chỉ set lần đầu, không ghi đè mốc cũ — giống
 * `markFirstLearningSession`. Bấm "Tiếp tục" 3 lần vẫn là 1 mốc.
 *
 * KHÔNG đụng `onboardingStatus`: bấm "làm sau" ở bước kiểm tra năng lực không
 * có nghĩa AI đã biết người dùng — đánh dấu PERSONALIZED lúc đó là nói dối.
 */
export async function markSurveyDecided(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { learningProfile: true },
  });
  const profile = (user?.learningProfile as LearningProfile | null) ?? null;
  if (profile?.surveyDecidedAt) return; // đã có mốc -> giữ nguyên

  await prisma.user.update({
    where: { id: userId },
    data: {
      learningProfile: {
        ...(profile ?? { version: 1 }),
        version: 1,
        surveyDecidedAt: new Date().toISOString(),
      } as unknown as object,
    },
  });
}

/**
 * Đánh dấu đã hoàn thành phiên học đầu tiên.
 *
 * Chỉ set một lần (điều kiện `firstLearningSessionAt: null`) vì đây là mốc
 * đo "Time to First Meaningful Learning Experience" — ghi đè mỗi lần sẽ
 * làm sai chỉ số.
 */
export async function markFirstLearningSession(userId: string): Promise<void> {
  await prisma.user.updateMany({
    where: { id: userId, firstLearningSessionAt: null },
    data: { firstLearningSessionAt: new Date() },
  });
}
