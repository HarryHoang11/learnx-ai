// ================================================================
// POST /api/learning/activity — Record a learning activity
// ================================================================
// Centralized endpoint for ALL learning activities to award XP/LXP
// and update streak. Features must call this instead of managing
// XP/LXP themselves.
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { recordLearningActivity, type LearningActivityInput } from "@/services/learning-activity.service";
import type { ApiResponse } from "@/types";

const VALID_TYPES = [
  'lesson_complete',
  'exercise_easy',
  'exercise_medium',
  'exercise_hard',
  'quiz_complete',
  'quiz_80_percent',
  'daily_challenge',
  'daily_mission',
  'weekly_mission',
  'mastery_milestone',
] as const;

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { type, difficulty, scorePercent, isFirstCompletion, sourceId, sourceType, metadata } = body as LearningActivityInput;

    if (!type || !VALID_TYPES.includes(type as any)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid or missing activity type." },
        { status: 400 }
      );
    }

    const result = await recordLearningActivity({
      userId,
      type,
      difficulty: difficulty ?? 'medium',
      scorePercent: scorePercent ?? 0,
      isFirstCompletion: isFirstCompletion ?? true,
      sourceId,
      sourceType: sourceType ?? type,
      metadata,
    });

    return NextResponse.json<ApiResponse<typeof result>>({ success: true, data: result });
  } catch (err) {
    console.error("[api/learning/activity] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể ghi nhận hoạt động học tập, thử lại sau." },
      { status: 500 }
    );
  }
}