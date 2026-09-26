// Test end-to-end cho /api/onboarding — chạy ROUTE THẬT với payload THẬT mà
// LearningOnboarding gửi lên.
//
// Vì sao cần test ở tầng route thay vì chỉ test `sanitizeLearningProfile`:
// đường đi payload frontend -> route -> sanitize -> merge -> Prisma có nhiều
// chỗ có thể lệch (đặc biệt là chỗ "gửi `""` để báo xoá"). Test ở đây khoá
// lại TOÀN BỘ chuỗi đó, kể cả hành vi Prisma được gọi với gì.
//
// Mock `@/lib/auth/session` + `@/lib/db/prisma` nên KHÔNG cần DB thật và
// không ghi dữ liệu thật ở bất kỳ đâu.
import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetCurrentUserId = vi.fn<() => Promise<string | null>>();
const mockUserFindUnique = vi.fn();
const mockUserUpdate = vi.fn();
const mockUserUpdateMany = vi.fn();
const mockTransaction = vi.fn();

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
      updateMany: (...args: unknown[]) => mockUserUpdateMany(...args),
    },
    learningGoal: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn() },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { PATCH } from "../route";

function patchRequest(body: unknown) {
  return { json: async () => body } as unknown as Parameters<typeof PATCH>[0];
}

/** Payload BẢN SAO CHÍNH XÁC của `draftToPayload` khi user mới, chưa chọn gì. */
const emptyDraftPayload = {
  version: 1,
  // Enum -> `|| undefined` -> JSON.stringify loại bỏ key.
  educationStage: "UNIVERSITY",
  grade: undefined,
  track: undefined,
  // Văn bản tự do -> gửi nguyên văn "".
  field: "",
  topics: "",
  otherSubject: "",
  intents: [],
  goalCategory: undefined,
  futureGoal: "",
  goals: [],
  subjects: [],
  careerStatus: undefined,
  careerFields: [],
  studyTime: undefined,
  studyTimePreference: undefined,
  aiPreferences: [],
  learningPreferences: [],
};

/** Hồ sơ user đang có trong DB (mặc định: chưa có gì). */
function storedUser(learningProfile: Record<string, unknown> | null = null) {
  return {
    onboardingStatus: "EXPLORING",
    welcomeSeenAt: new Date(),
    firstLearningSessionAt: null,
    learningProfile,
    learningProfileCompletedAt: null,
    _count: { attempts: 0, documents: 0, roadmaps: 0 },
  };
}

/** Trả về learningProfile mà Prisma được gọi để lưu. */
function savedProfile() {
  expect(mockUserUpdate).toHaveBeenCalled();
  const data = mockUserUpdate.mock.calls[0][0].data as { learningProfile?: Record<string, unknown> };
  return data.learningProfile ?? {};
}

/** Các lần update có set onboardingStatus (dùng để kiểm trạng thái). */
function statusUpdates() {
  return mockUserUpdate.mock.calls.filter((c) => c[0].data.onboardingStatus);
}

beforeEach(() => {
  mockGetCurrentUserId.mockReset();
  mockUserFindUnique.mockReset();
  mockUserUpdate.mockReset();
  mockUserUpdateMany.mockReset();
  mockTransaction.mockReset();

  mockGetCurrentUserId.mockResolvedValue("user-1");
  mockUserUpdate.mockResolvedValue({ id: "user-1" });
  mockUserUpdateMany.mockResolvedValue({ count: 1 });
  mockUserFindUnique.mockResolvedValue(storedUser());
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      user: { update: mockUserUpdate },
      learningGoal: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn() },
    })
  );
});

describe("PATCH /api/onboarding — save_learning_profile", () => {
  it("payload rỗng của user mới KHÔNG log lỗi validation (đúng lỗi đã gặp)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await PATCH(patchRequest({ action: "save_learning_profile", ...emptyDraftPayload }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    // Trước khi sửa, MỖI lần bấm "Tiếp tục" đều in ra 3 dòng
    // "field/topics/futureGoal phải là chuỗi ngắn hợp lệ."
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("user mới: profile rỗng vẫn lưu được version + giai đoạn đã chọn", async () => {
    await PATCH(patchRequest({ action: "save_learning_profile", ...emptyDraftPayload }));
    const saved = savedProfile();
    expect(saved.version).toBe(1);
    expect(saved.educationStage).toBe("UNIVERSITY");
  });

  it("lưu giá trị hợp lệ và trim khoảng trắng thừa", async () => {
    await PATCH(
      patchRequest({
        action: "save_learning_profile",
        ...emptyDraftPayload,
        field: "  Kinh tế  ",
        topics: " Excel cho kế toán ",
        futureGoal: "SU_NGHIEP",
      })
    );
    const saved = savedProfile();
    expect(saved.field).toBe("Kinh tế");
    expect(saved.topics).toBe("Excel cho kế toán");
    expect(saved.futureGoal).toBe("SU_NGHIEP");
  });

  it("topics nhận NHIỀU chủ đề trong một chuỗi tự do (đúng thiết kế, không phải mảng)", async () => {
    const topics = "Excel cho kế toán, tiếng Anh giao tiếp, Power BI";
    await PATCH(patchRequest({ action: "save_learning_profile", ...emptyDraftPayload, topics }));
    expect(savedProfile().topics).toBe(topics);
  });

  it("topics rỗng -> hợp lệ, không phải lỗi", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await PATCH(patchRequest({ action: "save_learning_profile", ...emptyDraftPayload, topics: "" }));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("XOÁ được field cũ: chọn ngành rồi bỏ chọn -> DB không còn giá trị đó", async () => {
    // Mô phỏng lần lưu trước: user đã có field="CNTT".
    mockUserFindUnique.mockResolvedValue(
      storedUser({ version: 1, educationStage: "UNIVERSITY", field: "CNTT" })
    );
    await PATCH(patchRequest({ action: "save_learning_profile", ...emptyDraftPayload, field: "" }));
    // `""` phải tới tay merge để xoá — đây là hành vi bị hỏng trước khi sửa.
    expect(savedProfile().field).toBeUndefined();
  });

  it("patch KHÔNG gửi key nào -> giữ nguyên dữ liệu cũ (không xoá nhầm)", async () => {
    // Client cũ / Quick Setup gửi payload không có `field`, `topics`. Khi đó
    // merge phải GIỮ giá trị đang lưu, không được hiểu là "xoá".
    mockUserFindUnique.mockResolvedValue(
      storedUser({ version: 1, educationStage: "UNIVERSITY", topics: "Excel", field: "CNTT" })
    );
    await PATCH(
      patchRequest({ action: "save_learning_profile", version: 1, educationStage: "UNIVERSITY" })
    );
    const saved = savedProfile();
    expect(saved.topics).toBe("Excel");
    expect(saved.field).toBe("CNTT");
  });

  it("điền 1 field không xoá nhầm field khác đã có", async () => {
    // Người dùng SV chỉ có `field`; `topics` luôn gửi "" vì họ không bao giờ
    // thấy bước hỏi chủ đề -> `topics` phải vẫn rỗng, không sao.
    mockUserFindUnique.mockResolvedValue(
      storedUser({ version: 1, educationStage: "UNIVERSITY", topics: "Excel" })
    );
    await PATCH(
      patchRequest({ action: "save_learning_profile", ...emptyDraftPayload, field: "CNTT" })
    );
    const saved = savedProfile();
    expect(saved.field).toBe("CNTT");
    // topics CỐ Ý bị xoá: client gửi "" = tín hiệu "không có chủ đề này".
    // Không có mất dữ liệu vì nhóm SV không dùng `topics` (xem steps.ts).
    expect(saved.topics).toBeUndefined();
  });

  it("field sai kiểu (mảng) vẫn bị từ chối + ghi log — KHÔNG nới lỏng validation", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await PATCH(
      patchRequest({ action: "save_learning_profile", ...emptyDraftPayload, field: ["CNTT"] })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
    expect(savedProfile().field).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("field quá dài bị từ chối (không cắt cụt âm thầm)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await PATCH(
      patchRequest({ action: "save_learning_profile", ...emptyDraftPayload, field: "x".repeat(500) })
    );
    expect(savedProfile().field).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("futureGoal ngoài danh mục bị từ chối (enum nghiêm)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await PATCH(
      patchRequest({ action: "save_learning_profile", ...emptyDraftPayload, futureGoal: "SAI_BALA" })
    );
    expect(savedProfile().futureGoal).toBeUndefined();
    warn.mockRestore();
  });
});

describe("PATCH /api/onboarding — action khác", () => {
  it("bỏ qua bước (skip) trả 200, không lỗi", async () => {
    const res = await PATCH(patchRequest({ action: "skip_onboarding" }));
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it("complete_survey ghi mốc surveyDecidedAt nhưng KHÔNG nâng onboardingStatus", async () => {
    const res = await PATCH(patchRequest({ action: "complete_survey" }));
    expect(res.status).toBe(200);
    expect(typeof savedProfile().surveyDecidedAt).toBe("string");
    // Bỏ qua kiểm tra không có nghĩa AI đã biết người dùng -> KHÔNG được
    // đánh dấu PERSONALIZED.
    expect(statusUpdates()).toHaveLength(0);
  });

  it("bấm Hoàn tất ở bước cuối -> nâng lên PERSONALIZED", async () => {
    await PATCH(
      patchRequest({ action: "save_learning_profile", ...emptyDraftPayload, completed: true })
    );
    const updates = statusUpdates();
    expect(updates.length).toBeGreaterThan(0);
    expect(updates[0][0].data.onboardingStatus).toBe("PERSONALIZED");
  });

  it("thiếu action -> 400, không ghi DB", async () => {
    const res = await PATCH(patchRequest({ ...emptyDraftPayload }));
    expect(res.status).toBe(400);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });

  it("chưa đăng nhập -> 401, không chạm DB", async () => {
    mockGetCurrentUserId.mockResolvedValue(null);
    const res = await PATCH(patchRequest({ action: "save_learning_profile", ...emptyDraftPayload }));
    expect(res.status).toBe(401);
    expect(mockUserUpdate).not.toHaveBeenCalled();
  });
});
