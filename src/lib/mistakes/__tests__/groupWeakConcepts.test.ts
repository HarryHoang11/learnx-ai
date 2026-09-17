import { describe, expect, it } from "vitest";
import { groupIntoWeakConcepts, type MistakeLogRow } from "../groupWeakConcepts";

function makeMistake(overrides: Partial<MistakeLogRow>): MistakeLogRow {
  return {
    id: "m1",
    userId: "u1",
    subject: "Toán",
    topic: "Đạo hàm",
    questionText: "Câu hỏi mẫu",
    selectedAnswer: "A",
    correctAnswer: "B",
    explanation: null,
    sourceDocumentId: null,
    createdAt: new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  };
}

describe("groupIntoWeakConcepts", () => {
  it("gộp đúng theo (subject, topic) và đếm số lần sai", () => {
    const mistakes = [
      makeMistake({ id: "1", topic: "Đạo hàm" }),
      makeMistake({ id: "2", topic: "Đạo hàm" }),
      makeMistake({ id: "3", topic: "Tích phân" }),
    ];
    const result = groupIntoWeakConcepts(mistakes);
    expect(result).toHaveLength(2);
    const derivative = result.find((c) => c.topic === "Đạo hàm");
    expect(derivative?.mistakeCount).toBe(2);
  });

  it("sắp xếp topic sai NHIỀU NHẤT lên đầu", () => {
    const mistakes = [
      makeMistake({ id: "1", topic: "Tích phân" }),
      makeMistake({ id: "2", topic: "Đạo hàm" }),
      makeMistake({ id: "3", topic: "Đạo hàm" }),
      makeMistake({ id: "4", topic: "Đạo hàm" }),
    ];
    const result = groupIntoWeakConcepts(mistakes);
    expect(result[0].topic).toBe("Đạo hàm");
    expect(result[0].mistakeCount).toBe(3);
  });

  it("giữ sourceDocumentId khi ĐA SỐ lỗi cùng 1 nguồn", () => {
    const mistakes = [
      makeMistake({ id: "1", sourceDocumentId: "doc-A" }),
      makeMistake({ id: "2", sourceDocumentId: "doc-A" }),
      makeMistake({ id: "3", sourceDocumentId: "doc-B" }),
    ];
    const result = groupIntoWeakConcepts(mistakes);
    expect(result[0].sourceDocumentId).toBe("doc-A");
  });

  it("bỏ sourceDocumentId khi lỗi trộn lẫn từ nhiều nguồn khác nhau (không có nguồn nào chiếm đa số)", () => {
    const mistakes = [
      makeMistake({ id: "1", sourceDocumentId: "doc-A" }),
      makeMistake({ id: "2", sourceDocumentId: "doc-B" }),
      makeMistake({ id: "3", sourceDocumentId: null }),
    ];
    const result = groupIntoWeakConcepts(mistakes);
    expect(result[0].sourceDocumentId).toBeNull();
  });

  it("giới hạn số lượng kết quả trả về theo limit", () => {
    const mistakes = ["A", "B", "C", "D"].map((topic, i) => makeMistake({ id: String(i), topic }));
    const result = groupIntoWeakConcepts(mistakes, 2);
    expect(result).toHaveLength(2);
  });

  it("dùng lỗi đầu tiên trong danh sách (giả định đã sort desc theo createdAt) làm ví dụ hiển thị", () => {
    const mistakes = [
      makeMistake({ id: "1", questionText: "Câu mới nhất", explanation: "Giải thích mới" }),
      makeMistake({ id: "2", questionText: "Câu cũ hơn", explanation: "Giải thích cũ" }),
    ];
    const result = groupIntoWeakConcepts(mistakes);
    expect(result[0].exampleQuestion).toBe("Câu mới nhất");
    expect(result[0].exampleExplanation).toBe("Giải thích mới");
  });

  it("trả về mảng rỗng khi không có lỗi sai nào", () => {
    expect(groupIntoWeakConcepts([])).toEqual([]);
  });
});
