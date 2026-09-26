import { describe, it, expect } from "vitest";
import {
  SUBJECT_ENGINES,
  defaultQuestionType,
  findSubject,
  flattenSkills,
  isValidQuestionType,
  nextDifficulty,
  topLevelSkills,
  withSubject,
  type QuestionType,
} from "../engine";
import { SUBJECTS } from "@/lib/constants/subjects";
import { pickNextDifficulty } from "@/services/assessment.service";

describe("Subject Engine — registry", () => {
  it("có đủ 7 môn lõi của LearnX", () => {
    const names = SUBJECT_ENGINES.map((e) => e.subject);
    for (const expected of ["Toán", "Tiếng Anh", "Vật lý", "Hóa học", "Sinh học", "Tin học", "Ngữ văn"]) {
      expect(names).toContain(expected);
    }
  });

  // Bảo đảm 2 nguồn không lệch nhau. Nếu ai đó thêm môn vào SUBJECTS mà quên
  // thêm engine (hoặc ngược lại), test này bắt được ngay thay vì để UI hiện
  // môn không có hành vi riêng.
  it("khớp với SUBJECTS trong lib/constants/subjects", () => {
    for (const subject of SUBJECTS) {
      const engine = findSubject(subject.value);
      expect(engine, `thiếu engine cho môn "${subject.value}"`).toBeDefined();
      expect(engine?.slug).toBe(subject.slug);
    }
  });

  it("mỗi engine có questionTypes, cardFields, taxonomy và icon", () => {
    for (const engine of SUBJECT_ENGINES) {
      expect(engine.questionTypes.length, `${engine.subject} thiếu questionTypes`).toBeGreaterThan(0);
      expect(engine.cardFields.length, `${engine.subject} thiếu cardFields`).toBeGreaterThan(0);
      expect(engine.skillTaxonomy.length, `${engine.subject} thiếu skillTaxonomy`).toBeGreaterThan(0);
      expect(engine.icon.length).toBeGreaterThan(0);
    }
  });

  it("cardFields luôn bắt đầu bằng front/back (thẻ nhớ phải có 2 mặt)", () => {
    for (const engine of SUBJECT_ENGINES) {
      expect(engine.cardFields).toContain("front");
      expect(engine.cardFields).toContain("back");
    }
  });

  it("không có môn nào báo isCodeSubject trừ Tin học", () => {
    for (const engine of SUBJECT_ENGINES) {
      expect(engine.isCodeSubject).toBe(engine.subject === "Tin học");
    }
  });
});

describe("Subject Engine — tra cứu", () => {
  it("tra được theo tên tiếng Việt và theo slug", () => {
    expect(findSubject("Toán")?.subject).toBe("Toán");
    expect(findSubject("tin-hoc")?.subject).toBe("Tin học");
    expect(findSubject("  Toán  ")?.subject).toBe("Toán");
  });

  it("trả undefined cho môn chưa hỗ trợ", () => {
    expect(findSubject("Kinh tế")).toBeUndefined();
    expect(findSubject(null)).toBeUndefined();
    expect(findSubject("")).toBeUndefined();
  });

  // Chính sách "mở rộng không cần sửa code": môn lạ vẫn phải dùng được.
  it("withSubject dựng được engine trung tính cho môn lạ", () => {
    const engine = withSubject("Lịch sử Việt Nam");
    expect(engine.subject).toBe("Lịch sử Việt Nam");
    expect(engine.slug).toBe("lich-su-viet-nam");
    expect(engine.questionTypes.length).toBeGreaterThan(0);
    expect(engine.cardFields).toContain("front");
    expect(engine.isCodeSubject).toBe(false);
  });

  it("withSubject trả về đúng engine có sẵn, không dựng lại", () => {
    expect(withSubject("Hóa học")).toBe(findSubject("Hóa học"));
  });


describe("Subject Engine — question types", () => {
  it("Toán có lõi tính toán, Tiếng Anh có lõi ngôn ngữ, không lẫn", () => {
    const math = withSubject("Toán").questionTypes;
    expect(math).toContain("CALCULATION");
    expect(math).toContain("PROOF");
    expect(math).not.toContain("VOCABULARY");

    const english = withSubject("Tiếng Anh").questionTypes;
    expect(english).toContain("VOCABULARY");
    expect(english).toContain("GRAMMAR");
    expect(english).not.toContain("PROOF");
  });

  it("Tin học có đủ nhóm câu hỏi lập trình", () => {
    const cs = withSubject("Tin học").questionTypes;
    for (const t of ["CODE_OUTPUT", "DEBUGGING", "COMPLEXITY", "CODE_COMPLETION"]) {
      expect(cs).toContain(t);
    }
  });

  it("isValidQuestionType chặn loại câu không thuộc môn", () => {
    expect(isValidQuestionType("Toán", "CALCULATION")).toBe(true);
    expect(isValidQuestionType("Toán", "VOCABULARY")).toBe(false);
    expect(isValidQuestionType("Tiếng Anh", "CALCULATION")).toBe(false);
    expect(isValidQuestionType("Toán", "KHONG_CO")).toBe(false);
    expect(isValidQuestionType("Toán", null)).toBe(false);
  });

  it("defaultQuestionType luôn thuộc môn đó", () => {
    for (const engine of SUBJECT_ENGINES) {
      const type = defaultQuestionType(engine.subject);
      expect(engine.questionTypes).toContain(type as QuestionType);
    }
  });
});

describe("Subject Engine — taxonomy", () => {
  it("topLevelSkills trả về skill cấp 1 của đúng môn", () => {
    expect(topLevelSkills("Toán")).toContain("Lượng giác");
    expect(topLevelSkills("Tiếng Anh")).toContain("IELTS");
    expect(topLevelSkills("Tin học")).toContain("Quy hoạch động");
    expect(topLevelSkills("Toán")).not.toContain("IELTS");
  });

  it("flattenSkills duyệt cả cấp con", () => {
    const nested = [{ name: "Lượng giác", children: [{ name: "Phương trình lượng giác cơ bản" }] }];
    expect(flattenSkills(nested)).toEqual(["Lượng giác", "Phương trình lượng giác cơ bản"]);
  });

  it("không có tên skill trùng lặp trong cùng môn", () => {
    for (const engine of SUBJECT_ENGINES) {
      const all = flattenSkills(engine.skillTaxonomy);
      expect(new Set(all).size, `${engine.subject} có skill trùng`).toBe(all.length);
    }
  });
});

describe("Subject Engine — độ khó thích nghi", () => {
  it("uỷ chuyển cho pickNextDifficulty sẵn có (không tạo thuật toán thứ hai)", () => {
    expect(nextDifficulty("easy", true, pickNextDifficulty)).toBe("medium");
    expect(nextDifficulty("hard", true, pickNextDifficulty)).toBe("hard");
    expect(nextDifficulty("hard", false, pickNextDifficulty)).toBe("medium");
    expect(nextDifficulty("easy", false, pickNextDifficulty)).toBe("easy");
  });
});
  it("withSubject chịu được input rỗng mà không ném lỗi", () => {
    expect(withSubject(undefined).questionTypes.length).toBeGreaterThan(0);
    expect(withSubject("").skillTaxonomy.length).toBeGreaterThan(0);
  });
});