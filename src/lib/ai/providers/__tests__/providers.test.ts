// ================================================================
// TEST — DeepSeek provider + thứ tự fallback của router MẶC ĐỊNH
// ================================================================
// Mạch tư duy: provider DeepSeek phải chứng minh được 4 điều mà KHÔNG cần
// API key thật (stub global fetch, không gọi mạng thật):
//   1) isConfigured() đúng điều kiện.
//   2) Gọi ĐÚNG endpoint OpenAI-compatible, model/endpoint lấy từ env.
//   3) jsonMode -> gửi response_format json_object (DeepSeek
//      yêu cầu prompt chứa từ "json" — đã audit toàn bộ prompts.ts).
//   4) Lỗi HTTP phân loại đúng kind và message KHÔNG chứa API key.
// ================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAIRouter, DEFAULT_AI_PROVIDERS } from "../../router";
import { deepseekProvider } from "../deepseek.provider";
import { openrouterProvider } from "../openrouter.provider";
import { ProviderError } from "../../types";

const MANAGED_KEYS = [
  "DEEPSEEK_API_KEY",
  "DEEPSEEK_BASE_URL",
  "DEEPSEEK_MODEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
] as const;

let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of MANAGED_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of MANAGED_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.unstubAllGlobals();
});

const baseOpts = { systemPrompt: "system", userPrompt: "user" };

// Ghi lại URL + init của từng request để assert — KHÔNG log ra console.
function stubFetchSequence(responder: (url: string) => { status: number; body: unknown }) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      const { status, body } = responder(String(url));
      if (status !== 200) {
        return { ok: false, status, text: async () => JSON.stringify(body) } as unknown as Response;
      }
      return { ok: true, status, json: async () => body } as unknown as Response;
    })
  );
  return calls;
}

function jsonBodyOf(init: RequestInit): Record<string, unknown> {
  return JSON.parse(String(init.body)) as Record<string, unknown>;
}

describe("AI Router — thứ tự provider mặc định", () => {
  it("Gemini -> Groq -> DeepSeek -> OpenRouter", () => {
    expect(DEFAULT_AI_PROVIDERS.map((p) => p.name)).toEqual([
      "gemini",
      "groq",
      "deepseek",
      "openrouter",
    ]);
  });
});

describe("DeepSeek provider", () => {
  it("thiếu DEEPSEEK_API_KEY -> isConfigured() false (router SKIP, không crash)", () => {
    expect(deepseekProvider.isConfigured()).toBe(false);
  });

  it("gọi đúng endpoint OpenAI-compatible, model mặc định, key chỉ nằm ở header Authorization", async () => {
    process.env.DEEPSEEK_API_KEY = "ds-test-key";
    const calls = stubFetchSequence(() => ({
      status: 200,
      body: { model: "deepseek-flash", choices: [{ message: { content: "xin chao" } }] },
    }));

    const result = await deepseekProvider.generate(baseOpts);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.deepseek.com/chat/completions");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer ds-test-key");
    const payload = jsonBodyOf(calls[0].init);
    expect(payload.model).toBe("deepseek-flash");
    expect(payload.messages).toEqual([
      { role: "system", content: "system" },
      { role: "user", content: "user" },
    ]);
    // Không jsonMode -> KHÔNG gửi response_format (tránh ép JSON cho các
    // task văn bản tự do như tóm tắt tài liệu / study guide).
    expect(payload.response_format).toBeUndefined();
    expect(result.content).toBe("xin chao");
    expect(result.provider).toBe("deepseek");
  });

  it("jsonMode gửi response_format json_object; DEEPSEEK_MODEL/BASE_URL ghi đè được từ env", async () => {
    process.env.DEEPSEEK_API_KEY = "ds-test-key";
    process.env.DEEPSEEK_MODEL = "deepseek-v4-pro";
    process.env.DEEPSEEK_BASE_URL = "https://gateway.internal/deepseek/";
    const calls = stubFetchSequence(() => ({
      status: 200,
      body: { choices: [{ message: { content: "{}" } }] },
    }));

    await deepseekProvider.generate({ ...baseOpts, jsonMode: true });

    // "/" cuối của BASE_URL được cắt để không thành "//chat/completions".
    expect(calls[0].url).toBe("https://gateway.internal/deepseek/chat/completions");
    const payload = jsonBodyOf(calls[0].init);
    expect(payload.model).toBe("deepseek-v4-pro");
    expect(payload.response_format).toEqual({ type: "json_object" });
  });

  it("lỗi 401 -> ProviderError kind 'auth' và message KHÔNG lộ API key", async () => {
    process.env.DEEPSEEK_API_KEY = "super-secret-ds-key";
    stubFetchSequence(() => ({ status: 401, body: { error: { message: "Authentication Fails" } } }));

    const err = await deepseekProvider.generate(baseOpts).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).kind).toBe("auth");
    expect((err as ProviderError).message).not.toContain("super-secret-ds-key");
  });
});
describe("Fallback thực tế qua provider", () => {
  it("DeepSeek 404 (model sai) -> KHÔNG retry -> OpenRouter thành công", async () => {
    process.env.DEEPSEEK_API_KEY = "ds-test-key";
    process.env.OPENROUTER_API_KEY = "or-test-key";

    const calls = stubFetchSequence((url) => {
      if (url.includes("deepseek")) return { status: 404, body: { error: "model_not_found" } };
      return { status: 200, body: { model: "or-model", choices: [{ message: { content: "final" } }] } };
    });

    const router = createAIRouter([deepseekProvider, openrouterProvider]);
    const result = await router.generate(baseOpts);

    expect(result.provider).toBe("openrouter");
    expect(result.content).toBe("final");
    // 404 là lỗi cấu hình model -> KHÔNG retry vô hạn.
    expect(calls.filter((c) => c.url.includes("deepseek"))).toHaveLength(1);
    expect(calls.filter((c) => c.url.includes("openrouter"))).toHaveLength(1);
  });
});