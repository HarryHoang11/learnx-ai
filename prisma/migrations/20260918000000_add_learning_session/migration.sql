-- Additive: bảng mới LearningSession, không đụng bảng/dữ liệu hiện có.

CREATE TABLE "LearningSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "learningGoalId" TEXT,
    "sourceDocumentId" TEXT,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "masteryBefore" DOUBLE PRECISION,
    "masteryAfter" DOUBLE PRECISION,
    "questionsAnswered" INTEGER NOT NULL DEFAULT 0,
    "correctAnswers" INTEGER NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LearningSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LearningSession_userId_status_idx" ON "LearningSession" ("userId", "status");

ALTER TABLE "LearningSession"
ADD CONSTRAINT "LearningSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningSession"
ADD CONSTRAINT "LearningSession_learningGoalId_fkey"
FOREIGN KEY ("learningGoalId") REFERENCES "LearningGoal"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LearningSession"
ADD CONSTRAINT "LearningSession_sourceDocumentId_fkey"
FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
