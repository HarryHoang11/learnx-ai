// ================================================================
// TEST — classifyHttpError (tầng phân loại lỗi HTTP dùng chung cho
// Groq/OpenRouter)
// ================================================================
// Mạch tư duy: đây là nơi bug thực tế đã xảy ra ("Groq lỗi HTTP 404 ->
// retry -> vẫn 404") — status 404 trước đây rơi vào nhánh default nên
// bị gắn kind "transient" và bị router retry vô nghĩa. Test này khoá
// lại đúng behavior mong muốn cho từng status code, để nếu ai đó lỡ
// sửa nhầm classifyHttpError sau này, test sẽ đỏ ngay thay vì phải
// đợi gặp lại lỗi 404 thật ngoài log production.
// ================================================================

import { describe, it, expect } from "vitest";
import { classifyHttpError } from "../openaiCompatible";

describe("classifyHttpError", () => {
  it("404 (model không tồn tại) -> kind 'no_retry', KHÔNG phải 'transient'", () => {
    const err = classifyHttpError("groq", 404, '{"error":{"message":"model not found"}}');
    expect(err.kind).toBe("no_retry");
    expect(err.status).toBe(404);
  });

  it("401 -> kind 'auth'", () => {
    const err = classifyHttpError("openrouter", 401, "Missing Authentication header");
    expect(err.kind).toBe("auth");
  });

  it("403 -> kind 'auth'", () => {
    const err = classifyHttpError("groq", 403, "forbidden");
    expect(err.kind).toBe("auth");
  });

  it("429 -> kind 'transient' (rate limit, nên retry)", () => {
    const err = classifyHttpError("groq", 429, "rate limited");
    expect(err.kind).toBe("transient");
  });

  it("500/502/503/504 -> kind 'transient'", () => {
    for (const status of [500, 502, 503, 504]) {
      const err = classifyHttpError("groq", status, "server error");
      expect(err.kind).toBe("transient");
    }
  });

  it("400/422 (input không hợp lệ) -> kind 'fatal', không fallback provider khác", () => {
    expect(classifyHttpError("groq", 400, "bad request").kind).toBe("fatal");
    expect(classifyHttpError("groq", 422, "invalid").kind).toBe("fatal");
  });
});
