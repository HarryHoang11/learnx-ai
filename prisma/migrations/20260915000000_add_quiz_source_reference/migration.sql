-- Additive source reference for generated quiz questions.
-- Existing cached questions remain valid with NULL sourceDocumentId.
ALTER TABLE "QuizQuestionCache" ADD COLUMN "sourceDocumentId" TEXT;

CREATE INDEX "QuizQuestionCache_sourceDocumentId_idx"
ON "QuizQuestionCache" ("sourceDocumentId");

ALTER TABLE "QuizQuestionCache"
ADD CONSTRAINT "QuizQuestionCache_sourceDocumentId_fkey"
FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
