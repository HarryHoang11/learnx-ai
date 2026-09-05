// ================================================================
// GEMINI SDK CLIENT — dùng chung bởi GeminiProvider (text) VÀ
// lib/embeddings/vector.ts (embedding).
// ================================================================
// Mạch tư duy: TRƯỚC ĐÂY file này throw cứng ngay lúc import nếu
// thiếu GEMINI_API_KEY (fail-fast lúc `next dev`/cold start). Điều
// này KHÔNG còn phù hợp sau khi có AI Router (router.ts): nếu thiếu
// GEMINI_API_KEY, yêu cầu là router phải tự bỏ qua Gemini và thử
// Groq/OpenRouter — nhưng vì generateText/generateJSON được gọi từ
// nhiều service khác nhau, chỉ cần 1 trong số đó được import ở đâu đó
// lúc server khởi động là app crash ngay cả khi Groq/OpenRouter vẫn
// dùng được bình thường. Vì vậy bỏ throw ở đây — `new
// GoogleGenerativeAI("")` KHÔNG gọi mạng, chỉ lưu key, nên không lỗi
// lúc khởi tạo. Lỗi thật (nếu Gemini thực sự được gọi mà thiếu key)
// sẽ được GeminiProvider.isConfigured() chặn từ trước khi tới lượt
// router gọi generate(), nên trường hợp gọi "chay" không còn xảy ra
// với luồng text generation nữa — chỉ còn lib/embeddings/vector.ts
// (embedding CHỈ dùng Gemini, xem giải thích trong router.ts) vẫn có
// thể lỗi rõ ràng nếu thiếu key, và lỗi đó được throw tự nhiên bởi
// chính Google SDK khi gọi embedContent(), không cần code thêm.
// ================================================================

import { GoogleGenerativeAI } from "@google/generative-ai";
import { AIOverloadedError } from "./types";

const apiKey = process.env.GEMINI_API_KEY;

export const client = new GoogleGenerativeAI(apiKey || "");

export const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-flash-latest";

// Re-export để lib/embeddings/vector.ts KHÔNG cần đổi import — lớp
// AIOverloadedError giờ định nghĩa DUY NHẤT ở types.ts (dùng chung
// cho cả router.ts), file này chỉ trỏ lại đúng 1 class, tránh có 2
// định nghĩa AIOverloadedError khác nhau khiến `instanceof` sai.
export { AIOverloadedError };

export function isRetryableStatus(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 503 || status === 429) return true;
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("503") || message.includes("429") || message.toLowerCase().includes("high demand");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retry với backoff tăng dần + jitter nhẹ — tối đa 3 lần gọi (1 lần gốc
// + 2 lần retry). Dùng cho embedding (lib/embeddings/vector.ts) — text
// generation qua GeminiProvider có logic retry RIÊNG nằm trong
// router.ts (thống nhất chung cho cả 3 provider), không dùng hàm này.
export async function callWithRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryableStatus(err) || attempt === maxAttempts) break;
      const backoffMs = 500 * 2 ** (attempt - 1) + Math.random() * 200;
      await sleep(backoffMs);
    }
  }
  throw lastErr;
}
