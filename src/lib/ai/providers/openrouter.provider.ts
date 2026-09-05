// ================================================================
// OPENROUTER PROVIDER — fallback CUỐI CÙNG (priority 3)
// ================================================================
// Cũng tương thích OpenAI API như Groq, nhưng OpenRouter yêu cầu thêm
// 2 header (HTTP-Referer, X-Title) để hiển thị đúng tên app trên
// dashboard OpenRouter — không bắt buộc để request chạy được, nhưng
// nên có để tuân thủ khuyến nghị của OpenRouter và dễ theo dõi usage.
// ================================================================

import { AIProvider, AIResponse, GenerateOptions } from "../types";
import { callOpenAICompatibleChat } from "./openaiCompatible";

const TIMEOUT_MS = 12_000;
const BASE_URL = "https://openrouter.ai/api/v1";
// Model mặc định: bản free-tier của Llama 3.3 70B trên OpenRouter —
// vì đây là fallback CUỐI CÙNG (đã fail cả Gemini lẫn Groq), ưu tiên
// một model luôn sẵn sàng thay vì tối ưu benchmark. Đọc từ .env để dễ
// đổi sang model trả phí nếu cần độ ổn định cao hơn.
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

export const openrouterProvider: AIProvider = {
  name: "openrouter",

  isConfigured() {
    return !!process.env.OPENROUTER_API_KEY;
  },

  async generate(opts: GenerateOptions): Promise<AIResponse> {
    return callOpenAICompatibleChat(
      {
        providerName: "openrouter",
        baseUrl: BASE_URL,
        apiKey: process.env.OPENROUTER_API_KEY!,
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        timeoutMs: TIMEOUT_MS,
        extraHeaders: {
          "HTTP-Referer": process.env.APP_URL || "https://learnx.app",
          "X-Title": "LearnX AI",
        },
      },
      opts
    );
  },
};
