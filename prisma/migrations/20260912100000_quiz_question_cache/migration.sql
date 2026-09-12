-- Thêm bảng QuizQuestionCache để lưu câu hỏi quiz sinh bởi AI
-- server-side, tránh client sửa đổi correctIndex.
CREATE TABLE "QuizQuestionCache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "questionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuizQuestionCache_questionId_key" ON "QuizQuestionCache" ("questionId");
CREATE INDEX "QuizQuestionCache_userId_createdAt_idx" ON "QuizQuestionCache" ("userId", "createdAt");
CREATE INDEX "QuizQuestionCache_createdAt_idx" ON "QuizQuestionCache" ("createdAt");