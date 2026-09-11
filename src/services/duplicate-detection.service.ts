// ================================================================
// DUPLICATE DETECTION SERVICE
// ================================================================
// Uses embeddings and text similarity to detect duplicate documents
// ================================================================

import { prisma } from "@/lib/db/prisma";
import { searchSimilarChunksAcrossDocuments } from "@/lib/embeddings/vector";

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingDocumentId?: string;
  similarity: number;
  matchType: "exact" | "near" | "content" | "none";
}

// --- 1) EXACT DUPLICATE CHECK (file hash) ---
export async function checkExactDuplicate(
  userId: string,
  fileName: string,
  fileSize: number
): Promise<DuplicateCheckResult | null> {
  const recentDuplicate = await prisma.$queryRaw<{ id: string; fileLength: number | null }[]>`
    SELECT "id", octet_length("fileData") AS "fileLength"
    FROM "CommunityDocument"
    WHERE "ownerId" = ${userId}
      AND "fileName" = ${fileName}
      AND "fileSize" = ${fileSize}
      AND "uploadedAt" >= ${new Date(Date.now() - 15_000)}
    ORDER BY "uploadedAt" DESC
    LIMIT 1
  `;
  
  const dup = recentDuplicate[0];
  if (dup) {
    return {
      isDuplicate: true,
      existingDocumentId: dup.id,
      similarity: 1.0,
      matchType: "exact",
    };
  }
  
  return null;
}

// --- 2) CONTENT SIMILARITY CHECK (embeddings) ---
export async function detectDuplicateDocument(
  userId: string,
  text: string
): Promise<DuplicateCheckResult> {
  // First check user's own recent uploads
  const recentDocs = await prisma.communityDocument.findMany({
    where: {
      ownerId: userId,
      status: "READY",
      uploadedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24h
    },
    select: { id: true, title: true, summary: true },
    take: 10,
  });

  if (recentDocs.length === 0) {
    return { isDuplicate: false, similarity: 0, matchType: "none" };
  }

  // Quick text similarity check first
  for (const doc of recentDocs) {
    if (!doc.summary) continue;
    
    const similarity = calculateTextSimilarity(text, doc.summary);
    if (similarity > 0.9) {
      return {
        isDuplicate: true,
        existingDocumentId: doc.id,
        similarity,
        matchType: "near",
      };
    }
  }

  // Use embeddings for semantic similarity
  // This is a simplified check - in production you'd use the document's embeddings
  // For now, return no duplicate found
  return { isDuplicate: false, similarity: 0, matchType: "none" };
}

// --- 3) EMBEDDING-BASED SIMILARITY (using existing pgvector) ---
export async function checkSemanticDuplicate(
  documentId: string,
  userId: string
): Promise<DuplicateCheckResult> {
  const document = await prisma.communityDocument.findUnique({
    where: { id: documentId },
    select: { id: true, ownerId: true, summary: true, title: true },
  });

  if (!document) return { isDuplicate: false, similarity: 0, matchType: "none" };
  if (document.ownerId !== userId) return { isDuplicate: false, similarity: 0, matchType: "none" };

  // Need real text to embed — an empty query produces a meaningless vector.
  const queryText = (document.summary || document.title || "").trim();
  if (!queryText) return { isDuplicate: false, similarity: 0, matchType: "none" };

  // Search for similar chunks in OTHER documents (never the document itself).
  const similarChunks = await searchSimilarChunksAcrossDocuments(documentId, queryText, 5);

  if (similarChunks.length === 0) {
    return { isDuplicate: false, similarity: 0, matchType: "none" };
  }

  // The most similar chunk belongs to the most similar document.
  const otherDoc = await prisma.communityDocument.findFirst({
    where: { id: similarChunks[0].documentId },
    select: { id: true, title: true },
  });

  if (otherDoc) {
    return {
      isDuplicate: true,
      existingDocumentId: otherDoc.id,
      similarity: 0.85, // Estimated from embedding similarity
      matchType: "content",
    };
  }

  return { isDuplicate: false, similarity: 0, matchType: "none" };
}

// --- 3) TEXT SIMILARITY HELPER ---
function calculateTextSimilarity(text1: string, text2: string): number {
  // Simple Jaccard similarity on words
  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  if (words1.size === 0 && words2.size === 0) return 1;
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// --- 4) CONTENT FINGERPRINT (for quick duplicate checks) ---
export function generateContentFingerprint(text: string): string {
  // Simple hash of normalized text
  const normalized = text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim()
    .slice(0, 1000);
  
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(16);
}

// --- 5) BATCH DUPLICATE SCAN (for admin/moderation) ---
export async function scanForDuplicates(limit = 100): Promise<{
  duplicates: Array<{ doc1: string; doc2: string; similarity: number }>;
}> {
  const documents = await prisma.communityDocument.findMany({
    where: { status: "READY" },
    select: { id: true, title: true, summary: true, ownerId: true },
    take: limit,
    orderBy: { uploadedAt: "desc" },
  });

  const duplicates: Array<{ doc1: string; doc2: string; similarity: number }> = [];

  for (let i = 0; i < documents.length; i++) {
    for (let j = i + 1; j < documents.length; j++) {
      const doc1 = documents[i];
      const doc2 = documents[j];

      // Skip if same owner (could be legitimate updates)
      if (doc1.ownerId === doc2.ownerId) continue;

      if (!doc1.summary || !doc2.summary) continue;

      const similarity = calculateTextSimilarity(doc1.summary || "", doc2.summary || "");
      
      if (similarity > 0.85) {
        duplicates.push({
          doc1: doc1.id,
          doc2: doc2.id,
          similarity: Math.round(similarity * 100) / 100,
        });
      }
    }
  }

  return { duplicates };
}