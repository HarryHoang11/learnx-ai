// ================================================================
// ONBOARDING OPTIONS — nguồn sự thật DUY NHẤT cho mọi lựa chọn trong
// onboarding học tập (giai đoạn, định hướng, mục tiêu, môn, nghề, thời gian,
// tuỳ chọn AI, cách học).
//
// VÌ SAO 1 FILE:
//   Danh sách này được dùng ở UI (onboarding, Account), ở API (validate) và ở
//   prompt AI (buildLearningContext). Nếu mỗi component tự hardcode danh sách
//   riêng thì chỉ cần thêm 1 môn là UI và prompt lệch nhau — và validation ở
//   server sẽ từ chối giá trị mà UI vừa cho chọn. Mọi nơi import từ đây.
//
// VÌ SAO KHÔNG ĐỂ TRONG DB:
//   Đây là CATALOGUE của sản phẩm (LearnX hỗ trợ những lựa chọn này), không
//   phải dữ liệu người dùng. Model `Subject` trong DB là danh mục cộng đồng
//   mở rộng (icon/mô tả) và là tập con — xem ghi chú ở lib/constants/subjects.ts.
//
// CHUỖI NHÃN: mỗi option mang `labelKey` trỏ vào dictionary i18n, KHÔNG hardcode
// text trong component (quy ước đã có của project — xem lib/i18n/dictionary.ts).
// ================================================================

import type { I18nKey } from "@/lib/i18n/dictionary";
import { SUBJECTS, CUSTOM_SUBJECT_VALUE } from "@/lib/constants/subjects";

/** Option bất biến: giá trị lưu DB + key i18n để hiển thị. */
export interface OnboardingOption {
  readonly value: string;
  readonly labelKey: I18nKey;
}

/** Nhóm lựa chọn (dùng cho môn học / lĩnh vực quan tâm). */
export interface OnboardingOptionGroup {
  readonly id: string;
  readonly labelKey: I18nKey;
  readonly options: readonly OnboardingOption[];
}

// ------------------------------------------------------------
// 1) GIAI ĐOẠN HỌC TẬP
// ------------------------------------------------------------

export const EDUCATION_STAGES: readonly OnboardingOption[] = [
  { value: "THCS", labelKey: "onboarding.stage.THCS" },
  { value: "THPT", labelKey: "onboarding.stage.THPT" },
  { value: "UNIVERSITY", labelKey: "onboarding.stage.UNIVERSITY" },
  { value: "POSTGRAD", labelKey: "onboarding.stage.POSTGRAD" },
  { value: "WORKING", labelKey: "onboarding.stage.WORKING" },
  { value: "SELF_LEARNING", labelKey: "onboarding.stage.SELF_LEARNING" },
  { value: "OTHER", labelKey: "onboarding.stage.OTHER" },
];

/**
 * Lớp chỉ hỏi khi giai đoạn là THCS/THPT.
 *
 * Lý do giới hạn: hỏi "lớp mấy" với người đã đi làm hoặc tự học là hỏi vô
 * nghĩa — đúng kiểu dữ liệu rác làm prompt AI nhiễu. Nguyên tắc data
 * minimization: chỉ hỏi thứ ĐỊNH NGHĨA được cho nhóm người đó.
 */
export const GRADES_BY_STAGE: Record<string, readonly OnboardingOption[]> = {
  THCS: [
    { value: "6", labelKey: "onboarding.grade.6" },
    { value: "7", labelKey: "onboarding.grade.7" },
    { value: "8", labelKey: "onboarding.grade.8" },
    { value: "9", labelKey: "onboarding.grade.9" },
    { value: "OTHER", labelKey: "onboarding.grade.other" },
  ],
  THPT: [
    { value: "10", labelKey: "onboarding.grade.10" },
    { value: "11", labelKey: "onboarding.grade.11" },
    { value: "12", labelKey: "onboarding.grade.12" },
    { value: "OTHER", labelKey: "onboarding.grade.other" },
  ],
};

/** Định hướng — chỉ hỏi sau THCS/THPT. `UNSURE` là lựa chọn HỢP LỆ (không phải lỗi). */
export const TRACKS: readonly OnboardingOption[] = [
  { value: "SCIENCE", labelKey: "onboarding.track.SCIENCE" },
  { value: "SOCIAL", labelKey: "onboarding.track.SOCIAL" },
  { value: "MATH", labelKey: "onboarding.track.MATH" },
  { value: "INFORMATICS", labelKey: "onboarding.track.INFORMATICS" },
  { value: "ENGLISH", labelKey: "onboarding.track.ENGLISH" },
  { value: "OTHER", labelKey: "onboarding.track.OTHER" },
  { value: "UNSURE", labelKey: "onboarding.track.UNSURE" },
];

// ------------------------------------------------------------
// 2) MỤC ĐÍCH — người dùng đến LearnX để làm gì (multi-select)
// ------------------------------------------------------------

export const INTENTS: readonly OnboardingOption[] = [
  { value: "SCHOOL", labelKey: "onboarding.intent.SCHOOL" },
  { value: "SCORE", labelKey: "onboarding.intent.SCORE" },
  { value: "REVIEW_EXAM", labelKey: "onboarding.intent.REVIEW_EXAM" },
  { value: "GRADUATE_EXAM", labelKey: "onboarding.intent.GRADUATE_EXAM" },
  { value: "COMPETITION", labelKey: "onboarding.intent.COMPETITION" },
  { value: "PROGRAMMING", labelKey: "onboarding.intent.PROGRAMMING" },
  { value: "LANGUAGE", labelKey: "onboarding.intent.LANGUAGE" },
  { value: "NEW_FIELD", labelKey: "onboarding.intent.NEW_FIELD" },
  { value: "HABIT", labelKey: "onboarding.intent.HABIT" },
  { value: "CAREER_EXPLORE", labelKey: "onboarding.intent.CAREER_EXPLORE" },
  { value: "UNIVERSITY_PREP", labelKey: "onboarding.intent.UNIVERSITY_PREP" },
  { value: "OTHER", labelKey: "onboarding.intent.OTHER" },
];


// ------------------------------------------------------------
// 3) MỤC TIÊU — nhóm mục tiêu (single-select) + mục tiêu tự do
// ------------------------------------------------------------

export const GOAL_CATEGORIES: readonly OnboardingOption[] = [
  { value: "CLASS_SCORE", labelKey: "onboarding.goalCategory.CLASS_SCORE" },
  { value: "EXAM", labelKey: "onboarding.goalCategory.EXAM" },
  { value: "CERTIFICATE", labelKey: "onboarding.goalCategory.CERTIFICATE" },
  { value: "COMPETITION", labelKey: "onboarding.goalCategory.COMPETITION" },
  { value: "FOUNDATION", labelKey: "onboarding.goalCategory.FOUNDATION" },
  { value: "SKILL", labelKey: "onboarding.goalCategory.SKILL" },
  { value: "UNIVERSITY", labelKey: "onboarding.goalCategory.UNIVERSITY" },
  { value: "EXPLORE", labelKey: "onboarding.goalCategory.EXPLORE" },
  { value: "HABIT", labelKey: "onboarding.goalCategory.HABIT" },
  { value: "OTHER", labelKey: "onboarding.goalCategory.OTHER" },
];

// ------------------------------------------------------------
// 4) MÔN HỌC / LĨNH VỰC QUAN TÂM (multi-select, có nhóm)
// ------------------------------------------------------------

/**
 * Danh sách môn lấy TỪ `lib/constants/subjects.ts` (tập con của danh mục DB)
 * để tên môn luôn khớp với Diagnostic / Library / Roadmap. Chỉ BỔ SUNG thêm
 * nhóm "kỹ năng / công nghệ" vì onboarding hỏi rộng hơn môn học thuần tuý.
 */
export const SUBJECT_GROUPS: readonly OnboardingOptionGroup[] = [
  {
    id: "core",
    labelKey: "onboarding.subjectGroup.core",
    options: SUBJECTS.map((s) => ({ value: s.value, labelKey: s.labelKey })),
  },
  {
    id: "tech",
    labelKey: "onboarding.subjectGroup.tech",
    options: [
      { value: "Lập trình", labelKey: "onboarding.interest.programming" },
      { value: "AI", labelKey: "onboarding.interest.ai" },
      { value: "Data Science", labelKey: "onboarding.interest.dataScience" },
    ],
  },
  {
    id: "skill",
    labelKey: "onboarding.subjectGroup.skill",
    options: [
      { value: "Ngoại ngữ", labelKey: "onboarding.interest.language" },
      { value: "Kinh tế", labelKey: "onboarding.interest.economy" },
      { value: "Khoa học", labelKey: "onboarding.interest.science" },
      { value: CUSTOM_SUBJECT_VALUE, labelKey: "onboarding.interest.other" },
    ],
  },
];

/** Phẳng hoá SUBJECT_GROUPS thành danh sách giá trị hợp lệ (dùng validate + dedupe). */
export const SUBJECT_INTERESTS: readonly string[] = Array.from(
  new Set(SUBJECT_GROUPS.flatMap((group) => group.options.map((o) => o.value)))
);

// ------------------------------------------------------------
// 5) ĐỊNH HƯỚNG NGÀNH / NGHỀ
// ------------------------------------------------------------

/**
 * `CAREER_STATUS` TÁCH RIÊNG khỏi danh sách nghề, vẽ ra 3 trạng thái hợp lệ:
 * "chưa biết", "đang khám phá", "có vài lựa chọn".
 *
 * NGUYÊN TẮC SỐ 9 của sản phẩm: "chưa biết nghề nghiệp" là DỮ LIỆU HỢP LỆ,
 * không phải lỗi và không bao giờ bị ép đổi thành null. Vì vậy nó là 1 giá trị
 * enum có tên, được lưu vào DB y hệt các giá trị khác.
 */
export const CAREER_STATUSES: readonly OnboardingOption[] = [
  { value: "UNDECIDED", labelKey: "onboarding.careerStatus.UNDECIDED" },
  { value: "EXPLORING", labelKey: "onboarding.careerStatus.EXPLORING" },
  { value: "A few options", labelKey: "onboarding.careerStatus.SOME" },
  { value: "SET", labelKey: "onboarding.careerStatus.SET" },
];

export const CAREER_FIELDS: readonly OnboardingOption[] = [
  { value: "AI / Machine Learning", labelKey: "onboarding.career.aiMl" },
  { value: "Software Engineering", labelKey: "onboarding.career.software" },
  { value: "Data Science", labelKey: "onboarding.career.dataScience" },
  { value: "Cybersecurity", labelKey: "onboarding.career.cybersecurity" },
  { value: "Computer Science", labelKey: "onboarding.career.computerScience" },
  { value: "Engineering", labelKey: "onboarding.career.engineering" },
  { value: "Medicine", labelKey: "onboarding.career.medicine" },
  { value: "Science / Research", labelKey: "onboarding.career.research" },
  { value: "Business", labelKey: "onboarding.career.business" },
  { value: "Finance", labelKey: "onboarding.career.finance" },
  { value: "Design", labelKey: "onboarding.career.design" },
  { value: "Education", labelKey: "onboarding.career.education" },
  { value: "Law", labelKey: "onboarding.career.law" },
  { value: "Media / Communication", labelKey: "onboarding.career.media" },
];


// ------------------------------------------------------------
// 6) THỜI GIAN HỌC
// ------------------------------------------------------------

export const STUDY_TIMES: readonly OnboardingOption[] = [
  { value: "UNDER_30", labelKey: "onboarding.studyTime.UNDER_30" },
  { value: "30_60", labelKey: "onboarding.studyTime.30_60" },
  { value: "1_2_HOURS", labelKey: "onboarding.studyTime.1_2_HOURS" },
  { value: "2_4_HOURS", labelKey: "onboarding.studyTime.2_4_HOURS" },
  { value: "OVER_4_HOURS", labelKey: "onboarding.studyTime.OVER_4_HOURS" },
  { value: "VARIES", labelKey: "onboarding.studyTime.VARIES" },
];

export const STUDY_TIME_PREFERENCES: readonly OnboardingOption[] = [
  { value: "MORNING", labelKey: "onboarding.studyTimePref.morning" },
  { value: "AFTERNOON", labelKey: "onboarding.studyTimePref.afternoon" },
  { value: "EVENING", labelKey: "onboarding.studyTimePref.evening" },
  { value: "NIGHT", labelKey: "onboarding.studyTimePref.night" },
  { value: "VARIES", labelKey: "onboarding.studyTimePref.varies" },
];

// ------------------------------------------------------------
// 7) CÁCH MUỐN AI HỖ TRỢ (multi-select -> thành prompt thật)
// ------------------------------------------------------------

/**
 * Đây KHÔNG phải sở thích trang trí: mỗi giá trị được `lib/personalization`
 * dịch thành chỉ dẫn cụ thể trong system prompt của Tutor / Quiz.
 * Thêm option mới ở đây mà không thêm vào PROMPT_BEHAVIOR sẽ khiến lựa chọn
 * đó im lặng — nên 2 bảng phải cùng cập nhật.
 */
export const AI_PREFERENCES: readonly OnboardingOption[] = [
  { value: "EXPLAIN_SIMPLE", labelKey: "onboarding.aiPref.EXPLAIN_SIMPLE" },
  { value: "TUTOR_ROLE", labelKey: "onboarding.aiPref.TUTOR_ROLE" },
  { value: "STEP_BY_STEP", labelKey: "onboarding.aiPref.STEP_BY_STEP" },
  { value: "NO_DIRECT_ANSWER", labelKey: "onboarding.aiPref.NO_DIRECT_ANSWER" },
  { value: "EXAMPLES", labelKey: "onboarding.aiPref.EXAMPLES" },
  { value: "CREATE_EXERCISES", labelKey: "onboarding.aiPref.CREATE_EXERCISES" },
  { value: "SUMMARIZE", labelKey: "onboarding.aiPref.SUMMARIZE" },
  { value: "MINDMAP", labelKey: "onboarding.aiPref.MINDMAP" },
  { value: "TRACK_PROGRESS", labelKey: "onboarding.aiPref.TRACK_PROGRESS" },
  { value: "WEAKNESS_ANALYSIS", labelKey: "onboarding.aiPref.WEAKNESS_ANALYSIS" },
  { value: "ROADMAP", labelKey: "onboarding.aiPref.ROADMAP" },
  { value: "REMINDERS", labelKey: "onboarding.aiPref.REMINDERS" },
  { value: "QUIZ", labelKey: "onboarding.aiPref.QUIZ" },
  { value: "FLASHCARDS", labelKey: "onboarding.aiPref.FLASHCARDS" },
];

// ------------------------------------------------------------
// 8) CÁCH HỌC ƯU TIÊN (không gọi là "learning style" cố định)
// ------------------------------------------------------------

/**
 * CỐ Ý gọi là "learning preference" chứ không phải "learning style": đây chỉ là
 * sở thích lúc này và có thể đổi. Không có mô hình nào trong app gắn nhãn
 * người dùng vào một kiểu học cố định (đó là quan niệm không có bằng chứng và
 * sẽ khóa AI vào 1 cách dạy).
 */
export const LEARNING_PREFERENCES: readonly OnboardingOption[] = [
  { value: "EXPLAIN_FIRST", labelKey: "onboarding.learnPref.EXPLAIN_FIRST" },
  { value: "TRY_FIRST", labelKey: "onboarding.learnPref.TRY_FIRST" },
  { value: "EXAMPLES", labelKey: "onboarding.learnPref.EXAMPLES" },
  { value: "VISUAL", labelKey: "onboarding.learnPref.VISUAL" },
  { value: "Q_AND_A", labelKey: "onboarding.learnPref.Q_AND_A" },
  { value: "MIXED", labelKey: "onboarding.learnPref.MIXED" },
];

// ------------------------------------------------------------
// 9) NGÀNH HỌC / NGHỀ NGHIỆP
// ------------------------------------------------------------

/**
 * Lựa chọn gợi ý cho "ngành học" (sv) và "nghề nghiệp" (đi làm).
 *
 * VÌ SAO CẦN GỢI Ý THAY VÌ CHỈ GÕ TỰ DO: ô nhập tự do khiến phần lớn user
 * bỏ trống vì không biết nên viết thế nào. Có danh sách gợi ý + ô tự do thì
 * người đã biết bấm 1 cái (nhanh), người chưa biết vẫn gõ được — và giá trị
 * gõ tự do được giữ nguyên trong DB, KHÔNG ép vào danh sách.
 *
 * Danh sách này CỐ Ý ngắn và phổ biến: nhét hết 200 ngành không làm AI hiểu
 * người dùng tốt hơn, chỉ làm khó đọc.
 */
export const MAJORS: readonly OnboardingOption[] = [
  { value: "CNTT", labelKey: "onboarding.major.CNTT" },
  { value: "KHOA_HOC", labelKey: "onboarding.major.KHOA_HOC" },
  { value: "Y_DUOC", labelKey: "onboarding.major.Y_DUOC" },
  { value: "SU_PHAM", labelKey: "onboarding.major.SU_PHAM" },
  { value: "KINH_TE", labelKey: "onboarding.major.KINH_TE" },
  { value: "QUAN_TRI", labelKey: "onboarding.major.QUAN_TRI" },
  { value: "NGON_NGU", labelKey: "onboarding.major.NGON_NGU" },
  { value: "THAT_MOI_TRUONG", labelKey: "onboarding.major.THAT_MOI_TRUONG" },
  { value: "NGHE_THUAT", labelKey: "onboarding.major.NGHE_THUAT" },
  { value: "OTHER_MAJOR", labelKey: "onboarding.major.OTHER_MAJOR" },
];

export const OCCUPATIONS: readonly OnboardingOption[] = [
  { value: "IT", labelKey: "onboarding.occupation.IT" },
  { value: "GIAO_DUC", labelKey: "onboarding.occupation.GIAO_DUC" },
  { value: "Y_TE", labelKey: "onboarding.occupation.Y_TE" },
  { value: "KE_TOAN", labelKey: "onboarding.occupation.KE_TOAN" },
  { value: "XUAT_NHAP_KHAU", labelKey: "onboarding.occupation.XUAT_NHAP_KHAU" },
  { value: "SAN_XUAT", labelKey: "onboarding.occupation.SAN_XUAT" },
  { value: "DICH_VU", labelKey: "onboarding.occupation.DICH_VU" },
  { value: "SALES_MARKETING", labelKey: "onboarding.occupation.SALES_MARKETING" },
  { value: "NGHELAO", labelKey: "onboarding.occupation.NGHELAO" },
  { value: "OTHER_OCCUPATION", labelKey: "onboarding.occupation.OTHER_OCCUPATION" },
];

/** Gợi ý theo giai đoạn: sv chọn ngành, người đi làm chọn nghề. */
export function fieldOptionsForStage(stage: string | undefined): readonly OnboardingOption[] {
  if (stage === "UNIVERSITY" || stage === "POSTGRAD") return MAJORS;
  if (stage === "WORKING") return OCCUPATIONS;
  return [];
}

// ------------------------------------------------------------
// 10) ĐỊNH HƯỚNG TƯƠNG LAI
// ------------------------------------------------------------

/**
 * Câu hỏi "kể từ giờ bạn muốn đi về đâu" — thứ quyết định AI nên kéo lộ trình
 * về phía nào trong 6 tháng tới.
 *
 * `UNDECIDED` ("chưa quyết") là lựa chọn HỢP LỆ và đứng ngang hàng các lựa
 * chọn khác: ép người 17 tuổi chọn "nghiên cứu khoa học" chỉ để lấy dữ liệu là
 * lấy dữ liệu sai (nguyên tắc "AI không tự bịa" — xem lib/onboarding/profile.ts).
 */
export const FUTURE_GOALS: readonly OnboardingOption[] = [
  { value: "DAIHOC", labelKey: "onboarding.future.DAIHOC" },
  { value: "NGHIEN_CUU", labelKey: "onboarding.future.NGHIEN_CUU" },
  { value: "SU_NGHIEP", labelKey: "onboarding.future.SU_NGHIEP" },
  { value: "THANG_TIEN", labelKey: "onboarding.future.THANG_TIEN" },
  { value: "CHUYEN_NGHE", labelKey: "onboarding.future.CHUYEN_NGHE" },
  { value: "KHOI_NGHIEP", labelKey: "onboarding.future.KHOI_NGHIEP" },
  { value: "KY_NANG", labelKey: "onboarding.future.KY_NANG" },
  { value: "GIAI_TRI", labelKey: "onboarding.future.GIAI_TRI" },
  { value: "UNDECIDED", labelKey: "onboarding.future.UNDECIDED" },
];

/** Gợi ý theo nhóm tuổi — đưa cả 9 lựa chọn cho học sinh lớp 7 là nhiễu. */
export function futureOptionsForStage(stage: string | undefined): readonly OnboardingOption[] {
  if (stage === "THCS" || stage === "THPT") {
    return FUTURE_GOALS.filter((o) =>
      ["DAIHOC", "NGHIEN_CUU", "SU_NGHIEP", "KHOI_NGHIEP", "UNDECIDED"].includes(o.value)
    );
  }
  if (stage === "UNIVERSITY" || stage === "POSTGRAD") {
    return FUTURE_GOALS.filter((o) =>
      ["NGHIEN_CUU", "SU_NGHIEP", "CHUYEN_NGHE", "KHOI_NGHIEP", "UNDECIDED"].includes(o.value)
    );
  }
  if (stage === "WORKING") {
    return FUTURE_GOALS.filter((o) =>
      ["THANG_TIEN", "SU_NGHIEP", "CHUYEN_NGHE", "KHOI_NGHIEP", "KY_NANG", "UNDECIDED"].includes(o.value)
    );
  }
  return FUTURE_GOALS;
}

// ------------------------------------------------------------
// 11) BỘ LỰA CHỌN THEO GIAI ĐOẠN (câu hỏi "muốn hỗ trợ gì")
// ------------------------------------------------------------

/**
 * `INTENTS` là danh sách HỢP NHẤT (validate 1 lần ở server). Bản "theo giai
 * đoạn" chỉ là CÁC TẬP CON của nó — nhờ vậy mọi giá trị UI sinh ra đều đã hợp
 * lệ (không sinh lỗi validate) và không phải duy trì 2 danh sách song song.
 */
const INTENTS_BY_STAGE_GROUP: Readonly<Record<string, readonly string[]>> = {
  SCHOOL: ["SCHOOL", "SCORE", "REVIEW_EXAM", "GRADUATE_EXAM", "UNIVERSITY_PREP", "COMPETITION"],
  UNIVERSITY: ["SCORE", "REVIEW_EXAM", "PROGRAMMING", "NEW_FIELD", "HABIT", "CAREER_EXPLORE"],
  WORKING: ["NEW_FIELD", "PROGRAMMING", "LANGUAGE", "HABIT", "CAREER_EXPLORE"],
  SELF: ["NEW_FIELD", "LANGUAGE", "PROGRAMMING", "HABIT", "OTHER"],
};

function stageGroup(stage: string | undefined): string | undefined {
  if (stage === "THCS" || stage === "THPT") return "SCHOOL";
  if (stage === "UNIVERSITY" || stage === "POSTGRAD") return "UNIVERSITY";
  if (stage === "WORKING") return "WORKING";
  if (stage === "SELF_LEARNING" || stage === "OTHER") return "SELF";
  return undefined;
}

function subset(source: readonly OnboardingOption[], values: readonly string[]): OnboardingOption[] {
  return source.filter((o) => values.includes(o.value));
}

/** Câu hỏi "Bạn muốn LearnX hỗ trợ điều gì?" — đổi danh sách theo nhóm. */
export function intentsForStage(stage: string | undefined): readonly OnboardingOption[] {
  const group = stageGroup(stage);
  // Chưa chọn giai đoạn -> hiện toàn bộ: hơn hỏi ít nhưng hỏi sai.
  return group ? subset(INTENTS, INTENTS_BY_STAGE_GROUP[group]) : INTENTS;
}

// ------------------------------------------------------------
// TRA CỨU NHANH (validate ở server dùng các Set này)
// ------------------------------------------------------------

function toSet(options: readonly OnboardingOption[]): ReadonlySet<string> {
  return new Set(options.map((o) => o.value));
}

export const EDUCATION_STAGE_VALUES: ReadonlySet<string> = toSet(EDUCATION_STAGES);
export const TRACK_VALUES: ReadonlySet<string> = toSet(TRACKS);
export const INTENT_VALUES: ReadonlySet<string> = toSet(INTENTS);
export const GOAL_CATEGORY_VALUES: ReadonlySet<string> = toSet(GOAL_CATEGORIES);
export const CAREER_FIELD_VALUES: ReadonlySet<string> = toSet(CAREER_FIELDS);
export const CAREER_STATUS_VALUES: ReadonlySet<string> = toSet(CAREER_STATUSES);
export const STUDY_TIME_VALUES: ReadonlySet<string> = toSet(STUDY_TIMES);
export const STUDY_TIME_PREFERENCE_VALUES: ReadonlySet<string> = toSet(STUDY_TIME_PREFERENCES);
export const AI_PREFERENCE_VALUES: ReadonlySet<string> = toSet(AI_PREFERENCES);
export const LEARNING_PREFERENCE_VALUES: ReadonlySet<string> = toSet(LEARNING_PREFERENCES);
export const SUBJECT_INTEREST_VALUES: ReadonlySet<string> = new Set(SUBJECT_INTERESTS);
export const FUTURE_GOAL_VALUES: ReadonlySet<string> = toSet(FUTURE_GOALS);

/**
 * Mọi giá trị hợp lệ của `field` (ngành/nghề) — MAJORS + OCCUPATIONS gộp lại.
 *
 * Validate ở server dùng Set này, KHÔNG dùng Set của từng nhóm: `field` được
 * gửi 1 lần không kèm giai đoạn, nên không biết nó thuộc nhóm nào để kiểm.
 * Rủi ro lệch nhóm không đáng kể (và đã bị chặn bởi intent phía trên).
 */
export const FIELD_VALUES: ReadonlySet<string> = new Set([
  ...MAJORS.map((o) => o.value),
  ...OCCUPATIONS.map((o) => o.value),
]);

/** Field có thực sự áp dụng cho giai đoạn này không (siết thêm 1 lớp). */
export function isValidFieldForStage(stage: string | undefined, field: string): boolean {
  return fieldOptionsForStage(stage).some((o) => o.value === field);
}

/** Grade hợp lệ cho 1 giai đoạn (dùng validate chéo, không chỉ check "có phải số"). */
export function gradeOptionsFor(stage: string | undefined): readonly OnboardingOption[] {
  return stage ? (GRADES_BY_STAGE[stage] ?? []) : [];
}

export function isValidGradeForStage(stage: string | undefined, grade: string): boolean {
  return gradeOptionsFor(stage).some((g) => g.value === grade);
}

/** Giai đoạn có hỏi tiếp lớp/định hướng không — UI và validate dùng chung. */
export function stageFollowsUp(stage: string | undefined): boolean {
  return stage === "THCS" || stage === "THPT";
}
