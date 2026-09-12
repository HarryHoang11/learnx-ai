-- AlterTable: lưu số trang của chunk để RAG/trích dẫn biết nội dung đến từ trang nào.
-- Cột nullable nên migration an toàn với dữ liệu cũ (chunk cũ = NULL = không rõ trang).
ALTER TABLE "DocumentChunk" ADD COLUMN "pageNumber" INTEGER;
