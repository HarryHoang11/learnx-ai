-- ================================================================
-- Learning Profile (onboarding học tập) — MỞ RỘNG, KHÔNG PHÁ VỠ
-- ================================================================
--
-- NGUYÊN TẮC AN TOÀN:
--   1. KHÔNG drop / KHÔNG đổi kiểu cột cũ, KHÔNG xoá dữ liệu.
--   2. Mọi cột mới đều NULLABLE hoặc có DEFAULT -> chạy trên bảng đang có
--      dữ liệu thật là an toàn, KHÔNG cần backfill.
--   3. KHÔNG tạo bảng mới: tái sử dụng `User.learningProfile` (JSON, đã có sẵn
--      từ migration add_onboarding_welcome) và model `LearningGoal` đã có sẵn.
--      Đây là lý do không sinh ra bảng "LearningProfile" song song.
--
-- VÌ SAO KHÔNG TÁCH PROFILE RA BẢNG RIÊNG:
--   Profile luôn được đọc/sửa nguyên tử theo đúng 1 user (1 : 1), không có
--   truy vấn lọc/tổng hợp theo từng field (kiểu "tất cả học sinh lớp 11 chưa
--   chọn môn"). Giữ JSON cho phép thêm câu hỏi onboarding mà không migration,
--   và khớp với chính schema hiện tại đã chọn cho `learningProfile`.
--   Phần CẦN truy vấn/lọc thật sự (mục tiêu) đã có bảng riêng `LearningGoal`.

-- 1) Mốc "đã hoàn tất onboarding học tập" (khác với welcomeSeenAt = đã xem
--    trang giới thiệu). NULL = chưa hoàn tất, kể cả khi đã bấm Skip.
ALTER TABLE "User" ADD COLUMN "learningProfileCompletedAt" TIMESTAMP(3);

-- 2) Mục tiêu học tập có cấu trúc để lọc/thống kê được.
--    - category : nhóm mục tiêu do người dùng chọn ở onboarding (enum logic ở
--                 src/lib/onboarding/options.ts, lưu String để thêm giá trị mới
--                 không cần migration).
--    - target   : kết quả đo được ("điểm Toán 7 -> 9"), tách khỏi targetOutcome
--                 (mô tả định tính) vì target dùng để so sánh gap máy được.
--    - priority : 1 = cao, 2 = thường, 3 = thấp — sắp xếp mục tiêu hiện tại.
--    - source   : "onboarding" | "manual" | "ai" — để chạy lại onboarding mà
--                 không nhân bản goal người dùng đã sửa tay.
ALTER TABLE "LearningGoal"
  ADD COLUMN "category" TEXT,
  ADD COLUMN "target" TEXT,
  ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 3) Index phục vụ màn "mục tiêu hiện tại" (Dashboard, Roadmap, next-action):
--    luôn lọc theo user + status rồi mới sắp priority.
CREATE INDEX "LearningGoal_userId_status_priority_idx" ON "LearningGoal"("userId", "status", "priority");
