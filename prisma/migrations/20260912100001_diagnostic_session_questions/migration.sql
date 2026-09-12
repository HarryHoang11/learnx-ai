-- Thêm cột questions JSON vào DiagnosticSession để cache câu hỏi
-- server-side, tránh client sửa đổi correctAnswer.
ALTER TABLE "DiagnosticSession" ADD COLUMN "questions" JSONB;