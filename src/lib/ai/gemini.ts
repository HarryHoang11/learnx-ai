// ================================================================
// GEMINI CLIENT WRAPPER
// ================================================================
// Mạch tư duy: KHÔNG gọi thẳng @google/generative-ai rải rác trong
// từng route/service. Bọc lại 1 lớp mỏng ở đây vì 2 lý do:
//   1) Nếu sau này đổi model (Gemini -> Claude/OpenAI), chỉ sửa file
//      này, các service khác không cần biết đang dùng model gì.
//   2) Đây là nơi DUY NHẤT áp "Guardrails" (kiểm duyệt input/output)
//      như đã vẽ trong kiến trúc AI Orchestrator — mọi lời gọi AI
//      đều phải đi qua generateText() ở đây, không có đường tắt.
// ================================================================

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  // Fail CỨNG ngay lúc module này được load lần đầu (server start / cold
  // start), thay vì chỉ console.warn rồi để lỗi mơ hồ nổ ra giữa chừng
  // lúc user bấm nút -> route nào gọi tới generateText() cũng sẽ 500
  // với message chung chung, khó biết nguyên nhân là do thiếu key hay
  // do gì khác. Throw ở đây giúp thấy lỗi rõ ràng ngay khi `next dev`
  // khởi động, sửa 1 lần cho tất cả các route dùng AI.
  throw new Error(
    "[gemini.ts] Thiếu GEMINI_API_KEY trong .env — không thể khởi tạo AI client."
  );
}

export const client = new GoogleGenerativeAI(apiKey);

// ----------------------------------------------------------------
// TÊN MODEL — đọc từ .env (GEMINI_MODEL), có fallback mặc định.
// ----------------------------------------------------------------
// Vì sao KHÔNG hard-code "gemini-1.5-flash" (như bản cũ) hay hard-code
// bất kỳ tên model cụ thể nào khác ("gemini-2.5-flash" chẳng hạn):
// Google trong năm 2026 liên tục ép migrate model theo từng đợt vài
// tháng 1 lần (dòng 1.5 đã bị gỡ hoàn toàn khỏi API — đây chính là lý
// do gây lỗi 404 "is not found for API version v1beta"; dòng 2.0 đã
// shutdown 1/6/2026; dòng 2.5 dự kiến shutdown sớm nhất 16/10/2026).
// Nếu hard-code tên model, mỗi đợt Google gỡ model là 1 lần phải sửa
// code + build + deploy lại — dễ bị 404 y hệt lần này trong vài tháng
// tới. Đưa ra .env giúp đổi model chỉ bằng 1 dòng .env, không cần
// build lại.
//
// Mặc định dùng alias "gemini-flash-latest" — đây là alias do CHÍNH
// Google duy trì, tự động trỏ tới bản Flash GA (generally available)
// mới nhất tại thời điểm gọi (hiện tại là gemini-3.5-flash). Ưu điểm:
// không cần theo dõi lịch deprecation thủ công. Nhược điểm: hành vi
// model có thể thay đổi ngầm giữa các lần Google update alias — nếu
// cần tuyệt đối ổn định cho production (không muốn hành vi AI đổi bất
// ngờ), hãy pin cứng bằng cách đặt biến GEMINI_MODEL trong .env thành
// 1 tên model stable cụ thể, ví dụ: GEMINI_MODEL=gemini-3.5-flash
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-flash-latest";

// ----------------------------------------------------------------
// LỖI "AI ĐANG QUÁ TẢI" — phân biệt với lỗi thật (config sai, bug...)
// ----------------------------------------------------------------
// Google thỉnh thoảng trả 503 "currently experiencing high demand" hoặc
// 429 "rate limit" — đây là lỗi TẠM THỜI, phía Google quá tải, KHÔNG
// phải do code sai. Tách riêng 1 class lỗi để route phía trên trả đúng
// status 503 (Service Unavailable) thay vì 500, giúp frontend biết đây
// là lỗi "thử lại sau" chứ không phải bug cần báo cáo.
export class AIOverloadedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIOverloadedError";
  }
}

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
// + 2 lần retry). KHÔNG retry vô hạn vì route handler của Next.js có
// timeout riêng (mặc định 10s ở nhiều cấu hình hosting) — retry quá
// nhiều sẽ khiến request bị timeout ở tầng trên với lỗi còn khó hiểu
// hơn cả 503 gốc.
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

interface GenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  // Bắt AI trả JSON thuần khi cần parse có cấu trúc (vd sinh câu hỏi quiz)
  jsonMode?: boolean;
}

export async function generateText(opts: GenerateOptions): Promise<string> {
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: opts.systemPrompt,
    generationConfig: opts.jsonMode
      ? { responseMimeType: "application/json" }
      : undefined,
  });

  let result;
  try {
    result = await callWithRetry(() => model.generateContent(opts.userPrompt));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Lỗi 404 "model not found" — model bị Google gỡ khỏi API (xem
    // giải thích ở MODEL_NAME phía trên).
    if (message.includes("404") || message.toLowerCase().includes("not found")) {
      throw new Error(
        `Model "${MODEL_NAME}" không còn khả dụng ở Gemini API (có thể đã bị Google ` +
          `gỡ bỏ). Kiểm tra danh sách model còn hỗ trợ tại ` +
          `https://ai.google.dev/gemini-api/docs/models rồi cập nhật biến ` +
          `GEMINI_MODEL trong .env. Lỗi gốc: ${message}`
      );
    }

    // Lỗi 503/429 — đã retry hết số lần cho phép mà vẫn quá tải. Ném
    // dạng lỗi riêng (AIOverloadedError) để route phía trên bắt được
    // và trả status 503 thay vì 500 chung chung.
    if (isRetryableStatus(err)) {
      throw new AIOverloadedError(
        "Hệ thống AI (Gemini) đang quá tải, vui lòng thử lại sau ít phút."
      );
    }

    throw err;
  }

  const text = result.response.text();

  // --- GUARDRAILS (tối giản cho MVP) ---
  // Chặn output rỗng để service phía trên không phải tự check null
  // ở mọi nơi gọi hàm này.
  if (!text || text.trim().length === 0) {
    throw new Error("AI trả về nội dung rỗng — thử lại hoặc kiểm tra prompt.");
  }
  return text;
}

// Dùng khi cần AI trả về đúng 1 object JSON (vd sinh câu hỏi, sinh roadmap).
// Tách riêng generateJSON() thay vì để mỗi service tự JSON.parse() và
// tự try/catch — tránh lặp code và đồng nhất cách xử lý lỗi parse.
export async function generateJSON<T>(opts: GenerateOptions): Promise<T> {
  const raw = await generateText({ ...opts, jsonMode: true });
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(
      `AI trả JSON không hợp lệ, không parse được. Raw: ${raw.slice(0, 200)}...`
    );
  }
}
