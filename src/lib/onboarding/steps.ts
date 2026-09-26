// ================================================================
// ONBOARDING STEPS — engine bước động của khảo sát học tập
//
// Mạch tư duy: khảo sát KHÔNG hỏi giống nhau cho mọi người. Học sinh lớp 11
// không có "nghề nghiệp", sinh viên năm 3 không có "lớp", người đi làm không
// có "lớp + định hướng". Hỏi cả 3 nhóm cho tất cả chính là dữ liệu rác mà
// user phải bấm "không áp dụng" — tệ hơn là không hỏi.
//
// Vì vậy ở đây tách 2 khái niệm:
//   - Step (bước): 1 câu hỏi / 1 màn hình.
//   - Phase: nhóm bước, dùng cho thanh tiến trình "01 Profile · 02 Mục tiêu".
//
// stepsForStage() là hàm thuần tra cứu, nên UI (LearningOnboarding), thanh
// tiến trình (Dashboard banner) và API đều suy ra CÙNG một danh sách bước từ
// đây — không có chỗ nào tự chế ra danh sách riêng và lệch nhau.
//
// File này KHÔNG import React/i18n: chỉ dữ liệu + logic thuần để test được.
// Nhãn hiển thị nằm ở dictionary, liên kết qua labelKey.
// ================================================================

/** 1 câu hỏi = 1 StepId. */
export type StepId =
  /** Bạn đang ở giai đoạn học tập nào? (luôn là bước đầu tiên) */
  | "stage"
  /** Ngành học (UNIVERSITY/POSTGRAD) hoặc nghề nghiệp (WORKING) */
  | "field"
  /** Lớp (chỉ THCS/THPT) */
  | "grade"
  /** Định hướng khối (chỉ THCS/THPT) */
  | "track"
  /** Ngành/nghề đang cân nhắc (chỉ THCS/THPT — sv và người đi làm đã có `field`) */
  | "career"
  /** Chủ đề bạn tự học (chỉ SELF_LEARNING/OTHER) */
  | "topics"
  /** Bạn muốn LearnX hỗ trợ điều gì? */
  | "intent"
  /** Mục tiêu cụ thể + định hướng tương lai */
  | "goal"
  /** Môn học / chủ đề quan tâm */
  | "subjects"
  /** Thời gian học được mỗi ngày */
  | "time"
  /** Bạn muốn AI hỗ trợ như thế nào + cách học ưu tiên */
  | "ai"
  /** Kiểm tra năng lực (10-15 câu) */
  | "diagnostic";

/** Nhóm bước — dùng cho tiêu đề tiến trình. */
export type PhaseId = "profile" | "goals" | "style" | "diagnostic" | "ready";

export interface PhaseMeta {
  readonly id: PhaseId;
  /** Số thứ tự hiển thị (1-5). */
  readonly index: number;
  /** key i18n cho tên phase. */
  readonly labelKey: string;
}

/**
 * 5 phase theo đúng câu chuyện người dùng:
 *   01 Profile        — bạn là ai, đang học ở đâu
 *   02 Goals          — bạn muốn đạt được gì
 *   03 Learning style — bạn muốn học như thế nào
 *   04 Diagnostic     — bạn đang đứng ở đâu về kiến thức
 *   05 Ready          — hồ sơ + lộ trình
 */
export const PHASES: readonly PhaseMeta[] = [
  { id: "profile", index: 1, labelKey: "onboarding.phase.profile" },
  { id: "goals", index: 2, labelKey: "onboarding.phase.goals" },
  { id: "style", index: 3, labelKey: "onboarding.phase.style" },
  { id: "diagnostic", index: 4, labelKey: "onboarding.phase.diagnostic" },
  { id: "ready", index: 5, labelKey: "onboarding.phase.ready" },
];

const PHASE_BY_ID: Readonly<Record<PhaseId, PhaseMeta>> = PHASES.reduce(
  (acc, phase) => {
    acc[phase.id] = phase;
    return acc;
  },
  {} as Record<PhaseId, PhaseMeta>
);

/** Step nào thuộc phase nào. */
const STEP_PHASE: Readonly<Record<StepId, PhaseId>> = {
  stage: "profile",
  field: "profile",
  grade: "profile",
  track: "profile",
  topics: "profile",
  career: "profile",
  intent: "goals",
  goal: "goals",
  subjects: "goals",
  time: "style",
  ai: "style",
  diagnostic: "diagnostic",
};

export function phaseOfStep(step: StepId): PhaseMeta {
  return PHASE_BY_ID[STEP_PHASE[step]];
}

export function phaseIndexOfStep(step: StepId): number {
  return phaseOfStep(step).index;
}

// ------------------------------------------------------------
// CHUỖI BƯỚC THEO NHÓM NGƯỜI DÙNG
// ------------------------------------------------------------

/** Bước chung cho mọi nhóm (sau phần định danh). */
const COMMON_TAIL: readonly StepId[] = ["intent", "goal", "subjects", "time", "ai", "diagnostic"];


/** Shape tối thiểu cần cho `isStepAnswered` — tránh phụ thuộc cả LearningProfile. */
export interface StepAnswerSource {
  educationStage?: string;
  field?: string;
  grade?: string;
  track?: string;
  topics?: string;
  careerStatus?: string;
  careerFields?: string[];
  intents?: string[];
  goalCategory?: string;
  goals?: unknown[];
  futureGoal?: string;
  subjects?: string[];
  otherSubject?: string;
  studyTime?: string;
  aiPreferences?: string[];
  learningPreferences?: string[];
}

/**
 * Điều kiện "bước này đã có câu trả lời".
 *
 * CỐ Ý bỏ qua bước KHÔNG áp dụng: ví dụ `careerStatus` chỉ có ý nghĩa với
 * người đang cân nhắc nghề, nhưng engine không biết ý định đó nên quy tắc
 * chung là "bước chỉ cần có dữ liệu ở BẤT KỲ field nào của nó".
 */
export function isStepAnswered(step: StepId, draft: StepAnswerSource): boolean {
  switch (step) {
    case "stage":
      return Boolean(draft.educationStage);
    case "field":
      return Boolean(draft.field);
    case "grade":
      return Boolean(draft.grade);
    case "track":
      return Boolean(draft.track);
    case "topics":
      return Boolean(draft.topics);
    case "career":
      return Boolean(draft.careerStatus) || (draft.careerFields?.length ?? 0) > 0;
    case "intent":
      return (draft.intents?.length ?? 0) > 0;
    case "goal":
      return Boolean(draft.goalCategory) || (draft.goals?.length ?? 0) > 0 || Boolean(draft.futureGoal);
    case "subjects":
      return (draft.subjects?.length ?? 0) > 0 || Boolean(draft.otherSubject);
    case "time":
      return Boolean(draft.studyTime);
    case "ai":
      return (draft.aiPreferences?.length ?? 0) > 0 || (draft.learningPreferences?.length ?? 0) > 0;
    case "diagnostic":
      // Luôn coi là đã trả lời: đây là HÀNH ĐỘNG (làm / bỏ qua), không phải
      // dữ liệu cần nhớ. Engine không được giữ user mắc ở bước này.
      return true;
  }
}

/**
 * Bước đầu tiên CÒN THIẾU — dùng khi user quay lại /onboarding.
 *
 * Trả bước cuối khi đã trả lời đủ: mở thẳng `diagnostic` (nơi chốt hồ sơ)
 * thay vì quay về bước 1 và bắt người đã hoàn thành làm lại.
 */
export function firstIncompleteStep(steps: readonly StepId[], draft: StepAnswerSource): number {
  const index = steps.findIndex((step) => !isStepAnswered(step, draft));
  return index === -1 ? steps.length - 1 : index;
}

/**
 * Tiến trình khảo sát (0-100) cho banner Dashboard.
 *
 * Tính trên ĐÚNG danh sách bước của giai đoạn đó — nếu không, người đã học xong
 * sẽ thấy "2/9" vì 7 bước không áp dụng không bao giờ được hỏi.
 */
export function surveyProgress(draft: StepAnswerSource): {
  answered: number;
  total: number;
  percent: number;
} {
  const steps = stepsForStage(draft.educationStage);
  const answered = steps.filter((step) => isStepAnswered(step, draft)).length;
  const total = steps.length;
  return { answered, total, percent: total === 0 ? 0 : Math.round((answered / total) * 100) };
}

/**
 * Bước hỏi định danh theo giai đoạn.
 *
 * Chưa chọn giai đoạn (`""` / undefined) -> KHÔNG có bước định danh nào, vì
 * "bạn học lớp mấy" / "bạn học ngành gì" không thể hỏi trước khi biết người
 * dùng là học sinh hay nhân viên văn phòng. Các bước CHUNG vẫn giữ nguyên để
 * người dùng đã biết mình là ai vẫn trả lời tiếp được, không bị kẹt ở bước 1.
 *
 * LƯU Ý: học sinh có thêm bước `career` (đang cân nhắc ngành/nghề) vì đây là
 * câu hỏi có giá trị thật với học sinh/sinh viên năm 1. Sinh viên và người
 * đi làm KHÔNG hỏi bước này — họ đã có `field` (ngành/nghề) rồi, hỏi lại là
 * hỏi trùng.
 */
const PROFILE_STEPS_BY_STAGE: Readonly<Record<string, readonly StepId[]>> = {
  THCS: ["grade", "track", "career"],
  THPT: ["grade", "track", "career"],
  UNIVERSITY: ["field"],
  POSTGRAD: ["field"],
  WORKING: ["field"],
  SELF_LEARNING: ["topics"],
  OTHER: ["topics"],
};

export function profileStepsForStage(stage: string | undefined): readonly StepId[] {
  if (!stage) return [];
  return PROFILE_STEPS_BY_STAGE[stage] ?? [];
}

/**
 * Chuỗi bước đầy đủ cho 1 giai đoạn.
 *
 * Luôn kết thúc bằng `diagnostic` — đây là bước nối khảo sát với bài kiểm tra
 * năng lực, và nó LUÔN xuất hiện ở mọi nhóm (bỏ qua được) để luồng luôn có
 * 1 điểm chốt rõ ràng trước khi vào Dashboard.
 */
export function stepsForStage(stage: string | undefined): StepId[] {
  return ["stage", ...profileStepsForStage(stage), ...COMMON_TAIL];
}