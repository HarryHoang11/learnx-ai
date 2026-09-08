-- CreateEnum
CREATE TYPE "RoadmapStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');

-- AlterTable
-- DEFAULT 'ACTIVE' đảm bảo MỌI LearningGoal đã tồn tại tự động coi là
-- đang active (đúng thực tế: nếu user đã có roadmap trước migration
-- này, họ vẫn đang học nó, không tự nhiên trở thành "completed").
ALTER TABLE "LearningGoal" ADD COLUMN     "status" "RoadmapStatus" NOT NULL DEFAULT 'ACTIVE';

-- DropForeignKey + AddForeignKey (đổi RESTRICT -> CASCADE)
-- Lý do: chức năng "Xóa lộ trình" cần xoá LearningGoal kèm toàn bộ
-- bản ghi Roadmap (lịch sử các lần AI sinh plan) thuộc về nó, tránh
-- orphan record. LearningProgress/Attempt KHÔNG có foreign key nào
-- trỏ tới LearningGoal/Roadmap (đã kiểm tra schema + toàn bộ codebase)
-- nên KHÔNG bị ảnh hưởng bởi thay đổi này — progress/lịch sử làm bài
-- của user được giữ nguyên vẹn dù goal/roadmap bị xoá.
ALTER TABLE "Roadmap" DROP CONSTRAINT "Roadmap_learningGoalId_fkey";
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_learningGoalId_fkey" FOREIGN KEY ("learningGoalId") REFERENCES "LearningGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
