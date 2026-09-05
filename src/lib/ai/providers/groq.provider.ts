// ================================================================
// GROQ PROVIDER — fallback đầu tiên khi Gemini fail (priority 2)
// ================================================================
// Groq expose API tương thích OpenAI (chat completions) nên KHÔNG cần
// thêm SDK riêng — dùng thẳng fetch qua helper openaiCompatible.ts,
// tránh thêm dependency không cần thiết.
// ================================================================

import { AIProvider, AIResponse, GenerateOptions } from "../types";
import { callOpenAICompatibleChat } from "./openaiCompatible";

const TIMEOUT_MS = 8_000;
const BASE_URL = "https://api.groq.com/openai/v1";
// Model mặc định: Llama 3.3 70B bản "versatile" trên Groq — cân bằng
// tốt giữa chất lượng và tốc độ cho use case tutor/quiz/roadmap hiện
// tại của LearnX. Đọc từ .env để đổi không cần build lại (đồng bộ
// cách làm với GEMINI_MODEL).
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export const groqProvider: AIProvider = {
  name: "groq",

  isConfigured() {
    return !!process.env.GROQ_API_KEY;
  },

  async generate(opts: GenerateOptions): Promise<AIResponse> {
    return callOpenAICompatibleChat(
      {
        providerName: "groq",
        baseUrl: BASE_URL,
        apiKey: process.env.GROQ_API_KEY!,
        model: process.env.GROQ_MODEL || DEFAULT_MODEL,
        timeoutMs: TIMEOUT_MS,
      },
      opts
    );
  },
};
