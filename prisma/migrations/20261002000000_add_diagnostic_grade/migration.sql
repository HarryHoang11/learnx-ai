-- Lưu CẤP/LỚP của từng bài kiểm tra năng lực (Assessment + DiagnosticSession).
--
-- AN TOÀN: cả 4 cột đều NULLABLE và không có DEFAULT => các dòng cũ đọc vẫn bình
-- thường (null nghĩa là "không ghi nhận lớp"), không cần backfill và không bịa
-- dữ liệu lớp cho user cũ.
--
-- currentGrade vẫn nằm ở User.learningProfile (JSONB); cột mới này là
-- `diagnosticGrade` — cho phép lưu nhiều lần kiểm tra ở nhiều lớp mà không
-- đè lên nhau.
ALTER TABLE "Assessment" ADD COLUMN "educationStage" TEXT;
ALTER TABLE "Assessment" ADD COLUMN "grade" TEXT;

ALTER TABLE "DiagnosticSession" ADD COLUMN "educationStage" TEXT;
ALTER TABLE "DiagnosticSession" ADD COLUMN "grade" TEXT;

-- Truy vấn lịch sử kiểm tra theo lớp (page Tiến độ, AI Tutor) cần index này.
CREATE INDEX "Assessment_userId_grade_idx" ON "Assessment"("userId", "grade");