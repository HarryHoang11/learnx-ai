import { describe, it, expect } from "vitest";
import {
  PHASES,
  firstIncompleteStep,
  isStepAnswered,
  phaseIndexOfStep,
  phaseOfStep,
  profileStepsForStage,
  stepsForStage,
  surveyProgress,
  type StepId,
} from "@/lib/onboarding/steps";

describe("stepsForStage", () => {
  it("chưa chọn giai đoạn -> lõi chung vẫn đủ, nhưng KHÔNG sinh bước định danh", () => {
    // Bước định danh (lớp/ngành/chủ đề) cần biết giai đoạn mới hỏi được —
    // chưa chọn thì không có bước nào cả. Các bước CHUNG vẫn giữ để người
    // dùng đã biết mình là ai vẫn trả lời tiếp được, không bị chặn ở bước 1.
    const steps = stepsForStage("");
    expect(steps[0]).toBe("stage");
    expect(steps).not.toContain("field");
    expect(steps).not.toContain("grade");
    expect(steps).toContain("diagnostic");
    expect(stepsForStage(undefined)).toEqual(steps);
  });

  it("học sinh THPT -> hỏi lớp, định hướng, ngành/nghề đang cân nhắc", () => {
    const steps = stepsForStage("THPT");
    expect(steps[0]).toBe("stage");
    expect(steps).toContain("grade");
    expect(steps).toContain("track");
    expect(steps).toContain("career");
  });

  it("sinh viên -> hỏi NGÀNH học, KHÔNG hỏi lớp/định hướng (không áp dụng)", () => {
    const steps = stepsForStage("UNIVERSITY");
    expect(steps).toContain("field");
    expect(steps).not.toContain("grade");
    expect(steps).not.toContain("track");
    expect(steps).not.toContain("career");
  });

  it("người đi làm -> hỏi NGHỀ, không hỏi lớp", () => {
    const steps = stepsForStage("WORKING");
    expect(steps).toContain("field");
    expect(steps).not.toContain("grade");
  });

  it("người tự học -> hỏi CHỦ ĐỀ, không hỏi ngành/lớp", () => {
    const steps = stepsForStage("SELF_LEARNING");
    expect(steps).toContain("topics");
    expect(steps).not.toContain("field");
    expect(steps).not.toContain("grade");
  });

  it("MỌI nhóm đều kết thúc bằng bước kiểm tra năng lực", () => {
    for (const stage of ["THCS", "THPT", "UNIVERSITY", "POSTGRAD", "WORKING", "SELF_LEARNING", "OTHER", ""]) {
      const steps = stepsForStage(stage);
      expect(steps[steps.length - 1]).toBe("diagnostic");
    }
  });

  it("giai đoạn lạ (dữ liệu phiên bản cũ) -> không sinh bước rác, vẫn có lõi chung", () => {
    const steps = stepsForStage("KHONG_CO_TRONG_DANH_MUC");
    expect(steps[0]).toBe("stage");
    expect(steps).toContain("diagnostic");
    expect(steps).not.toContain("field");
  });

  it("profileStepsForStage trả về mảng rỗng khi chưa chọn giai đoạn", () => {
    expect(profileStepsForStage(undefined)).toEqual([]);
  });
});

describe("phase mapping", () => {
  it("mọi step thuộc đúng phase của nó", () => {
    expect(phaseOfStep("stage").id).toBe("profile");
    expect(phaseOfStep("field").id).toBe("profile");
    expect(phaseOfStep("career").id).toBe("profile");
    expect(phaseOfStep("intent").id).toBe("goals");
    expect(phaseOfStep("goal").id).toBe("goals");
    expect(phaseOfStep("subjects").id).toBe("goals");
    expect(phaseOfStep("time").id).toBe("style");
    expect(phaseOfStep("ai").id).toBe("style");
    expect(phaseOfStep("diagnostic").id).toBe("diagnostic");
  });

  it("thứ tự phase là 1..5 và phase 5 là Ready (ngoài khảo sát)", () => {
    expect(PHASES.map((p) => p.index)).toEqual([1, 2, 3, 4, 5]);
    expect(PHASES[4].id).toBe("ready");
    expect(phaseIndexOfStep("diagnostic")).toBe(4);
  });

describe("isStepAnswered", () => {
  it("bước diagnostic LUÔN coi là đã trả lời (hành động, không phải dữ liệu)", () => {
    expect(isStepAnswered("diagnostic", {})).toBe(true);
  });

  it("bước chỉ cần MỘT field trong nhóm là đủ (không đòi đủ tất cả)", () => {
    // Chỉ chọn mục tiêu chứ chưa gõ mục tiêu cụ thể -> vẫn tính là đã trả lời.
    expect(isStepAnswered("goal", { goalCategory: "EXAM" })).toBe(true);
    expect(isStepAnswered("goal", { goals: [{ title: "x" }] })).toBe(true);
    expect(isStepAnswered("goal", { futureGoal: "DAIHOC" })).toBe(true);
    expect(isStepAnswered("goal", {})).toBe(false);
  });

  it("bước subjects chấp nhận cả môn có sẵn lẫn môn gõ tay", () => {
    expect(isStepAnswered("subjects", { subjects: ["Toán"] })).toBe(true);
    expect(isStepAnswered("subjects", { otherSubject: "Excel" })).toBe(true);
    expect(isStepAnswered("subjects", { subjects: [] })).toBe(false);
  });
});

describe("firstIncompleteStep", () => {
  it("dừng ở bước đầu tiên còn thiếu, không bắt làm lại từ đầu", () => {
    const steps = stepsForStage("UNIVERSITY");
    const index = firstIncompleteStep(steps, { educationStage: "UNIVERSITY", field: "CNTT" });
    expect(steps[index]).toBe("intent");
  });

  it("đã trả lời đủ -> mở bước CUỐI (chốt), không quay về bước 1", () => {
    const steps = stepsForStage("SELF_LEARNING");
    const full = {
      educationStage: "SELF_LEARNING",
      topics: "Excel",
      intents: ["NEW_FIELD"],
      goalCategory: "SKILL",
      subjects: ["Tin học"],
      studyTime: "D1",
      aiPreferences: ["EXPLAIN_FIRST"],
    };
    const index = firstIncompleteStep(steps, full);
    expect(steps[index]).toBe("diagnostic");
  });
});

describe("surveyProgress", () => {
  it("tính trên danh sách bước CỦA NHÓM đó, không dùng số cứng", () => {
    const p = surveyProgress({ educationStage: "UNIVERSITY", field: "CNTT" });
    const total = stepsForStage("UNIVERSITY").length;
    expect(p.total).toBe(total);
    // stage + field + diagnostic (coi là đã trả lời) = 3
    expect(p.answered).toBe(3);
  });

  it("người đi làm và học sinh có TỔNG số bước khác nhau", () => {
    const worker = surveyProgress({ educationStage: "WORKING" });
    const student = surveyProgress({ educationStage: "THPT" });
    expect(worker.total).not.toBe(student.total);
  });

  it("chưa chọn giai đoạn -> vẫn ra % hợp lệ, không phải NaN", () => {
    const p = surveyProgress({});
    expect(Number.isNaN(p.percent)).toBe(false);
    expect(p.percent).toBeGreaterThanOrEqual(0);
    expect(p.percent).toBeLessThanOrEqual(100);
    // Bước diagnostic luôn tính là đã trả lời nên % không thể bằng 0 khi
    // đã có bước trong danh sách — nhưng vẫn là con số nhỏ, không phải 100.
    expect(p.percent).toBeLessThan(50);
  });
});

// Type-level guard: mọi StepId phải được ánh xạ phase, không sót.
describe("StepId exhaustiveness", () => {
  it("mọi StepId đều có phase hợp lệ", () => {
    const all: StepId[] = [
      "stage", "field", "grade", "track", "career", "topics",
      "intent", "goal", "subjects", "time", "ai", "diagnostic",
    ];
    for (const step of all) {
      expect(phaseOfStep(step).index).toBeGreaterThanOrEqual(1);
    }
  });
});

});
