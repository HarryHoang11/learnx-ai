// ================================================================
// CLIENT HELPER — đọc/ghi trạng thái onboarding từ trình duyệt
// ================================================================
// Mạch tư duy: Welcome, Quick Setup, Dashboard và Profile đều cần biết
// "user này đang ở giai đoạn nào". Gọi fetch + parse ApiResponse ở cả 4 chỗ
// sẽ dễ lệch (nhất là khi thêm field mới). Gom vào đây cho 1 nơi duy nhất.
//
// Điểm quan trọng: sau khi ghi trạng thái, hàm này gọi
// useSession().update() để LÀM MỚI JWT — nếu thiếu bước này thì proxy vẫn
// giữ trạng thái cũ trong token và sẽ kéo user về /welcome lần nữa (lỗi
// kinh điển "onboarding không bao giờ kết thúc").
// ================================================================

import type { LearningProfile, OnboardingAction, OnboardingState } from "./state";

/**
 * Ghi trạng thái onboarding.
 *
 * @param action xem OnboardingAction
 * @param profile chỉ cần khi action = "save_learning_profile" hoặc "complete_setup"
 * @param completed đánh dấu đây là bước CUỐI của onboarding học tập
 *   (server dùng để set mốc "hoàn tất" + nâng trạng thái PERSONALIZED).
 * @returns trạng thái mới, hoặc null nếu request lỗi.
 *
 * Hàm này KHÔNG throw: thất bại lúc lưu onboarding không được phép chặn
 * người dùng vào app — caller tự điều hướng, việc lưu có thể thử lại sau.
 * Vì vậy UI onboarding BẮT BUỘC tự hiển thị lỗi + nút "Thử lại" thay vì
 * im lặng coi như đã lưu (yêu cầu §29).
 */
export async function sendOnboardingAction(
  action: OnboardingAction,
  profile?: LearningProfile,
  completed?: boolean
): Promise<OnboardingState | null> {
  try {
    const res = await fetch("/api/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...(profile ?? {}), ...(completed ? { completed: true } : {}) }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data?: OnboardingState };
    return json.success && json.data ? json.data : null;
  } catch {
    return null;
  }
}

/** Đọc trạng thái onboarding (dùng cho empty state ở Dashboard/Profile). */
export async function fetchOnboardingState(): Promise<OnboardingState | null> {
  try {
    const res = await fetch("/api/onboarding");
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; data?: OnboardingState };
    return json.success && json.data ? json.data : null;
  } catch {
    return null;
  }
}
