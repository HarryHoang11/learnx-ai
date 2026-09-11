// ================================================================
// LEARNING RESOURCE SERVICE — catalog tài liệu học tập chung
// ================================================================
// Mạch tư duy: khác CommunityDocument (file user upload + AI xử lý),
// LearningResource là CATALOG có kiểm duyệt nhẹ: mỗi entry trỏ tới
// 1 URL ngoài HOẶC 1 CommunityDocument. Chất lượng KHÔNG chỉ là
// trung bình rating — công thức qualityScore kết hợp rating có trọng
// số tin cậy + usage + phạt report (xem computeQualityScore).
// Mỗi user chỉ rate 1 lần (unique DB), report trùng bị chặn.

import { prisma } from "@/lib/db/prisma";
import type { Prisma, ReportReason } from "@prisma/client";
import type { ApiResponse } from "@/types";

export const RESOURCE_TYPES = [
  "ARTICLE",
  "VIDEO",
  "DOCUMENTATION",
  "DOCUMENT",
  "WEBSITE",
  "EXERCISE_SET",
  "OTHER",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export interface ListResourcesParams {
  page: number;
  limit: number;
  search?: string;
  subject?: string;
  topic?: string;
  difficulty?: string;
  type?: string;
  sortBy?: "quality" | "rating" | "popular" | "newest";
}

export interface CreateResourceParams {
  contributorId: string;
  title: string;
  description?: string;
  subject?: string;
  topic?: string;
  difficulty?: string;
  type: string;
  url?: string;
  communityDocumentId?: string;
}

// Điểm chất lượng 0–100: rating có trọng số tin cậy (70) + usage
// log-scale (20) − phạt report (tối đa 30). Resource mới = 0, phải
// kiếm rating/usage thật — contributor không thể tự bơm điểm bằng
// cách tạo entry (chưa ai rate/đọc thì quality vẫn 0).
export function computeQualityScore(args: {
  ratingSum: number;
  ratingCount: number;
  usageCount: number;
  reportCount: number;
}): number {
  const avg = args.ratingCount > 0 ? args.ratingSum / args.ratingCount : 0;
  const confidence = Math.min(args.ratingCount, 10) / 10;
  const ratingPart = (avg / 5) * 70 * (0.3 + 0.7 * confidence);
  const usagePart = Math.min(20, 5 * Math.log10(1 + Math.max(0, args.usageCount)));
  const penalty = Math.min(30, Math.max(0, args.reportCount) * 10);
  return Math.max(0, Math.min(100, Math.round(ratingPart + usagePart - penalty)));
}

function toOrderBy(sortBy?: string) {
  switch (sortBy) {
    case "rating":
      return { ratingSum: "desc" as const };
    case "popular":
      return { usageCount: "desc" as const };
    case "newest":
      return { createdAt: "desc" as const };
    case "quality":
    default:
      return { qualityScore: "desc" as const };
  }
}

function withAverage<T extends { ratingSum: number; ratingCount: number }>(r: T) {
  return { ...r, averageRating: r.ratingCount > 0 ? r.ratingSum / r.ratingCount : 0 };
}

export async function listResources(params: ListResourcesParams): Promise<ApiResponse<any>> {
  try {
    const { page, limit, search, subject, topic, difficulty, type, sortBy } = params;
    if (type && !RESOURCE_TYPES.includes(type as ResourceType)) {
      return { success: false, error: "Loại tài liệu không hợp lệ." };
    }
    const where: Prisma.LearningResourceWhereInput = {
      status: "ACTIVE",
      ...(subject && { subject }),
      ...(topic && { topic }),
      ...(difficulty && { difficulty }),
      ...(type && { type: type as ResourceType }),
    };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.learningResource.findMany({
        where,
        orderBy: toOrderBy(sortBy),
        skip: (page - 1) * limit,
        take: limit,
        include: {
          contributor: { select: { id: true, name: true, nickname: true, image: true } },
        },
      }),
      prisma.learningResource.count({ where }),
    ]);

    return {
      success: true,
      data: {
        resources: items.map(withAverage),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (err) {
    console.error("[listResources] Error:", err);
    return { success: false, error: "Không thể tải danh sách tài liệu học, thử lại sau." };
  }
}

export async function createResource(params: CreateResourceParams): Promise<ApiResponse<any>> {
  try {
    const { contributorId, title, description, subject, topic, difficulty, type, url, communityDocumentId } =
      params;

    if (!title.trim()) return { success: false, error: "Thiếu tiêu đề tài liệu." };
    if (!RESOURCE_TYPES.includes(type as ResourceType)) {
      return { success: false, error: "Loại tài liệu không hợp lệ." };
    }
    if (!url && !communityDocumentId) {
      return { success: false, error: "Cần URL hoặc tài liệu cộng đồng liên kết." };
    }
    if (url) {
      try {
        const u = new URL(url);
        if (!["http:", "https:"].includes(u.protocol)) throw new Error("bad protocol");
      } catch {
        return { success: false, error: "URL không hợp lệ (chỉ chấp nhận http/https)." };
      }
    }
    if (communityDocumentId) {
      // Chỉ chủ sở hữu mới được đưa tài liệu của mình vào catalog —
      // chống ké fame tài liệu của người khác.
      const doc = await prisma.communityDocument.findFirst({
        where: { id: communityDocumentId, ownerId: contributorId },
        select: { id: true },
      });
      if (!doc) return { success: false, error: "Tài liệu liên kết không tồn tại hoặc không thuộc về bạn." };
    }

    const created = await prisma.learningResource.create({
      data: {
        contributorId,
        title: title.trim(),
        description,
        subject,
        topic,
        difficulty,
        type: type as ResourceType,
        url,
        communityDocumentId,
      },
    });
    return { success: true, data: withAverage(created) };
  } catch (err) {
    console.error("[createResource] Error:", err);
    return { success: false, error: "Không thể tạo tài liệu học, thử lại sau." };
  }
}

export async function getResource(resourceId: string, userId?: string): Promise<ApiResponse<any>> {
  try {
    const resource = await prisma.learningResource.findUnique({
      where: { id: resourceId },
      include: {
        contributor: { select: { id: true, name: true, nickname: true, image: true } },
        ratings: { select: { rating: true, userId: true } },
      },
    });
    if (!resource || resource.status !== "ACTIVE") {
      return { success: false, error: "Không tìm thấy tài liệu học." };
    }
    return {
      success: true,
      data: {
        ...withAverage(resource),
        userRating: userId ? resource.ratings.find((r) => r.userId === userId)?.rating : undefined,
      },
    };
  } catch (err) {
    console.error("[getResource] Error:", err);
    return { success: false, error: "Không thể tải tài liệu học, thử lại sau." };
  }
}

async function refreshQuality(resourceId: string) {
  const r = await prisma.learningResource.findUnique({
    where: { id: resourceId },
    select: { ratingSum: true, ratingCount: true, usageCount: true, reportCount: true },
  });
  if (!r) return null;
  const qualityScore = computeQualityScore(r);
  await prisma.learningResource.update({ where: { id: resourceId }, data: { qualityScore } });
  return { ...r, qualityScore, averageRating: r.ratingCount > 0 ? r.ratingSum / r.ratingCount : 0 };
}

export async function rateResource(
  userId: string,
  resourceId: string,
  rating: number,
  review?: string
): Promise<ApiResponse<any>> {
  try {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { success: false, error: "Đánh giá phải là số nguyên từ 1 đến 5." };
    }
    const resource = await prisma.learningResource.findUnique({
      where: { id: resourceId },
      select: { id: true, status: true, contributorId: true },
    });
    if (!resource || resource.status !== "ACTIVE") {
      return { success: false, error: "Không tìm thấy tài liệu học." };
    }
    if (resource.contributorId === userId) {
      return { success: false, error: "Bạn không thể tự đánh giá tài liệu của mình." };
    }

    const existing = await prisma.resourceRating.findUnique({
      where: { userId_resourceId: { userId, resourceId } },
    });

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.resourceRating.update({
          where: { id: existing.id },
          data: { rating, review },
        });
        await tx.learningResource.update({
          where: { id: resourceId },
          data: { ratingSum: { increment: rating - existing.rating } },
        });
      } else {
        await tx.resourceRating.create({ data: { userId, resourceId, rating, review } });
        await tx.learningResource.update({
          where: { id: resourceId },
          data: { ratingSum: { increment: rating }, ratingCount: { increment: 1 } },
        });
      }
    });

    const updated = await refreshQuality(resourceId);
    return { success: true, data: { ...updated, rating } };
  } catch (err) {
    console.error("[rateResource] Error:", err);
    return { success: false, error: "Không thể đánh giá, thử lại sau." };
  }
}

export async function reportResource(
  userId: string,
  resourceId: string,
  reason: string,
  description?: string
): Promise<ApiResponse<any>> {
  try {
    const validReasons = [
      "WRONG_INFO",
      "SPAM",
      "DUPLICATE",
      "MISLEADING",
      "INAPPROPRIATE",
      "COPYRIGHT",
      "WRONG_SUBJECT",
      "OTHER",
    ];
    if (!validReasons.includes(reason)) {
      return { success: false, error: "Lý do báo cáo không hợp lệ." };
    }
    const resource = await prisma.learningResource.findUnique({
      where: { id: resourceId },
      select: { id: true, status: true },
    });
    if (!resource || resource.status !== "ACTIVE") {
      return { success: false, error: "Không tìm thấy tài liệu học." };
    }
    const dup = await prisma.resourceReport.findFirst({
      where: { userId, resourceId, status: "pending" },
    });
    if (dup) return { success: false, error: "Bạn đã báo cáo tài liệu này rồi." };

    await prisma.$transaction(async (tx) => {
      await tx.resourceReport.create({
        data: { userId, resourceId, reason: reason as ReportReason, description, status: "pending" },
      });
      await tx.learningResource.update({
        where: { id: resourceId },
        data: { reportCount: { increment: 1 } },
      });
    });

    await refreshQuality(resourceId);
    return { success: true, data: { reported: true } };
  } catch (err) {
    console.error("[reportResource] Error:", err);
    return { success: false, error: "Không thể báo cáo, thử lại sau." };
  }
}

// Ghi nhận 1 lượt mở/sử dụng (không cộng XP — chỉ phục vụ sort
// popularity + quality, nên refresh/spam click không farm được gì).
export async function trackResourceUsage(userId: string, resourceId: string): Promise<ApiResponse<any>> {
  try {
    const resource = await prisma.learningResource.findUnique({
      where: { id: resourceId },
      select: { id: true, status: true, usageCount: true },
    });
    if (!resource || resource.status !== "ACTIVE") {
      return { success: false, error: "Không tìm thấy tài liệu học." };
    }
    const updated = await prisma.learningResource.update({
      where: { id: resourceId },
      data: { usageCount: { increment: 1 } },
      select: { usageCount: true },
    });
    return { success: true, data: { usageCount: updated.usageCount } };
  } catch (err) {
    console.error("[trackResourceUsage] Error:", err);
    return { success: false, error: "Không thể ghi nhận lượt xem." };
  }
}
