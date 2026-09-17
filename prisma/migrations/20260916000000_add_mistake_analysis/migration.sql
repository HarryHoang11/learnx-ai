-- Additive: giải thích đáp án cho quiz + bảng ghi lỗi sai (MistakeLog).
-- Không đổi/xóa cột cũ, câu hỏi cache cũ vẫn hợp lệ với explanation = NULL.

ALTER TABLE "QuizQuestionCache" ADD COLUMN "explanation" TEXT;

CREATE TABLE "MistakeLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "selectedAnswer" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "explanation" TEXT,
    "sourceDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MistakeLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MistakeLog_userId_subject_topic_idx" ON "MistakeLog" ("userId", "subject", "topic");
CREATE INDEX "MistakeLog_userId_createdAt_idx" ON "MistakeLog" ("userId", "createdAt");

ALTER TABLE "MistakeLog"
ADD CONSTRAINT "MistakeLog_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MistakeLog"
ADD CONSTRAINT "MistakeLog_sourceDocumentId_fkey"
FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
