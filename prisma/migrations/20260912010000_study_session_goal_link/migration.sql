-- AlterTable
ALTER TABLE "StudySession" ADD COLUMN     "description" TEXT,
ADD COLUMN     "learningGoalId" TEXT;

-- CreateIndex
CREATE INDEX "StudySession_learningGoalId_idx" ON "StudySession"("learningGoalId");

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_learningGoalId_fkey" FOREIGN KEY ("learningGoalId") REFERENCES "LearningGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
