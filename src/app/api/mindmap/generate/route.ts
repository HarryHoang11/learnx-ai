// ================================================================
// POST /api/mindmap/generate — Generate mind map from document
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { AIOverloadedError } from "@/lib/ai/router";
import { parseMindMapData, toMindMapJson, type MindMapData } from "@/lib/mindmap/graph";
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
      select: { summary: true, fileName: true, subject: true, topic: true },
    });

    if (!document || !document.summary) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Tài liệu không có tóm tắt." },
        { status: 404 }
      );
    }

    // Generate mind map using AI
    const prompt = buildMindMapPrompt(document.summary);
    const mindMapData = await generateJSON<MindMapData>(
      {
        systemPrompt: prompt.system,
        userPrompt: prompt.user,
      },
      (value) => {
        const parsed = parseMindMapData(value);
        if (!parsed) throw new Error("AI không trả về graph Mind Map hợp lệ.");
        return parsed;
      }
    );

    // Validate AI response structure before saving
    if (!mindMapData) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "AI không trả về graph Mind Map hợp lệ, thử lại sau." },
        { status: 422 }
      );
    }

    // Save mind map
    const mindMap = await prisma.mindMap.create({
      data: {
        userId,
        title: title || `${document.fileName} - Mind Map`,
        description: `Mind Map được tạo từ tài liệu: ${document.fileName}`,
        sourceDocumentId: documentId,
        subject: subject || document.subject || undefined,
        topic: topic || document.topic || undefined,
        data: toMindMapJson(mindMapData),
      },
    });

    return NextResponse.json<ApiResponse<typeof mindMap>>({ success: true, data: mindMap });
  } catch (err) {
    console.error("[api/mindmap/generate] Error:", err);
    if (err instanceof AIOverloadedError) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: err.message },
        { status: 503 }
      );
    }
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo Mind Map, thử lại sau." },
      { status: 500 }
    );
  }
}
