// ================================================================
// GEMINI PROVIDER — provider CHÍNH (priority 1)
// ================================================================
// Mạch tư duy: giữ NGUYÊN logic sinh text từ lib/ai/gemini.ts bản cũ
// (generationConfig.responseMimeType cho jsonMode, cách nhận diện lỗi
// 404 model bị gỡ...), chỉ bọc lại đúng theo interface AIProvider để
// router.ts có thể dùng chung với Groq/OpenRouter mà không cần biết
// chi tiết SDK của Google.
// ================================================================

import { client, MODEL_NAME } from "../gemini";
import { AIProvider, AIResponse, GenerateOptions, ProviderError } from "../types";
import { withTimeout } from "./timeout";

const TIMEOUT_MS = 12_000;

function classifyError(err: unknown): ProviderError {
  const status = (err as { status?: number })?.status;
  const message = err instanceof Error ? err.message : String(err);

  if (err instanceof ProviderError) return err; // đã được classify (vd timeout)

  // Model bị Google gỡ khỏi API — đây là lỗi CẤU HÌNH (sai tên model
  // trong .env), không phải Gemini tạm thời quá tải, và provider khác
  // (Groq/OpenRouter) dùng model khác nên fallback vẫn hợp lý ở đây
  // -> coi là "transient" để router thử Groq tiếp, nhưng giữ nguyên
  // message rõ ràng để log ra dễ debug.
  if (status === 404 || message.toLowerCase().includes("not found")) {
    return new ProviderError(
      `Gemini: model "${MODEL_NAME}" không khả dụng (có thể đã bị Google gỡ, kiểm tra GEMINI_MODEL trong .env). Chi tiết: ${message}`,
      "transient",
      404
    );
  }

  if (status === 429 || message.includes("429")) {
    return new ProviderError(`Gemini rate limit (429): ${message}`, "transient", 429);
  }
  if (status === 503 || message.includes("503") || message.toLowerCase().includes("high demand")) {
    return new ProviderError(`Gemini quá tải (503): ${message}`, "transient", 503);
  }
  if (status === 401 || status === 403) {
    return new ProviderError(`Gemini từ chối API key (${status}): ${message}`, "auth", status);
  }
  if (status && status >= 500) {
    return new ProviderError(`Gemini server error (${status}): ${message}`, "transient", status);
  }
  if (
    message.toLowerCase().includes("network") ||
    message.toLowerCase().includes("fetch failed") ||
    message.toLowerCase().includes("econnreset")
  ) {
    return new ProviderError(`Gemini network error: ${message}`, "transient");
  }
  if (status === 400) {
    return new ProviderError(`Gemini từ chối request (400 - input không hợp lệ): ${message}`, "fatal", 400);
  }

  // Không nhận diện được -> mặc định coi là transient để vẫn có cơ
  // hội fallback thay vì làm cả request fail hẳn vì 1 lỗi lạ.
  return new ProviderError(`Gemini lỗi không xác định: ${message}`, "transient", status);
}

export const geminiProvider: AIProvider = {
  name: "gemini",

  isConfigured() {
    return !!process.env.GEMINI_API_KEY;
  },

  async generate(opts: GenerateOptions): Promise<AIResponse> {
    const model = client.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: opts.systemPrompt,
      generationConfig: opts.jsonMode ? { responseMimeType: "application/json" } : undefined,
    });

    let result;
    try {
      result = await withTimeout(model.generateContent(opts.userPrompt), TIMEOUT_MS, "Gemini");
    } catch (err) {
      throw classifyError(err);
    }

    const content = result.response.text();
    if (!content || content.trim().length === 0) {
      throw new ProviderError("Gemini trả về nội dung rỗng.", "transient");
    }

    const usageMeta = result.response.usageMetadata;
    return {
      content,
      provider: "gemini",
      model: MODEL_NAME,
      usage: usageMeta
        ? {
            inputTokens: usageMeta.promptTokenCount,
            outputTokens: usageMeta.candidatesTokenCount,
            totalTokens: usageMeta.totalTokenCount,
          }
        : undefined,
    };
  },
};
