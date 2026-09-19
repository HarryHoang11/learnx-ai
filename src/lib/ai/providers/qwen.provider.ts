// ================================================================
// QWEN PROVIDER (Alibaba Cloud Model Studio / DashScope) — priority 4
// ================================================================
// Qwen cũng expose API tương thích OpenAI qua "compatible-mode" của
// DashScope, nên dùng CHUNG callOpenAICompatibleChat() với
// Groq/OpenRouter/DeepSeek — không thêm SDK @dashscope của Alibaba
// (tránh 1 dependency chỉ để gọi đúng 1 endpoint chuẩn OpenAI).
//
// BASE URL: BẮT BUỘC lấy từ env QWEN_BASE_URL, KHÔNG hardcode. Lý do:
// DashScope có base URL KHÁC NHAU theo region (theo docs
// https://help.aliyun.com/en/model-studio/base-url):
//   - Singapore:        https://dashscope-intl.aliyuncs.com/compatible-mode/v1
//   - China (Beijing):  https://dashscope.aliyuncs.com/compatible-mode/v1
//   - US (Virginia):    https://dashscope-us.aliyuncs.com/compatible-mode/v1
//   - Hong Kong:        https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1
//   - workspace/dedicated domain: {WorkspaceId}.{region}.maas.aliyuncs.com/compatible-mode/v1
// API key cũng theo region — dùng key region A với endpoint region B sẽ
// bị 401. Vì vậy endpoint phải là CẤU HÌNH, không phải hằng số trong
// code: cùng một bản build phải chạy được ở mọi region/deployment.
// isConfigured() yêu cầu CẢ key LẪN base URL — thiếu base URL thì
// provider bị router SKIP (không thể đoán đúng region thay người dùng).
//
// MODEL: đọc từ QWEN_MODEL. Mặc định "qwen-flash" — model nhanh/rẻ,
// đúng vai trò fallback, và nằm trong danh sách hỗ trợ JSON Object mode
// (xem docs Structured output). LƯU Ý đã kiểm chứng trong docs: dùng
// response_format {"type":"json_object"} BẮT BUỘC prompt phải chứa từ
// "json" (case-insensitive), nếu không DashScope trả lỗi 400
// "'messages' must contain the word 'json'...". Điều này được xử lý tập
// trung ở openaiCompatible.ts (mọi provider) chứ không riêng Qwen.
// ================================================================

import { AIProvider, AIResponse, GenerateOptions } from "../types";
import { callOpenAICompatibleChat } from "./openaiCompatible";

const TIMEOUT_MS = 12_000;
const DEFAULT_MODEL = "qwen-flash";

export const qwenProvider: AIProvider = {
  name: "qwen",

  isConfigured() {
    return !!process.env.QWEN_API_KEY && !!process.env.QWEN_BASE_URL;
  },

  async generate(opts: GenerateOptions): Promise<AIResponse> {
    return callOpenAICompatibleChat(
      {
        providerName: "qwen",
        // Bỏ dấu "/" cuối (nếu người dùng dán kèm) để không sinh ra
        // "//chat/completions" — DashScope không normalize double slash.
        baseUrl: process.env.QWEN_BASE_URL!.replace(/\/+$/, ""),
        apiKey: process.env.QWEN_API_KEY!,
        model: process.env.QWEN_MODEL || DEFAULT_MODEL,
        timeoutMs: TIMEOUT_MS,
      },
      opts
    );
  },
};