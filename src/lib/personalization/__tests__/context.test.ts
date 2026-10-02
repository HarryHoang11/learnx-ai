// Test cho tầng cá nhân hoá — chỗ biến hồ sơ thành hành vi AI.
//
// Trọng tâm KHÔNG phải "chuỗi text đúng y như thế nào" (sẽ vỡ mỗi khi copy
// đổi) mà là CÁC QUY TẮC:
//   1. Không có hồ sơ -> prompt RỖNG, tuyệt đối không bịa ngữ cảnh.
//   2. Tuỳ chọn AI phải dịch được thành chỉ dẫn THẬT cho AI.
//   3. "Chưa biết nghề" phải được nói ra là chưa biết — không suy thành ngành.
//   4. Chỉ xếp hạng môn ĐÃ CÓ trong hồ sơ, không tự chế môn mới.
import { describe, expect, it } from "vitest";
import {
  buildLearningContext,
  buildAdaptiveTeachingRules,
  gradeLevelText,
  prefersNoDirectAnswer,
  suggestDiagnosticSubjects,
  PROMPT_BEHAVIOR,
  LEARNING_STYLE_HINT,
} from "../context";
import { AI_PREFERENCES, LEARNING_PREFERENCES } from "@/lib/onboarding/options";

describe("buildLearningContext", () => {
  it("không có hồ sơ/mục tiêu/kỹ năng -> prompt RỖNG (không bịa)", () => {
    expect(buildLearningContext({ profile: null, goals: [] }).prompt).toBe("");
  });

  it("hồ sơ rỗng nhưng có mục tiêu -> vẫn có ngữ cảnh", () => {
    const { prompt } = buildLearningContext({
      profile: { version: 1 },
      goals: [{ title: "HSG Tin học", target: "Vào top 10" }],
    });
    expect(prompt).toContain("HSG Tin học");
    expect(prompt).toContain("Vào top 10");
  });

  it("mọi lựa chọn AI trong options.ts đều phải có chỉ dẫn tương ứng", () => {
    // Guard chống "lựa chọn im lặng": thêm option vào options.ts mà quên
    // PROMPT_BEHAVIOR thì user chọn xong không thấy tác dụng gì.
    for (const option of AI_PREFERENCES) {
      expect(PROMPT_BEHAVIOR[option.value]).toBeTruthy();
    }
    for (const option of LEARNING_PREFERENCES) {
      expect(LEARNING_STYLE_HINT[option.value]).toBeTruthy();
    }
  });

  it("'không đưa đáp án ngay' xuất hiện trong prompt và bật cờ quy tắc cứng", () => {
    const profile = { version: 1 as const, aiPreferences: ["NO_DIRECT_ANSWER", "STEP_BY_STEP"] };
    const { prompt } = buildLearningContext({ profile, goals: [] });
    expect(prompt).toContain(PROMPT_BEHAVIOR.NO_DIRECT_ANSWER);
    expect(prompt).toContain(PROMPT_BEHAVIOR.STEP_BY_STEP);
    expect(prefersNoDirectAnswer(profile.aiPreferences)).toBe(true);
  });

  it("không chọn thì quy tắc cứng tắt", () => {
    expect(prefersNoDirectAnswer([])).toBe(false);
    expect(prefersNoDirectAnswer(undefined)).toBe(false);
    expect(prefersNoDirectAnswer(["EXAMPLES"])).toBe(false);
  });

  it("'chưa biết nghề' được nói rõ là chưa biết — KHÔNG bịa thành ngành cụ thể", () => {
    const { prompt } = buildLearningContext({
      profile: { version: 1, careerStatus: "UNDECIDED" },
      goals: [],
    });
    expect(prompt).toContain("chưa xác định");
    // Nguyên tắc §18: tuyệt đối không được tự gán ngành cho user.
    expect(prompt).not.toContain("AI / Machine Learning");
    expect(prompt).not.toContain("Software Engineering");
  });

  it("nghề do USER nêu thì được ghi kèm nhãn 'do người dùng nêu'", () => {
    const { prompt } = buildLearningContext({
      profile: { version: 1, careerStatus: "SET", careerFields: ["Software Engineering"] },
      goals: [],
    });
    expect(prompt).toContain("do người dùng nêu");
    expect(prompt).toContain("Software Engineering");
  });

  it("'chưa xác định' ở định hướng không bị đọc thành một chuyên ngành", () => {
    // Track = UNSURE là câu trả lời hợp lệ nhưng KHÔNG phải thông tin định
    // hướng — không được đưa vào prompt như 1 chuyên ngành.
    const { prompt, summary } = buildLearningContext({
      profile: { version: 1, educationStage: "THPT", track: "UNSURE" },
      goals: [],
    });
    expect(summary.track).toBe("UNSURE");
    expect(prompt).not.toContain("Chuyên");
  });

  it("gộp môn tự do (otherSubject) và bỏ nhãn 'Khác' khỏi danh sách môn", () => {
    const { summary } = buildLearningContext({
      profile: { version: 1, subjects: ["Khác", "Toán"], otherSubject: "Lập trình" },
      goals: [],
    });
    expect(summary.subjects).toEqual(["Toán", "Lập trình"]);
  });

  it("dữ liệu học thật (weak topics) được đưa vào, phân biệt với tự khai", () => {
    const { prompt, summary } = buildLearningContext({
      profile: null,
      goals: [],
      skills: [
        { subject: "Tin học", topic: "Đồ thị", masteryPercent: 20, isWeak: true },
        { subject: "Toán", topic: "Hàm bậc hai", masteryPercent: 90, isWeak: false },
      ],
    });
    expect(summary.weakTopics).toEqual(["Tin học/Đồ thị"]);
    expect(prompt).toContain("dữ liệu thật");
  });

  it("ngôn ngữ EN sinh prompt tiếng Anh", () => {
    const { prompt } = buildLearningContext({
      profile: { version: 1, educationStage: "THPT" },
      goals: [],
      language: "en",
    });
    expect(prompt).toContain("Education:");
  });
});

describe("suggestDiagnosticSubjects", () => {
  it("xếp hạng môn user đã chọn trước (yêu cầu §19)", () => {
    const { summary } = buildLearningContext({
      profile: { version: 1, subjects: ["Tin học"] },
      goals: [],
      skills: [{ subject: "Toán", topic: "Đạo hàm", masteryPercent: 20, isWeak: true }],
    });
    // Môn đã chọn đứng trước môn chỉ yếu — đây là "Hồ sơ của bạn đã sẵn sàng,
    // hãy đánh giá năng lực" đúng nghĩa.
    expect(suggestDiagnosticSubjects(summary)).toEqual(["Tin học", "Toán"]);
  });

  it("không tự chế môn mới — chỉ xếp hạng môn đã có tín hiệu", () => {
    const { summary } = buildLearningContext({
      profile: { version: 1, subjects: ["Lập trình"] },
      goals: [],
    });
    const suggested = suggestDiagnosticSubjects(summary);
    expect(suggested).toEqual(["Lập trình"]);
    expect(suggested).not.toContain("Toán");
  });

  it("hồ sơ trống -> danh sách rỗng, UI hiển thị đầy đủ như cũ (không chặn)", () => {
    const { summary } = buildLearningContext({ profile: null, goals: [] });
    expect(suggestDiagnosticSubjects(summary)).toEqual([]);
  });

  it("dedupe — môn vừa chọn vừa yếu chỉ xuất hiện 1 lần", () => {
    const { summary } = buildLearningContext({
      profile: { version: 1, subjects: ["Toán"] },
      goals: [],
      skills: [{ subject: "Toán", topic: "Tích phân", masteryPercent: 10, isWeak: true }],
    });
    expect(suggestDiagnosticSubjects(summary)).toEqual(["Toán"]);
  });

// --- LỚP ĐANG DÙNG TRONG PROMPT (currentGrade vs diagnosticGrade) ---

describe("gradeLevelText", () => {
  it("lớp đã lưu -> câu mô tả trình độ cho prompt", () => {
    expect(gradeLevelText("11")).toBe("học sinh lớp 11");
    expect(gradeLevelText(" 6 ")).toBe("học sinh lớp 6");
  });

  it("giá trị rỗng/không phải số -> undefined, KHÔNG bịa lớp", () => {
    // "OTHER"/null/undefined là hồ sơ chưa biết lớp — prompt phải rỗng chỗ này,
    // tuyệt đối không dựng "học sinh lớp OTHER".
    expect(gradeLevelText(null)).toBeUndefined();
    expect(gradeLevelText(undefined)).toBeUndefined();
    expect(gradeLevelText("")).toBeUndefined();
    expect(gradeLevelText("OTHER")).toBeUndefined();
    expect(gradeLevelText("lớp 11")).toBeUndefined();
  });
});

describe("buildAdaptiveTeachingRules", () => {
  it("không có dữ liệu -> không sinh quy tắc nào (không thêm prompt rỗng)", () => {
    expect(buildAdaptiveTeachingRules({ weakTopics: [], strongTopics: [] })).toEqual([]);
  });

  it("chủ đề yếu -> bắt AI dựng lại nền tảng, không nhảy vào công thức nâng cao", () => {
    const rules = buildAdaptiveTeachingRules({
      weakTopics: ["Toán/Tích phân"],
      strongTopics: [],
    });
    expect(rules.join(" ")).toContain("Toán/Tích phân");
    expect(rules.join(" ")).toMatch(/nền tảng/i);
  });

  it("chủ đề vững -> bỏ phần cơ bản, nâng bài tập", () => {
    const rules = buildAdaptiveTeachingRules({
      weakTopics: [],
      strongTopics: ["Lý/Cơ điện"],
    });
    expect(rules.join(" ")).toContain("Lý/Cơ điện");
    expect(rules.join(" ")).toMatch(/bỏ phần giải thích cơ bản/i);
  });

  it("có lớp -> nhắc bám đúng chương trình lớp đó", () => {
    const rules = buildAdaptiveTeachingRules({ weakTopics: [], strongTopics: [], grade: "10" });
    expect(rules.join(" ")).toContain("lớp 10");
  });

  it("chủ đề yếu và vững cùng lúc -> có cả 2 quy tắc, không lẫn lộn", () => {
    const rules = buildAdaptiveTeachingRules({
      weakTopics: ["Toán/Tích phân"],
      strongTopics: ["Lý/Cơ điện"],
    });
    expect(rules).toHaveLength(2);
    expect(rules[0]).toContain("Toán/Tích phân");
    expect(rules[1]).toContain("Lý/Cơ điện");
  });
});

describe("buildLearningContext — quy tắc dạy theo trình độ đi vào prompt", () => {
  it("chủ đề yếu + vững từ dữ liệu thật -> prompt chứa cả hai quy tắc", () => {
    const { prompt } = buildLearningContext({
      profile: { version: 1, educationStage: "THPT", grade: "11" },
      goals: [{ title: "Luyện thi THPT", target: "9 điểm" }],
      skills: [
        { subject: "Toán", topic: "Tích phân", masteryPercent: 20, isWeak: true },
        { subject: "Lý", topic: "Cơ điện", masteryPercent: 90, isWeak: false },
      ],
    });
    expect(prompt).toContain("Toán/Tích phân");
    expect(prompt).toContain("Lý/Cơ điện");
    // Ngưỡng "vững" 80% phải khớp Analytics, không phải con số bịa ở đây.
    expect(prompt).toContain("lớp 11");
  });

  it("chủ đề ở mức trung bình (60%) -> KHÔNG bị coi là yếu lẫn là vững", () => {
    const { prompt } = buildLearningContext({
      profile: { version: 1, educationStage: "THPT", grade: "11" },
      goals: [{ title: "Học đều", target: "" }],
      skills: [{ subject: "Toán", topic: "Hàm bậc hai", masteryPercent: 60, isWeak: false }],
    });
    expect(prompt).not.toContain("Toán/Hàm bậc hai");
  });
});

});
