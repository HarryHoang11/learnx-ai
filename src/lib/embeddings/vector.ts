// ================================================================
// EMBEDDINGS + VECTOR SEARCH (RAG)
// ================================================================
// Mạch tư duy: tính năng "AI biến tài liệu thành khoá học" cần trả
// lời DỰA TRÊN nội dung tài liệu học sinh upload, không bịa kiến
// thức. Luồng chuẩn RAG là:
//   text tài liệu -> chunk nhỏ -> embedding (vector số) -> lưu DB
//   -> khi học sinh hỏi -> embed câu hỏi -> tìm chunk gần nhất
//   -> đưa các chunk đó làm context cho Gemini.
//
// Vì Prisma chưa hỗ trợ kiểu "vector" gốc của pgvector, các thao tác
// liên quan tới cột embedding PHẢI dùng raw SQL ($queryRaw / $executeRaw)
// thay vì Prisma Client bình thường — đây là lý do file này tách riêng
// khỏi services/, để mọi chỗ "chạm" vào raw SQL đều tập trung ở đây,
// dễ audit khi có lỗi SQL injection hoặc sai cú pháp vector.
// ================================================================

import { prisma } from "@/lib/db/prisma";
import { TaskType } from "@google/generative-ai";
import { client, callWithRetry, AIOverloadedError, isRetryableStatus } from "@/lib/ai/gemini";

// ----------------------------------------------------------------
// MODEL EMBEDDING — đọc từ .env, có fallback mặc định.
// ----------------------------------------------------------------
// "text-embedding-004" (bản cũ) đã bị Google SHUT DOWN hoàn toàn ngày
// 14/1/2026 — đây chính là nguyên nhân lỗi 404 "text-embedding-004 is
// not found for API version v1beta, or is not supported for
// embedContent". Model thay thế được Google khuyến nghị chính thức là
// "gemini-embedding-001" (stable, production-ready). Cũng như
// GEMINI_MODEL ở lib/ai/gemini.ts, đưa ra .env để lần Google gỡ model
// tiếp theo chỉ cần đổi 1 dòng .env, không cần sửa code.
const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";

// ----------------------------------------------------------------
// SỐ CHIỀU VECTOR — PHẢI khớp với cột "vector(768)" khai báo trong
// prisma/schema.prisma (model DocumentChunk). KHÔNG được đổi số này
// một mình — nếu muốn tăng lên (vd 1536/3072 để chất lượng tốt hơn),
// phải sửa CẢ migration SQL (ALTER COLUMN ... TYPE vector(N)) VÀ xoá,
// tạo lại toàn bộ embedding cũ (vector cũ 768 chiều không tương thích
// với cột kiểu vector chiều khác).
// ----------------------------------------------------------------
// Vì sao KHÔNG đơn giản gọi model với dimension mặc định (3072) của
// gemini-embedding-001: cột DB đang cố định "vector(768)", insert
// thẳng vector 3072 chiều sẽ lỗi ngay ở tầng Postgres (dimension
// mismatch). Thay vì migrate DB (tốn công, và app đang ở giai đoạn
// MVP không có dữ liệu cũ cần giữ), ta cắt bớt (truncate) vector về
// đúng 768 chiều đầu — đây là cách dùng ĐÚNG theo tài liệu chính thức
// của Google cho các model có hỗ trợ Matryoshka Representation
// Learning (MRL) như gemini-embedding-001: cắt vector về N chiều đầu
// rồi CHUẨN HOÁ LẠI (L2-normalize) vẫn cho ra embedding hợp lệ, chỉ
// giảm nhẹ chất lượng so với dùng đủ 3072 chiều — hoàn toàn chấp nhận
// được cho tính năng RAG ở quy mô MVP.
const EMBEDDING_DIMENSIONS = 768;

function truncateAndNormalize(vector: number[], dims: number): number[] {
  const truncated = vector.slice(0, dims);
  const norm = Math.sqrt(truncated.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return truncated;
  return truncated.map((v) => v / norm);
}

// taskType giúp Gemini tối ưu embedding đúng mục đích: chunk tài liệu
// lưu vào DB nên dùng RETRIEVAL_DOCUMENT, còn câu hỏi của học sinh lúc
// tìm kiếm nên dùng RETRIEVAL_QUERY — 2 loại này KHÔNG tương đương
// nhau dù cùng model, dùng đúng loại giúp similarity search chính xác
// hơn (khuyến nghị chính thức của Google, không phải tối ưu tuỳ chọn).
export async function embedText(
  text: string,
  taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT
): Promise<number[]> {
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });

  let result;
  try {
    result = await callWithRetry(() => model.embedContent({ content: { role: "user", parts: [{ text }] }, taskType }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("404") || message.toLowerCase().includes("not found")) {
      throw new Error(
        `Model embedding "${EMBEDDING_MODEL}" không còn khả dụng ở Gemini API (có thể ` +
          `đã bị Google gỡ bỏ). Kiểm tra danh sách model còn hỗ trợ tại ` +
          `https://ai.google.dev/gemini-api/docs/embeddings rồi cập nhật biến ` +
          `GEMINI_EMBEDDING_MODEL trong .env. Lỗi gốc: ${message}`
      );
    }

    if (isRetryableStatus(err)) {
      throw new AIOverloadedError(
        "Hệ thống AI (Gemini Embedding) đang quá tải, vui lòng thử lại sau ít phút."
      );
    }

    throw err;
  }

  return truncateAndNormalize(result.embedding.values, EMBEDDING_DIMENSIONS);
}

// Chia văn bản dài thành các đoạn nhỏ ~1000 ký tự, có overlap 100 ký tự
// để không bị cắt đứt ý ở ranh giới 2 chunk liền nhau.
export function splitIntoChunks(text: string, chunkSize = 1000, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

// Lưu 1 chunk + embedding của nó vào DB.
// Dùng $executeRaw vì Prisma Client không biết kiểu "vector" —
// phải tự format mảng số thành literal Postgres dạng '[0.1,0.2,...]'.
export async function saveChunkWithEmbedding(
  documentId: string,
  content: string,
  chunkIndex: number
): Promise<void> {
  const embedding = await embedText(content);
  const vectorLiteral = `[${embedding.join(",")}]`;

  await prisma.$executeRaw`
    INSERT INTO "DocumentChunk" (id, "documentId", content, "chunkIndex", embedding)
    VALUES (gen_random_uuid()::text, ${documentId}, ${content}, ${chunkIndex}, ${vectorLiteral}::vector)
  `;
}

// Tìm k chunk gần nhất với câu hỏi của học sinh, dùng toán tử "<->"
// (khoảng cách Euclid) của pgvector — đây là bước "Similarity Search"
// trong sơ đồ RAG đã vẽ ở bản kế hoạch gốc.
export async function searchSimilarChunks(
  documentId: string,
  query: string,
  topK = 4
): Promise<{ content: string; chunkIndex: number }[]> {
  const queryEmbedding = await embedText(query, TaskType.RETRIEVAL_QUERY);
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  // Kết quả trả về đã tự sắp xếp theo khoảng cách gần nhất trước
  // (ORDER BY embedding <-> ...) nhờ pgvector, không cần sort lại ở JS.
  const rows = await prisma.$queryRaw<{ content: string; chunkIndex: number }[]>`
    SELECT content, "chunkIndex"
    FROM "DocumentChunk"
    WHERE "documentId" = ${documentId}
    ORDER BY embedding <-> ${vectorLiteral}::vector
    LIMIT ${topK}
  `;
  return rows;
}
