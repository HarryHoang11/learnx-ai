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
// THỨ TỰ PROVIDER: Gemini -> Groq -> DeepSeek -> OpenRouter. Provider
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
import { deepseekProvider } from "./providers/deepseek.provider";
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
  async function generateWith<T>(
    opts: GenerateOptions,
    parse: (response: AIResponse) => T
  ): Promise<T> {
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
          try {
            const parsed = parse(result);
            log(`${provider.name} success (model: ${result.model}).`);
            return parsed;
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            throw new ProviderError(`${provider.name} trả về dữ liệu không hợp lệ: ${message}`, "transient");
          }
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

          if (providerErr.kind === "no_retry") {
            // Lỗi cấu hình riêng của provider này (vd 404 model không
            // tồn tại) — retry lại CÙNG model chắc chắn fail y hệt lần
            // nữa, nên bỏ qua retry và fallback ngay, KHÔNG chờ thêm.
            log(`${provider.name} lỗi cấu hình (không thể retry), chuyển sang provider tiếp theo: ${providerErr.message}`);
            break;
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
      `Tất cả AI provider (Gemini, Groq, DeepSeek, OpenRouter) đều không khả dụng, vui lòng thử lại sau ít phút. Lỗi cuối: ${lastMessage}`
    );
  }

  async function generate(opts: GenerateOptions): Promise<AIResponse> {
    return generateWith(opts, (response) => response);
  }

  async function generateJSON<T>(opts: GenerateOptions, validate?: (value: unknown) => T): Promise<T> {
    return generateWith({ ...opts, jsonMode: true }, (response) => {
      const parsed: unknown = JSON.parse(response.content);
      return validate ? validate(parsed) : (parsed as T);
    });
  }

  return { generate, generateJSON };
}

// Thứ tự fallback của router MẶC ĐỊNH — export để (a) test khoá lại ĐÚNG
// thứ tự này (một provider bị timeout/rate-limit/model-404/API error thì
// router tự chuyển sang provider kế tiếp, không retry vô hạn), và (b) chỗ
// nào cần biết "hệ thống đang có những provider nào" thì đọc 1 nguồn duy
// nhất thay vì import lẻ từng file provider.
//
// Thứ tự này KHÔNG phải thứ hạng chất lượng model, mà là thứ hạng
// "độ sẵn sàng cho use case của LearnX": Gemini (chính, có embedding cùng
// nhà) -> Groq (nhanh, độ trễ thấp cho tutor/quiz) -> DeepSeek (rẻ, JSON
// output tốt) -> OpenRouter (chợ model, nhiều model dự phòng nhất).
// Provider thiếu API key bị SKIP hoàn toàn, không tính là fail.
export const DEFAULT_AI_PROVIDERS: readonly AIProvider[] = [
  geminiProvider,
  groqProvider,
  deepseekProvider,
  openrouterProvider,
];

const defaultRouter = createAIRouter([...DEFAULT_AI_PROVIDERS]);

// ----------------------------------------------------------------
// API CÔNG KHAI — giữ NGUYÊN chữ ký so với lib/ai/gemini.ts bản cũ để
// mọi service/route hiện tại chỉ cần đổi đường dẫn import.
// ----------------------------------------------------------------
export async function generateText(opts: GenerateOptions): Promise<string> {
  const result = await defaultRouter.generate(opts);
  return result.content;
}

export async function generateJSON<T>(opts: GenerateOptions, validate?: (value: unknown) => T): Promise<T> {
  return defaultRouter.generateJSON(opts, validate);
}

export { AIOverloadedError };
