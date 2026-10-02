import { afterEach, describe, expect, it, vi } from "vitest";
import { readApi, describeError, ApiError, TransportError } from "../readApi";

// Test cho lớp "lưới an toàn" của error handling trên mobile/APK:
// mục tiêu là KHÔNG BAO GIỜ lộ message kỹ thuật ra UI — "Unexpected token
// '<'" (proxy trả HTML), "Failed to fetch" / "Load failed" (mạng), "NetworkError
// when attempting to fetch resource" (WebView).

/** Response giả với body dạng text — readApi đọc .text() nên không cần .json(). */
function makeResponse(body: string, status = 200): Response {
  return { status, text: async () => body } as unknown as Response;
}

describe("readApi — đọc ApiResponse không để lỗi JSON che mất nguyên nhân", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("body JSON hợp lệ thì trả về nguyên vẹn", async () => {
    const payload = { success: true, data: { reply: "xin chào" } };
    const json = await readApi<{ reply: string }>(
      makeResponse(JSON.stringify(payload)),
      "POST /api/ai/chat"
    );
    expect(json).toEqual(payload);
  });

  it("body KHÔNG phải JSON (proxy trả HTML 502) thì ném TransportError, KHÔNG SyntaxError", async () => {
    // Đây là case quan trọng nhất: nếu dùng res.json() thẳng, SyntaxError
    // mang message "Unexpected token '<'" sẽ bị đẩy thẳng ra UI.
    const html = "<html><head><title>502 Bad Gateway</title></head></html>";
    await expect(
      readApi(makeResponse(html, 502), "POST /api/ai/chat")
    ).rejects.toBeInstanceOf(TransportError);
  });

  it("body rỗng cũng ném TransportError (không parse được)", async () => {
    await expect(readApi(makeResponse("", 204), "GET /api/x")).rejects.toBeInstanceOf(TransportError);
  });

  it("log dev có status + body cắt ngắn, nhưng TransportError KHÔNG chứa body", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    let caught: unknown;
    try {
      await readApi(makeResponse("<html>oops</html>", 500), "GET /api/y");
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(TransportError);
    // Nhãn + status có trong message (hữu ích khi debug), nhưng KHÔNG có
    // body HTML để tránh rò rỉ nội dung response vào log/UI.
    expect((caught as Error).message).toContain("GET /api/y");
    expect((caught as Error).message).toContain("500");
    expect((caught as Error).message).not.toContain("<html>");
    expect(spy).toHaveBeenCalled();
  });
});

describe("describeError — chỉ thông điệp hiển thị được cho người dùng", () => {
  const fallback = "Không thể kết nối tới máy chủ.";

  it("TransportError (body hỏng / proxy 5xx) => dùng fallback, không lộ kỹ thuật", () => {
    const err = new TransportError("POST /api/ai/chat -> HTTP 502 (body không phải JSON)");
    expect(describeError(err, fallback)).toBe(fallback);
  });

  it("lỗi mạng kiểu fetch (TypeError) => dùng fallback thay vì 'Failed to fetch'", () => {
    const err = new TypeError("Failed to fetch");
    expect(describeError(err, fallback)).toBe(fallback);
  });

  it("lỗi mạng kiểu WebView/iOS cũng về fallback", () => {
    const webview = new TypeError("NetworkError when attempting to fetch resource.");
    const ios = new TypeError("Load failed");
    expect(describeError(webview, fallback)).toBe(fallback);
    expect(describeError(ios, fallback)).toBe(fallback);
  });

  it("ApiError (message do API viết cho người dùng) => GIỮ NGUYÊN", () => {
    const err = new ApiError("Tài liệu vượt quá 20MB.");
    expect(describeError(err, fallback)).toBe("Tài liệu vượt quá 20MB.");
  });

  it("lỗi 401/403/404/500 từ API vẫn giữ message vì app chủ động throw ApiError", () => {
    for (const msg of [
      "Bạn cần đăng nhập lại.",
      "Bạn không có quyền xem tài liệu này.",
      "Không tìm thấy tài liệu.",
      "Có lỗi khi gọi AI Tutor, thử lại sau.",
    ]) {
      expect(describeError(new ApiError(msg), fallback)).toBe(msg);
    }
  });

  it("giá trị lạ (null, string, lỗi không có message) => fallback, không bao giờ undefined", () => {
    expect(describeError(null, fallback)).toBe(fallback);
    expect(describeError(undefined, fallback)).toBe(fallback);
    expect(describeError("một string lạ", fallback)).toBe(fallback);
    expect(describeError(new Error(""), fallback)).toBe(fallback);
  });
});