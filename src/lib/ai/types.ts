// ================================================================
// AI ROUTER — SHARED TYPES & ERROR CLASSES
// ================================================================
// Mạch tư duy: tách riêng file này (không để trong router.ts) vì cả
// 3 provider (gemini/groq/openrouter) VÀ router VÀ lib/embeddings/vector.ts
// (dùng AIOverloadedError cho lỗi embedding) đều cần import — tránh
// circular import nếu để trong router.ts (router.ts sẽ import ngược
// lại các provider).
// ================================================================

export interface GenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  // Bắt AI trả JSON thuần khi cần parse có cấu trúc (vd sinh câu hỏi quiz).
  jsonMode?: boolean;
}

// Format CHUNG mọi provider phải trả về — router/service phía trên
// KHÔNG được biết tới format riêng của Gemini/Groq/OpenRouter.
export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export interface AIProvider {
  name: string;
  // false nếu thiếu API key — router dùng để SKIP provider này thay
  // vì để lỗi ném ra giữa chừng lúc gọi generate().
  isConfigured(): boolean;
  generate(opts: GenerateOptions): Promise<AIResponse>;
}

// "kind" quyết định router xử lý thế nào khi provider ném lỗi này:
//   - "transient": lỗi tạm thời (429/timeout/network/5xx/unavailable)
//     -> retry chính provider đó tối đa 1 lần, hết vẫn fail thì
//     fallback sang provider tiếp theo.
//   - "auth": API key có nhưng bị provider từ chối (401/403) -> KHÔNG
//     retry provider này (retry với cùng key sai chỉ tốn thời gian),
//     fallback thẳng sang provider tiếp theo.
//   - "fatal": lỗi do request của app (400 malformed input, validation,
//     business logic...) -> KHÔNG retry, KHÔNG fallback — provider
//     khác nhận cùng input sai sẽ fail giống hệt, fallback chỉ che
//     giấu bug thật, nên phải ném lỗi ra ngay.
export type ProviderErrorKind = "transient" | "auth" | "fatal";

export class ProviderError extends Error {
  kind: ProviderErrorKind;
  status?: number;

  constructor(message: string, kind: ProviderErrorKind, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind;
    this.status = status;
  }
}

// Ném ra khi TẤT CẢ provider (Gemini -> Groq -> OpenRouter) đều fail.
// Route phía trên bắt lỗi này để trả HTTP 503 (Service Unavailable)
// thay vì 500 chung chung — giữ đúng behavior cũ (trước đây lớp này
// chỉ đại diện cho "Gemini quá tải", giờ đại diện cho "mọi provider
// đều quá tải/không khả dụng", route không cần đổi gì thêm).
export class AIOverloadedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIOverloadedError";
  }
}
