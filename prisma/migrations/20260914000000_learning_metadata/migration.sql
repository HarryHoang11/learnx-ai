-- Metadata học tập cho Document + ngôn ngữ UI cho User + mục tiêu chi tiết cho LearningGoal.
-- Tất cả cột nullable (trừ language có default) nên an toàn với dữ liệu cũ.
ALTER TABLE "Document" ADD COLUMN "subject" TEXT;
ALTER TABLE "Document" ADD COLUMN "topic" TEXT;
ALTER TABLE "Document" ADD COLUMN "difficulty" TEXT;
ALTER TABLE "Document" ADD COLUMN "description" TEXT;
ALTER TABLE "User" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'vi';
ALTER TABLE "LearningGoal" ADD COLUMN "subject" TEXT;
ALTER TABLE "LearningGoal" ADD COLUMN "targetOutcome" TEXT;
ALTER TABLE "LearningGoal" ADD COLUMN "deadline" TIMESTAMP(3);
