import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDueReviews } from "../reviewDue";

// Test chỉ mock TẦNG NETWORK (global fetch) để ĐẾM số request thật sự
// bắn ra — không tạo dữ liệu review giả: payload dưới đây đúng shape
// JSON mà server thật trả về khi user chưa có item đến hạn; helper chỉ
// chuyển tiếp nguyên trạng.
const payload = {
  success: true as const,
  data: {
    reviews: [],
    stats: { due: 0, overdue: 0, upcoming: 0, total: 0, averageEaseFactor: 2.5 },
    // Route luôn kèm key này (null khi không xin insights) — payload phải
    // khớp shape thật, nếu thiếu thì `json.data.insights ?? null` vẫn chạy
    // nhưng test không còn bảo vệ được hợp đồng dữ liệu nữa.
    insights: null,
  },
};

function stubFetchWith(json: unknown) {
  // `vi.fn(async (url: string) => ...)` — khai báo tham số để `mock.calls[0][0]`
  // có kiểu `string` trong test; `vi.fn()` không typed sẽ ra `undefined` và
  // TypeScript chặn (ts(2352)/(2493)).
  const fetchMock = vi.fn(async (_url: string) => ({ json: async () => json }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fetchDueReviews — khử trùng request đang bay", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("2 lời gọi SONG SONG cùng URL chỉ bắn 1 request (StrictMode double-invoke)", async () => {
    const fetchMock = stubFetchWith(payload);

    const [first, second] = await Promise.all([fetchDueReviews(30), fetchDueReviews(30)]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/review/due?limit=30");
    expect(first).toBe(second);
    expect(first).toEqual(payload);
  });

  it("sau khi request trước hoàn tất, lần load kế tiếp là request MỚI (refresh hoạt động)", async () => {
    const fetchMock = stubFetchWith(payload);

    await fetchDueReviews(30);
    await fetchDueReviews(30);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("request lỗi không bị kẹt trong bộ nhớ gộp — lần gọi sau được thử lại", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    await expect(fetchDueReviews(30)).rejects.toThrow("network down");

    const fetchMock = stubFetchWith(payload);
    await fetchDueReviews(30);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("limit khác nhau KHÔNG gộp nhầm URL (Review 30 vs Dashboard 5)", async () => {
    const fetchMock = stubFetchWith(payload);

    await Promise.all([fetchDueReviews(30), fetchDueReviews(5)]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

/**
 * Lọc môn + smart review (yêu cầu §14–§17).
 *
 * Vì sao cần test riêng: khoá gộp request bây giờ gồm CẢ `subject` trong
 * URL. Nếu khoá chỉ theo `limit`, thì lần gọi "ôn Toán" và "ôn Vật lý" sẽ
 * bị gộp làm 1 — người dùng bấm môn khác mà vẫn thấy dữ liệu môn cũ, đúng
 * loại bug "chọn A ra B" mà test này chặn.
 */
describe("fetchDueReviews — lọc môn & smart review", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gửi subject trong query khi chọn môn", async () => {
    const fetchMock = stubFetchWith(payload);

    await fetchDueReviews(30, { subject: "Toán" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/review/due?limit=30&subject=To%C3%A1n"
    );
  });

  it("môn khác nhau KHÔNG gộp chung request (chọn Toán không lấy dữ liệu Vật lý)", async () => {
    const fetchMock = stubFetchWith(payload);

    await Promise.all([
      fetchDueReviews(30, { subject: "Toán" }),
      fetchDueReviews(30, { subject: "Vật lý" }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("môn có dấu tiếng Việt được mã hoá đúng (URL không bị hỏng)", async () => {
    const fetchMock = stubFetchWith(payload);

    await fetchDueReviews(30, { subject: "Ngữ văn" });

    // Assert bằng CHÍNH `URLSearchParams` (không phải `encodeURIComponent`)
    // vì 2 hàm này encode dấu cách KHÁC NHAU: URLSearchParams ra "+",
    // encodeURIComponent ra "%20". Cả hai đều hợp lệ với server, nhưng test
    // phải khớp đúng thứ implementation dùng, nếu không sẽ fail giả.
    const url = fetchMock.mock.calls[0][0] as string;
    const expected = new URLSearchParams({ limit: "30" });
    expected.set("subject", "Ngữ văn");
    expect(url).toBe(`/api/review/due?${expected.toString()}`);

    // Quan trọng hơn: giải mã ngược phải ra đúng tên môn — đây mới là điều
    // server thật sự nhận, và là chỗ bug "lọc rỗng" sẽ bắt ra.
    const decoded = new URL(`http://x${url}`).searchParams.get("subject");
    expect(decoded).toBe("Ngữ văn");
  });

  it("không lọc môn thì KHÔNG gửi tham số subject rỗng", async () => {
    const fetchMock = stubFetchWith(payload);

    await fetchDueReviews(30, { subject: undefined, insights: true });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("insights=true");
    expect(url).not.toContain("subject=");
  });

  it("insights=false thì không gửi tham số insights (dashboard không tốn query)", async () => {
    const fetchMock = stubFetchWith(payload);

    await fetchDueReviews(5);

    expect(fetchMock).toHaveBeenCalledWith("/api/review/due?limit=5");
  });

  it("gọi không lọc môn + insights và gọi có lọc môn là 2 request khác nhau", async () => {
    const fetchMock = stubFetchWith(payload);

    await Promise.all([
      fetchDueReviews(30, { insights: true }),
      fetchDueReviews(30, { subject: "Toán" }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
