// ================================================================
// POST /api/mindmap/generate — Generate mind map from document
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generateJSON } from "@/lib/ai/router";
import { buildMindMapPrompt } from "@/lib/ai/prompts";
import type { ApiResponse } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { documentId, subject, topic, title } = body as {
      documentId: string;
      subject?: string;
      topic?: string;
      title?: string;
    };

    if (!documentId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu documentId." },
        { status: 400 }
      );
    }

    // Get document
    const document = await prisma.document.findFirst({
      where: { id: documentId, userId },
      select: { summary: true, fileName: true },
    });

    if (!document || !document.summary) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Tài liệu không có tóm tắt." },
        { status: 404 }
      );
    }

    // Generate mind map using AI
    const prompt = buildMindMapPrompt(document.summary);
    const mindMapData = await generateJSON<{ nodes: any[]; edges: any[] }>({
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      jsonMode: true,
    });

    // Save mind map
    const mindMap = await prisma.mindMap.create({
      data: {
        userId,
        title: title || `${document.fileName} - Mind Map`,
        description: `Mind Map được tạo từ tài liệu: ${document.fileName}`,
        sourceDocumentId: documentId,
        subject,
        topic,
        data: {
          version: 1,
          nodes: mindMapData.nodes,
          edges: mindMapData.edges,
        },
      },
    });

    return NextResponse.json<ApiResponse<typeof mindMap>>({ success: true, data: mindMap });
  } catch (err) {
    console.error("[api/mindmap/generate] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo Mind Map, thử lại sau." },
      { status: 500 }
    );
  }
}