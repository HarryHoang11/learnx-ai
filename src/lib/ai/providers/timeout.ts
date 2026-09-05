// ================================================================
// TIMEOUT HELPER DÙNG CHUNG CHO CẢ 3 PROVIDER
// ================================================================
// Mạch tư duy: mỗi provider có timeout khác nhau (Gemini 12s, Groq
// 8s, OpenRouter 12s theo đúng con số trong yêu cầu). Google SDK
// (@google/generative-ai bản đang dùng) không có option `timeout`
// truyền thẳng vào generateContent(), nên dùng Promise.race để ép
// timeout THỐNG NHẤT cho mọi provider (kể cả 2 provider gọi qua fetch
// - fetch dùng AbortController riêng để hủy request THẬT, còn Gemini
// SDK thì request gốc vẫn chạy ngầm tới khi tự xong/tự lỗi, nhưng ta
// không đợi nó nữa — tránh request treo vô thời hạn phía người dùng).
// ================================================================

import { ProviderError } from "../types";

export async function withTimeout<T>(promise: Promise<T>, ms: number, providerName: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new ProviderError(`${providerName} timeout sau ${ms}ms`, "transient"));
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
