// ================================================================
// ONBOARDING — trạng thái + quy tắc điều hướng của Welcome Experience
// ================================================================
// Mạch tư duy: triết lý sản phẩm của LearnX AI là
// "Explore before you configure" — người dùng mới phải được TRẢI NGHIỆM
// sản phẩm trước khi bị hỏi cấu hình. Vì vậy ở đây:
//   - "Đã onboarding" = đã THẤY Welcome, KHÔNG phải "đã điền profile".
//   - Setup (Quick Setup) là đường PHỤ, không bao giờ chặn Dashboard.
//   - Chỉ có 1 hướng dẫn duy nhất từ proxy; quy tắc ở đây là nguồn duy nhất
//     để cả server (proxy) và client cùng quyết định, tránh 2 bản logic lệch
//     nhau sinh redirect loop.
//
// Toàn bộ hàm ở đây là HÀM THUẦN (không đụng DB/React) nên test được —
// logic điều hướng là chỗ dễ sinh bug "kẹt vòng lặp redirect" nhất.
// ================================================================

/** Trạng thái onboarding, khớp enum OnboardingStatus trong prisma/schema.prisma. */
export type OnboardingStatus = "NEW" | "EXPLORING" | "SETTING_UP" | "PERSONALIZED";

export const ONBOARDING_STATUSES: readonly OnboardingStatus[] = [
  "NEW",
  "EXPLORING",
  "SETTING_UP",
  "PERSONALIZED",
];

/** Chuỗi DB có thể là bất kỳ giá trị nào (schema từng đổi) -> chuẩn hoá. */
export function normalizeOnboardingStatus(value: unknown): OnboardingStatus {
  return ONBOARDING_STATUSES.includes(value as OnboardingStatus)
    ? (value as OnboardingStatus)
    : "NEW";
}

/**
 * Câu trả lời onboarding — shape ĐẦY ĐỦ nằm ở lib/onboarding/profile.ts.
 *
 * Ở đây chỉ re-export để các file đang import `LearningProfile` từ `state.ts`
 * (vd onboarding.service.ts) không phải sửa hàng loạt import — nhưng nguồn sự
 * thật DUY NHẤT vẫn là profile.ts.
 *
 * LƯU Ý TƯƠNG THÍCH NGƯỢC: shape cũ chỉ có `goal` / `subjects` / `level`
 * (Quick Setup 3 câu). Tất cả vẫn còn trong shape mới, nên dữ liệu người dùng
 * cũ đọc được nguyên vẹn và onboarding mới chỉ BỔ SUNG, không phá.
 */
export type { LearningProfile, LearningGoalDraft } from "@/lib/onboarding/profile";

import type { LearningProfile } from "@/lib/onboarding/profile";
import { computeProfileCompletion, hasProfileSignal } from "@/lib/onboarding/profile";

/** Cờ rút gọn cho code đọc onboarding nhiều chỗ. */
export interface OnboardingState {
  status: OnboardingStatus;
  welcomeSeenAt: Date | string | null;
  firstLearningSessionAt: Date | string | null;
  learningProfile: LearningProfile | null;
  /**
   * Phần trăm hồ sơ đã đầy đủ (0-100), tính SẴN ở server
   * (computeProfileCompletion) để mọi màn hiển thị giống nhau.
   */
  profileCompletion: number;
  /** Mốc thời gian hoàn tất onboarding học tập (null = chưa/bỏ qua). */
  profileCompletedAt: Date | string | null;
  /** Đủ dữ liệu để coi là "đã hoàn thiện" (>= 80%). */
  profileComplete: boolean;
  /** User đã có dữ liệu học thật (bài làm, tài liệu, roadmap) hay chưa. */
  hasLearningData: boolean;
}

/**
 * Đã "xong onboarding" chưa?
 *
 * Cố ý coi EXPLORING là ĐÃ XONG: người dùng đã đi vào app, không được ép
 * xem lại Welcome. Đây là điểm hiện thực nguyên tắc "không chặn Dashboard".
 */
export function hasCompletedWelcome(state: Pick<OnboardingState, "status" | "welcomeSeenAt">): boolean {
  return state.status !== "NEW" || Boolean(state.welcomeSeenAt);
}

/**
 * Profile đã đủ dùng để AI cá nhân hoá chưa?
 *
 * Dùng cho UI "Learning profile: Not set up yet" — nhưng CHỈ để hiển thị,
 * tuyệt đối không dùng để chặn bất cứ thứ gì.
 */
export function hasUsableProfile(state: Pick<OnboardingState, "status" | "learningProfile" | "hasLearningData">): boolean {
  if (state.status === "PERSONALIZED") return true;
  // Dùng chung `hasProfileSignal` với mọi nơi khác (Dashboard, onboarding)
  // để "có dữ liệu để cá nhân hoá không" được trả lời giống nhau ở mọi màn.
  if (hasProfileSignal(state.learningProfile)) return true;
  // Dữ liệu học thực tế cũng đủ để AI biết user mạnh/yếu môn nào — không bắt
  // user phải điền form khi hành vi đã nói lên tất cả.
  return state.hasLearningData;
}

/**
 * Phần trăm hoàn thiện profile — hiển thị dạng tiến trình nhẹ, KHÔNG phải nghĩa vụ.
 *
 * UỎ QUYỀN cho `computeProfileCompletion` (lib/onboarding/profile.ts) để
 * Dashboard, Account và onboarding cùng hiện MỘT con số — trước đây hàm này
 * tự tính theo shape Quick Setup cũ và sẽ lệch với shape mới.
 *
 * Vẫn giữ `goal` trong điều kiện dưới đây vì dữ liệu người dùng CŨ đã lưu
 * theo shape cũ vẫn còn `goal` trong JSON; xem LEGACY_GOAL bên dưới.
 */
export function profileCompletionPercent(state: Pick<OnboardingState, "learningProfile">): number {
  const profile = state.learningProfile;
  if (!profile) return 0;
  // Người dùng từ thời Quick Setup có `goal` dạng chuỗi thay vì `goals`/`goalCategory`.
  // Coi như đã có mục tiêu để không tụt % một cách vô lý.
  const legacy = profile as { goal?: unknown };
  const hasLegacyGoal = typeof legacy.goal === "string" && legacy.goal.trim().length > 0;
  const enriched =
    hasLegacyGoal && !profile.goalCategory && !profile.goals?.length
      ? { ...profile, goalCategory: "LEGACY" }
      : profile;
  return computeProfileCompletion(enriched);
}

/** Hành động client được phép gửi lên API. */
export type OnboardingAction =
  | "complete_welcome"
  | "start_setup"
  | "complete_setup"
  | "mark_first_session"
  // Onboarding học tập: lưu từng phần hồ sơ + đánh dấu đã bỏ qua.
  // `complete_setup` (Quick Setup cũ) vẫn giữ nguyên để tương thích.
  | "save_learning_profile"
  | "skip_onboarding"
  // Chốt khảo sát: user đã đi tới cuối luồng (hoặc bấm "làm sau" ở bước
  // kiểm tra năng lực). Tác vụ DUY NHẤT là ghi mốc `surveyDecidedAt` vào
  // learningProfile — dùng để tắt banner ưu tiên ở Dashboard.
  | "complete_survey";

/**
 * Trạng thái đích sau mỗi hành động.
 *
 * `complete_welcome` -> EXPLORING (không phải PERSONALIZED): xem Welcome KHÔNG
 * đồng nghĩa với việc AI đã biết user. Cái này giữ đúng câu chuyện
 * "profile được xây từ hành vi học thật, không phải từ việc xem 1 trang giới thiệu".
 */
export function nextStatusForAction(current: OnboardingStatus, action: OnboardingAction): OnboardingStatus {
  switch (action) {
    case "complete_welcome":
      // Đừng hạ trạng thái đi: user đang làm setup thì chuyển EXPLORING sẽ
      // làm mất thông tin đang nhập.
      return current === "NEW" ? "EXPLORING" : current;
    case "start_setup":
      return "SETTING_UP";
    case "complete_setup":
      return "PERSONALIZED";
    case "mark_first_session":
      return current === "NEW" ? "EXPLORING" : current;
    // Bỏ qua KHÔNG được coi là "đã cá nhân hoá" — status giữ nguyên (EXPLORING
    // nếu mới) để Dashboard tiếp tục gợi ý hoàn thiện, nhưng KHÔNG chặn app.
    case "skip_onboarding":
      return current === "NEW" ? "EXPLORING" : current;
    // Trạng thái onboarding học tập KHÔNG tự đặt PERSONALIZED ở đây: thao tác
    // này chạy sau MỖI bước, đánh dấu hoàn tất sẽ sai ngay từ bước 1.
    // PERSONALIZED do saveLearningProfile() set khi user bấm "Hoàn tất".
    case "save_learning_profile":
      return current;
    // Chốt khảo sát KHÔNG tự đặt PERSONALIZED: user bấm "làm sau" ở bước kiểm
    // tra năng lực thì AI vẫn chưa biết gì về họ — đánh dấu "đã cá nhân hoá"
    // lúc đó là nói dối. Mốc chốt nằm ở `learningProfile.surveyDecidedAt`.
    case "complete_survey":
      return current;
  }
}

/** Những route KHÔNG được chuyển hướng sang /welcome (tránh loop). */
export const WELCOME_EXEMPT_PATHS = [
  "/welcome",
  "/setup",
  // /onboarding (Hồ sơ học tập) phải được miễn trố: user đang làm
  // dữ dổ thì không được bị kéo ngưốc về /welcome đá
  // ngoài đang giữa trang onboarding — đây là nguôn "redirect loop" kinh điển.
  "/onboarding",
  "/login",
  "/register",
  "/api",
];

/** true nếu đường dẫn được phép đi thẳng (không ép về /welcome). */
export function isExemptFromWelcomeRedirect(pathname: string): boolean {
  return WELCOME_EXEMPT_PATHS.some(
    (path) => pathname === path || (path !== "/api" && pathname.startsWith(`${path}/`))
  ) || pathname.startsWith("/api");
}

/**
 * Nơi user mới nên được đưa tới sau khi đăng nhập.
 *
 * Returning user (đã xem Welcome) -> thẳng Dashboard, không delay, không hỏi
 * setup lại: đây là yêu cầu "Returning User: Login -> Dashboard".
 */
export function postLoginDestination(state: Pick<OnboardingState, "status" | "welcomeSeenAt">): string {
  return hasCompletedWelcome(state) ? "/dashboard" : "/welcome";
}

// ------------------------------------------------------------
// GATE MỀM: ưu tiên cá nhân hoá mà KHÔNG khoá app
// ------------------------------------------------------------

/**
 * Đã "chốt" khảo sát chưa (hoàn tất hoặc bấm bỏ qua)?
 *
 * Nhận CẢ 2 hình dữ liệu vì đây là cùng một sự thật ở 2 tầng:
 *   - `LearningProfile` đầy đủ (server, `getOnboardingState`);
 *   - `{ surveyDecidedAt }` rút gọn (client, đọc từ JWT mirror).
 * Dùng `Partial<LearningProfile>` thay vì `Pick<...>` để không vỡ khi gọi với
 * object literal có thêm field khác.
 *
 * Nguồn sự thật là `learningProfile.surveyDecidedAt` — mốc do SERVER tự sinh
 * khi user đi tới cuối luồng hoặc bấm "làm sau". Cờ trong JWT chỉ là bản cache
 * để proxy không phải query DB ở mỗi request.
 */
export function hasDecidedSurvey(
  learningProfile:
    | Partial<LearningProfile>
    | { surveyDecidedAt?: string | null }
    | null
    | undefined
): boolean {
  return Boolean(learningProfile?.surveyDecidedAt);
}

/**
 * Có cần nhắc hoàn thiện hồ sơ không? (KHÔNG chặn — chỉ quyết định hiện banner)
 *
 * BA ĐIỀU KIỆN, tất cả đều phải đúng:
 *   1. Đã qua Welcome — user mới tạo chưa xem trang giới thiệu thì chưa tới
 *      lượt khảo sát.
 *   2. Chưa chốt khảo sát.
 *   3. Hồ sơ CHƯA đủ dùng — đã có dữ liệu học thật thì coi như AI biết người
 *      dùng qua hành vi, đừng bắt điền form.
 *
 * Ngưỡng 80% cố tình khớp `isProfileComplete` để proxy và UI hiểu "đủ" theo
 * CÙNG một tiêu chí.
 */
export function needsLearningProfile(state: {
  status: OnboardingStatus;
  welcomeSeenAt: Date | string | null;
  learningProfile?: LearningProfile | null;
  hasLearningData?: boolean;
  profileCompletion?: number;
}): boolean {
  if (!hasCompletedWelcome(state)) return false;
  if (hasDecidedSurvey(state.learningProfile)) return false;
  if (state.hasLearningData) return false;
  if ((state.profileCompletion ?? 0) >= 80) return false;
  return true;
}

/**
 * Các trang HỌC CHÍNH — nơi thiếu hồ sơ thì AI không hỗ trợ được nên mới nhắc.
 *
 * CỐ Ý KHÔNG gồm /dashboard: người dùng mới phải nhìn thấy app trước đã, chặn
 * ở đây là biến onboarding thành trừng phạt. Dashboard tự hiện banner ưu tiên.
 */
export const LEARNING_GATE_PATHS = ["/roadmap", "/diagnostic", "/practice", "/library"] as const;

/** true nếu đường dẫn này cần hồ sơ để hoạt động tốt. */
export function isLearningGatedPath(pathname: string): boolean {
  return LEARNING_GATE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Lối vào Diagnostic do CHÍNH onboarding tạo ra: `/diagnostic?from=onboarding`.
 *
 * VÌ SAO CẦN HÀM NÀY: `/diagnostic` nằm trong `LEARNING_GATE_PATHS`, mà ở phase
 * 04 `surveyDecidedAt` CHƯA được ghi (cố ý — user còn phải đi tiếp phase 05).
 * Nghĩa là `needsLearningProfile()` trả true ĐÚNG lúc user bấm "Bắt đầu kiểm
 * tra", và proxy kéo thẳng về `/onboarding` — URL quay lại chính trang đang
 * đứng, nên nút trông như "bấm không có phản hồi". Đây cùng loại bẫy đã ghi ở
 * ONBOARDING.md §"nút rời khỏi màn hồ sơ" (từng xảy ra với nút roadmap).
 *
 * PHẠM VI HẸP: chỉ miễn cho `/diagnostic` + đúng query do `goDiagnostic()` gắn.
 * Vào `/diagnostic` trực tiếp (sidebar) khi chưa có hồ sơ vẫn bị nhắc hoàn tất
 * khảo sát như cũ — không nới gate cho mọi trang học.
 */
export const ONBOARDING_ENTRY_PARAM = "from";
export const ONBOARDING_ENTRY_VALUE = "onboarding";

/** true nếu đây là lối vào diagnostic từ bước "Kiểm tra năng lực" của khảo sát. */
export function isOnboardingDiagnosticEntry(
  pathname: string,
  search?: string | URLSearchParams | null
): boolean {
  if (pathname !== "/diagnostic" && !pathname.startsWith("/diagnostic/")) return false;
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  return params?.get(ONBOARDING_ENTRY_PARAM) === ONBOARDING_ENTRY_VALUE;
}
