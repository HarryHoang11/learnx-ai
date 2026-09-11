// ================================================================
// GET /api/community/subjects — Get all subjects with topics
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
    const includeTopics = searchParams.get("includeTopics") === "true";

const subjects = await prisma.subject.findMany({
      where: { status: "ACTIVE" },
      orderBy: { order: "asc" },
      include: includeTopics
        ? ({
            topics: {
              where: { status: "ACTIVE" },
              orderBy: { order: "asc" },
              include: {
                children: {
                  where: { status: "ACTIVE" },
                  orderBy: { order: "asc" },
                },
              },
            }
          })
        : undefined,
    });

    return NextResponse.json<ApiResponse<typeof subjects>>({ success: true, data: subjects });
  } catch (err) {
    console.error("[api/community/subjects] GET error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tải danh sách môn học" },
      { status: 500 }
    );
  }
}