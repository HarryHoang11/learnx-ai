// ================================================================
// DIAGNOSTIC SERVICE — Adaptive AI Diagnostic Test
// ================================================================
// Mạch tư duy: đây là "bộ não" của tính năng Diagnostic Test.
// 3 trách nhiệm chính:
//   1) generateDiagnosticQuestions() — sinh câu hỏi diagnostic dựa trên subject/topic/goal
//   2) pickNextDifficulty() — logic ADAPTIVE: câu tiếp theo nên khó/hay dễ hơn
//   3) evaluateDiagnosticResult() — đánh giá kết quả và cập nhật LearningProgress
// Route (api/diagnostic/*) KHÔNG được tự viết logic này — mọi thay đổi
// chỉ sửa Ở ĐÂY, một chỗ duy nhất.
// ================================================================

import { prisma } from "@/lib/db/prisma";
import { generateJSON } from "@/lib/ai/router";
import { buildDiagnosticPrompt } from "@/lib/ai/prompts";
import { updateMastery, WEAK_THRESHOLD_PERCENT } from "@/services/assessment.service";
import { recordLearningActivity } from "@/services/learning-activity.service";
import type { Difficulty, GeneratedQuestion } from "@/types";

export interface DiagnosticConfig {
  subject: string;
  topic?: string;
  goal?: string;
  questionCount?: number;
}

export interface DiagnosticQuestion {
  id: string;
  text: string;
  type: "multiple_choice" | "short_answer" | "code_reasoning" | "debugging" | "conceptual" | "problem_solving";
  difficulty: Difficulty;
  subject: string;
  topic: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  concepts?: string[];
}

export interface DiagnosticResult {
  overallScore: number;
  skillBreakdown: Array<{
    topic: string;
    score: number;
    level: "weak" | "developing" | "good" | "mastered";
    confidence: number;
  }>;
  recommendedTopics: string[];
  prerequisites: string[];
}

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];
const MAX_QUESTIONS = 15;
const MIN_QUESTIONS = 5;

// --- 1) ADAPTIVE BRANCHING ---
export function pickNextDifficulty(current: Difficulty, wasCorrect: boolean): Difficulty {
  const idx = DIFFICULTY_ORDER.indexOf(current);
  if (wasCorrect) {
    const nextIdx = Math.min(idx + 1, DIFFICULTY_ORDER.length - 1);
    return DIFFICULTY_ORDER[nextIdx];
  }
  const prevIdx = Math.max(idx - 1, 0);
  return DIFFICULTY_ORDER[prevIdx];
}

// --- 2) GENERATE DIAGNOSTIC QUESTIONS ---
export async function generateDiagnosticQuestions(config: DiagnosticConfig): Promise<DiagnosticQuestion[]> {
  const count = Math.min(Math.max(config.questionCount ?? 10, MIN_QUESTIONS), MAX_QUESTIONS);
  
  const prompt = buildDiagnosticPrompt({
    subject: config.subject,
    topic: config.topic,
    goal: config.goal,
    questionCount: count,
  });

  const result = await generateJSON<{ questions: DiagnosticQuestion[] }>({
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
    jsonMode: true,
  });

  // Validate and ensure each question has required fields
  return result.questions.map((q, i) => ({
    id: q.id || `q-${i + 1}`,
    text: q.text,
    type: q.type || "multiple_choice",
    difficulty: q.difficulty || "medium",
    subject: q.subject || config.subject,
    topic: q.topic || config.topic || "General",
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    concepts: q.concepts,
  }));
}

// --- 3) EVALUATE DIAGNOSTIC RESULT ---
export async function evaluateDiagnosticResult(params: {
  userId: string;
  diagnosticSessionId: string;
  answers: Array<{ questionId: string; answer: string; isCorrect: boolean; difficulty: Difficulty; topic: string }>;
}): Promise<DiagnosticResult> {
  const { userId, diagnosticSessionId, answers } = params;

  // Group answers by topic
  const topicStats = new Map<string, { correct: number; total: number; difficulties: Difficulty[] }>();
  
  for (const ans of answers) {
    const stat = topicStats.get(ans.topic) || { correct: 0, total: 0, difficulties: [] };
    stat.total += 1;
    if (ans.isCorrect) stat.correct += 1;
    stat.difficulties.push(ans.difficulty);
    topicStats.set(ans.topic, stat);
  }

  // Calculate skill breakdown
  const skillBreakdown = Array.from(topicStats.entries()).map(([topic, stat]) => {
    const score = Math.round((stat.correct / stat.total) * 100);
    let level: "weak" | "developing" | "good" | "mastered";
    if (score < 30) level = "weak";
    else if (score < 60) level = "developing";
    else if (score < 80) level = "good";
    else level = "mastered";

    // Confidence based on number of questions and difficulty spread
    const confidence = Math.min(0.9, 0.3 + (stat.total * 0.1) + (stat.difficulties.filter(d => d === "hard").length * 0.1));

    return { topic, score, level, confidence: Math.round(confidence * 100) / 100 };
  });

  // Overall score
  const totalCorrect = answers.filter(a => a.isCorrect).length;
  const overallScore = Math.round((totalCorrect / answers.length) * 100);

  // Identify weak topics for recommended learning
  const weakTopics = skillBreakdown
    .filter(s => s.level === "weak" || s.level === "developing")
    .sort((a, b) => a.score - b.score)
    .map(s => s.topic);

  // Identify prerequisites (topics with very low scores)
  const prerequisites = skillBreakdown
    .filter(s => s.score < 30)
    .map(s => s.topic);

  // Update LearningProgress for each topic
  for (const ans of answers) {
    await updateMastery({
      userId,
      subject: ans.topic.split(" - ")[0] || "General",
      topic: ans.topic,
      isCorrect: ans.isCorrect,
    });
  }

  // Record learning activity
  await recordLearningActivity({
    userId,
    type: "diagnostic_completed",
    difficulty: "medium",
    scorePercent: overallScore,
    isFirstCompletion: true,
    sourceId: diagnosticSessionId,
    sourceType: "diagnostic",
  });

  return {
    overallScore,
    skillBreakdown,
    recommendedTopics: weakTopics,
    prerequisites,
  };
}

// --- 4) CREATE DIAGNOSTIC SESSION ---
export async function createDiagnosticSession(params: {
  userId: string;
  subject: string;
  topic?: string;
  assessmentId?: string;
}): Promise<{ id: string }> {
  const session = await prisma.diagnosticSession.create({
    data: {
      userId: params.userId,
      subject: params.subject,
      topic: params.topic,
      assessmentId: params.assessmentId,
      status: "in_progress",
      currentDifficulty: 0.5,
    },
  });
  return { id: session.id };
}

// --- 5) UPDATE DIAGNOSTIC SESSION ---
export async function updateDiagnosticSession(params: {
  sessionId: string;
  userId: string;
  answeredQuestions?: number;
  correctAnswers?: number;
  currentDifficulty?: number;
  status?: string;
  result?: any;
}): Promise<void> {
  await prisma.diagnosticSession.update({
    where: { id: params.sessionId, userId: params.userId },
    data: {
      answeredQuestions: params.answeredQuestions ?? { increment: 1 },
      correctAnswers: params.correctAnswers ?? { increment: 0 },
      currentDifficulty: params.currentDifficulty,
      status: params.status,
      result: params.result,
      completedAt: params.status === "completed" ? new Date() : undefined,
    },
  });
}