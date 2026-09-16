// ================================================================
// GET/POST /api/mindmap — Get or create mind maps
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { parseMindMapData, toMindMapJson } from "@/lib/mindmap/graph";
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
      title?: unknown;
      description?: unknown;
      sourceDocumentId?: unknown;
      subject?: unknown;
      topic?: unknown;
      data?: unknown;
    };
    const graph = parseMindMapData(data);

    if (typeof title !== "string" || title.trim() === "" || !graph) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu title hợp lệ hoặc graph Mind Map không hợp lệ." },
        { status: 400 }
      );
    }

    const mindMap = await prisma.mindMap.create({
      data: {
        userId,
        title: title.trim(),
        description: typeof description === "string" ? description.trim() || undefined : undefined,
        sourceDocumentId: typeof sourceDocumentId === "string" ? sourceDocumentId : undefined,
        subject: typeof subject === "string" ? subject.trim() || undefined : undefined,
        topic: typeof topic === "string" ? topic.trim() || undefined : undefined,
        data: toMindMapJson(graph),
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