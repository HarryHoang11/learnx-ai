// ================================================================
// PERSONALIZATION CONTEXT — biến hồ sơ học tập thành chỉ dẫn cho AI
//
// Mạch tư duy: đây là TẦNG NỀN của toàn bộ tính năng cá nhân hoá. Mọi thứ AI
// (Tutor, Diagnostic, Roadmap, Quiz, Study Guide) đều lấy ngữ cảnh từ đây,
// thay vì mỗi chỗ tự chế lại. Hai lợi ích rõ ràng:
//   1. Người dùng đổi 1 tuỳ chọn trong Account -> AI đổi hành vi NGAY ở mọi
//      nơi, không phải sửa lại từng prompt.
//   2. Prompt không bị "lệch phiên bản" giữa các service (một chỗ có, một
//      chỗ không).
//
// FILE NÀY THUẦN TUYẾN (không DB, không AI) — nên test được bằng vitest, và
// service (services/personalization.service.ts) chỉ việc lấy dữ liệu rồi gọi
// vào đây.
//
// NGUYÊN TẮC SỐ 18 — KHÔNG BỊA HỒ SƠ:
// Hàm này CHỈ DIỄN GIẢI dữ liệu người dùng đã cung cấp. Tuyệt đối không
// suy luận ("chọn Tin học => chắc chắn muốn làm AI Engineer"). Mọi dòng suy
// ra đều phải gắn nhãn rõ là do AI gợi ý, không phải dữ liệu người dùng.
// ================================================================

import type { LearningProfile, LearningGoalDraft } from "@/lib/onboarding/profile";

/** Dữ liệu học THẬT (không phải tự khai) — đi kèm hồ sơ để AI biết user
 *  đang mạnh/yếu chỗ nào thay vì đoán từ bản khai. */
export interface SkillSignal {
  subject: string;
  topic: string;
  masteryPercent: number;
  isWeak: boolean;
}

export interface LearningContextInput {
  profile: LearningProfile | null;
  goals: LearningGoalDraft[];
  skills?: SkillSignal[];
  language?: "vi" | "en";
}

/** Chuỗi ngữ cảnh đã diễn giải, dán thẳng vào system prompt. */
export interface LearningContext {
  prompt: string;
  summary: LearningContextSummary;
}

export interface LearningContextSummary {
  hasProfile: boolean;
  educationStage: string | null;
  grade: string | null;
  track: string | null;
  intents: string[];
  subjects: string[];
  careerStatus: string | null;
  careerFields: string[];
  studyTime: string | null;
  studyTimePreference: string | null;
  aiPreferences: string[];
  learningPreferences: string[];
  goals: LearningGoalDraft[];
  weakTopics: string[];
}

// ------------------------------------------------------------
// 1) TUỲ CHỌN AI -> CHỈ DẪN HÀNH VI THẬT
// ------------------------------------------------------------

/**
 * Bảng dịch lựa chọn -> câu chỉ dẫn cho AI.
 *
 * ĐÂY là chỗ chứng minh dữ liệu onboarding KHÔNG phải trang trí: user chọn
 * "Không đưa đáp án ngay" thì Tutor thực sự không đưa đáp án (đè lên quy tắc
 * Socratic sẵn có), chọn "Gợi ý từng bước" thì prompt bắt buộc chia nhỏ bước.
 *
 * Không có entry = lựa chọn đó bị bỏ qua. Vì vậy thêm option mới vào
 * `options.ts` mà quên thêm ở đây sẽ khiến lựa chọn im lặng — 2 bảng phải
 * cập nhật cùng nhau.
 */
export const PROMPT_BEHAVIOR: Record<string, string> = {
  EXPLAIN_SIMPLE: "Giải thích bằng ngôn ngữ đơn giản, tránh thuật ngữ khi không cần.",
  TUTOR_ROLE: "Đóng vai gia sư đồng hành thay vì chỉ ra lệnh/bài tập.",
  STEP_BY_STEP: "Chia mọi lời giải thành từng bước nhỏ, đánh số rõ ràng.",
  NO_DIRECT_ANSWER: "TUYỆT ĐỐI không đưa đáp án cuối cùng; dùng câu hỏi dẫn dắt để học sinh tự tìm ra.",
  EXAMPLES: "Kèm ví dụ cụ thể, ưu tiên ví dụ gần với tình huống học sinh đang gặp.",
  CREATE_EXERCISES: "Chủ động đề xuất bài tập để luyện ngay sau khi giải thích xong.",
  SUMMARIZE: "Kết thúc bằng phần tóm tắt ngắn các ý chính.",
  MINDMAP: "Gợi ý cấu trúc dạng mind map khi nội dung có nhiều nhánh.",
  TRACK_PROGRESS: "Nhắc học sinh mức độ tiến bộ hiện tại thay vì coi như bắt đầu.",
  WEAKNESS_ANALYSIS: "Chỉ ra điểm yếu cụ thể dựa trên dữ liệu học tập đã có, không đoán bừa.",
  ROADMAP: "Gợi ý bước tiếp theo trong lộ trình thay vì chỉ giải quyết câu hỏi hiện tại.",
  REMINDERS: "Nhắc lịch học/ôn tập khi thấy học sinh quên hoặc bỏ dở.",
  QUIZ: "Đề xuất kiểm tra nhanh bằng quiz sau khi học xong một phần.",
  FLASHCARDS: "Đề xuất flashcard cho các ý trí nhớ lâu dài.",
};

/**
 * Cách học ưu tiên -> cách trình bày. KHÔNG phải nhãn "kiểu học" cố định, chỉ là
 * định dạng ưu tiên lúc này và có thể đổi bất cứ lúc nào.
 */
export const LEARNING_STYLE_HINT: Record<string, string> = {
  EXPLAIN_FIRST: "Học sinh thích xem phần giải thích trước khi làm bài.",
  TRY_FIRST: "Học sinh thích tự làm thử trước, sai rồi mới xem lời giải.",
  EXAMPLES: "Học sinh tiếp thu tốt qua ví dụ thực tế.",
  VISUAL: "Ưu tiên mô tả bằng sơ đồ, bảng, công thức trực quan.",
  Q_AND_A: "Học sinh thích hỏi đáp trực tiếp.",
  MIXED: "Học sinh muốn kết hợp nhiều cách học.",
};

/** Nhãn tiếng Việt cho các giá trị enum, dùng trong prompt và UI Account. */
const LABELS: Record<string, string> = {
  THCS: "THCS", THPT: "THPT", UNIVERSITY: "Đại học/Cao đẳng", POSTGRAD: "Sau đại học",
  WORKING: "Đã đi làm", SELF_LEARNING: "Tự học", OTHER: "Khác",
  SCIENCE: "Khoa học tự nhiên", SOCIAL: "Khoa học xã hội", MATH: "Chuyên Toán",
  INFORMATICS: "Chuyên Tin", ENGLISH: "Chuyên Anh", UNSURE: "Chưa xác định",
  SCHOOL: "học tốt hơn ở trường", SCORE: "cải thiện điểm số", REVIEW_EXAM: "ôn thi",
  GRADUATE_EXAM: "thi THPT", COMPETITION: "học sinh giỏi/Olympic", PROGRAMMING: "học lập trình",
  LANGUAGE: "học ngoại ngữ", NEW_FIELD: "tự học lĩnh vực mới", HABIT: "xây dựng thói quen học",
  CAREER_EXPLORE: "khám phá ngành nghề", UNIVERSITY_PREP: "chuẩn bị đại học",
  UNDER_30: "dưới 30 phút/ngày", "30_60": "30-60 phút/ngày", "1_2_HOURS": "1-2 giờ/ngày",
  "2_4_HOURS": "2-4 giờ/ngày", OVER_4_HOURS: "trên 4 giờ/ngày", VARIES: "thời gian không cố định",
  MORNING: "buổi sáng", AFTERNOON: "buổi chiều", EVENING: "buổi tối", NIGHT: "ban đêm",
  UNDECIDED: "chưa biết", EXPLORING: "đang khám phá", "A few options": "có vài lựa chọn",
  SET: "đã xác định",
  CLASS_SCORE: "tăng điểm trên lớp", EXAM: "chuẩn bị kỳ thi", CERTIFICATE: "đạt chứng chỉ",
  FOUNDATION: "nắm chắc nền tảng", SKILL: "học kỹ năng mới",
  EXPLORE: "khám phá lĩnh vực mới",
};

/** Dịch 1 giá trị enum sang nhãn tiếng Việt để đưa vào prompt. */
export function labelFor(value: string): string {
  if (LABELS[value]) return LABELS[value];
  // Nghề nghiệp / môn học vốn đã là chuỗi tiếng Anh có nghĩa, giữ nguyên.
  return value;
}

/**
 * Trình độ hiện tại của người học, dạng câu tiếng Việt để đưa thẳng vào prompt
 * ("lớp 11", "sinh viên năm 2", "người đi làm").
 *
 * VÌ SAO CẦN: yêu cầu §22 — "không để AI tự đoán subject/grade nếu hệ thống đã
 * biết". Hệ thống ĐÃ biết (onboarding hỏi `educationStage` + `grade`), nên phải
 * nói ra thay vì để AI suy.
 *
 * HỢP ĐỒNG: trả `undefined` khi hồ sơ rỗng — đúng như `buildLearningContext`,
 * prompt rỗng tốt hơn prompt bịa. Lưu ý `learningProfile` là cột JSON, có thể
 * là `null`, hoặc là object thiếu field, nên đọc kiểu phòng vệ.
 */
/**
 * Câu mô tả trình độ lớp ĐÃ LƯU, dùng chung cho mọi prompt (`"học sinh lớp 11"`).
 *
 * Tách ra để nơi đọc dữ liệu lớp đã lưu (ví dụ `Assessment.grade` của bài kiểm
 * tra đang chạy) diễn đạt ĐÚNG CÁCH với `readGradeLevel` — cùng một cách nói
 * trong prompt, không phải mỗi chỗ tự chế chuỗi ("lớp 11" / "cấp 3 lớp 11" /...).
 * Trả `undefined` khi giá trị rỗng/không phải số ("OTHER") — prompt rỗng tốt
 * hơn prompt bịa.
 */
export function gradeLevelText(grade: string | null | undefined): string | undefined {
  if (typeof grade !== "string") return undefined;
  const trimmed = grade.trim();
  return /^\d+$/.test(trimmed) ? `học sinh lớp ${trimmed}` : undefined;
}

export function readGradeLevel(learningProfile: unknown): string | undefined {
  if (!learningProfile || typeof learningProfile !== "object") return undefined;
  const profile = learningProfile as Record<string, unknown>;

  // Enum `educationStage` lấy từ EDUCATION_STAGES trong lib/onboarding/options.ts
  // (THCS/THPT/UNIVERSITY/POSTGRAD/WORKING/SELF_LEARNING/OTHER). Cố ý dùng
  // CHÍNH TÊN đó thay vì bịa enum mới ở đây — nếu đổi danh sách ở options.ts
  // mà quên sửa file này thì hỏng ngầm.
  const stage = typeof profile.educationStage === "string" ? profile.educationStage : "";
  const grade = typeof profile.grade === "string" ? profile.grade : "";
  const field = typeof profile.field === "string" ? profile.field.trim() : "";

  if (stage === "THCS" || stage === "THPT") {
    // `grade` chỉ chứa số ("10", "11") khi thuộc nhóm này; "OTHER"/"" = chưa biết.
    return gradeLevelText(grade);
  }
  if (stage === "UNIVERSITY" || stage === "POSTGRAD") {
    return field ? `sinh viên ngành ${field}` : "sinh viên đại học";
  }
  if (stage === "WORKING") {
    return field ? `người đang làm việc trong lĩnh vực ${field}` : "người đang đi làm";
  }
  if (stage === "SELF_LEARNING") {
    return "người tự học";
  }
  return undefined;
}

// ------------------------------------------------------------
// 2) DỰNG NGỮ CẢNH
// ------------------------------------------------------------

/**
 * Dựng khối ngữ cảnh từ hồ sơ + mục tiêu + dữ liệu học thật.
 *
 * HỢP ĐỒNG QUAN TRỌNG: khi user CHƯA có gì, hàm trả prompt RỖNG (""). Lý do:
 * prompt rỗng tốt hơn prompt bịa. Nếu thêm câu "người dùng chưa cho biết
 * gì" thì AI sẽ bắt đầu tự suy đoán — đúng thứ ta cấm. Service chỉ nối khối
 * này vào prompt khi nó khác rỗng.
 */
/**
 * NGUYÊN TẮC DẠY THEO TRÌNH ĐỘ (yêu cầu §9 + §10).
 *
 * "Thích nghi" KHÔNG phải "luôn giải thích thật đơn giản":
 *  - Chủ đề YẾU (<50%): dựng nền tảng trước (khái niệm đơn giản → vì sao →
 *    ví dụ trực quan → liên hệ kiến thức đã biết → MỚI tới công thức), tuyệt đối
 *    không nhảy thẳng vào công thức nâng cao.
 *  - Chủ đề VỮNG (>=80%): rút gọn phần cơ bản, đi thẳng bản chất, dùng thuật
 *    ngữ phù hợp và nâng bài tập lên — hạ trình độ chỗ đã vững là lãng phí.
 *
 * Hàm thuần tuý để test được; `skills` là dữ liệu THẬT từ LearningProgress
 * (mastery 0-100), không phải tự khai của học sinh.
 */
export function buildAdaptiveTeachingRules(input: {
  weakTopics: string[];
  strongTopics: string[];
  grade?: string | null;
}): string[] {
  const lines: string[] = [];
  if (input.grade) {
    lines.push(
      `CÁCH DẠY BẮT BUỘC theo trình độ lớp ${input.grade}: nội dung, ví dụ và bài tập phải nằm trong chương trình lớp đó — KHÔNG dùng ví dụ vượt xa trình độ (ví dụ giải tích đại học cho học sinh lớp 10).`
    );
  }
  if (input.weakTopics.length > 0) {
    lines.push(
      `VỚI CHỦ ĐỀ ĐANG YẾU (${input.weakTopics.join(", ")}): dựng lại nền tảng theo thứ tự (1) khái niệm đơn giản, (2) "vì sao" đúng như vậy, (3) ví dụ trực quan, (4) liên hệ kiến thức học sinh đã biết, (5) mới đến công thức, (6) ví dụ có số, (7) để học sinh tự thử. KHÔNG nhảy thẳng vào công thức nâng cao.`
    );
  }
  if (input.strongTopics.length > 0) {
    lines.push(
      `VỚI CHỦ ĐỀ HỌC SINH ĐÃ VỮNG (${input.strongTopics.join(", ")}): bỏ phần giải thích cơ bản, đi thẳng vào bản chất, dùng thuật ngữ chuẩn và đưa bài tập khó hơn — hạ trình độ chỗ đã vững là lãng phí thời gian học sinh.`
    );
  }
  return lines;
}

export function buildLearningContext(input: LearningContextInput): LearningContext {
  const { profile, goals, skills = [] } = input;
  const weakTopics = skills.filter((s) => s.isWeak).map((s) => `${s.subject}/${s.topic}`);
  // Ngưỡng "vững" = 80% (khớp với ngưỡng `skillsMastered` ở Analytics) để
  // AI và thống kê nói cùng 1 ngôn ngữ về năng lực học sinh.
  const strongTopics = skills
    .filter((s) => !s.isWeak && s.masteryPercent >= 80)
    .map((s) => `${s.subject}/${s.topic}`);

  const summary: LearningContextSummary = {
    hasProfile: Boolean(profile),
    educationStage: profile?.educationStage ?? null,
    grade: profile?.grade ?? null,
    track: profile?.track ?? null,
    intents: profile?.intents ?? [],
    // otherSubject chỉ có nghĩa khi user chọn "Khác" — gộp vào để prompt thấy
    // đủ môn học thật.
    subjects: [
      ...(profile?.subjects ?? []).filter((s) => s !== "Khác"),
      ...(profile?.otherSubject ? [profile.otherSubject] : []),
    ],
    careerStatus: profile?.careerStatus ?? null,
    careerFields: profile?.careerFields ?? [],
    studyTime: profile?.studyTime ?? null,
    studyTimePreference: profile?.studyTimePreference ?? null,
    aiPreferences: profile?.aiPreferences ?? [],
    learningPreferences: profile?.learningPreferences ?? [],
    goals,
    weakTopics,
  };

  if (!profile && goals.length === 0 && weakTopics.length === 0) {
    return { prompt: "", summary };
  }

  const lines: string[] = [];
  const en = input.language === "en";

  // --- Học vấn ---
  if (summary.educationStage) {
    const parts = [labelFor(summary.educationStage)];
    if (summary.grade) parts.push(`lớp ${summary.grade}`);
    if (summary.track && summary.track !== "UNSURE") parts.push(labelFor(summary.track));
    lines.push(en ? `Education: ${parts.join(", ")}` : `Học vấn: ${parts.join(", ")}`);
  }

  // --- Mục đích ---
  if (summary.intents.length > 0) {
    const text = summary.intents.map(labelFor).join(", ");
    lines.push(en ? `Wants to: ${text}` : `Mục đích: ${text}`);
  }

  // --- Mục tiêu ---
  if (goals.length > 0) {
    const text = goals
      .map((g) => (g.target ? `"${g.title}" (đạt ${g.target})` : `"${g.title}"`))
      .join("; ");
    lines.push(en ? `Goals: ${text}` : `Mục tiêu: ${text}`);
  } else if (profile?.goalCategory) {
    lines.push(
      en
        ? `Goal focus: ${labelFor(profile.goalCategory)}`
        : `Mục tiêu: ${labelFor(profile.goalCategory)}`
    );
  }

  // --- Môn học ---
  if (summary.subjects.length > 0) {
    lines.push(
      en
        ? `Subjects of interest: ${summary.subjects.join(", ")}`
        : `Môn quan tâm: ${summary.subjects.join(", ")}`
    );
  }

  // --- Nghề nghiệp: nói thẳng mức độ chắc chắn, KHÔNG suy ra định hướng ---
  if (summary.careerStatus === "UNDECIDED" || summary.careerStatus === "EXPLORING") {
    lines.push(
      en
        ? "Career: not decided yet — offer career exploration, do NOT assume a target field."
        : "Nghề nghiệp: chưa xác định — có thể gợi ý khám phá nghề, KHÔNG được coi là đã chọn ngành."
    );
  } else if (summary.careerFields.length > 0) {
    lines.push(
      en
        ? `Career interest (user-stated): ${summary.careerFields.join(", ")}`
        : `Ngành/nghề quan tâm (do người dùng nêu): ${summary.careerFields.join(", ")}`
    );
  }

  // --- Thời gian học ---
  if (summary.studyTime) {
    const when =
      summary.studyTimePreference && summary.studyTimePreference !== "VARIES"
        ? ` (thường học ${labelFor(summary.studyTimePreference).toLowerCase()})`
        : "";
    lines.push(
      en
        ? `Available study time: ${labelFor(summary.studyTime)}${when}`
        : `Thời gian học: ${labelFor(summary.studyTime)}${when}`
    );
  }

  // --- Dữ liệu học thật (không phải tự khai) ---
  if (weakTopics.length > 0) {
    lines.push(
      en
        ? `Weak topics (real data): ${weakTopics.join(", ")}`
        : `Chủ đề đang yếu (dữ liệu thật): ${weakTopics.join(", ")}`
    );
  }

  // --- QUY TẮC DẠY THEO TRÌNH ĐỘ (§9 + §10) ---
  // Dùng dữ liệu thật (LearningProgress) + lớp trong hồ sơ: mạnh thì đi
  // nhanh, yếu thì dựng nền tảng — KHÔNG hạ trình độ đại trày.
  lines.push(
    ...buildAdaptiveTeachingRules({
      weakTopics,
      strongTopics,
      grade: profile?.grade ?? null,
    })
  );

  // --- Chỉ dẫn hành vi từ tuỳ chọn AI ---
  const behaviors = summary.aiPreferences
    .map((p) => PROMPT_BEHAVIOR[p])
    .filter((v): v is string => Boolean(v));
  if (behaviors.length > 0) {
    lines.push(
      en
        ? `Tutor style the user chose: ${behaviors.join(" ")}`
        : `Cách hỗ trợ người dùng đã chọn: ${behaviors.join(" ")}`
    );
  }

  // --- Định dạng trình bày theo cách học ưu tiên ---
  const styles = summary.learningPreferences
    .map((p) => LEARNING_STYLE_HINT[p])
    .filter((v): v is string => Boolean(v));
  if (styles.length > 0) {
    lines.push(
      en
        ? `Preferred format: ${styles.join(" ")}`
        : `Định dạng trình bày ưu tiên: ${styles.join(" ")}`
    );
  }

  return { prompt: lines.join("\n"), summary };
}

/**
 * Chỉ dẫn hành vi đè lên quy tắc mặc định — dành cho chỗ cần quyết định CỨNG
 * (vd Tutor: không được đưa đáp án lần thứ 7 nếu user chưa tự tìm ra).
 *
 * Trả về `boolean` thay vì chuỗi prompt để call site dùng được trong điều kiện
 * mà không phải parse text.
 */
export function prefersNoDirectAnswer(aiPreferences: string[] | undefined): boolean {
  return aiPreferences?.includes("NO_DIRECT_ANSWER") ?? false;
}

/**
 * Suy đề xuất môn cho Diagnostic từ hồ sơ (yêu cầu §19).
 *
 * QUY TẮC: Diagnostic phải bám `grade/track/subjects/goals`, không phải lúc
 * nào cũng mặc định Toán.
 *
 * VÌ SAO AN TOÀN: hàm chỉ XẾP HẠNG lại danh sách môn hợp lệ mà hồ sơ đã nêu
 * (môn user chọn, môn có dữ liệu yếu thật). Nó KHÔNG tự chế môn mới — nếu user
 * chỉ chọn "Lập trình" thì đề xuất cũng chỉ có Lập trình. Đây là cách tuân
 * thủ "không bịa" một cách cơ học.
 */
export function suggestDiagnosticSubjects(summary: LearningContextSummary): string[] {
  const ranked: string[] = [];
  const push = (value: string | null | undefined) => {
    if (value && !ranked.includes(value)) ranked.push(value);
  };

  // 1) Môn user tự chọn trong hồ sơ (tín hiệu mạnh nhất).
  summary.subjects.forEach(push);
  // 2) Môn đang yếu theo dữ liệu học THẬT -> nên đánh giá để biết chỗ nào
  //    củng cố. weakTopics có dạng "Môn/Chủ đề", nên lấy phần trước "/".
  summary.weakTopics.forEach((w) => push(w.split("/")[0]));

  return ranked;
}
