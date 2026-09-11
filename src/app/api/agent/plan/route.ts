// ================================================================
// GET/POST /api/agent/plan — Get or create learning agent plan
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { createAgentPlan, getAgentPlan, getAgentPlans } from "@/services/learning-agent.service";
import type { ApiResponse } from "@/types";

export async function GET(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(req.url);
    const all = searchParams.get("all") === "true";

    if (all) {
      const plans = await getAgentPlans(userId);
      return NextResponse.json<ApiResponse<typeof plans>>({ success: true, data: plans });
    }

    const plan = await getAgentPlan(userId);
    return NextResponse.json<ApiResponse<typeof plan>>({ success: true, data: plan });
  } catch (err) {
    console.error("[api/agent/plan] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể lấy kế hoạch, thử lại sau." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { goal, targetDate, subject, preferredHoursPerWeek } = body as {
      goal: string;
      targetDate?: string;
      subject?: string;
      preferredHoursPerWeek?: number;
    };

    if (!goal) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu goal." },
        { status: 400 }
      );
    }

    const plan = await createAgentPlan({
      userId,
      goal,
      targetDate: targetDate ? new Date(targetDate) : undefined,
      subject,
      preferredHoursPerWeek,
    });

    return NextResponse.json<ApiResponse<typeof plan>>({ success: true, data: plan });
  } catch (err) {
    console.error("[api/agent/plan] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo kế hoạch, thử lại sau." },
      { status: 500 }
    );
  }
}