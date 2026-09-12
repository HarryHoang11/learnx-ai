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
import type { ActivityType } from "@/lib/constants/xp";
import type { ApiResponse } from "@/types";

const VALID_TYPES: ActivityType[] = [
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
  'achievement_unlocked',
  'tutor_session_completed',
  'mindmap_created',
  'document_analyzed',
  'reflection_completed',
  'task_completed',
  'diagnostic_completed',
  'roadmap_completed',
  'review_completed',
  'study_session_completed',
];

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const body = await req.json();
    const { type, difficulty, scorePercent, isFirstCompletion, sourceId, sourceType, metadata } = body as LearningActivityInput;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Invalid or missing activity type." },
        { status: 400 }
      );
    }

    // Validate difficulty server-side — must be a known value
    const validDifficulty = ['easy', 'medium', 'hard'];
    const safeDifficulty = validDifficulty.includes(difficulty ?? '') ? (difficulty as 'easy' | 'medium' | 'hard') : 'medium';

    // Validate scorePercent server-side — must be a number in [0, 100]
    const safeScorePercent = typeof scorePercent === 'number' && scorePercent >= 0 && scorePercent <= 100 ? scorePercent : 0;

    // Validate isFirstCompletion — must be a boolean
    const safeIsFirstCompletion = typeof isFirstCompletion === 'boolean' ? isFirstCompletion : true;

    const result = await recordLearningActivity({
      userId,
      type,
      difficulty: safeDifficulty,
      scorePercent: safeScorePercent,
      isFirstCompletion: safeIsFirstCompletion,
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