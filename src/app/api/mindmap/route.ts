// ================================================================
// GET/POST /api/mindmap — Get or create mind maps
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const sourceDocumentId = searchParams.get("sourceDocumentId");

    if (id) {
      const mindMap = await prisma.mindMap.findFirst({
        where: { id, userId },
      });
      if (!mindMap) {
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Không tìm thấy Mind Map." },
          { status: 404 }
        );
      }
      return NextResponse.json<ApiResponse<typeof mindMap>>({ success: true, data: mindMap });
    }

    if (sourceDocumentId) {
      const mindMaps = await prisma.mindMap.findMany({
        where: { userId, sourceDocumentId },
        orderBy: { updatedAt: "desc" },
      });
      return NextResponse.json<ApiResponse<typeof mindMaps>>({ success: true, data: mindMaps });
    }

    const mindMaps = await prisma.mindMap.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json<ApiResponse<typeof mindMaps>>({ success: true, data: mindMaps });
  } catch (err) {
    console.error("[api/mindmap] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy Mind Map, thử lại sau." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { title, description, sourceDocumentId, subject, topic, data } = body as {
      title: string;
      description?: string;
      sourceDocumentId?: string;
      subject?: string;
      topic?: string;
      data: any; // Mind map graph data
    };

    if (!title || !data) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu title hoặc data." },
        { status: 400 }
      );
    }

    const mindMap = await prisma.mindMap.create({
      data: {
        userId,
        title,
        description,
        sourceDocumentId,
        subject,
        topic,
        data,
      },
    });

    return NextResponse.json<ApiResponse<typeof mindMap>>({ success: true, data: mindMap });
  } catch (err) {
    console.error("[api/mindmap] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo Mind Map, thử lại sau." },
      { status: 500 }
    );
  }
}