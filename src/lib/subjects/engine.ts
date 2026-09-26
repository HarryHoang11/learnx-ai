// ================================================================
// SUBJECT ENGINE — hành vi riêng của từng môn
// ------------------------------------------------------------
// Mạch tư duy: LearnX có 1 CORE LEARNING ENGINE (quiz, flashcard, SM-2,
// mastery, analytics, tutor) dùng chung cho MỌI môn. Những gì khác nhau giữa
// Toán và Tiếng Anh KHÔNG được rải trong React component — nó nằm ở đây, dạng
// dữ liệu + hàm thuần.
//
// VÌ SAO TÁCH KHỎI lib/constants/subjects.ts:
//   File đó là "danh sách môn để hiển thị/validate" (SUBJECTS, slug, labelKey)
// và đang được 6 file khác import. Engine là tầng khác — biết CÁCH học môn đó,
// không chỉ TÊN môn. Gộp vào sẽ kéo tầng AI/assessment vào một file danh mục
// và làm nó nặng dần theo thời gian.
//
// LƯU Ý VỀ `Subject` TRONG DB:
//   Model `Subject`/`SubjectTopic` là danh mục cộng đồng, mở rộng dần. Registry
//   này là TẬP CON tĩnh: phần lõi sản phẩm, phải chạy được cả khi DB rỗng. Hai
//   nguồn CỐ Ý tách biệt; `subject` ở đây TRÙNG tên với `SUBJECTS[].value`.
//
// MỞ RỘNG KHÔNG CẦN SỬA CẤU TRÚC: thêm 1 entry vào SUBJECT_ENGINES là xong
// (IELTS, TOEFL, Kinh tế, môn tùy chọn...). `withSubject()` có sẵn đường mở cho
// môn chưa có trong registry.
// ================================================================

import type { Difficulty } from "@/types";

/**
 * Loại câu hỏi — CHUNG cho mọi môn, mỗi môn chọn tập con riêng.
 *
 * Vì sao là string union chứ không phải enum DB: đây là phân loại AI dùng để
 * định hướng sinh câu hỏi và định dạng lời giải thích, KHÔNG phải dữ liệu người
 * dùng cần query/lọc. Thêm loại mới = thêm 1 member ở đây (type-safe, có test),
 * không cần migration DB.
 */
export type QuestionType =
  // Toán / Vật lý / Hóa
  | "CALCULATION"
  | "MULTI_STEP"
  | "PROOF"
  | "ERROR_ANALYSIS"
  | "FORMULA_APPLICATION"
  | "CONCEPT"
  | "GRAPH_ANALYSIS"
  | "PHENOMENON"
  | "REACTION"
  | "IDENTIFICATION"
  | "REACTION_CHAIN"
  // Ngôn ngữ
  | "VOCABULARY"
  | "GRAMMAR"
  | "READING"
  | "FILL_BLANK"
  | "ERROR_CORRECTION"
  // Sinh
  | "PROCESS"
  | "CLASSIFICATION"
  | "COMPARISON"
  | "DIAGRAM"
  // Tin học
  | "CODE_OUTPUT"
  | "DEBUGGING"
  | "ALGORITHM_SELECTION"
  | "COMPLEXITY"
  | "CODE_COMPLETION"
  | "TEST_CASE"
  | "IMPLEMENTATION"
  // Ngữ văn
  | "LITERARY_CONCEPT"
  | "TEXT_ANALYSIS";

/** Trường dữ liệu riêng của thẻ nhớ, theo đúng nhu cầu từng môn. */
export type CardField =
  | "front"
  | "back"
  | "definition"
  | "example"
  | "conditions"
  | "commonMistakes"
  | "variables"
  | "units"
  | "properties"
  | "reaction"
  | "process"
  | "characteristics"
  | "syntax"
  | "complexity"
  | "algorithm"
  | "pronunciation"
  | "translation"
  | "partOfSpeech"
  | "collocations"
  | "author"
  | "work";

/** Một cấp trong taxonomy chuẩn của môn (không gắn user, không gắn DB). */
export interface SkillNode {
  name: string;
  /** Cấp con. Rỗng = skill lá — điểm dừng của mastery. */
  children?: SkillNode[];
}

export interface SubjectEngine {
  /** Tên hiển thị chuẩn — TRÙNG với `SUBJECTS[].value` trong constants/subjects. */
  readonly subject: string;
  readonly slug: string;
  /** Emoji theo quy chuẩn design system (chỉ đổi icon, KHÔNG đổi màu). */
  readonly icon: string;
  /** Loại câu hỏi hợp lệ của môn. */
  readonly questionTypes: readonly QuestionType[];
  /** Trường của thẻ nhớ, thứ tự = thứ tự hiển thị. */
  readonly cardFields: readonly CardField[];
  /** Taxonomy chuẩn để đề xuất chủ đề khi học sinh chưa chọn. */
  readonly skillTaxonomy: readonly SkillNode[];
  /**
   * Gợi ý bổ sung cho AI khi sinh câu hỏi của môn này. Được chèn vào prompt
   * chung — AI Router vẫn là nguồn DUY NHẤT chọn provider.
   */
  readonly promptGuidance: string;
  /** Cần công thức toán trong prompt không (bật MATH_FORMAT_RULE). */
  readonly usesMathNotation: boolean;
  /** Câu hỏi dạng mã nguồn: hiển thị editor + chạy test thay vì chọn đáp án. */
  readonly isCodeSubject: boolean;
}


// ------------------------------------------------------------
// REGISTRY — nguồn sự thật duy nhất về hành vi riêng của từng môn
// ------------------------------------------------------------
export const SUBJECT_ENGINES: readonly SubjectEngine[] = [
  {
    subject: "Toán",
    slug: "toan",
    icon: "📐",
    questionTypes: ["CALCULATION", "MULTI_STEP", "FORMULA_APPLICATION", "PROOF", "ERROR_ANALYSIS"],
    cardFields: ["front", "back", "definition", "example", "conditions", "commonMistakes"],
    skillTaxonomy: skills(
      "Đại số", "Hàm số", "Lượng giác", "Hình học",
      "Tổ hợp - Xác suất", "Thống kê", "Giải tích", "Toán Olympic",
    ),
    promptGuidance:
      "Sinh câu hỏi có lời giải nhiều bước, nêu rõ điều kiện áp dụng công thức. " +
      "Với ERROR_ANALYSIS: đưa một lời giải SAI có lỗi điển hình và hỏi học sinh chỉ ra lỗi.",
    usesMathNotation: true,
    isCodeSubject: false,
  },
  {
    subject: "Tiếng Anh",
    slug: "tieng-anh",
    icon: "🇬🇧",
    questionTypes: ["VOCABULARY", "GRAMMAR", "READING", "FILL_BLANK", "ERROR_CORRECTION"],
    cardFields: ["front", "back", "partOfSpeech", "pronunciation", "example", "translation", "collocations"],
    skillTaxonomy: skills(
      "Từ vựng", "Ngữ pháp", "Đọc hiểu", "Nghe nói",
      "Viết học thuật", "Ngữ pháp tiếng Anh", "IELTS", "TOEFL",
    ),
    promptGuidance:
      "Câu hỏi phải kiểm tra CẢ nghĩa lẫn cách dùng (collocation, register). " +
      "Với ERROR_CORRECTION: đưa câu tiếng Anh sai và hỏi lỗi CỤ THỂ, không hỏi chung chung.",
    usesMathNotation: false,
    isCodeSubject: false,
  },
  {
    subject: "Vật lý",
    slug: "vat-ly",
    icon: "⚛️",
    questionTypes: ["CONCEPT", "FORMULA_APPLICATION", "CALCULATION", "GRAPH_ANALYSIS", "PHENOMENON"],
    cardFields: ["front", "back", "definition", "variables", "units", "example"],
    skillTaxonomy: skills(
      "Cơ học", "Nhiệt động lực học", "Điện học", "Từ trường",
      "Quang học", "Sóng học", "Vật lý hiện đại",
    ),
    promptGuidance:
      "BẮT BUỘC nêu đơn vị SI cho mọi đại lượng trong đáp án. " +
      "Nếu dùng công thức, phải chỉ rõ điều kiện áp dụng và ý nghĩa từng biến.",
    usesMathNotation: true,
    isCodeSubject: false,
  },
  {
    subject: "Hóa học",
    slug: "hoa-hoc",
    icon: "🧪",
    questionTypes: ["REACTION", "CALCULATION", "IDENTIFICATION", "CONCEPT", "REACTION_CHAIN"],
    cardFields: ["front", "back", "definition", "properties", "reaction", "example"],
    skillTaxonomy: skills(
      "Cấu tạo nguyên tử", "Bảng tuần hoàn", "Liên kết hoá học",
      "Hoá học vô cơ", "Hoá học hữu cơ", "Phản ứng hoá học", "Tính toán hoá học",
    ),
    promptGuidance:
      "Cân bằng mọi phương trình hoá học trước khi đưa đáp án. " +
      "Với REACTION: nêu rõ điều kiện (nhiệt độ, xúc tác, dung môi) vì phản ứng phụ thuộc điều kiện.",
    usesMathNotation: true,
    isCodeSubject: false,
  },
  {
    subject: "Sinh học",
    slug: "sinh-hoc",
    icon: "🧬",
    questionTypes: ["CONCEPT", "PROCESS", "CLASSIFICATION", "COMPARISON", "DIAGRAM"],
    cardFields: ["front", "back", "definition", "process", "characteristics", "example"],
    skillTaxonomy: skills(
      "Sinh học tế bào", "Di truyền học", "Tiến hoá",
      "Sinh thái học", "Sinh lý người", "Sinh học phân tử",
    ),
    promptGuidance:
      "Với CLASSIFICATION/COMPARISON: các đối tượng so sánh phải cùng cấp phân loại " +
      "(không so một tế bào với một cơ quan). Luôn nêu cơ chế nhân quả khi có.",
    usesMathNotation: false,
    isCodeSubject: false,
  },
  {
    subject: "Tin học",
    slug: "tin-hoc",
    icon: "💻",
    questionTypes: [
      "CODE_OUTPUT", "DEBUGGING", "ALGORITHM_SELECTION",
      "COMPLEXITY", "CODE_COMPLETION", "TEST_CASE", "IMPLEMENTATION",
    ],
    cardFields: ["front", "back", "definition", "algorithm", "complexity", "syntax", "example"],
    skillTaxonomy: skills(
      "Cơ sở lập trình", "Cấu trúc dữ liệu", "Thuật toán", "Quy hoạch động",
      "Đồ thị", "Xử lý xâu", "Toán tổ hợp", "Độ phức tạp", "Lập trình thi đấu",
    ),
    promptGuidance:
      "Mọi code block phải có ngôn ngữ rõ ràng và chạy được. " +
      "Với DEBUGGING: chỉ ra ĐÚNG 1 lỗi, nêu triệu chứng quan sát được và vì sao gây lỗi. " +
      "Với COMPLEXITY: nêu cả trường hợp trung bình và xấu nhất, kèm lý do.",
    usesMathNotation: false,
    isCodeSubject: true,
  },
  {
    subject: "Ngữ văn",
    slug: "ngu-van",
    icon: "📖",
    questionTypes: ["LITERARY_CONCEPT", "READING", "TEXT_ANALYSIS", "ERROR_CORRECTION"],
    cardFields: ["front", "back", "definition", "author", "work", "example"],
    skillTaxonomy: skills("Thơ", "Truyện ngắn", "Tiểu thuyết", "Kịch", "Bài luận văn"),
    promptGuidance:
      "Trích dẫn nguyên văn khi hỏi về tác phẩm; không hỏi chi tiết sự kiện chỉ biết từ ngoài sách. " +
      "Câu hỏi phân tích phải dẫn tới bằng chứng cụ thể trong văn bản.",
    usesMathNotation: false,
    isCodeSubject: false,
  },
  {
    subject: "Lịch sử",
    slug: "lich-su",
    icon: "🏛️",
    questionTypes: ["CONCEPT", "COMPARISON", "PROCESS", "ERROR_CORRECTION"],
    cardFields: ["front", "back", "definition", "process", "example"],
    skillTaxonomy: skills("Thế giới cận đại", "Việt Nam", "Lịch sử Việt Nam hiện đại"),
    promptGuidance: "Luôn ghi rõ mốc năm trong câu hỏi và đáp án để tránh nhầm các giai đoạn.",
    usesMathNotation: false,
    isCodeSubject: false,
  },
  {
    subject: "Địa lý",
    slug: "dia-ly",
    icon: "🌏",
    questionTypes: ["CONCEPT", "DIAGRAM", "IDENTIFICATION", "COMPARISON"],
    cardFields: ["front", "back", "definition", "characteristics", "example"],
    skillTaxonomy: skills("Địa lý tự nhiên", "Địa lý kinh tế - XH", "Địa lý Việt Nam"),
    promptGuidance: "Nêu rõ quy mô (diện tích, dân số, vị trí) khi so sánh các đơn vị hành chính.",
    usesMathNotation: false,
    isCodeSubject: false,
  },
];

// ------------------------------------------------------------
// TRA CỨU
// ------------------------------------------------------------

const BY_NAME = new Map(SUBJECT_ENGINES.map((e) => [e.subject, e]));
const BY_SLUG = new Map(SUBJECT_ENGINES.map((e) => [e.slug, e]));

/** Tra engine theo tên hoặc slug. Trả undefined nếu môn không có bộ riêng. */
export function findSubject(subject: string | null | undefined): SubjectEngine | undefined {
  if (!subject) return undefined;
  const key = subject.trim();
  return BY_NAME.get(key) ?? BY_SLUG.get(key.toLowerCase());
}

/**
 * Chuẩn hoá chuỗi thành slug ASCII an toàn cho URL.
 *
 * CẦN THIẾT VÌ GÌ: môn do người dùng tự gõ có dấu ("Lịch sử Việt Nam").
 * `toLowerCase().replace(/\s+/g, "-")` giữ nguyên dấu tiếng Việt, tạo ra slug
 * "lịch-sử-việt-nam" — đưa vào URL là hỏng, vào cache key là lệch. Nên bỏ dấu
 * trước, rồi mới nối dấu gạch.
 *
 * Trả về `""` nếu chuỗi rỗng — để `withSubject` quyết định fallback thay vì
 * sinh slug rỗng.
 */
function toSlug(input: string): string {
  return input
    .normalize("NFD") // tách dấu ra khỏi ký tự gốc
    .replace(/[̀-ͯ]/g, "") // bỏ dấu thanh/sắc/hỏi/huyền
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Engine của một môn, LUÔN trả về engine hợp lệ.
 *
 * Vì sao cần fallback thay vì trả `undefined`: onboarding cho phép chọn "Khác"
 * và người dùng có thể tự gõ tên môn. Nếu engine trả undefined thì mọi nơi gọi
 * phải null-check, và một nơi quên là crash. Ở đây ta dựng engine trung tính theo
 * chính tên môn đó — môn mới vẫn dùng được bộ câu hỏi chung, chỉ mất phần tối ưu
 * riêng. Đây là chính sách "mở rộng không cần sửa code".
 */
export function withSubject(subject: string | null | undefined): SubjectEngine {
  const found = findSubject(subject);
  if (found) return found;

  const name = (subject ?? "").trim();
  return {
    subject: name,
    slug: toSlug(name),
    icon: "📘",
    questionTypes: GENERIC_QUESTION_TYPES,
    cardFields: GENERIC_CARD_FIELDS,
    skillTaxonomy: skills(name || "Kiến thức chung"),
    promptGuidance: "",
    usesMathNotation: false,
    isCodeSubject: false,
  };
}

/** Loại câu hỏi mặc định khi sinh câu mới — lấy loại đầu của môn. */
export function defaultQuestionType(subject: string | null | undefined): QuestionType {
  return withSubject(subject).questionTypes[0] ?? "CONCEPT";
}

/** Kiểm tra loại câu hỏi có thuộc môn hay không (dùng ở API validate). */
export function isValidQuestionType(
  subject: string | null | undefined,
  type: string | null | undefined
): boolean {
  if (!type) return false;
  return withSubject(subject).questionTypes.includes(type as QuestionType);
}

/** Skill cấp 1 của môn (dùng cho UI chọn chủ đề khi học sinh chưa chọn). */
export function topLevelSkills(subject: string | null | undefined): string[] {
  return withSubject(subject).skillTaxonomy.map((node) => node.name);
}

/** Duyệt cây taxonomy, trả về mọi skill (cấp 1 + cấp con) dạng phẳng. */
export function flattenSkills(nodes: readonly SkillNode[]): string[] {
  return nodes.flatMap((node) => [node.name, ...(node.children ? flattenSkills(node.children) : [])]);
}

/**
 * Gợi ý bước độ khó kế tiếp — CỐ Ý UỎ CHUYỂN cho `pickNextDifficulty` ở
 * services/assessment.service.ts.
 *
 * Lý do: hệ thống ĐÃ CÓ sẵn thuật toán adaptive (đúng -> lên 1 bậc, sai -> lùi
 * 1 bậc, kẹp trong [easy..hard]) và nó đang được Diagnostic dùng. Viết thêm
 * 1 hàm ở đây nghĩa là có 2 nơi quyết định độ khó — sửa một bên thì lệch bên
 * kia. Nhận hàm làm tham số là dependency inversion nhỏ, không phải abstraction
 * thừa; và giữ engine này không import service (tránh vòng phụ thuộc).
 *
 * Yêu cầu §23 "ổn định + explainable + dữ liệu thật" — thuật toán sẵn có thoả
 * cả ba, nên ta dùng lại thay vì phát minh cái mới.
 */
export function nextDifficulty(
  current: Difficulty,
  wasCorrect: boolean,
  pick: (current: Difficulty, wasCorrect: boolean) => Difficulty
): Difficulty {
  return pick(current, wasCorrect);
}
/** Bộ câu hỏi dùng chung cho môn chưa có bộ riêng. */
const GENERIC_QUESTION_TYPES: readonly QuestionType[] = [
  "CONCEPT",
  "CALCULATION",
  "ERROR_ANALYSIS",
];

const GENERIC_CARD_FIELDS: readonly CardField[] = ["front", "back", "definition", "example"];

function skills(...names: string[]): readonly SkillNode[] {
  return names.map((name) => ({ name }));
}