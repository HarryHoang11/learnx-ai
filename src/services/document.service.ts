// ================================================================
// DOCUMENT SERVICE (RAG ingestion pipeline)
// ================================================================
// Mạch tư duy: đây là bước "PDF -> OCR/Text extraction -> AI phân
// tích -> Knowledge chunks -> Summary/Flashcards/Quiz" đã vẽ trong
// bản kế hoạch gốc. MVP triển khai phần lõi (chunk + embedding +
// summary); phần Flashcards/Quiz tái sử dụng LUÔN generateQuizQuestion()
// đã có ở quiz.service.ts thay vì viết logic sinh câu hỏi riêng cho
// tài liệu — vì bản chất vẫn là "sinh câu hỏi trắc nghiệm theo 1 chủ
// đề", chỉ khác nguồn ngữ cảnh (từ chunk tài liệu thay vì tên topic).
// ================================================================

import { generateText } from "@/lib/ai/gemini";
import { buildDocumentSummaryPrompt } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db/prisma";
import { saveChunkWithEmbedding, splitIntoChunks } from "@/lib/embeddings/vector";

// Hàm chính được gọi ngay sau khi upload (xem api/documents/upload).
// Thứ tự bước đi ĐÚNG như sơ đồ RAG trong bản kế hoạch gốc:
//   text -> chunk -> embedding (lưu từng chunk) -> tóm tắt toàn văn
//   -> cập nhật status "ready".
export async function processDocument(documentId: string, rawText: string): Promise<void> {
  try {
    // Bước 1+2: chunk rồi embedding từng chunk, lưu vào DocumentChunk.
    // Chạy tuần tự (không Promise.all) để tránh gọi quá nhiều request
    // embedding cùng lúc, dễ dính rate limit của Gemini API với tài
    // liệu dài — đánh đổi tốc độ lấy sự ổn định cho MVP.
    const chunks = splitIntoChunks(rawText);
    for (let i = 0; i < chunks.length; i++) {
      await saveChunkWithEmbedding(documentId, chunks[i], i);
    }

    // Bước 3: tóm tắt toàn văn để hiển thị ngay trong màn hình Thư viện
    // (học sinh không cần mở AI Tutor mới thấy tóm tắt).
    const prompt = buildDocumentSummaryPrompt(rawText);
    const summary = await generateText({ systemPrompt: prompt.system, userPrompt: prompt.user });

    await prisma.document.update({
      where: { id: documentId },
      data: { status: "ready", summary },
    });
  } catch (err) {
    // Không throw lại — đây là job chạy nền (fire-and-forget từ route
    // upload), throw ở đây sẽ chỉ log ra console mà không ai catch được.
    // Thay vào đó, đánh dấu rõ "failed" để UI biết tài liệu lỗi và học
    // sinh có thể thử upload lại.
    await prisma.document.update({ where: { id: documentId }, data: { status: "failed" } });
    throw err;
  }
}

// Dùng cho tính năng "hỏi AI dựa trên tài liệu đã upload" — bước RAG
// hoàn chỉnh: tìm chunk liên quan nhất rồi đưa vào prompt làm ngữ cảnh.
export async function answerFromDocument(documentId: string, question: string): Promise<string> {
  const { searchSimilarChunks } = await import("@/lib/embeddings/vector");
  const relevantChunks = await searchSimilarChunks(documentId, question, 4);

  const context = relevantChunks.map((c) => c.content).join("\n---\n");

  return generateText({
    systemPrompt: `Bạn trả lời câu hỏi CHỈ dựa trên đoạn tài liệu được cung cấp dưới đây.
Nếu tài liệu không chứa thông tin liên quan, hãy nói rõ là không tìm thấy trong tài liệu,
KHÔNG bịa thêm kiến thức ngoài tài liệu.
--- TÀI LIỆU ---
${context}`,
    userPrompt: question,
  });
}
