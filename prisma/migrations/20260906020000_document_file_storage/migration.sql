-- AlterTable
-- Khôi phục 4 cột cho Document đã bị thiếu trong database thật (schema
-- từng bị `prisma db pull` ghi đè mất phần khai báo này, dù CODE ứng
-- dụng — document.service.ts, api/documents/route.ts, [id]/route.ts,
-- download, retry — đã và vẫn đang cần các cột này cho tính năng "Thư
-- viện tài liệu": xem tóm tắt đầy đủ, tải file gốc, thử lại khi lỗi.
--
-- AN TOÀN với dữ liệu hiện có:
--   - "errorMessage", "fileData", "mimeType": nullable, row cũ tự động
--     nhận NULL, không vi phạm constraint nào.
--   - "updatedAt": KHÔNG nullable nhưng có DEFAULT CURRENT_TIMESTAMP(3)
--     (tương ứng @updatedAt trong Prisma) — Postgres tự backfill giá
--     trị này cho toàn bộ row cũ ngay khi ALTER TABLE chạy, không cần
--     bước migrate dữ liệu thủ công riêng.
ALTER TABLE "Document" ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "fileData" BYTEA,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
