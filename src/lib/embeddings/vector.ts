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
import { GoogleGenerativeAI } from "@google/generative-ai";

const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");
// Model embedding riêng, KHÁC với model sinh text (gemini-1.5-flash ở
// lib/ai/gemini.ts) — đây là lý do 2 file AI được tách biệt nhau.
const EMBEDDING_MODEL = "text-embedding-004";

export async function embedText(text: string): Promise<number[]> {
  const model = client.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(text);
  return result.embedding.values; // mảng 768 số thực
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
  const queryEmbedding = await embedText(query);
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
