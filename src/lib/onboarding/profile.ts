// ================================================================
// LEARNING PROFILE — shape + validation của hồ sơ học tập
//
// Mạch tư duy: `User.learningProfile` (JSONB trong Prisma) là nơi DUY NHẤT lưu
// hồ sơ học tập. File này là HỢP ĐỒNG của cột JSON đó — không có file này thì
// mọi nơi đọc/ghi JSON sẽ tự đoán shape và dữ liệu sẽ nhanh chóng hỗn độn.
//
// BA NGUYÊN TẮC CỐT LÕI (giữ xuyên suốt dự án):
//
//  1. AI KHÔNG TỰ BỊA HỒ SƠ.
//     Mọi giá trị ở đây đều do NGƯỜI DÙNG chọn/gõ. "Chưa biết nghề" là một
//     giá trị hợp lệ được lưu thật, KHÔNG phải null và KHÔNG phải lỗi. Engine
//     cá nhân hoá (lib/personalization) chỉ được đọc, không được suy diễn
//     ("chọn Tin học => chắc chắn muốn làm kỹ sư AI" — không được phép).
//
//  2. MỌI THỨ ĐỀU TUỲ CHỌN.
//     Không có field bắt buộc. Người dùng Skip ở bất kỳ bước nào vẫn vào được
//     app; profile chỉ "chưa đầy đủ" chứ không "sai".
//
//  3. VALIDATE Ở SERVER, LỊCH SỰ.
//     `sanitizeLearningProfile` là hàng rào duy nhất: nó nhận `unknown` (payload
//     JSON bất kỳ từ client) và trả về profile SẠCH + DANH SÁCH LỖI. Mọi API
//     route ghi profile đều đi qua đây — không route nào tự parse tay.
//
// VÌ SAO KHÔNG DÙNG ZOD:
//     Project chưa có Zod (xem package.json) và đã có sẵn quy ước validate tay
//     rõ ràng ở các route khác (vd api/assessment/start, api/roadmap/generate).
//     Thêm 1 dependency chỉ để validate 1 payload sẽ lệch khỏi pattern hiện có,
//     nên ở đây viết validator thuần, dễ test, trả về cả value lẫn lỗi.
// ================================================================

import {
  AI_PREFERENCE_VALUES,
  CAREER_FIELD_VALUES,
  CAREER_STATUS_VALUES,
  EDUCATION_STAGE_VALUES,
  FUTURE_GOAL_VALUES,
  GOAL_CATEGORY_VALUES,
  INTENT_VALUES,
  LEARNING_PREFERENCE_VALUES,
  STUDY_TIME_PREFERENCE_VALUES,
  STUDY_TIME_VALUES,
  SUBJECT_INTEREST_VALUES,
  TRACK_VALUES,
  isValidGradeForStage,
  stageFollowsUp,
} from "./options";

/** Giới hạn độ dài — chống payload rác làm prompt AI phình to. */
export const GOAL_TEXT_MAX = 200;
export const SUBJECT_MAX = 120;
/**
 * Giới hạn riêng cho `futureGoal`: đây là ENUM (xem FUTURE_GOAL_VALUES), nên
 * giá trị hợp lệ ngắn. Giới hạn thấp giúp chặn sớn chuỗi rác dài thay vì
 * phải chạy tới bước kiểm tra Set mới báo lỗi.
 */
const FUTURE_GOAL_MAX = 40;
const LIST_MAX = 8;
/** Tên trường học: chuỗi tự do, độ dài tương tự `otherSubject`. */
export const SCHOOL_MAX = 120;

/** 1 mục tiêu người dùng khai trong onboarding. */
export interface LearningGoalDraft {
  title: string;
  category?: string;
  target?: string;
  deadline?: string; // ISO date (yyyy-mm-dd)
  priority?: number; // 1 = cao, 2 = thường, 3 = thấp
}

/**
 * Hồ sơ học tập đầy đủ. Mọi field đều optional.
 *
 * `version` cho phép migrate shape sau này mà vẫn đọc được dữ liệu cũ (hiện
 * tại chỉ có version 1).
 */
export interface LearningProfile {
  version: 1;
  educationStage?: string;
  grade?: string;
  track?: string;
  /** Trường học (tự nhập, tùy chọn) — dùng cho AI Tutor/giáo viên tham chiếu. */
  school?: string;
  intents?: string[];
  goalCategory?: string;
  goals?: LearningGoalDraft[];
  subjects?: string[];
  otherSubject?: string;
  careerStatus?: string;
  careerFields?: string[];
  studyTime?: string;
  studyTimePreference?: string;
  aiPreferences?: string[];
  learningPreferences?: string[];
  /** Trình độ tự đánh giá (giữ tương thích với Quick Setup cũ). */
  level?: string;
  // ---- Bổ sung cho khảo sát 5 phase (mở rộng, KHÔNG phá dữ liệu cũ) ----
  /**
   * Ngành học (sv) hoặc nghề nghiệp (đi làm) — giá trị trong
   * `FIELD_VALUES` (options.ts) HOẶC chuỗi tự do user gõ (≤120 ký tự).
   *
   * CỐ Ý cho phép chuỗi tự do: danh sách gợi ý không thể bao hết ngành học, và
   * ép người dùng chọn "Khác" rồi không gõ gì sẽ mất thông tin hơn là gõ tay.
   */
  field?: string;
  /**
   * Chủ đề người TỰ HỌC gõ tay (nhóm SELF_LEARNING / OTHER) — văn bản tự do,
   * KHÔNG phải mảng.
   *
   * VÌ SAO KHÔNG PHẢI `string[]`: câu hỏi gốc là "bạn muốn tự học về chủ đề
   * gì?" và UI dùng MỘT ô nhập, ví dụ "Excel cho kế toán, tiếng Anh giao
   * tiếp". Người tự học hay ghi cụm tự nhiên, tách thành mảng sẽ phải bắt họ
   * bấm chọn từng từ khoá rồi tự nhập lại -> vừa nặng UX vừa mất thông tin.
   * Phần "môn/chủ đề có cấu trúc" đã có sẵn ở `subjects` (mảng enum, chọn
   * nhiều được) và `goals[].title`.
   *
   * Vì vậy 2 field này có hình dạng khác nhau một cách CÓ CHỦ ĐÍCH, và cả hai
   * đều được dùng đúng ở mọi nơi: validate, merge, hiển thị (ProfileReady),
   * tiến trình (steps.ts), prompt AI.
   */
  topics?: string;
  /** Định hướng tương lai — giá trị trong `FUTURE_GOAL_VALUES`. */
  futureGoal?: string;
  /**
   * Mốc user ĐÃ CHỐT khảo sát (hoàn tất hoặc bỏ qua) — ISO string.
   *
   * VÌ SAO NẰM TRONG JSON MÀ KHÔNG THÊM CỘT: đây là quyết định của người dùng
   * về chính hồ sơ đó, không phải thuộc tính dòng user; và nó luôn đi cùng
   * `learningProfile` nên proxy đọc 1 chỗ là đủ. Thêm cột riêng sẽ tạo 2 nơi
   * nói về cùng 1 sự thật — đúng cái lỗi việc này cần tránh.
   */
  surveyDecidedAt?: string;
}

// ------------------------------------------------------------
// HÀM THUẦN — không đụng DB/React, test được
// ------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Chuỗi đã trim, hoặc undefined nếu rỗng/quá dài. */
function cleanString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : undefined;
}

/**
 * Kết quả đọc 1 field văn bản tự do từ patch.
 *
 * VÌ SAO CẦN discriminated union thay vì `string | undefined`:
 * `cleanString()` gộp 3 trạng thái KHÁC NHAU vào cùng `undefined`:
 *   1. sai kiểu (mảng/số)   -> phải BÁO LỖI
 *   2. rỗng sau trim ("")    -> KHÔNG phải lỗi, đây là tín hiệu "xoá field"
 *   3. quá độ dài           -> phải BÁO LỖI
 * Gộp chung khiến case 2 — hợp đệ mệnh với frontend — bị coi nhầm là case 1.
 * Hậu quả: `mergeLearningProfile()` không bao giờ nhìn thấy `""` nên không
 * xoá được giá trị cũ => người dùng đã chọn "Kinh tế" rồi xoá ô thì DB vẫn
 * giữ "Kinh tế" mãi mãi.
 */
type TextField =
  /** Không có trong patch — không đụng vào field. */
  | { kind: "absent" }
  /** Có mặt và rỗng — người dùng đã xoá: yêu cầu merge XOÁ field. */
  | { kind: "clear" }
  /** Giá trị hợp lệ đã trim. */
  | { kind: "value"; value: string }
  /** Dữ liệu sai — giữ nguyên validation, chỉ báo lỗi cụ thể hơn. */
  | { kind: "invalid"; reason: string };

/**
 * Đọc 1 field văn bản tự do, phân biệt 4 trạng thái ở trên.
 *
 * VẪN validate chặt: sai kiểu hoặc quá độ dài đều trả `invalid` (server lo và
 * ghi log). Chỉ riêng chuỗi rỗng — tín hiệu bỏ chọn hợp lệ — mới được đi qua.
 */
function readTextField(value: unknown, maxLength: number, fieldName: string): TextField {
  // `undefined` = client không gửi field này. `null` cũng coi như vậy: JSON
  // không phân biệt, và merge sẽ giữ nguyên giá trị đang có.
  if (value === undefined || value === null) return { kind: "absent" };
  if (typeof value !== "string") {
    return { kind: "invalid", reason: `${fieldName} phải là chuỗi.` };
  }
  const trimmed = value.trim();
  if (trimmed === "") return { kind: "clear" };
  if (trimmed.length > maxLength) {
    return {
      kind: "invalid",
      reason: `${fieldName} dài ${trimmed.length} ký tự, tối đa ${maxLength}.`,
    };
  }
  return { kind: "value", value: trimmed };
}

/**
 * Chuẩn hoá 1 danh sách enum: bỏ giá trị lạ, bỏ rỗng, dedupe, giới hạn độ dài.
 * Dùng ReadonlySet để validate — Set.has là O(1) và giữ nguyên thứ tự user chọn.
 */
function cleanEnumList(
  value: unknown,
  allowed: ReadonlySet<string>,
  maxItems: number = LIST_MAX
): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim();
    if (!allowed.has(trimmed) || result.includes(trimmed)) continue;
    result.push(trimmed);
    if (result.length >= maxItems) break;
  }
  return result;
}

/** Chuẩn hoá 1 giá trị enum đơn; trả undefined nếu không hợp lệ. */
function cleanEnum(value: unknown, allowed: ReadonlySet<string>): string | undefined {
  return typeof value === "string" && allowed.has(value.trim()) ? value.trim() : undefined;
}

/** Ngày ISO hợp lệ (yyyy-mm-dd), chuẩn hoá về đầu ngày UTC để lưu Date. */
function cleanDate(value: unknown): string | undefined {
  const raw = cleanString(value, 40);
  if (!raw) return undefined;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

function cleanPriority(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 3
    ? value
    : undefined;
}

/** Chuẩn hoá 1 mục tiêu. Trả undefined nếu thiếu title (title là phần bắt buộc). */
function cleanGoalDraft(value: unknown): LearningGoalDraft | undefined {
  if (!isRecord(value)) return undefined;
  const title = cleanString(value.title, GOAL_TEXT_MAX);
  if (!title) return undefined;
  const draft: LearningGoalDraft = { title };
  const category = cleanEnum(value.category, GOAL_CATEGORY_VALUES);
  if (category) draft.category = category;
  const target = cleanString(value.target, GOAL_TEXT_MAX);
  if (target) draft.target = target;
  const deadline = cleanDate(value.deadline);
  if (deadline) draft.deadline = deadline;
  const priority = cleanPriority(value.priority);
  if (priority) draft.priority = priority;
  return draft;
}

/** Kết quả validate: value luôn an toàn để ghi DB, errors để trả về client. */
export interface SanitizedProfile {
  profile: LearningProfile;
  errors: string[];
}

/**
 * HÀNG RÀO DUY NHẤT — nhận payload bất kỳ, trả profile sạch + lỗi.
 *
 * QUY TẮC: giá trị SAI bị loại khỏi `profile` và ghi vào `errors`, nhưng KHÔNG
 * làm hỏng cả request. Lý do: onboarding là trải nghiệm nhẹ nhàng, một ô nhập
 * sai không được khiến user mất toàn bộ những gì đã trả lời ở các bước trước.
 * `errors` được log ở server để phát hiện client lệch phiên bản.
 */
export function sanitizeLearningProfile(input: unknown): SanitizedProfile {
  const profile: LearningProfile = { version: 1 };
  const errors: string[] = [];
  if (!isRecord(input)) return { profile, errors };

  // --- Giai đoạn học tập ---
  const stage = cleanEnum(input.educationStage, EDUCATION_STAGE_VALUES);
  if (stage) profile.educationStage = stage;
  else if (input.educationStage !== undefined) errors.push("educationStage không hợp lệ.");

  // Grade/track CHỈ hợp lệ khi giai đoạn là THCS/THPT — nếu không, loại bỏ
  // kèm cảnh báo thay vì âm thầm nhận (dữ liệu vô nghĩa làm nhiễu prompt).
  const followUp = stageFollowsUp(stage);
  if (followUp && input.grade !== undefined) {
    const grade = cleanString(input.grade, 20);
    if (grade && isValidGradeForStage(stage, grade)) profile.grade = grade;
    else errors.push("grade không hợp lệ với giai đoạn đã chọn.");
  }
  if (followUp && input.track !== undefined) {
    const track = cleanEnum(input.track, TRACK_VALUES);
    if (track) profile.track = track;
    else errors.push("track không hợp lệ.");
  }

  // Trường học: tự do nên KHÔNG có danh sách enum (hệ thống không có "danh
  // sách trường" và không được bịa). Dùng `readTextField` như các text field
  // khác: "" = xoá, sai kiểu/quá dài = báo lỗi. `cleanString` sẽ NUỐT mất
  // cả hai trường hợp -> người dùng xoá ô mà vẫn thấy giá trị cũ còn trong DB.
  if (input.school !== undefined) {
    const school = readTextField(input.school, SCHOOL_MAX, "school");
    if (school.kind === "value") profile.school = school.value;
    else if (school.kind === "clear") profile.school = "";
    else if (school.kind === "invalid") errors.push(school.reason);
  }

  // --- Mục đích ---
  if (input.intents !== undefined) {
    profile.intents = cleanEnumList(input.intents, INTENT_VALUES, LIST_MAX + 4);
  }

  // --- Mục tiêu ---
  const goalCategory = cleanEnum(input.goalCategory, GOAL_CATEGORY_VALUES);
  if (goalCategory) profile.goalCategory = goalCategory;
  else if (input.goalCategory !== undefined) errors.push("goalCategory không hợp lệ.");

  if (Array.isArray(input.goals)) {
    const goals = input.goals
      .map(cleanGoalDraft)
      .filter((g): g is LearningGoalDraft => g !== undefined)
      .slice(0, LIST_MAX);
    // Dedupe theo title — chống trùng khi user bấm "Thêm mục tiêu" nhiều lần.
    const seen = new Set<string>();
    profile.goals = goals.filter((g) => {
      const key = g.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // --- Môn học ---
  if (input.subjects !== undefined) {
    profile.subjects = cleanEnumList(input.subjects, SUBJECT_INTEREST_VALUES, LIST_MAX + 4);
  }
  // "Khác" mở ô nhập tự do; chỉ giữ khi user thực sự có "Khác" trong danh sách,
  // tránh tích tu text rác từ client.
  if (profile.subjects?.includes("Khác")) {
    // Dùng `readTextField` để `""` đi tới merge và XOÁ giá trị cũ. Trước đây
    // dùng `cleanString` -> xoá ô thì giá trị cũ mãi mãi còn trong DB.
    const other = readTextField(input.otherSubject, SUBJECT_MAX, "otherSubject");
    if (other.kind === "value") profile.otherSubject = other.value;
    else if (other.kind === "clear") profile.otherSubject = "";
    else if (other.kind === "invalid") errors.push(other.reason);
  }

  // --- Nghề nghiệp ---
  // "Chưa biết" là 1 GIÁ TRỊ HỢP LỆ, được lưu như mọi giá trị khác.
  const careerStatus = cleanEnum(input.careerStatus, CAREER_STATUS_VALUES);
  if (careerStatus) profile.careerStatus = careerStatus;
  else if (input.careerStatus !== undefined) errors.push("careerStatus không hợp lệ.");

  if (input.careerFields !== undefined) {
    profile.careerFields = cleanEnumList(input.careerFields, CAREER_FIELD_VALUES, LIST_MAX);
  }
  // Người chưa biết nghề ("UNDECIDED") thì danh sách lĩnh vực là vô nghĩa —
  // nhưng ta KHÔNG xoá, chỉ không hỏi UI nữa. Giữ dữ liệu thay vì suy diễn.

  // --- Thời gian học ---
  const studyTime = cleanEnum(input.studyTime, STUDY_TIME_VALUES);
  if (studyTime) profile.studyTime = studyTime;
  else if (input.studyTime !== undefined) errors.push("studyTime không hợp lệ.");

  const studyTimePreference = cleanEnum(input.studyTimePreference, STUDY_TIME_PREFERENCE_VALUES);
  if (studyTimePreference) profile.studyTimePreference = studyTimePreference;
  else if (input.studyTimePreference !== undefined) {
    errors.push("studyTimePreference không hợp lệ.");
  }

  // --- Tuỳ chọn AI & cách học ---
  if (input.aiPreferences !== undefined) {
    profile.aiPreferences = cleanEnumList(input.aiPreferences, AI_PREFERENCE_VALUES, LIST_MAX + 6);
  }
  if (input.learningPreferences !== undefined) {
    profile.learningPreferences = cleanEnumList(
      input.learningPreferences,
      LEARNING_PREFERENCE_VALUES,
      LIST_MAX
    );
  }

  // --- Trình độ tự đánh giá (tương thích ngược với Quick Setup) ---
  // ---- Field mới của khảo sát 5 phase ----
  //
  // Cả 3 field dưới đây dùng `readTextField` (không dùng `cleanString`) vì cần
  // phân biệt "rỗng = bỏ chọn" với "sai kiểu = dữ liệu rác". Chi tiết lý do ở
  // docstring của `readTextField`.
  //
  // `field` nhận CẢ giá trị trong danh sách LẪN chuỗi tự do: nếu chỉ nhận giá
  // trị trong danh sách thì "Đại học Bách Khoa" — cách duy nhất người dùng ghi
  // tên trường thật — sẽ bị loại và mất thông tin.
  const field = readTextField(input.field, SUBJECT_MAX, "field");
  if (field.kind === "value") profile.field = field.value;
  else if (field.kind === "clear") profile.field = "";
  else if (field.kind === "invalid") errors.push(field.reason);

  // `topics` là văn bản tự do ("Excel cho kế toán, tiếng Anh giao tiếp"),
  // KHÔNG phải mảng — xem giải thích ở interface LearningProfile.topics.
  const topics = readTextField(input.topics, GOAL_TEXT_MAX, "topics");
  if (topics.kind === "value") profile.topics = topics.value;
  else if (topics.kind === "clear") profile.topics = "";
  else if (topics.kind === "invalid") errors.push(topics.reason);

  const futureGoal = readTextField(input.futureGoal, FUTURE_GOAL_MAX, "futureGoal");
  if (futureGoal.kind === "value") {
    // Enum: giá trị lạ vẫn bị loại + báo lỗi, không lọt vào prompt AI.
    if (FUTURE_GOAL_VALUES.has(futureGoal.value)) profile.futureGoal = futureGoal.value;
    else errors.push(`futureGoal không hợp lệ: ${futureGoal.value}`);
  } else if (futureGoal.kind === "clear") profile.futureGoal = "";
  else if (futureGoal.kind === "invalid") errors.push(futureGoal.reason);

  // Mốc chốt khảo sát: server TỰ sinh, không tin giá trị client gửi lên —
  // chỉ kiểm tra chuỗi ngày để dữ liệu JSON luôn đọc được ở mọi nơi.
  if (input.surveyDecidedAt !== undefined) {
    const value = cleanString(input.surveyDecidedAt, 40);
    if (value === undefined) errors.push("surveyDecidedAt phải là chuỗi hợp lệ.");
    else if (value) {
      const parsed = new Date(value);
      if (Number.isNaN(parsed.getTime())) errors.push("surveyDecidedAt không phải ngày hợp lệ.");
      else profile.surveyDecidedAt = parsed.toISOString();
    }
  }

  const level = cleanString(input.level, 40);
  if (level) profile.level = level;

  return { profile, errors };
}

/**
 * Gộp 2 lần lưu một phần (PATCH từng bước onboarding).
 *
 * VÌ SAO CẦN: onboarding lưu sau TỪNG bước để refresh không mất dữ liệu. Nếu
 * mỗi lần ghi đè toàn bộ, user làm tới bước 5 rồi bỏ ngang ở bước 2 (đổi ý
 * quay lại) sẽ mất phần đã trả lời. Nên: chỉ ghi đè những field CÓ MẬT trong
 * patch, và xoá hẳn (set rỗng) khi người dùng BỎ CHỌN một lựa chọn.
 */
export function mergeLearningProfile(
  current: LearningProfile | null | undefined,
  patch: LearningProfile
): LearningProfile {
  const merged: LearningProfile = { ...(current ?? {}), version: 1 };

  const scalarKeys = [
    "educationStage",
    "grade",
    "track",
    "school",
    "goalCategory",
    "otherSubject",
    "careerStatus",
    "studyTime",
    "studyTimePreference",
    "level",
    // Field của khảo sát 5 phase — cùng cơ chế: chuỗi rỗng = bỏ chọn -> xoá.
    "field",
    "topics",
    "futureGoal",
  ] as const;

  for (const key of scalarKeys) {
    const value = patch[key];
    if (value === undefined) continue;
    if (value === "") {
      // Chuỗi rỗng = người dùng xoá lựa chọn -> xoá hẳn field.
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }

  const listKeys = [
    "intents",
    "subjects",
    "careerFields",
    "aiPreferences",
    "learningPreferences",
  ] as const;
  for (const key of listKeys) {
    const value = patch[key];
    if (value === undefined) continue;
    if (value.length === 0) delete merged[key];
    else merged[key] = value;
  }

  // goals: patch đã được dedupe sẵn; danh sách rỗng nghĩa là không có mục tiêu.
  if (patch.goals !== undefined) {
    if (patch.goals.length === 0) delete merged.goals;
    else merged.goals = patch.goals;
  }

  return merged;
}

/**
 * Phần trăm hoàn thiện hồ sơ (0-100).
 *
 * Dùng cho thanh tiến trình ĐỘNG (Dashboard) — KHÔNG phải nghĩa vụ. Vì vậy:
 *   - Field người dùng hợp lệ "không biết" (chưa biết nghề) KHÔNG tính là
 *     thiếu — chỉ thiếu khi user BỎ QUA bước đó.
 *   - Không bao giờ trả 100 khi còn bước bắt buộc nào chưa chạm tới.
 */
export function computeProfileCompletion(profile: LearningProfile | null | undefined): number {
  if (!profile) return 0;
  let score = 0;
  // Trọng số phản ánh mức độ ảnh hưởng tới chất lượng cá nhân hoá.
  if (profile.educationStage) score += 15;
  if (profile.intents?.length) score += 10;
  if (profile.goalCategory || profile.goals?.length) score += 20;
  if (profile.subjects?.length) score += 20;
  if (profile.careerStatus) score += 10; // "chưa biết" cũng là 1 câu trả lời
  if (profile.studyTime) score += 10;
  if (profile.aiPreferences?.length) score += 10;
  if (profile.learningPreferences?.length) score += 5;
  // Field của khảo sát 5 phase — trọng số NHỎ (2%) vì chỉ áp dụng cho một nhóm
  // người: cộng ở mức này giữ điểm cho nhóm khác mà không làm tụt nhóm này,
  // và người đủ dữ liệu vẫn đạt ngưỡng "đầy đủ" 80%.
  if (profile.field) score += 2;
  if (profile.topics) score += 2;
  if (profile.futureGoal) score += 2;
  return Math.min(100, score);
}

/** Profile đã "đầy đủ" chưa — dùng cho thông báo nhắc hoàn thiện. */
export function isProfileComplete(profile: LearningProfile | null | undefined): boolean {
  return computeProfileCompletion(profile) >= 80;
}

/** Profile có dữ liệu nào để cá nhân hoá chưa (dùng cho empty state của Tutor/Diagnostic). */
export function hasProfileSignal(profile: LearningProfile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    profile.educationStage ||
      profile.intents?.length ||
      profile.goalCategory ||
      profile.goals?.length ||
      profile.subjects?.length ||
      profile.aiPreferences?.length ||
      profile.learningPreferences?.length ||
      // Field của khảo sát 5 phase — dữ liệu này cũng đủ để AI cá nhân hoá.
      profile.field ||
      profile.topics ||
      profile.futureGoal ||
      profile.level
  );
}
