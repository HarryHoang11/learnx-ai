// Test phân tách `currentGrade` (hồ sơ) và `diagnosticGrade` (lớp ĐANG kiểm tra)
// ở route thật `POST /api/assessment/start`.
//
// Vì sao cần test ở đây: yêu cầu cốt lõi là "học sinh lớp 11 vẫn kiểm tra
// được lớp 10, và việc đó KHÔNG được đổi lớp hiện tại trong hồ sơ". Rủi ro nằm
// ở chỗ route tin `grade` client, hoặc vô tình ghi ngược vào profile. Test ở
// tầng service không bắt được, vì lỗi nằm ở chỗ route gọi/nhận gì.
//
// Mock `@/lib/auth/session` + `@/lib/db/prisma` + `@/services/quiz.service` nên
// không cần DB thật, không gọi AI, và không ghi dữ liệu thật ở bất kỳ đâu.
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
const mockAssessmentFindFirst = vi.fn();
const mockAssessmentCreate = vi.fn();
const mockGenerateQuizQuestion = vi.fn();

vi.mock("@/lib/auth/session", () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
  unauthorizedResponse: () =>
    new Response(JSON.stringify({ success: false, error: "Chưa đăng nhập." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    assessment: {
      findFirst: (...args: unknown[]) => mockAssessmentFindFirst(...args),
      create: (...args: unknown[]) => mockAssessmentCreate(...args),
    },
    // assessment.service (import gián tiếp qua personalization.service)
    learningProgress: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

vi.mock("@/services/quiz.service", () => ({
  generateQuizQuestion: (...args: unknown[]) => mockGenerateQuizQuestion(...args),
  toPublicQuestion: (q: unknown) => q,
  QuizQuestionError: class QuizQuestionError extends Error {},
}));

import { POST } from "../route";

/** Hồ sơ học tập của user trong DB. */
function storedProfile(learningProfile: Record<string, unknown> | null) {
  mockUserFindUnique.mockResolvedValue({ learningProfile });
}

/** Câu hỏi giả, đủ để `toPublicQuestion` trả về nguyên trạng. */
const fakeQuestion = {
  id: "q1",
  text: "Câu hỏi?",
  type: "multiple_choice",
  difficulty: "easy",
  subject: "Toán",
  topic: "Kiến thức nền tảng",
  options: ["A", "B"],
  correctIndex: 0,
};

function postRequest(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof POST>[0];
}

/** Dữ liệu mà `assessment.create` được gọi với. */
function createdData() {
  return mockAssessmentCreate.mock.calls[0][0].data as Record<string, unknown>;
}

/** Tham số thứ 6 (options) của `generateQuizQuestion`. */
function questionOptions() {
  return mockGenerateQuizQuestion.mock.calls[0][5] as
    | { gradeLevelOverride?: string }
    | undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUserId.mockResolvedValue("user-1");
  mockAssessmentFindFirst.mockResolvedValue(null);
  mockAssessmentCreate.mockResolvedValue({ id: "assessment-new" });
  mockGenerateQuizQuestion.mockResolvedValue(fakeQuestion);
});

describe("POST /api/assessment/start — lớp đang kiểm tra", () => {
  it("không có grade trong body -> dùng lớp hiện tại của hồ sơ", async () => {
    storedProfile({ version: 1, educationStage: "THPT", grade: "11" });

    await POST(postRequest({ subject: "Toán" }));

    expect(createdData().grade).toBe("11");
    expect(createdData().educationStage).toBe("THPT");
    expect(questionOptions()?.gradeLevelOverride).toBe("học sinh lớp 11");
  });

  it("lớp 11 kiểm tra lớp 10 -> lưu lớp 10, KHÔNG ghi đè currentGrade", async () => {
    storedProfile({ version: 1, educationStage: "THPT", grade: "11" });

    const res = await POST(postRequest({ subject: "Toán", grade: "10" }));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(createdData().grade).toBe("10");
    // Câu hỏi đầu tiên theo lớp ĐANG kiểm tra, không phải lớp hiện tại.
    expect(questionOptions()?.gradeLevelOverride).toBe("học sinh lớp 10");
    // Điều kiện then chốt: hồ sơ KHÔNG bị đụng tới khi kiểm tra lớp khác.
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });


  it("lớp không hợp lệ với cấp đã khai -> rơi về lớp hiện tại", async () => {
    storedProfile({ version: 1, educationStage: "THPT", grade: "11" });

    await POST(postRequest({ subject: "Toán", grade: "99" }));

    expect(createdData().grade).toBe("11");
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("lớp thuộc cấp khác (THCS) không dùng được khi hồ sơ khai THPT", async () => {
    storedProfile({ version: 1, educationStage: "THPT", grade: "11" });

    await POST(postRequest({ subject: "Toán", grade: "6" }));

    expect(createdData().grade).toBe("11");
  });

  it("hồ sơ chưa khai cấp -> không tự chế lớp (null), prompt không bịa", async () => {
    storedProfile(null);

    await POST(postRequest({ subject: "Toán", grade: "10" }));

    expect(createdData().grade).toBeNull();
    expect(questionOptions()?.gradeLevelOverride).toBeUndefined();
  });

  it("chỉ tái dùng phiên đang mở CÙNG lớp (where có grade)", async () => {
    storedProfile({ version: 1, educationStage: "THPT", grade: "11" });

    await POST(postRequest({ subject: "Toán", grade: "10" }));

    expect(mockAssessmentFindFirst).toHaveBeenCalledTimes(1);
    const where = mockAssessmentFindFirst.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.grade).toBe("10");
    expect(where.status).toBe("in_progress");
    expect(where.attempts).toEqual({ none: {} });
  });

  it("thiếu subject -> 400, không tạo bài kiểm tra", async () => {
    storedProfile({ version: 1, educationStage: "THPT", grade: "11" });

    const res = await POST(postRequest({ grade: "10" }));

    expect(res.status).toBe(400);
    expect(mockAssessmentCreate).not.toHaveBeenCalled();
  });
});
