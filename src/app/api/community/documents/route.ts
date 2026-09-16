// ================================================================
// GET /api/community/documents — List community documents
// POST /api/community/documents — Upload new document
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { getCommunityDocuments, uploadCommunityDocument } from "@/services/community-document.service";
import type { ApiResponse } from "@/types";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB — match documents/upload/route.ts

const VALID_VISIBILITIES = ["COMMUNITY", "PRIVATE"];

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const pageValue = Number(searchParams.get("page") || 1);
    const limitValue = Number(searchParams.get("limit") || 20);
    const page = Number.isInteger(pageValue) ? Math.max(1, pageValue) : 1;
    const limit = Number.isInteger(limitValue) ? Math.min(50, Math.max(1, limitValue)) : 20;
    const sortBy = searchParams.get("sortBy") || undefined;
    const search = searchParams.get("search") || undefined;
    const subjectId = searchParams.get("subjectId") || undefined;
    const topicId = searchParams.get("topicId") || undefined;
    const grade = searchParams.get("grade") || undefined;
    const difficulty = searchParams.get("difficulty") || undefined;
    const trustLevel = searchParams.get("trustLevel") || undefined;

    const result = await getCommunityDocuments({
      userId,
      page,
      limit,
      sortBy,
      search,
      subjectId,
      topicId,
      grade,
      difficulty,
      trustLevel,
    });

    return NextResponse.json<ApiResponse<any>>(result);
  } catch (err) {
    console.error("[api/community/documents] GET error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải danh sách tài liệu" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không có file được tải lên" },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "File quá lớn (giới hạn 20MB)." },
        { status: 413 }
      );
    }

    const title = formData.get("title") as string;
    const description = formData.get("description") as string | null;
    const subjectId = formData.get("subjectId") as string;
    const topicId = formData.get("topicId") as string | null;
    const difficulty = formData.get("difficulty") as string | null;
    const language = formData.get("language") as string | null;
    const grade = formData.get("grade") as string | null;
    const tags = formData.get("tags") as string | null;
    const visibilityRaw = formData.get("visibility") as string | null;

    const visibility = visibilityRaw && VALID_VISIBILITIES.includes(visibilityRaw)
      ? visibilityRaw as "COMMUNITY" | "PRIVATE"
      : "COMMUNITY";

    if (!title || !subjectId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu tiêu đề hoặc môn học" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileType = file.name.split(".").pop()?.toLowerCase() || "";
    const mimeType = file.type || "application/octet-stream";

    const result = await uploadCommunityDocument({
      userId,
      title,
      description: description || undefined,
      subjectId,
      topicId: topicId || undefined,
      difficulty: difficulty || undefined,
      language: language || undefined,
      grade: grade || undefined,
      tags: tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      fileData: buffer,
      mimeType,
      fileName: file.name,
      fileType,
      fileSize: file.size,
      visibility: visibility || "COMMUNITY",
    });

    if (!result.success) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    if (result.data.isDuplicate) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "File này đã được tải lên gần đây." },
        { status: 409 }
      );
    }

    return NextResponse.json<ApiResponse<any>>({ success: true, data: result.data });
  } catch (err) {
    console.error("[api/community/documents] POST error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải lên tài liệu" },
      { status: 500 }
    );
  }
}