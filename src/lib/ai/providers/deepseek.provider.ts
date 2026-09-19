// ================================================================
// DEEPSEEK PROVIDER — fallback thứ 3 (priority 3)
// ================================================================
// DeepSeek expose API tương thích OpenAI (POST /chat/completions), y hệt
// Groq/OpenRouter, nên KHÔNG thêm SDK riêng (@langchain, openai...) —
// dùng lại callOpenAICompatibleChat() để giữ ĐÚNG một đường code
// fetch/parse/classify-error cho mọi provider kiểu OpenAI (xem
// openaiCompatible.ts). Nhờ vậy provider mới thừa hưởng nguyên xi cách
// phân loại lỗi đã được test (404 -> no_retry, 429/5xx -> transient,
// 401/403 -> auth, 400/422 -> fatal).
//
// BASE URL: https://api.deepseek.com — theo đúng docs DeepSeek
// (https://api-docs.deepseek.com/quick_start/pricing): cả base URL
// "OpenAI Format" lẫn ví dụ trong JSON Output guide đều dùng
// "https://api.deepseek.com" (KHÔNG cần hậu tố /v1; DeepSeek tự route
// cả 2 dạng). Vì vậy KHÔNG hardcode "/v1" — helper tự ghép
// `${baseUrl}/chat/completions`. Nếu deployment riêng (proxy nội bộ,
// gateway) cần base URL khác thì set DEEPSEEK_BASE_URL, không sửa code.
//
// MODEL: đọc từ DEEPSEEK_MODEL. Mặc định "deepseek-flash" vì đây là
// provider FALLBACK khi Gemini+Groq đã fail — ưu tiên model rẻ/nhanh/
// concurrency cao (2500) hơn là model suy luận nặng (deepseek-v4-pro,
// concurrency 500, đắt hơn ~4.4x). Cả 2 model hiện tại đều hỗ trợ
// "Json Output ✓" (xem bảng Models & Pricing), nên jsonMode hoạt động
// với cả 2 — đổi model chỉ cần sửa .env.
// ================================================================

import { AIProvider, AIResponse, GenerateOptions } from "../types";
import { callOpenAICompatibleChat } from "./openaiCompatible";

const TIMEOUT_MS = 12_000;
const DEFAULT_BASE_URL = "https://api.deepseek.com";
const DEFAULT_MODEL = "deepseek-flash";

export const deepseekProvider: AIProvider = {
  name: "deepseek",

  isConfigured() {
    return !!process.env.DEEPSEEK_API_KEY;
  },

  async generate(opts: GenerateOptions): Promise<AIResponse> {
    return callOpenAICompatibleChat(
      {
        providerName: "deepseek",
        baseUrl: (process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ""),
        apiKey: process.env.DEEPSEEK_API_KEY!,
        model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
        timeoutMs: TIMEOUT_MS,
      },
      opts
    );
  },
};