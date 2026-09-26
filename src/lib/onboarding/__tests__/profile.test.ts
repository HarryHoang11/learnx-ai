// Test cho hợp đồNG dữ liệu của LearningProfile: validate, merge, % hoàn
// thiện.
//
// Đây là file test QUAN TRỌNG NHẤT của phần onboarding vì 3 thứ ở đây quyết
// định chất lượng dữ liệu cả hệ thống:
//   1) "Chưa biết nghề" phải được lưu như 1 giá trị HỢP LỆ (không null/lỗi).
//   2) Giá trị bịa/rác từ client phải bị loại mà KHÔNG làm hỏng phần hợp lệ
//      đã trả lời.
//   3) Mọi thứ đều tuỳ chọn — không có payload nào bị coi là "sai".
import { describe, expect, it } from "vitest";
import {
  computeProfileCompletion,
  hasProfileSignal,
  isProfileComplete,
  mergeLearningProfile,
  sanitizeLearningProfile,
  type LearningProfile,
} from "../profile";

describe("sanitizeLearningProfile", () => {
  it("payload rác không làm hỏng — trả về profile rỗng, không throw", () => {
    // Route nhận `unknown` từ client; payload sai kiểu phải được xử lý an toàn
    // thay vì làm 500 (yêu cầu §29).
    for (const bad of [null, undefined, "string", 42, [], true]) {
      const { profile, errors } = sanitizeLearningProfile(bad);
      expect(profile.version).toBe(1);
      expect(Array.isArray(errors)).toBe(true);
    }
  });

  it("giữ nguyên giá trị hợp lệ", () => {
    const { profile, errors } = sanitizeLearningProfile({
      educationStage: "THPT",
      grade: "11",
      track: "INFORMATICS",
      studyTime: "1_2_HOURS",
    });
    expect(errors).toEqual([]);
    expect(profile.educationStage).toBe("THPT");
    expect(profile.grade).toBe("11");
    expect(profile.track).toBe("INFORMATICS");
    expect(profile.studyTime).toBe("1_2_HOURS");
  });

  it("'CHƯA BIẾT NGHỀ' là dữ liệu HỢP LỆ — không null, không lỗi (yêu cầu §7)", () => {
    const { profile, errors } = sanitizeLearningProfile({ careerStatus: "UNDECIDED" });
    expect(profile.careerStatus).toBe("UNDECIDED");
    // "Chưa biết" là 1 CÂU TRẢ LỜI hợp lệ -> không được báo lỗi validate.
    expect(errors).toEqual([]);
  });

  it("loại giá trị enum bịa nhưng GIỮ nguyên phần hợp lệ", () => {
    const { profile, errors } = sanitizeLearningProfile({
      educationStage: "SUPER_STUDENT",
      studyTime: "1_2_HOURS",
      subjects: ["Toán", "KHÔNG_TỒN_TẠI", "Tin học"],
    });
    // Field sai bị loại...
    expect(profile.educationStage).toBeUndefined();
    expect(errors.length).toBeGreaterThan(0);
    // ...nhưng dữ liệu hợp lệ vẫn còn nguyên.
    expect(profile.studyTime).toBe("1_2_HOURS");
    expect(profile.subjects).toEqual(["Toán", "Tin học"]);
  });

  it("grade chỉ hợp lệ với giai đoạn hỏi được lớp (THCS/THPT)", () => {
    // "Đã đi làm" + lớp 11 là dữ liệu vô nghĩa -> phải bị loại.
    expect(sanitizeLearningProfile({ educationStage: "WORKING", grade: "11" }).profile.grade)
      .toBeUndefined();
    // Lớp 10 KHÔNG hợp lệ với THCS.
    expect(sanitizeLearningProfile({ educationStage: "THCS", grade: "10" }).profile.grade)
      .toBeUndefined();
    expect(sanitizeLearningProfile({ educationStage: "THCS", grade: "8" }).profile.grade).toBe("8");
  });

  it("dedupe danh sách và giữ thứ tự user chọn", () => {
    const { profile } = sanitizeLearningProfile({
      aiPreferences: ["EXAMPLES", "EXAMPLES", "STEP_BY_STEP", "EXAMPLES"],
    });
    expect(profile.aiPreferences).toEqual(["EXAMPLES", "STEP_BY_STEP"]);
  });

  it("dedupe mục tiêu theo title (không phân biệt hoa thường)", () => {
    // Chống tạo trùng khi user bấm "thêm mục tiêu" nhiều lần (yêu cầu §16).
    const { profile } = sanitizeLearningProfile({
      goals: [{ title: "Tăng điểm Toán" }, { title: "tăng điểm toán " }, { title: "Học Python" }],
    });
    expect(profile.goals).toHaveLength(2);
  });

  it("bỏ mục tiêu thiếu title thay vì tạo record vô nghĩa", () => {
    const { profile } = sanitizeLearningProfile({ goals: [{ target: "9 điểm" }, { title: "OK" }] });
    expect(profile.goals).toHaveLength(1);
    expect(profile.goals?.[0].title).toBe("OK");
  });

  it("chỉ giữ otherSubject khi user thực sự chọn 'Khác'", () => {
    expect(sanitizeLearningProfile({ otherSubject: "Hóa học" }).profile.otherSubject)
      .toBeUndefined();
    expect(
      sanitizeLearningProfile({ subjects: ["Khác"], otherSubject: "Hóa học" }).profile.otherSubject
    ).toBe("Hóa học");
  });

  it("mọi field đều tuỳ chọn — payload rỗng vẫn hợp lệ", () => {
    const { profile, errors } = sanitizeLearningProfile({});
    expect(errors).toEqual([]);
    expect(profile.version).toBe(1);
    expect(computeProfileCompletion(profile)).toBe(0);
  });
});

describe("mergeLearningProfile", () => {
  const base: LearningProfile = {
    version: 1,
    educationStage: "THPT",
    grade: "11",
    subjects: ["Toán"],
  };

  it("gộp chỉ field có mặt trong patch — không xoá dữ liệu cũ", () => {
    // Người dùng làm tới bước 5 rồi quay lại sửa bước 1: các bước 2-4 phải
    // còn nguyên (yêu cầu §33 resume flow).
    const merged = mergeLearningProfile(base, { version: 1, educationStage: "THCS" });
    expect(merged.educationStage).toBe("THCS");
    expect(merged.subjects).toEqual(["Toán"]);
  });

  it("bỏ chọn = xoá hẳn field khỏi profile", () => {
    const merged = mergeLearningProfile(base, { version: 1, subjects: [] });
    expect(merged.subjects).toBeUndefined();
  });

  it("null profile -> trả về đúng patch", () => {
    const merged = mergeLearningProfile(null, { version: 1, studyTime: "1_2_HOURS" });
    expect(merged.studyTime).toBe("1_2_HOURS");
    expect(merged.version).toBe(1);
  });
});

describe("computeProfileCompletion", () => {
  it("null/rỗng -> 0", () => {
    expect(computeProfileCompletion(null)).toBe(0);
    expect(computeProfileCompletion({ version: 1 })).toBe(0);
  });

  it("'chưa biết nghề' VẪN ĐƯỢC TÍNH là đã trả lời", () => {
    // Nếu không tính, user hợp lệ sẽ bị kẹt ở % thấp mãi — trải nghiệm
    // như bị phạt vì đã trả lời thật (yêu cầu §11).
    const withUndecided = computeProfileCompletion({ version: 1, careerStatus: "UNDECIDED" });
    expect(withUndecided).toBeGreaterThan(computeProfileCompletion({ version: 1 }));
  });

  it("không vượt 100", () => {
    expect(
      computeProfileCompletion({
        version: 1,
        educationStage: "THPT",
        grade: "12",
        track: "MATH",
        intents: ["SCORE"],
        goalCategory: "EXAM",
        goals: [{ title: "a" }],
        subjects: ["Toán"],
        careerStatus: "SET",
        careerFields: ["Design"],
        studyTime: "1_2_HOURS",
        studyTimePreference: "EVENING",
        aiPreferences: ["EXAMPLES"],
        learningPreferences: ["MIXED"],
      })
    ).toBe(100);
  });
});

describe("isProfileComplete / hasProfileSignal", () => {
  it("chưa làm gì -> chưa hoàn thiện, chưa có tín hiệu", () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(hasProfileSignal(null)).toBe(false);
    expect(hasProfileSignal({ version: 1 })).toBe(false);
  });

  it("có tín hiệu tối thiểu -> usable nhưng chưa chắc hoàn thiện", () => {
    const partial: LearningProfile = { version: 1, educationStage: "THPT", subjects: ["Toán"] };
    expect(hasProfileSignal(partial)).toBe(true);
    expect(isProfileComplete(partial)).toBe(false);
  });

// ======================================================================
// TÁI HIỆN LỖI THẬT: "field/topics phải là chuỗi ngắn hợp lệ."
// ======================================================================
// Payload dưới đây là BẢN SAO CHÍNH XÁC những gì LearningOnboarding gửi lên
// khi user mới bấm "Tiếp tục" mà chưa chạm vào ô nhập nào (xem
// draftToPayload: `field: draft.field` — draft rỗng = "").
describe("chuỗi rỗng là tín hiệu 'xoá', KHÔNG phải dữ liệu sai", () => {
  const emptyStringPatch = {
    version: 1,
    educationStage: "UNIVERSITY",
    // `|| undefined` -> JSON.stringify bỏ hẳn key, không sinh lỗi.
    grade: undefined,
    track: undefined,
    // Gửi NGUYÊN VĂN "" để báo "người dùng xoá ô này".
    field: "",
    topics: "",
    futureGoal: "",
    intents: [],
    goals: [],
    subjects: [],
    careerFields: [],
    aiPreferences: [],
    learningPreferences: [],
  };

  it("payload mặc định của UI mới không sinh lỗi validation nào", () => {
    const { errors } = sanitizeLearningProfile(emptyStringPatch);
    expect(errors).toEqual([]);
  });

  it("chuỗi rỗng đi tới merge để XOÁ field cũ (không phải giữ giá trị cũ)", () => {
    const { profile } = sanitizeLearningProfile(emptyStringPatch);
    const current: LearningProfile = {
      version: 1,
      educationStage: "UNIVERSITY",
      field: "CNTT",
      topics: "Excel",
      futureGoal: "SU_NGHIEP",
    };
    const merged = mergeLearningProfile(current, profile);
    expect(merged.field).toBeUndefined();
    expect(merged.topics).toBeUndefined();
    expect(merged.futureGoal).toBeUndefined();
    // Phần khác KHÔNG bị mất.
    expect(merged.educationStage).toBe("UNIVERSITY");
  });

  it("sai KIỂU (mảng/số) thì VẪN phải báo lỗi — không nới lỏng validation", () => {
    const { errors } = sanitizeLearningProfile({ version: 1, field: ["CNTT"] as unknown as string });
    expect(errors.some((e) => e.includes("field"))).toBe(true);

    const { errors: e2 } = sanitizeLearningProfile({ version: 1, topics: 42 as unknown as string });
    expect(e2.some((e) => e.includes("topics"))).toBe(true);
  });

  it("quá độ dài vẫn bị chặn (không cắt cụt âm thầm)", () => {
    const { errors } = sanitizeLearningProfile({ version: 1, field: "x".repeat(500) });
    expect(errors.some((e) => e.includes("field"))).toBe(true);
  });

  it("giá trị hợp lệ vẫn lưu bình thường", () => {
    const { profile, errors } = sanitizeLearningProfile({
      version: 1,
      field: "  Kinh tế  ",
      topics: " Excel cho kế toán ",
      futureGoal: "SU_NGHIEP",
    });
    expect(errors).toEqual([]);
    expect(profile.field).toBe("Kinh tế"); // đã trim
    expect(profile.topics).toBe("Excel cho kế toán");
    expect(profile.futureGoal).toBe("SU_NGHIEP");
  });
});

});
