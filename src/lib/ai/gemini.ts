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
  // Fail sớm và rõ ràng thay vì để lỗi mơ hồ lúc gọi API giữa chừng
  console.warn("[gemini.ts] Thiếu GEMINI_API_KEY trong .env — các tính năng AI sẽ lỗi.");
}

const client = new GoogleGenerativeAI(apiKey ?? "");

// Dùng flash model cho MVP: rẻ, nhanh, đủ tốt cho hint/tutor/quiz-gen.
// Nếu cần chất lượng cao hơn cho việc chấm bài tự luận phức tạp,
// có thể tách 1 hàm generateTextPro() riêng dùng model "pro".
const MODEL_NAME = "gemini-1.5-flash";

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

  const result = await model.generateContent(opts.userPrompt);
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
