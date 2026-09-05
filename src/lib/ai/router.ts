// ================================================================
// AI PROVIDER ROUTER
// ================================================================
// Mạch tư duy: đây là điểm THAY THẾ cho generateText/generateJSON cũ
// vốn nằm trong lib/ai/gemini.ts (gọi thẳng Gemini, không fallback).
// Toàn bộ service/route hiện tại (document/quiz/roadmap/tutor service,
// api/ai/chat, api/ai/hint, api/assessment/start, api/roadmap/generate,
// api/analytics) chỉ cần đổi 1 dòng import
// (`@/lib/ai/gemini` -> `@/lib/ai/router`), KHÔNG cần sửa gì khác vì
// generateText()/generateJSON()/AIOverloadedError giữ NGUYÊN chữ ký.
//
// THỨ TỰ PROVIDER: Gemini -> Groq -> OpenRouter (đúng yêu cầu). Provider
// thiếu API key bị SKIP (không throw), không phải lỗi.
//
// VÌ SAO EMBEDDING (lib/embeddings/vector.ts) KHÔNG đi qua router này:
// cột DB `DocumentChunk.embedding` là `vector(768)` cố định, và code
// hiện tại cắt/chuẩn hoá (L2-normalize) vector 3072 chiều của CHÍNH
// `gemini-embedding-001` về đúng 768 chiều theo kỹ thuật MRL riêng của
// Google. Groq/OpenRouter không có model embedding tương thích để cho
// ra cùng không gian vector — trộn embedding từ nhiều model khác nhau
// vào cùng 1 cột sẽ làm similarity search (RAG) cho kết quả sai lệch
// ngầm, khó phát hiện hơn nhiều so với việc Gemini tạm thời không gọi
// được. Vì vậy embedding CHỦ Ý giữ nguyên chỉ dùng Gemini, không nằm
// trong phạm vi "AI Provider Router" của yêu cầu này.
// ================================================================

import { geminiProvider } from "./providers/gemini.provider";
import { groqProvider } from "./providers/groq.provider";
import { openrouterProvider } from "./providers/openrouter.provider";
import { AIProvider, AIResponse, GenerateOptions, ProviderError, AIOverloadedError } from "./types";

const RETRY_BACKOFF_MS = 300;

function log(message: string) {
  // Không dùng logger riêng vì project hiện tại chưa có logging
  // abstraction nào khác ngoài console.error rải rác — giữ nhất quán,
  // thêm prefix "[AI]" để dễ lọc log khi debug fallback.
  // eslint-disable-next-line no-console
  console.log(`[AI] ${message}`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Factory thay vì export thẳng 1 instance singleton — để test (xem
// __tests__/router.test.ts) có thể tự truyền vào danh sách provider
// giả (mock) mà không cần mock module thật qua GEMINI_API_KEY/fetch.
export function createAIRouter(providers: AIProvider[]) {
  async function generate(opts: GenerateOptions): Promise<AIResponse> {
    let lastError: unknown;

    for (const provider of providers) {
      if (!provider.isConfigured()) {
        log(`Bỏ qua provider "${provider.name}": thiếu API key.`);
        continue;
      }

      log(`Trying provider: ${provider.name}`);

      // Tối đa 1 lần gốc + 1 lần retry CHO CÙNG 1 provider — chỉ với
      // lỗi "transient" (429/timeout/network/5xx). Lỗi "auth"/"fatal"
      // thoát vòng retry ngay (xem ProviderErrorKind trong types.ts).
      const MAX_ATTEMPTS_PER_PROVIDER = 2;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_PROVIDER; attempt++) {
        try {
          const result = await provider.generate(opts);
          log(`${provider.name} success (model: ${result.model}).`);
          return result;
        } catch (err) {
          const providerErr =
            err instanceof ProviderError ? err : new ProviderError(String(err), "transient");
          lastError = providerErr;

          if (providerErr.kind === "fatal") {
            // Lỗi do request của app (input/prompt sai) — provider
            // khác nhận CÙNG input sẽ fail giống hệt, fallback chỉ
            // che giấu bug thật nên ném thẳng ra, KHÔNG thử provider
            // tiếp theo.
            log(`${provider.name} lỗi không thể fallback (fatal): ${providerErr.message}`);
            throw providerErr;
          }

          if (providerErr.kind === "auth") {
            log(`${provider.name} từ chối API key, chuyển sang provider tiếp theo: ${providerErr.message}`);
            break; // không retry cùng provider, fallback ngay
          }

          // kind === "transient"
          log(`${provider.name} thất bại (lần ${attempt}/${MAX_ATTEMPTS_PER_PROVIDER}): ${providerErr.message}`);
          if (attempt < MAX_ATTEMPTS_PER_PROVIDER) {
            await sleep(RETRY_BACKOFF_MS * attempt);
            continue;
          }
          log(`${provider.name} vẫn fail sau retry, chuyển sang provider tiếp theo.`);
        }
      }
    }

    const lastMessage = lastError instanceof Error ? lastError.message : String(lastError);
    throw new AIOverloadedError(
      `Tất cả AI provider (Gemini, Groq, OpenRouter) đều không khả dụng, vui lòng thử lại sau ít phút. Lỗi cuối: ${lastMessage}`
    );
  }

  return { generate };
}

const defaultRouter = createAIRouter([geminiProvider, groqProvider, openrouterProvider]);

// ----------------------------------------------------------------
// API CÔNG KHAI — giữ NGUYÊN chữ ký so với lib/ai/gemini.ts bản cũ để
// mọi service/route hiện tại chỉ cần đổi đường dẫn import.
// ----------------------------------------------------------------
export async function generateText(opts: GenerateOptions): Promise<string> {
  const result = await defaultRouter.generate(opts);
  return result.content;
}

export async function generateJSON<T>(opts: GenerateOptions): Promise<T> {
  const raw = await generateText({ ...opts, jsonMode: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`AI trả JSON không hợp lệ, không parse được. Raw: ${raw.slice(0, 200)}...`);
  }
}

export { AIOverloadedError };
