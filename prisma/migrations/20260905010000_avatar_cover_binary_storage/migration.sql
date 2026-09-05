-- AlterTable
-- Thêm cột lưu BYTES ảnh THẬT trong Postgres (thay cho ghi file ra
-- public/uploads/... trên local disk). Cột "image"/"coverImage" cũ
-- được GIỮ NGUYÊN kiểu String (không đổi, không mất dữ liệu cũ) vì
-- vẫn cần thiết cho Auth.js PrismaAdapter và cho session JWT — chỉ
-- đổi Ý NGHĨA giá trị bên trong (URL route serve ảnh thay vì path
-- local), việc này xử lý ở tầng application, không cần migration.
ALTER TABLE "User" ADD COLUMN     "avatarData" BYTEA,
ADD COLUMN     "avatarMimeType" TEXT,
ADD COLUMN     "coverData" BYTEA,
ADD COLUMN     "coverMimeType" TEXT;
