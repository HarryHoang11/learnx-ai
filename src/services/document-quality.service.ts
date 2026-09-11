// ================================================================
// DOCUMENT QUALITY SERVICE
// ================================================================
// Calculates document quality scores, trust scores, and manages
// AI-powered quality evaluation.
// ================================================================

import { prisma } from "@/lib/db/prisma";
import { generateJSON } from "@/lib/ai/router";
import { buildDocumentQualityPrompt } from "@/lib/ai/prompts";

export interface AIQualityEvaluation {
  clarity: number;              // 0-100: How clear and well-written
  structure: number;            // 0-100: Organization, headings, flow
  completeness: number;         // 0-100: Covers topic thoroughly
  educationalValue: number;     // 0-100: Learning value for students
  accuracyConfidence: number;   // 0-100: How confident AI is in accuracy
  difficultyAccuracy: number;   // 0-100: Matches stated difficulty
  topicRelevance: number;       // 0-100: Relevance to subject/topic
  duplicateSimilarity: number;  // 0-100: Similarity to existing docs
}

export interface QualityScoreComponents {
  aiScore: number;              // AI evaluation score (0-100)
  ratingScore: number;          // User rating score (0-100)
  helpfulScore: number;         // Helpful votes score (0-100)
  engagementScore: number;      // Views/downloads/saves (0-100)
  penalty: number;              // Penalties (reports, duplicates)
}

export interface TrustScoreComponents {
  qualityScore: number;         // Combined quality score
  ratingConfidence: number;     // Confidence in rating (based on count)
  helpfulness: number;          // Helpful vote ratio
  engagement: number;           // Views, downloads, saves
  reportPenalty: number;        // Report penalty
  duplicatePenalty: number;     // Duplicate penalty
  freshness: number;            // Recency factor
}

// --- AI QUALITY EVALUATION ---
export async function evaluateDocumentQuality(
  documentId: string,
  text: string,
  summary: string
): Promise<AIQualityEvaluation> {
  const prompt = buildDocumentQualityPrompt(text, summary);
  
  try {
    const result = await generateJSON<AIQualityEvaluation>({
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      jsonMode: true,
    });
    
    // Validate and clamp scores
    return validateAndClampQuality(result);
  } catch (err) {
    console.error("[DocumentQuality] AI evaluation failed:", err);
    // Return default conservative scores on failure
    return getDefaultQualityScores();
  }
}

function validateAndClampQuality(result: any): AIQualityEvaluation {
  const fields: (keyof AIQualityEvaluation)[] = [
    "clarity", "structure", "completeness", "educationalValue",
    "accuracyConfidence", "difficultyAccuracy", "topicRelevance", "duplicateSimilarity"
  ];
  
  const clamped: AIQualityEvaluation = {} as AIQualityEvaluation;
  
  for (const field of fields) {
    const value = Number(result?.[field]);
    clamped[field] = isNaN(value) ? 50 : Math.max(0, Math.min(100, value));
  }
  
  return clamped;
}

function getDefaultQualityScores(): AIQualityEvaluation {
  return {
    clarity: 50,
    structure: 50,
    completeness: 50,
    educationalValue: 50,
    accuracyConfidence: 50,
    difficultyAccuracy: 50,
    topicRelevance: 50,
    duplicateSimilarity: 0,
  };
}

// --- QUALITY SCORE CALCULATION ---
export function calculateDocumentQuality(aiQuality: AIQualityEvaluation): number {
  if (!aiQuality) return 0;
  
  // Weighted AI score
  const weights = {
    clarity: 0.15,
    structure: 0.15,
    completeness: 0.15,
    educationalValue: 0.20,
    accuracyConfidence: 0.10,
    difficultyAccuracy: 0.10,
    topicRelevance: 0.10,
    duplicateSimilarity: -0.05, // Penalty for high similarity
  };
  
  let score = 0;
  let totalWeight = 0;
  
  for (const [key, weight] of Object.entries(weights)) {
    const value = (aiQuality as any)[key] ?? 50;
    score += value * weight;
    totalWeight += Math.abs(weight);
  }
  
  // Normalize and clamp
  return Math.max(0, Math.min(100, Math.round(score / totalWeight * 100)));
}

// --- RATING SCORE WITH CONFIDENCE ---
export function calculateRatingScore(
  averageRating: number,
  ratingCount: number,
  helpfulVotes: number = 0,
  totalVotes: number = 0
): { score: number; confidence: number } {
  if (ratingCount === 0) return { score: 0, confidence: 0 };
  
  // Base rating score (0-100)
  const ratingScore = (averageRating / 5) * 100;
  
  // Confidence based on number of ratings
  // Using Wilson score interval concept simplified
  const confidence = Math.min(1, ratingCount / 50); // 50 ratings = full confidence
  
  // Helpful bonus
  let helpfulBonus = 0;
  if (totalVotes > 0) {
    const helpfulRatio = helpfulVotes / totalVotes;
    helpfulBonus = helpfulRatio * 10; // Up to 10 points
  }
  
  const finalScore = Math.min(100, ratingScore + helpfulBonus);
  
  return { score: Math.round(finalScore), confidence: Math.round(confidence * 100) / 100 };
}

// --- ENGAGEMENT SCORE ---
export function calculateEngagementScore(
  viewCount: number,
  downloadCount: number,
  saveCount: number,
  daysSincePublish: number
): number {
  // Logarithmic scaling for large numbers
  const viewScore = Math.log10(viewCount + 1) * 10;
  const downloadScore = Math.log10(downloadCount + 1) * 15;
  const saveScore = Math.log10(saveCount + 1) * 20;
  
  // Freshness bonus (newer documents get slight boost)
  const freshnessBonus = daysSincePublish < 30 ? (30 - daysSincePublish) * 0.5 : 0;
  
  const score = viewScore + downloadScore + saveScore + freshnessBonus;
  return Math.min(100, Math.max(0, Math.round(score)));
}

// --- TRUST SCORE CALCULATION ---
export function computeTrustScore(
  qualityScore: number,
  isDuplicate: boolean,
  reportCount: number,
  ratingCount: number,
  averageRating: number,
  helpfulVotes: number = 0,
  totalVotes: number = 0,
  viewCount: number = 0,
  downloadCount: number = 0,
  saveCount: number = 0,
  daysSincePublish: number = 0
): number {
  // Base score from quality
  let score = qualityScore * 0.4;
  
  // Rating component (with confidence)
  const { score: ratingScore, confidence } = calculateRatingScore(
    averageRating || 0,
    ratingCount,
    0, // helpfulVotes not available here
    0
  );
  score += ratingScore * 0.25 * confidence;
  
  // Helpful votes
  score += Math.min(20, 5); // Max 5 points for helpful votes
  
  // Engagement
  const engagement = calculateEngagementScore(
    0, // viewCount
    0, // downloadCount
    0, // saveCount
    daysSincePublish
  );
  score += engagement * 0.15;
  
  // Penalties
  if (isDuplicate) score -= 40;
  score -= Math.min(30, reportCount * 10); // Max -30 for reports
  
  // Freshness bonus
  const freshness = Math.max(0, 30 - daysSincePublish) * 0.2;
  score += Math.min(10, freshness);
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

// --- TRUST LEVEL ---
export function getTrustLevel(trustScore: number): 
  "NEW" | "COMMUNITY_VERIFIED" | "HIGH_QUALITY" | "NEEDS_REVIEW" | "LOW_QUALITY" {
  if (trustScore >= 80) return "HIGH_QUALITY";
  if (trustScore >= 60) return "COMMUNITY_VERIFIED";
  if (trustScore >= 40) return "NEW";
  if (trustScore >= 20) return "NEEDS_REVIEW";
  return "LOW_QUALITY";
}

// --- RECALCULATE TRUST SCORE (for periodic updates) ---
export async function recalculateDocumentTrustScore(documentId: string): Promise<number> {
  const document = await prisma.communityDocument.findUnique({
    where: { id: documentId },
    include: {
      ratings: { select: { rating: true } },
      votes: { select: { helpful: true } },
      reports: { select: { id: true } },
      _count: { select: { ratings: true, saves: true, reports: true } },
    },
  });

  if (!document) return 0;

  const averageRating = document.ratings.length > 0
    ? document.ratings.reduce((sum, r) => sum + r.rating, 0) / document.ratings.length
    : 0;

  const helpfulVotes = document.votes.filter(v => v.helpful).length;
  const totalVotes = document.votes.length;
  const daysSincePublish = document.publishedAt
    ? Math.floor((Date.now() - document.publishedAt.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // TODO: wire to duplicate-detection results once they are persisted.
  // Today nothing writes the DocumentDuplicates relation, so at runtime
  // this was always falsy (`undefined` — the field does not exist).
  // Kept explicit (instead of deleting the penalty path in computeTrustScore).
  const isDuplicate = false;

  const trustScore = computeTrustScore(
    document.qualityScore,
    isDuplicate,
    document.reportCount,
    document._count.ratings,
    averageRating,
    0, // helpfulVotes - need to query separately
    0, // totalVotes
    document.viewCount,
    document.downloadCount,
    document.saveCount,
    daysSincePublish
  );

  const trustLevel = getTrustLevel(trustScore);

  await prisma.communityDocument.update({
    where: { id: document.id },
    data: { trustScore, trustLevel: getTrustLevel(trustScore) },
  });

  return trustScore;
}

// --- PERIODIC QUALITY RECALCULATION ---
export async function recalculateAllDocumentQualityScores(): Promise<void> {
  const documents = await prisma.communityDocument.findMany({
    where: { status: "READY" },
    select: { id: true },
  });

  console.log(`Recalculating quality for ${documents.length} documents...`);

  for (const doc of documents) {
    await recalculateDocumentTrustScore(doc.id);
  }

  console.log("Quality recalculation completed");
}