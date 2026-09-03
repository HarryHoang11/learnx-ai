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

const client = new GoogleGenerativeAI(apiKey);

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
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.5-flash"; 

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
    result = await model.generateContent(opts.userPrompt);
  } catch (err) {
    // Bắt riêng lỗi 404 "model not found" từ Google — đây là lỗi RẤT
    // hay gặp lại trong tương lai vì Google liên tục gỡ model cũ khỏi
    // API (xem giải thích ở MODEL_NAME phía trên). Ném lại với message
    // rõ ràng, trỏ thẳng tới chỗ cần sửa (.env GEMINI_MODEL), thay vì
    // để lỗi SDK gốc khó hiểu rơi xuống catch chung ở route.
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("404") || message.toLowerCase().includes("not found")) {
      throw new Error(
        `Model "${MODEL_NAME}" không còn khả dụng ở Gemini API (có thể đã bị Google ` +
          `gỡ bỏ). Kiểm tra danh sách model còn hỗ trợ tại ` +
          `https://ai.google.dev/gemini-api/docs/models rồi cập nhật biến ` +
          `GEMINI_MODEL trong .env. Lỗi gốc: ${message}`
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
