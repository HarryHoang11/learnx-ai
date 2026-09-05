// ================================================================
// HELPER DÙNG CHUNG CHO PROVIDER KIỂU "OpenAI-compatible chat completions"
// ================================================================
// Mạch tư duy: Groq và OpenRouter đều expose y hệt REST API shape của
// OpenAI (POST {baseUrl}/chat/completions, body {model, messages,
// response_format?}) — viết 1 hàm dùng chung thay vì lặp lại toàn bộ
// logic fetch/parse/classify-error ở 2 file provider, đúng yêu cầu
// "không duplicate logic giữa providers". Phần KHÁC nhau thực sự giữa
// Groq/OpenRouter (base URL, tên biến env, timeout, extra header) vẫn
// nằm riêng trong từng file provider — hàm này chỉ nhận chúng làm
// tham số.
// ================================================================

import { AIResponse, GenerateOptions, ProviderError } from "../types";
import { withTimeout } from "./timeout";

interface OpenAICompatibleConfig {
  providerName: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  extraHeaders?: Record<string, string>;
}

function classifyHttpError(providerName: string, status: number, bodyText: string): ProviderError {
  if (status === 401 || status === 403) {
    return new ProviderError(`${providerName} từ chối API key (${status}): ${bodyText}`, "auth", status);
  }
  if (status === 429) {
    return new ProviderError(`${providerName} rate limit (429): ${bodyText}`, "transient", status);
  }
  if (status >= 500) {
    return new ProviderError(`${providerName} server error (${status}): ${bodyText}`, "transient", status);
  }
  if (status === 400 || status === 422) {
    return new ProviderError(`${providerName} từ chối request (${status} - input không hợp lệ): ${bodyText}`, "fatal", status);
  }
  return new ProviderError(`${providerName} lỗi HTTP ${status}: ${bodyText}`, "transient", status);
}

export async function callOpenAICompatibleChat(
  config: OpenAICompatibleConfig,
  opts: GenerateOptions
): Promise<AIResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  let response: Response;
  try {
    response = await withTimeout(
      fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          ...config.extraHeaders,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: "system", content: opts.systemPrompt },
            { role: "user", content: opts.userPrompt },
          ],
          ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
      }),
      config.timeoutMs,
      config.providerName
    );
  } catch (err) {
    if (err instanceof ProviderError) throw err; // timeout đã classify sẵn
    const message = err instanceof Error ? err.message : String(err);
    // fetch throw TypeError khi network error / DNS fail / bị abort
    // giữa chừng — đều là lỗi tạm thời phía kết nối, không phải bug.
    throw new ProviderError(`${config.providerName} network error: ${message}`, "transient");
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => "");
    throw classifyHttpError(config.providerName, response.status, bodyText.slice(0, 500));
  }

  const json = await response.json();
  const content: string | undefined = json?.choices?.[0]?.message?.content;

  if (!content || content.trim().length === 0) {
    throw new ProviderError(`${config.providerName} trả về nội dung rỗng.`, "transient");
  }

  return {
    content,
    provider: config.providerName,
    model: json?.model ?? config.model,
    usage: json?.usage
      ? {
          inputTokens: json.usage.prompt_tokens,
          outputTokens: json.usage.completion_tokens,
          totalTokens: json.usage.total_tokens,
        }
      : undefined,
  };
}
