// ================================================================
// TEST — AI PROVIDER ROUTER
// ================================================================
// Dùng createAIRouter(providers) với provider GIẢ (mock) thay vì mock
// module thật (fetch/@google/generative-ai) — nhanh, không cần network,
// không cần API key thật, và test đúng LOGIC điều phối (thứ tự, retry,
// fallback, skip khi thiếu key) chứ không test provider thật.
// ================================================================

import { describe, it, expect, vi } from "vitest";
import { createAIRouter } from "../router";
import { AIProvider, AIResponse, ProviderError } from "../types";

const baseOpts = { systemPrompt: "system", userPrompt: "user" };

function mockProvider(
  name: string,
  opts: {
    configured?: boolean;
    // Mảng kết quả cho từng lần generate() được gọi liên tiếp — cho
    // phép mô phỏng "lần đầu fail, lần retry thành công".
    behavior: Array<AIResponse | Error>;
  }
): AIProvider {
  let callIndex = 0;
  return {
    name,
    isConfigured: vi.fn(() => opts.configured ?? true),
    generate: vi.fn(async () => {
      const step = opts.behavior[Math.min(callIndex, opts.behavior.length - 1)];
      callIndex++;
      if (step instanceof Error) throw step;
      return step;
    }),
  };
}

function fakeResponse(provider: string): AIResponse {
  return { content: `hello from ${provider}`, provider, model: "test-model" };
}

describe("AI Router — fallback & retry", () => {
  it("Case 1: Gemini success -> không gọi Groq/OpenRouter", async () => {
    const gemini = mockProvider("gemini", { behavior: [fakeResponse("gemini")] });
    const groq = mockProvider("groq", { behavior: [fakeResponse("groq")] });
    const openrouter = mockProvider("openrouter", { behavior: [fakeResponse("openrouter")] });

    const router = createAIRouter([gemini, groq, openrouter]);
    const result = await router.generate(baseOpts);

    expect(result.provider).toBe("gemini");
    expect(gemini.generate).toHaveBeenCalledTimes(1);
    expect(groq.generate).not.toHaveBeenCalled();
    expect(openrouter.generate).not.toHaveBeenCalled();
  });

  it("Case 2: Gemini 429 -> retry Gemini -> vẫn fail -> Groq success", async () => {
    const gemini = mockProvider("gemini", {
      behavior: [
        new ProviderError("rate limit", "transient", 429),
        new ProviderError("rate limit", "transient", 429),
      ],
    });
    const groq = mockProvider("groq", { behavior: [fakeResponse("groq")] });
    const openrouter = mockProvider("openrouter", { behavior: [fakeResponse("openrouter")] });

    const router = createAIRouter([gemini, groq, openrouter]);
    const result = await router.generate(baseOpts);

    expect(result.provider).toBe("groq");
    expect(gemini.generate).toHaveBeenCalledTimes(2); // 1 gốc + 1 retry
    expect(openrouter.generate).not.toHaveBeenCalled();
  });

  it("Case 3: Gemini timeout -> Groq success", async () => {
    const gemini = mockProvider("gemini", {
      behavior: [
        new ProviderError("timeout", "transient"),
        new ProviderError("timeout", "transient"),
      ],
    });
    const groq = mockProvider("groq", { behavior: [fakeResponse("groq")] });
    const openrouter = mockProvider("openrouter", { behavior: [fakeResponse("openrouter")] });

    const router = createAIRouter([gemini, groq, openrouter]);
    const result = await router.generate(baseOpts);

    expect(result.provider).toBe("groq");
  });

  it("Case 4: Gemini fail -> Groq fail -> OpenRouter success", async () => {
    const gemini = mockProvider("gemini", {
      behavior: [new ProviderError("500", "transient", 500), new ProviderError("500", "transient", 500)],
    });
    const groq = mockProvider("groq", {
      behavior: [new ProviderError("503", "transient", 503), new ProviderError("503", "transient", 503)],
    });
    const openrouter = mockProvider("openrouter", { behavior: [fakeResponse("openrouter")] });

    const router = createAIRouter([gemini, groq, openrouter]);
    const result = await router.generate(baseOpts);

    expect(result.provider).toBe("openrouter");
  });

  it("Case 5: tất cả provider fail -> AIOverloadedError, không throw lỗi lạ/crash", async () => {
    const gemini = mockProvider("gemini", {
      behavior: [new ProviderError("500", "transient", 500), new ProviderError("500", "transient", 500)],
    });
    const groq = mockProvider("groq", {
      behavior: [new ProviderError("503", "transient", 503), new ProviderError("503", "transient", 503)],
    });
    const openrouter = mockProvider("openrouter", {
      behavior: [new ProviderError("timeout", "transient"), new ProviderError("timeout", "transient")],
    });

    const router = createAIRouter([gemini, groq, openrouter]);

    await expect(router.generate(baseOpts)).rejects.toMatchObject({ name: "AIOverloadedError" });
  });

  it("Case 6: GEMINI_API_KEY missing (isConfigured=false) -> skip Gemini -> thử Groq", async () => {
    const gemini = mockProvider("gemini", { configured: false, behavior: [fakeResponse("gemini")] });
    const groq = mockProvider("groq", { behavior: [fakeResponse("groq")] });
    const openrouter = mockProvider("openrouter", { behavior: [fakeResponse("openrouter")] });

    const router = createAIRouter([gemini, groq, openrouter]);
    const result = await router.generate(baseOpts);

    expect(result.provider).toBe("groq");
    expect(gemini.generate).not.toHaveBeenCalled();
  });

  it("Lỗi 'fatal' (bad request) không retry, không fallback, ném ra ngay", async () => {
    const gemini = mockProvider("gemini", {
      behavior: [new ProviderError("bad request", "fatal", 400)],
    });
    const groq = mockProvider("groq", { behavior: [fakeResponse("groq")] });

    const router = createAIRouter([gemini, groq]);

    await expect(router.generate(baseOpts)).rejects.toMatchObject({ kind: "fatal" });
    expect(gemini.generate).toHaveBeenCalledTimes(1); // không retry
    expect(groq.generate).not.toHaveBeenCalled(); // không fallback
  });

  it("Lỗi 'auth' (401/403) không retry cùng provider nhưng CÓ fallback provider tiếp theo", async () => {
    const gemini = mockProvider("gemini", {
      behavior: [new ProviderError("invalid key", "auth", 401)],
    });
    const groq = mockProvider("groq", { behavior: [fakeResponse("groq")] });

    const router = createAIRouter([gemini, groq]);
    const result = await router.generate(baseOpts);

    expect(result.provider).toBe("groq");
    expect(gemini.generate).toHaveBeenCalledTimes(1); // không retry
  });
});
