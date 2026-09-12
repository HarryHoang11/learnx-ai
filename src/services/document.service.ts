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
//
// NGUYÊN TẮC SỐNG CÒN (sau audit pipeline):
//   - Text extraction đã xong ở route (extractText.ts) — service nhận
//     ExtractionResult { text, pages } và KHÔNG parse lại.
//   - Chunk THEO TRANG (giữ pageNumber) với PDF; định dạng khác chunk
//     toàn văn với pageNumber null.
//   - Tóm tắt (markdown-ish) KHÔNG phải single point of failure: AI
//     tóm tắt lỗi -> document vẫn "ready" (chunk+RAG dùng được), chỉ
//     summary null + ghi log. Chỉ chunk/embedding lỗi mới "failed".
// ================================================================

import { generateText } from "@/lib/ai/router";
import { AIOverloadedError } from "@/lib/ai/router";
import { buildDocumentSummaryPrompt } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db/prisma";
import { saveChunkWithEmbedding, splitIntoChunks } from "@/lib/embeddings/vector";
import { MAX_EXTRACTED_CHARS } from "@/lib/documents/extractText";
import {
  DocumentProcessingError,
  logDocumentError,
  logDocumentStage,
} from "@/lib/documents/docErrors";
import type { ExtractionResult } from "@/lib/documents/extractText";

// Giới hạn số chunk để file rất dài không gọi embedding vô hạn
// (mỗi chunk = 1 API call + 1 row DB).
const MAX_CHUNKS_TOTAL = 300;

// Hàm chính được gọi ngay sau khi upload (xem api/documents/upload).
// Thứ tự bước đi ĐÚNG như sơ đồ RAG trong bản kế hoạch gốc:
//   text -> chunk (theo trang) -> embedding (lưu từng chunk) ->
//   tóm tắt toàn văn -> cập nhật status "ready".
export async function processDocument(documentId: string, extraction: ExtractionResult): Promise<void> {
  const startedAt = Date.now();
  try {
    // Xoá chunk CŨ trước khi xử lý lại — bắt buộc phải có bước này vì
    // giờ đây processDocument có thể được gọi LẦN 2 (RETRY sau khi
    // failed lần đầu). Nếu lần trước đã lỡ lưu được vài chunk rồi mới
    // fail giữa chừng (vd lỗi mạng lúc embedding chunk thứ 5/10), không
    // xoá sẽ để lại chunk cũ lẫn với chunk mới -> DUPLICATE, làm lệch
    // kết quả similarity search (RAG trả lời dựa trên chunk bị đếm 2 lần).
    await prisma.documentChunk.deleteMany({ where: { documentId } });

    let fullText = extraction.text;
    if (fullText.length > MAX_EXTRACTED_CHARS) {
      logDocumentStage(documentId, "CHUNKING", {
        truncated: true,
        originalChars: fullText.length,
        keptChars: MAX_EXTRACTED_CHARS,
      });
      fullText = fullText.slice(0, MAX_EXTRACTED_CHARS);
    }

    // Chunk theo trang (PDF) để giữ pageNumber; văn bản không phân
    // trang chunk toàn văn với pageNumber null.
    const pageUnits =
      extraction.pages && extraction.pages.length > 0
        ? extraction.pages
            .filter((p) => p.text.trim() !== "")
            .map((p) => ({ pageNumber: p.pageNumber as number | null, text: p.text }))
        : [{ pageNumber: null as number | null, text: fullText }];

    logDocumentStage(documentId, "CHUNKING", {
      pages: pageUnits.length,
      chars: fullText.length,
    });

    // Bước 1+2: chunk rồi embedding từng chunk, lưu vào DocumentChunk.
    // Chạy tuần tự (không Promise.all) để tránh gọi quá nhiều request
    // embedding cùng lúc, dễ dính rate limit của Gemini API với tài
    // liệu dài — đánh đổi tốc độ lấy sự ổn định cho MVP.
    let chunkIndex = 0;
    let truncatedChunks = false;
    for (const unit of pageUnits) {
      const chunks = splitIntoChunks(unit.text);
      for (const chunk of chunks) {
        if (chunkIndex >= MAX_CHUNKS_TOTAL) {
          truncatedChunks = true;
          break;
        }
        await saveChunkWithEmbedding(documentId, chunk, chunkIndex, unit.pageNumber);
        chunkIndex++;
      }
      if (truncatedChunks) break;
    }
    logDocumentStage(documentId, "EMBEDDING", {
      chunks: chunkIndex,
      truncatedChunks,
      ms: Date.now() - startedAt,
    });

    if (chunkIndex === 0) {
      throw new DocumentProcessingError("DOCUMENT_EMPTY", "CHUNKING", "Không tạo được chunk nào từ văn bản.");
    }

    // Bước 3: tóm tắt toàn văn để hiển thị ngay trong màn hình Thư viện
    // (học sinh không cần mở AI Tutor mới thấy tóm tắt). Bước này
    // NON-FATAL: AI tóm tắt lỗi (quá tải) thì document vẫn "ready" vì
    // chunk + RAG đã xong — chỉ thiếu summary (UI hiện "Chưa có tóm
    // tắt", retry sau vẫn tạo được).
    try {
      const prompt = buildDocumentSummaryPrompt(fullText);
      const summary = await generateText({ systemPrompt: prompt.system, userPrompt: prompt.user });

      // errorMessage: null — dọn sạch lỗi lần trước nếu đây là 1 lần
      // RETRY thành công, tránh hiển thị nhầm lỗi cũ đã không còn đúng.
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "ready", summary, errorMessage: null },
      });
    } catch (summaryErr) {
      logDocumentError(documentId, "AI_PROCESSING", summaryErr);
      await prisma.document.update({
        where: { id: documentId },
        data: {
          status: "ready",
          summary: null,
          errorMessage:
            summaryErr instanceof Error ? `[AI_PROCESSING_FAILED] ${summaryErr.message}` : "[AI_PROCESSING_FAILED]",
        },
      });
    }
  } catch (err) {
    // Không throw lại — đây là job chạy nền (fire-and-forget từ route
    // upload), throw ở đây sẽ chỉ log ra console mà không ai catch được.
    // Đánh dấu "failed" với errorMessage có prefix [CODE] để UI suy ra
    // nguyên nhân cụ thể (xem describeDocumentError).
    logDocumentError(documentId, "DATABASE", err);
    let code = "CHUNKING_FAILED";
    if (err instanceof DocumentProcessingError) code = err.code;
    else if (err instanceof AIOverloadedError) code = "EMBEDDING_FAILED";
    const message = err instanceof Error ? err.message : String(err);
    const stored = /^\[[A-Z_]+\]/.test(message) ? message : `[${code}] ${message}`;
    await prisma.document.update({ where: { id: documentId }, data: { status: "failed", errorMessage: stored } });
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
