-- Additive: bảng mới LearningArtifact, không đụng bảng/dữ liệu hiện có.

CREATE TABLE "LearningArtifact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningArtifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearningArtifact_userId_sourceDocumentId_type_difficulty_key"
ON "LearningArtifact" ("userId", "sourceDocumentId", "type", "difficulty");

CREATE INDEX "LearningArtifact_sourceDocumentId_idx" ON "LearningArtifact" ("sourceDocumentId");

ALTER TABLE "LearningArtifact"
ADD CONSTRAINT "LearningArtifact_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LearningArtifact"
ADD CONSTRAINT "LearningArtifact_sourceDocumentId_fkey"
FOREIGN KEY ("sourceDocumentId") REFERENCES "Document"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
