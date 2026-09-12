-- Thêm cột subject vào Assessment để hỗ trợ đa môn kiểm tra năng lực.
-- Nullable để assessment cũ (chưa có subject) vẫn hợp lệ.
ALTER TABLE "Assessment" ADD COLUMN "subject" TEXT;
