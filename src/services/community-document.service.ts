// ================================================================
// COMMUNITY DOCUMENT SERVICE
// ================================================================
// Implements community document operations using Prisma schema fields
// (ratingSum/ratingCount instead of averageRating)
// ================================================================

import { prisma } from "@/lib/db/prisma";
import type { ApiResponse } from "@/types";

export interface GetDocumentsParams {
  userId: string;
  page: number;
  limit: number;
  sortBy?: string;
  search?: string;
  subjectId?: string;
  topicId?: string;
  grade?: string;
  difficulty?: string;
  trustLevel?: string;
}

export async function getCommunityDocuments(params: GetDocumentsParams): Promise<ApiResponse<any>> {
  try {
    const { userId, page, limit, sortBy, search, subjectId, topicId, grade, difficulty, trustLevel } = params;

    const where: any = {
      status: "READY",
      visibility: "COMMUNITY",
      ...(subjectId && { subjectId }),
      ...(topicId && { topicId }),
      ...(grade && { grade }),
      ...(difficulty && { difficulty }),
      ...(trustLevel && { trustLevel }),
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { tags: { hasSome: search.split(" ") } },
      ];
    }

    const orderBy = getSortOrder(sortBy);

    const documents = await prisma.communityDocument.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        owner: { select: { id: true, name: true, nickname: true, image: true, contributorProfile: true } },
        subject: true,
        topic: true,
        ratings: { select: { rating: true } },
        _count: { select: { ratings: true, saves: true, reports: true } },
      },
    });

    const total = await prisma.communityDocument.count({ where });

    // Compute average rating for each document from ratingSum/ratingCount
    const documentsWithRating = documents.map(doc => ({
      ...doc,
      averageRating: doc.ratingCount > 0 ? doc.ratingSum / doc.ratingCount : 0,
    }));

    return {
      success: true,
      data: {
        documents: documentsWithRating,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (err) {
    console.error("[getCommunityDocuments] Error:", err);
    return { success: false, error: "Không thể tải danh sách tài liệu, thử lại sau." };
  }
}

export interface CreateDocumentParams {
  userId: string;
  title: string;
  description?: string;
  subjectId: string;
  topicId?: string;
  difficulty?: string;
  language?: string;
  grade?: string;
  tags?: string[];
  fileData: Buffer;
  mimeType: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  visibility?: "COMMUNITY" | "PRIVATE";
}

export async function uploadCommunityDocument(params: CreateDocumentParams): Promise<ApiResponse<any>> {
  try {
    const { userId, title, description, subjectId, topicId, difficulty, language, grade, tags, fileData, mimeType, fileName, fileType, fileSize, visibility } = params;

    // Check spam limits
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayUploads = await prisma.communityDocument.count({
      where: { ownerId: userId, uploadedAt: { gte: today } },
    });
    if (todayUploads >= 20) {
      return { success: false, error: "Đã đạt giới hạn tải lên hàng ngày (20 tài liệu)." };
    }

    // Check for duplicate (same fileName + fileSize by same user in last 24h)
    const recentDuplicate = await prisma.communityDocument.findFirst({
      where: {
        ownerId: userId,
        fileName,
        fileSize,
        uploadedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (recentDuplicate) {
      return { success: true, data: { isDuplicate: true, documentId: recentDuplicate.id } };
    }

    const document = await prisma.communityDocument.create({
      data: {
        ownerId: userId,
        title,
        description,
        subjectId,
        topicId,
        difficulty,
        language: language || "vi",
        grade,
        tags: tags || [],
        fileData,
        mimeType,
        fileName,
        fileType,
        fileSize,
        status: "PROCESSING",
        visibility: visibility || "COMMUNITY",
      },
    });

    // Process document asynchronously
    processDocument(document.id).catch((err) =>
      console.error(`[CommunityDocument] Processing failed for ${document.id}:`, err)
    );

    return { success: true, data: { documentId: document.id, isDuplicate: false } };
  } catch (err) {
    console.error("[uploadCommunityDocument] Error:", err);
    return { success: false, error: "Không thể tạo tài liệu, thử lại sau." };
  }
}

async function processDocument(documentId: string): Promise<void> {
  try {
    const document = await prisma.communityDocument.findUnique({
      where: { id: documentId },
      select: { fileData: true, mimeType: true, fileType: true },
    });
    if (!document?.fileData) return;

    // Single entry point that selects the extractor by fileType
    // (see extractText.ts) — do NOT branch on mimeType here.
    const { extractTextFromBuffer } = await import("@/lib/documents/extractText");
    const { text } = await extractTextFromBuffer(document.fileData, document.fileType);

    if (!text.trim()) {
      await prisma.communityDocument.update({
        where: { id: documentId },
        data: { status: "FAILED", errorMessage: "Không trích xuất được nội dung từ file" },
      });
      return;
    }

    // Generate summary
    const { generateText } = await import("@/lib/ai/router");
    const { buildDocumentSummaryPrompt } = await import("@/lib/ai/prompts");
    const summaryPrompt = buildDocumentSummaryPrompt(text);
    const summaryResult = await generateText({
      systemPrompt: summaryPrompt.system,
      userPrompt: summaryPrompt.user,
    });

    // Generate quality evaluation
    const { generateJSON } = await import("@/lib/ai/router");
    const { buildDocumentQualityPrompt } = await import("@/lib/ai/prompts");
    const qualityPrompt = buildDocumentQualityPrompt(text, summaryResult);
    const qualityResult = await generateJSON<Record<string, number>>({
      systemPrompt: qualityPrompt.system,
      userPrompt: qualityPrompt.user,
      jsonMode: true,
    });

    const qualityScore = Object.values(qualityResult).reduce((sum, v) => sum + (Number(v) || 0), 0) / 8;

    // Update document with results
    await prisma.communityDocument.update({
      where: { id: documentId },
      data: {
        summary: summaryResult,
        status: "READY",
        qualityScore,
        aiQuality: qualityResult,
        aiEvaluatedAt: new Date(),
        qualityEvaluatedAt: new Date(),
      },
    });
  } catch (err) {
    console.error("[processDocument] Error:", err);
    await prisma.communityDocument.update({
      where: { id: documentId },
      data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Lỗi xử lý tài liệu" },
    });
  }
}

export async function getCommunityDocument(documentId: string, userId?: string): Promise<ApiResponse<any>> {
  try {
    const document = await prisma.communityDocument.findUnique({
      where: { id: documentId },
      include: {
        owner: { select: { id: true, name: true, nickname: true, image: true } },
        subject: true,
        topic: true,
        ratings: { select: { rating: true, userId: true } },
        _count: { select: { ratings: true, saves: true, reports: true } },
      },
    });

    if (!document) {
      return { success: false, error: "Không tìm thấy tài liệu" };
    }

    if (document.visibility === "PRIVATE" && document.ownerId !== userId) {
      return { success: false, error: "Không có quyền truy cập tài liệu này" };
    }

    // Compute average rating from ratingSum/ratingCount
    const averageRating = document.ratingCount > 0 ? document.ratingSum / document.ratingCount : 0;
    const userRating = userId ? document.ratings.find(r => r.userId === userId)?.rating : undefined;

    // Check if user has saved this document
    let userSave = false;
    if (userId) {
      const save = await prisma.documentSave.findUnique({
        where: { userId_documentId: { userId, documentId } },
      });
      userSave = !!save;
    }

    return {
      success: true,
      data: {
        ...document,
        averageRating,
        userRating,
        userSave,
      },
    };
  } catch (err) {
    console.error("[getCommunityDocument] Error:", err);
    return { success: false, error: "Không thể tải tài liệu, thử lại sau." };
  }
}

export async function rateDocument(
  userId: string,
  documentId: string,
  rating: number,
  review?: string
): Promise<ApiResponse<any>> {
  try {
    if (rating < 1 || rating > 5) {
      return { success: false, error: "Đánh giá phải từ 1 đến 5 sao" };
    }

    const document = await prisma.communityDocument.findUnique({
      where: { id: documentId },
      select: { ratingSum: true, ratingCount: true },
    });
    if (!document) {
      return { success: false, error: "Không tìm thấy tài liệu" };
    }

    const existingRating = await prisma.documentRating.findUnique({
      where: { userId_documentId: { userId, documentId } },
    });

    // Use transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      if (existingRating) {
        const oldRating = existingRating.rating;
        await tx.documentRating.update({
          where: { id: existingRating.id },
          data: { rating, review },
        });
        // Update ratingSum/ratingCount
        await tx.communityDocument.update({
          where: { id: documentId },
          data: {
            ratingSum: { increment: rating - oldRating },
          },
        });
      } else {
        await tx.documentRating.create({
          data: { documentId, userId, rating, review },
        });
        await tx.communityDocument.update({
          where: { id: documentId },
          data: {
            ratingSum: { increment: rating },
            ratingCount: { increment: 1 },
          },
        });
      }
    });

    // Recompute average
    const updatedDoc = await prisma.communityDocument.findUnique({
      where: { id: documentId },
      select: { ratingSum: true, ratingCount: true },
    });

    const averageRating = updatedDoc!.ratingCount > 0 ? updatedDoc!.ratingSum / updatedDoc!.ratingCount : 0;

    return { success: true, data: { averageRating, rating, ratingCount: updatedDoc!.ratingCount } };
  } catch (err) {
    console.error("[rateDocument] Error:", err);
    return { success: false, error: "Không thể đánh giá tài liệu, thử lại sau." };
  }
}

export async function toggleSaveDocument(userId: string, documentId: string): Promise<ApiResponse<any>> {
  try {
    const document = await prisma.communityDocument.findUnique({
      where: { id: documentId },
      select: { saveCount: true },
    });
    if (!document) {
      return { success: false, error: "Không tìm thấy tài liệu" };
    }

    const existingSave = await prisma.documentSave.findUnique({
      where: { userId_documentId: { userId, documentId } },
    });

    let saved = false;
    await prisma.$transaction(async (tx) => {
      if (existingSave) {
        await tx.documentSave.delete({ where: { id: existingSave.id } });
        await tx.communityDocument.update({
          where: { id: documentId },
          data: { saveCount: { decrement: 1 } },
        });
        saved = false;
      } else {
        await tx.documentSave.create({ data: { userId, documentId } });
        await tx.communityDocument.update({
          where: { id: documentId },
          data: { saveCount: { increment: 1 } },
        });
        saved = true;
      }
    });

    return { success: true, data: { saved } };
  } catch (err) {
    console.error("[toggleSaveDocument] Error:", err);
    return { success: false, error: "Không thể lưu/bỏ lưu tài liệu, thử lại sau." };
  }
}

export async function trackDownload(userId: string, documentId: string): Promise<ApiResponse<any>> {
  try {
    const document = await prisma.communityDocument.findUnique({
      where: { id: documentId },
      select: { downloadCount: true, ownerId: true, visibility: true },
    });
    if (!document) {
      return { success: false, error: "Không tìm thấy tài liệu" };
    }

    // Only increment if not owner (or could track all downloads)
    if (document.ownerId !== userId) {
      await prisma.communityDocument.update({
        where: { id: documentId },
        data: { downloadCount: { increment: 1 } },
      });
    }

    return { success: true, data: { downloadCount: document.downloadCount + (document.ownerId !== userId ? 1 : 0) } };
  } catch (err) {
    console.error("[trackDownload] Error:", err);
    return { success: false, error: "Không thể ghi nhận lượt tải" };
  }
}

export async function reportDocument(
  userId: string,
  documentId: string,
  reason: string,
  description?: string
): Promise<ApiResponse<any>> {
  try {
    const document = await prisma.communityDocument.findUnique({
      where: { id: documentId },
      select: { reportCount: true, ownerId: true },
    });
    if (!document) {
      return { success: false, error: "Không tìm thấy tài liệu" };
    }

    const existingReport = await prisma.documentReport.findFirst({
      where: { documentId, userId },
    });

    if (existingReport) {
      return { success: false, error: "Bạn đã báo cáo tài liệu này" };
    }

    await prisma.$transaction(async (tx) => {
      await tx.documentReport.create({
        data: {
          documentId,
          userId,
          reason: reason as any,
          description,
          status: "PENDING",
        },
      });
      await tx.communityDocument.update({
        where: { id: documentId },
        data: { reportCount: { increment: 1 } },
      });
    });

    return { success: true, data: { reported: true } };
  } catch (err) {
    console.error("[reportDocument] Error:", err);
    return { success: false, error: "Không thể báo cáo tài liệu, thử lại sau." };
  }
}

function getSortOrder(sortBy?: string) {
  switch (sortBy) {
    case "newest":
      return { createdAt: "desc" as const };
    case "oldest":
      return { createdAt: "asc" as const };
    case "popular":
      return { viewCount: "desc" as const };
    case "rating":
      return { ratingSum: "desc" as const };
    default:
      return { createdAt: "desc" as const };
  }
}