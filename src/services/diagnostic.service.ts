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
import type { Prisma } from "@prisma/client";
import { generateJSON } from "@/lib/ai/router";
import { buildDiagnosticPrompt } from "@/lib/ai/prompts";
import { updateMastery } from "@/services/assessment.service";
import { recordLearningActivity } from "@/services/learning-activity.service";
import { syncRoadmapAfterMastery } from "@/services/roadmap.service";
import type { Difficulty } from "@/types";

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

export interface DiagnosticAnswer {
  questionId: string;
  answer: string;
  isCorrect: boolean;
  difficulty: Difficulty;
  topic: string;
  subject: string;
}

export interface DiagnosticSessionState {
  questions: DiagnosticQuestion[];
  answers: DiagnosticAnswer[];
}

export type PublicDiagnosticQuestion = Omit<DiagnosticQuestion, "correctAnswer">;

const DIFFICULTY_ORDER: Difficulty[] = ["easy", "medium", "hard"];
const MAX_QUESTIONS = 15;
const MIN_QUESTIONS = 5;
const QUESTION_TYPES = new Set<DiagnosticQuestion["type"]>([
  "multiple_choice",
  "short_answer",
  "code_reasoning",
  "debugging",
  "conceptual",
  "problem_solving",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

function normalizeQuestion(value: unknown, index: number, config: DiagnosticConfig): DiagnosticQuestion {
  if (!isRecord(value)) throw new Error("AI trả về một câu diagnostic không hợp lệ.");

  const text = nonEmptyString(value.text, 8_000);
  const correctAnswer = nonEmptyString(value.correctAnswer, 2_000);
  const type = QUESTION_TYPES.has(value.type as DiagnosticQuestion["type"])
    ? (value.type as DiagnosticQuestion["type"])
    : "multiple_choice";
  const difficulty = isDifficulty(value.difficulty) ? value.difficulty : "medium";
  const subject = config.subject;
  const topic = nonEmptyString(value.topic, 160) ?? config.topic ?? "General";
  const id = nonEmptyString(value.id, 120) ?? `q-${index + 1}`;

  if (!text || !correctAnswer) {
    throw new Error("AI trả về nội dung hoặc đáp án diagnostic không hợp lệ.");
  }

  const options = Array.isArray(value.options)
    ? value.options
        .map((option) => nonEmptyString(option, 1_000))
        .filter((option): option is string => option !== null)
    : undefined;
  if (type === "multiple_choice" && (!options || options.length < 2)) {
    throw new Error("AI trả về lựa chọn diagnostic không hợp lệ.");
  }

  const explanation = nonEmptyString(value.explanation, 4_000) ?? undefined;
  const concepts = Array.isArray(value.concepts)
    ? value.concepts
        .map((concept) => nonEmptyString(concept, 160))
        .filter((concept): concept is string => concept !== null)
    : undefined;

  return { id, text, type, difficulty, subject, topic, options, correctAnswer, explanation, concepts };
}

function isDiagnosticQuestion(value: unknown): value is DiagnosticQuestion {
  try {
    normalizeQuestion(value, 0, { subject: "General" });
    return true;
  } catch {
    return false;
  }
}

function isDiagnosticAnswer(value: unknown): value is DiagnosticAnswer {
  return isRecord(value)
    && nonEmptyString(value.questionId, 120) !== null
    && typeof value.answer === "string"
    && typeof value.isCorrect === "boolean"
    && isDifficulty(value.difficulty)
    && nonEmptyString(value.topic, 160) !== null
    && nonEmptyString(value.subject, 120) !== null;
}

export function parseDiagnosticSessionState(value: unknown): DiagnosticSessionState {
  const legacyQuestions = Array.isArray(value) ? value : null;
  const state = isRecord(value) ? value : null;
  const questions = (legacyQuestions ?? (Array.isArray(state?.questions) ? state.questions : []))
    .filter(isDiagnosticQuestion) as DiagnosticQuestion[];
  const answers = (Array.isArray(state?.answers) ? state.answers : [])
    .filter(isDiagnosticAnswer) as DiagnosticAnswer[];
  return { questions, answers };
}

function toQuestionJson(question: DiagnosticQuestion): Prisma.InputJsonObject {
  return {
    id: question.id,
    text: question.text,
    type: question.type,
    difficulty: question.difficulty,
    subject: question.subject,
    topic: question.topic,
    correctAnswer: question.correctAnswer,
    ...(question.options ? { options: question.options } : {}),
    ...(question.explanation ? { explanation: question.explanation } : {}),
    ...(question.concepts ? { concepts: question.concepts } : {}),
  };
}

function toAnswerJson(answer: DiagnosticAnswer): Prisma.InputJsonObject {
  return {
    questionId: answer.questionId,
    answer: answer.answer,
    isCorrect: answer.isCorrect,
    difficulty: answer.difficulty,
    topic: answer.topic,
    subject: answer.subject,
  };
}

export function serializeDiagnosticSessionState(state: DiagnosticSessionState): Prisma.InputJsonObject {
  return {
    questions: state.questions.map(toQuestionJson),
    answers: state.answers.map(toAnswerJson),
  };
}

export function toPublicDiagnosticQuestion(question: DiagnosticQuestion): PublicDiagnosticQuestion {
  const { correctAnswer: _correctAnswer, ...publicQuestion } = question;
  return publicQuestion;
}

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

  return generateJSON<DiagnosticQuestion[]>(
    {
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
    },
    (value) => {
      if (!isRecord(value) || !Array.isArray(value.questions)) {
        throw new Error("AI không trả về danh sách câu diagnostic hợp lệ.");
      }
      const questions = value.questions.map((question, index) => normalizeQuestion(question, index, config));
      if (questions.length < MIN_QUESTIONS || new Set(questions.map((question) => question.id)).size !== questions.length) {
        throw new Error("AI trả về không đủ hoặc trùng câu diagnostic.");
      }
      return questions.slice(0, count);
    }
  );
}

// --- 3) EVALUATE DIAGNOSTIC RESULT ---
export async function evaluateDiagnosticResult(params: {
  userId: string;
  diagnosticSessionId: string;
  answers: Array<{ questionId: string; answer: string; isCorrect: boolean; difficulty: Difficulty; topic: string; subject: string }>;
}): Promise<DiagnosticResult> {
  const { userId, diagnosticSessionId, answers } = params;
  if (answers.length === 0) {
    throw new Error("Không thể đánh giá diagnostic chưa có câu trả lời.");
  }

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
      subject: ans.subject,
      topic: ans.topic,
      isCorrect: ans.isCorrect,
    });
  }

  // Đồng bộ Roadmap sau khi mastery đã cập nhật xong — best-effort,
  // cùng nguyên tắc với quiz/exercise. Khử trùng theo (subject, topic)
  // vì diagnostic có thể hỏi cùng 1 topic nhiều lần trong 1 phiên,
  // không cần sync lặp lại cho cùng 1 cặp.
  const syncedTopics = new Set<string>();
  for (const ans of answers) {
    if (!ans.isCorrect) continue;
    const key = `${ans.subject}::${ans.topic}`;
    if (syncedTopics.has(key)) continue;
    syncedTopics.add(key);
    try {
      await syncRoadmapAfterMastery(userId, ans.subject, ans.topic);
    } catch (roadmapError) {
      console.error("[diagnostic] Không thể đồng bộ Roadmap:", roadmapError);
    }
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
  questions?: DiagnosticQuestion[];
}): Promise<{ id: string }> {
  const session = await prisma.diagnosticSession.create({
    data: {
      userId: params.userId,
      subject: params.subject,
      topic: params.topic,
      assessmentId: params.assessmentId,
      status: "in_progress",
      currentDifficulty: 0.5,
      totalQuestions: params.questions?.length ?? 0,
      questions: params.questions
        ? serializeDiagnosticSessionState({ questions: params.questions, answers: [] })
        : undefined,
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
  result?: Prisma.InputJsonValue;
}): Promise<void> {
  await prisma.diagnosticSession.update({
    where: { id: params.sessionId },
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
