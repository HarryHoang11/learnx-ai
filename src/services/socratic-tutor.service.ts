// ================================================================
// SOCRATIC TUTOR SERVICE — AI Tutor với Hint Levels
// ================================================================
// Mạch tư duy: service này quản lý tutor session, hint levels,
// và tích hợp với learning activity tracking.
// ================================================================

import { prisma } from "@/lib/db/prisma";
import { createHash } from "crypto";
import { generateText, generateJSON } from "@/lib/ai/router";
import { buildSocraticPrompt, buildTutorEvaluationPrompt } from "@/lib/ai/prompts";
import { getCurrentStreak, recordLearningActivity } from "@/services/learning-activity.service";
import type { ChatMessage } from "@/types";

export type HintLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TutorSessionData {
  id: string;
  userId: string;
  topic: string | null;
  subject?: string | null;
  mode: string;
  difficulty: number;
  hintsUsed: number;
  correctAnswers: number;
  incorrectAnswers: number;
  completedAt?: Date | null;
  startedAt: Date;
  metadata?: any;
}

export interface TutorResponse {
  reply: string;
  hintLevel: HintLevel;
  sessionId: string;
  isComplete: boolean;
  conceptsCovered?: string[];
  suggestedNextAction?: string;
}

export interface TutorEvaluation {
  isCorrect: boolean;
  confidence: number;
  feedback: string;
  conceptsIdentified: string[];
  suggestedHintLevel: HintLevel;
  // Kết quả ghi nhận hoạt động học (để UI hiện XP/streak từ server).
  activity?: {
    recorded: boolean;
    alreadyRecorded?: boolean;
    xpEarned: number;
    streak: { current: number; longest: number };
  };
}

// Hash ổn định câu hỏi+đáp án để dedup submit lặp lại (chống farm XP
// bằng cách gửi đi gửi lại cùng 1 đáp án đúng).
function evaluationSourceId(sessionId: string, question: string, userAnswer: string): string {
  const normalized = `${question.trim().toLowerCase()}|${userAnswer.trim().toLowerCase()}`;
  return `eval:${sessionId}:${createHash("sha256").update(normalized).digest("hex").slice(0, 16)}`;
}

// --- 1) CREATE TUTOR SESSION ---
export async function createTutorSession(params: {
  userId: string;
  topic: string;
  subject?: string;
  mode?: "socratic" | "explanation" | "practice";
  initialDifficulty?: number;
}): Promise<TutorSessionData> {
  const session = await prisma.tutorSession.create({
    data: {
      userId: params.userId,
      topic: params.topic,
      subject: params.subject,
      mode: params.mode || "socratic",
      difficulty: params.initialDifficulty ?? 0.5,
    },
  });

  return session;
}

// --- 2) SEND TUTOR MESSAGE (SOCRATIC MODE) ---
export async function sendTutorMessage(params: {
  userId: string;
  topic: string;
  userMessage: string;
  hintLevel: HintLevel;
  sessionId?: string;
}): Promise<TutorResponse> {
  const { userId, topic, userMessage, hintLevel, sessionId } = params;

  // Get or create session
  let session: TutorSessionData;
  if (sessionId) {
    const existing = await prisma.tutorSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!existing) throw new Error("Session not found");
    session = existing;
  } else {
    session = await createTutorSession({ userId, topic });
  }

  // Get conversation history
  const conversation = await getOrCreateConversation(userId, topic);
  const history = (conversation.messages as unknown as ChatMessage[]) ?? [];

  // Add user message to history
  const updatedHistory: ChatMessage[] = [
    ...history,
    { role: "user", content: userMessage, hintLevel },
  ];

  // Build system prompt based on hint level
  const systemPrompt = buildSocraticPrompt(topic, hintLevel);

  // Get recent context
  const recentContext = updatedHistory
    .slice(-8)
    .map((m) => `${m.role === "user" ? "Học sinh" : "AI"}: ${m.content}`)
    .join("\n");

  // Generate AI response
  const reply = await generateText({
    systemPrompt,
    userPrompt: recentContext,
  });

  // Update history
  updatedHistory.push({ role: "assistant", content: reply, hintLevel });

  // Update conversation
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { messages: updatedHistory as unknown as object },
  });

  // Update session stats
  if (hintLevel > 0) {
    await prisma.tutorSession.update({
      where: { id: session.id },
      data: { hintsUsed: { increment: 1 } },
    });
  }

  // Check if session should complete (e.g., user understands concept)
  const isComplete = hintLevel === 3 && userMessage.toLowerCase().includes("hiểu") || 
                     hintLevel === 5 || 
                     (hintLevel >= 4 && reply.toLowerCase().includes("đúng"));

  if (isComplete) {
    await prisma.tutorSession.update({
      where: { id: session.id },
      data: { completedAt: new Date() },
    });

    // Record learning activity
    await recordLearningActivity({
      userId,
      type: "tutor_session_completed",
      difficulty: session.difficulty < 0.33 ? "easy" : session.difficulty < 0.66 ? "medium" : "hard",
      isFirstCompletion: true,
      sourceId: session.id,
      sourceType: "tutor",
    });
  }

  // Extract concepts covered from reply
  const conceptsCovered = extractConcepts(reply, topic);

  return {
    reply,
    hintLevel,
    sessionId: session.id,
    isComplete,
    conceptsCovered,
    suggestedNextAction: isComplete ? "practice" : "continue",
  };
}

// --- 3) EVALUATE USER ANSWER ---
export async function evaluateUserAnswer(params: {
  userId: string;
  sessionId: string;
  question: string;
  userAnswer: string;
  expectedConcepts?: string[];
}): Promise<TutorEvaluation> {
  const session = await prisma.tutorSession.findFirst({
    where: { id: params.sessionId, userId: params.userId },
  });
  if (!session) throw new Error("Session not found");

  // Build evaluation prompt
  const prompt = buildTutorEvaluationPrompt({
    topic: session.topic!,
    question: params.question,
    userAnswer: params.userAnswer,
    expectedConcepts: params.expectedConcepts,
  });

  const evaluation = await generateJSON<TutorEvaluation>({
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
    jsonMode: true,
  });

  // Update session stats based on evaluation
  if (evaluation.isCorrect) {
    await prisma.tutorSession.update({
      where: { id: session.id },
      data: { correctAnswers: { increment: 1 } },
    });

    // Ghi nhận hoạt động học cho đáp án ĐÚNG — IDEMPOTENT theo
    // (session, câu hỏi, đáp án): submit lặp lại cùng nội dung không
    // tạo thêm XP/streak. Trước đây evaluate KHÔNG record gì nên streak
    // không bao giờ cập nhật sau Tutor test (root cause Problem 4).
    const sourceId = evaluationSourceId(session.id, params.question, params.userAnswer);
    const existing = await prisma.xPTransaction.findFirst({
      where: { userId: params.userId, sourceType: "tutor_evaluation", sourceId },
      select: { id: true },
    });
    if (existing) {
      const streak = await getCurrentStreak(params.userId);
      evaluation.activity = {
        recorded: false,
        alreadyRecorded: true,
        xpEarned: 0,
        streak: { current: streak.current, longest: streak.longest },
      };
    } else {
      const result = await recordLearningActivity({
        userId: params.userId,
        type: "tutor_session_completed",
        difficulty: "medium",
        scorePercent: 100,
        isFirstCompletion: true,
        sourceId,
        sourceType: "tutor_evaluation",
      });
      evaluation.activity = {
        recorded: true,
        xpEarned: result.xpEarned,
        streak: result.streakUpdated,
      };
    }
  } else {
    await prisma.tutorSession.update({
      where: { id: session.id },
      data: { incorrectAnswers: { increment: 1 } },
    });
  }

  // Adjust difficulty based on performance
  const recentSessions = await prisma.tutorSession.findMany({
    where: { userId: params.userId },
    orderBy: { startedAt: "desc" },
    take: 5,
  });
  
  const recentCorrect = recentSessions.reduce((sum, s) => sum + s.correctAnswers, 0);
  const recentIncorrect = recentSessions.reduce((sum, s) => sum + s.incorrectAnswers, 0);
  const recentAccuracy = recentCorrect + recentIncorrect > 0 
    ? recentCorrect / (recentCorrect + recentIncorrect) 
    : 0.5;

  let newDifficulty = session.difficulty;
  if (recentAccuracy > 0.85) newDifficulty = Math.min(1, session.difficulty + 0.1);
  else if (recentAccuracy < 0.5) newDifficulty = Math.max(0.1, session.difficulty - 0.1);

  if (newDifficulty !== session.difficulty) {
    await prisma.tutorSession.update({
      where: { id: session.id },
      data: { difficulty: newDifficulty },
    });
  }

  return evaluation;
}

// --- 4) GET NEXT HINT ---
export async function getNextHint(params: {
  userId: string;
  sessionId: string;
  currentHintLevel: HintLevel;
}): Promise<{ reply: string; newHintLevel: HintLevel }> {
  const newHintLevel = Math.min(params.currentHintLevel + 1, 5) as HintLevel;
  
  const session = await prisma.tutorSession.findFirst({
    where: { id: params.sessionId, userId: params.userId },
  });
  if (!session) throw new Error("Session not found");

  // Get conversation for context
  const conversation = await getOrCreateConversation(params.userId, session.topic!);
  const history = (conversation.messages as unknown as ChatMessage[]) ?? [];
  const updatedHistory: ChatMessage[] = [...history];

  const systemPrompt = buildSocraticPrompt(session.topic!, newHintLevel);
  const recentContext = history
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Học sinh" : "AI"}: ${m.content}`)
    .join("\n");

  const reply = await generateText({
    systemPrompt,
    userPrompt: recentContext,
  });

  // Update history
  updatedHistory.push({ role: "assistant", content: reply, hintLevel: newHintLevel });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { messages: updatedHistory as unknown as object },
  });

  // Update hints used
  await prisma.tutorSession.update({
    where: { id: params.sessionId },
    data: { hintsUsed: { increment: 1 } },
  });

  return { reply, newHintLevel };
}

// --- 5) COMPLETE TUTOR SESSION ---
export async function completeTutorSession(params: {
  userId: string;
  sessionId: string;
}): Promise<TutorSessionData> {
  const session = await prisma.tutorSession.update({
    where: { id: params.sessionId, userId: params.userId },
    data: { completedAt: new Date() },
  });

  return session;
}

// --- HELPER: GET OR CREATE CONVERSATION ---
async function getOrCreateConversation(userId: string, topic: string) {
  const existing = await prisma.conversation.findFirst({
    where: { userId, topic },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: { userId, topic, messages: [] as unknown as object },
  });
}

// --- HELPER: EXTRACT CONCEPTS ---
function extractConcepts(reply: string, topic: string): string[] {
  // Simple keyword extraction - can be enhanced with AI
  const commonConcepts = [
    "function", "variable", "loop", "condition", "array", "object",
    "algorithm", "complexity", "recursion", "dynamic programming",
    "graph", "tree", "hash", "sort", "search", "pointer",
    "memory", "pointer", "reference", "value", "type"
  ];
  
  const found = commonConcepts.filter(c => 
    reply.toLowerCase().includes(c.toLowerCase())
  );
  
  return found.length > 0 ? found : [topic];
}