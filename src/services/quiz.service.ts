// ================================================================
// QUIZ SERVICE
// ================================================================
// Mạch tư duy: khác với Assessment (bài kiểm tra thích ứng ban đầu),
// Quiz là bài LUYỆN TẬP học sinh chủ động chọn chủ đề để làm thêm.
// Vẫn dùng chung bảng Attempt + updateMastery() từ assessment.service
// (KHÔNG viết lại logic cập nhật mastery ở đây) — chỉ khác ở chỗ
// Quiz không có assessmentId (xem field optional trong schema).
// ================================================================

import { generateJSON } from "@/lib/ai/router";
import { buildQuestionGenPrompt } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db/prisma";
import { updateMastery } from "@/services/assessment.service";
import { recordLearningActivity } from "@/services/learning-activity.service";
import { syncRoadmapAfterMastery } from "@/services/roadmap.service";
import { createReviewFromMistake } from "@/services/spaced-repetition.service";
import type { Difficulty, GeneratedQuestion, PublicQuestion } from "@/types";

interface RawQuestionFromAI {
  text: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

const DIFFICULTIES = new Set<Difficulty>(["easy", "medium", "hard"]);

export class QuizQuestionError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400) {
    super(message);
    this.name = "QuizQuestionError";
  }
}

function requireNonEmptyText(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new QuizQuestionError(`AI trả về ${field} không hợp lệ.`);
  }

  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new QuizQuestionError(`AI trả về ${field} không hợp lệ.`);
  }
  return normalized;
}

function normalizeGeneratedQuestion(raw: RawQuestionFromAI, input: {
  subject: string;
  topic: string;
  difficulty: Difficulty;
}): GeneratedQuestion {
  const text = requireNonEmptyText(raw?.text, "nội dung câu hỏi", 8_000);
  if (!Array.isArray(raw?.options) || raw.options.length < 2 || raw.options.length > 8) {
    throw new QuizQuestionError("AI trả về các lựa chọn không hợp lệ.");
  }

  const options = raw.options.map((option) => requireNonEmptyText(option, "lựa chọn", 1_000));
  if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) {
    throw new QuizQuestionError("AI trả về các lựa chọn bị trùng.");
  }
  if (!Number.isInteger(raw.correctIndex) || raw.correctIndex < 0 || raw.correctIndex >= options.length) {
    throw new QuizQuestionError("AI trả về đáp án đúng không hợp lệ.");
  }

  // Explanation là "nice to have" cho mistake analysis — không chặn
  // sinh câu hỏi nếu AI thi thoảng bỏ sót, chỉ fallback text chung.
  const rawExplanation = typeof raw?.explanation === "string" ? raw.explanation.trim() : "";
  const explanation = rawExplanation && rawExplanation.length <= 2_000
    ? rawExplanation
    : `Đáp án đúng là "${options[raw.correctIndex]}".`;

  return {
    id: crypto.randomUUID(),
    text,
    options,
    correctIndex: raw.correctIndex,
    difficulty: input.difficulty,
    subject: input.subject,
    topic: input.topic,
    explanation,
  };
}

export function toPublicQuestion(question: GeneratedQuestion): PublicQuestion {
  const { correctIndex: _correctIndex, explanation: _explanation, ...publicQuestion } = question;
  return publicQuestion;
}

// Sinh 1 câu hỏi quiz bằng AI theo (subject, topic, difficulty).
// Trả về kèm "id" tạm (không lưu DB ở bước này) — DB chỉ ghi nhận khi
// học sinh THỰC SỰ trả lời (xem submitQuizAnswer), tránh rác dữ liệu
// từ những câu AI sinh ra nhưng học sinh chưa làm.
export async function generateQuizQuestion(
  userId: string,
  subject: string,
  topic: string,
  difficulty: Difficulty,
  sourceDocumentId?: string
): Promise<GeneratedQuestion> {
  const normalizedSubject = requireNonEmptyText(subject, "môn học", 120);
  const normalizedTopic = requireNonEmptyText(topic, "chủ đề", 160);
  if (!DIFFICULTIES.has(difficulty)) {
    throw new QuizQuestionError("Độ khó không hợp lệ.");
  }

  let sourceContext: string | undefined;
  if (sourceDocumentId) {
    const source = await prisma.document.findFirst({
      where: { id: sourceDocumentId, userId, status: "ready" },
      select: { summary: true },
    });
    if (!source) throw new QuizQuestionError("Nguồn học không tồn tại hoặc chưa sẵn sàng.", 404);
    sourceContext = source.summary ?? undefined;
  }
  const prompt = buildQuestionGenPrompt(normalizedSubject, normalizedTopic, difficulty, sourceContext);
  const question = await generateJSON<GeneratedQuestion>(
    {
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
    },
    (value) => normalizeGeneratedQuestion(value as RawQuestionFromAI, {
      subject: normalizedSubject,
      topic: normalizedTopic,
      difficulty,
    })
  );

  // Cache the question server-side so the correctIndex can be
  // verified independently when the user submits their answer.
  // Old cached questions are cleaned up automatically by the TTL
  // via the background job, but we also clean up during generation.
  await prisma.quizQuestionCache.create({
    data: {
      userId,
      questionId: question.id,
      subject: question.subject,
      topic: question.topic,
      difficulty: question.difficulty,
      questionText: question.text,
      options: question.options,
      correctIndex: question.correctIndex,
      explanation: question.explanation,
      sourceDocumentId: sourceDocumentId ?? null,
    },
  });

  // Clean up expired cache entries (> 24 hours old)
  const expiry = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.quizQuestionCache.deleteMany({
    where: { createdAt: { lt: expiry } },
  });

  return question;
}

// Ghi nhận câu trả lời của học sinh: lưu Attempt + cập nhật mastery.
// Đây là điểm chạm DUY NHẤT giữa "học sinh làm quiz" và "hồ sơ năng
// lực" — nếu sau này thêm loại bài tập mới (vd flashcard tự chấm),
// chỉ cần gọi lại đúng 2 hàm này (prisma.attempt.create + updateMastery).
export async function submitQuizAnswer(params: {
  userId: string;
  questionId: string;
  selectedIndex: number;
  assessmentId?: string | null;
}): Promise<{
  attemptId: string;
  isCorrect: boolean;
  subject: string;
  topic: string;
  difficulty: string;
  xpEarned: number;
  correctIndex: number;
  correctAnswer: string;
  explanation: string | null;
}> {
  // Server-side verification: look up the cached question to verify
  // the correctIndex. This prevents cheating by modifying the
  // client-side question object.
  const cached = await prisma.quizQuestionCache.findFirst({
    where: { questionId: params.questionId, userId: params.userId },
  });

  if (!cached) {
    throw new QuizQuestionError("Câu hỏi không tồn tại, đã hết hạn hoặc không thuộc về bạn.", 404);
  }

  // Claim the cache row before grading. Concurrent/replayed requests can
  // both read it, but exactly one can delete it and create an attempt.
  const isCorrect = params.selectedIndex === cached.correctIndex;

  const attempt = await prisma.$transaction(async (tx) => {
    const claim = await tx.quizQuestionCache.deleteMany({
      where: { id: cached.id, userId: params.userId },
    });
    if (claim.count !== 1) {
      throw new QuizQuestionError("Câu trả lời này đã được ghi nhận.", 409);
    }

    const createdAttempt = await tx.attempt.create({
      data: {
        userId: params.userId,
        assessmentId: params.assessmentId ?? null,
        subject: cached.subject,
        topic: cached.topic,
        difficulty: cached.difficulty,
        question: cached.questionText,
        isCorrect,
      },
    });

    await updateMastery({
      userId: params.userId,
      subject: cached.subject,
      topic: cached.topic,
      isCorrect,
    }, tx);

    return createdAttempt;
  });

  let xpEarned = 0;
  try {
    const activity = await recordLearningActivity({
      userId: params.userId,
      type: isCorrect
        ? cached.difficulty === "easy"
          ? "exercise_easy"
          : cached.difficulty === "hard"
            ? "exercise_hard"
            : "exercise_medium"
        : "quiz_complete",
      difficulty: cached.difficulty === "easy" || cached.difficulty === "hard" ? cached.difficulty : "medium",
      scorePercent: isCorrect ? 100 : 0,
      isFirstCompletion: true,
      sourceId: params.questionId,
      sourceType: "quiz_question",
    });
    xpEarned = activity.xpEarned;
  } catch (activityError) {
    console.error("[quiz] Không thể ghi nhận XP/LXP cho câu hỏi:", activityError);
  }

  // Ghi MistakeLog khi trả lời sai — best-effort, KHÔNG được để lỗi ở
  // đây làm hỏng kết quả chấm bài đã lưu thành công ở transaction trên
  // (cùng nguyên tắc với khối XP/LXP phía trên).
  const options = Array.isArray(cached.options) ? (cached.options as unknown as string[]) : [];
  const correctAnswer = options[cached.correctIndex] ?? "";
  if (!isCorrect) {
    try {
      await prisma.mistakeLog.create({
        data: {
          userId: params.userId,
          subject: cached.subject,
          topic: cached.topic,
          questionText: cached.questionText,
          selectedAnswer: options[params.selectedIndex] ?? `#${params.selectedIndex}`,
          correctAnswer,
          explanation: cached.explanation,
          sourceDocumentId: cached.sourceDocumentId,
        },
      });
    } catch (mistakeError) {
      console.error("[quiz] Không thể ghi MistakeLog:", mistakeError);
    }

    // Tự tạo Review item (spaced repetition) từ đúng câu vừa sai — đây
    // là nguồn nội dung DUY NHẤT hiện có cho trang /review (trước đây
    // không có gì tự động tạo ReviewItem, nên /review luôn trống).
    // Dedup theo (userId, topic, sourceType, sourceId) nằm sẵn trong
    // createReviewItem() — trả lời sai CÙNG 1 câu nhiều lần chỉ cập
    // nhật lại 1 review item, không tạo trùng. Best-effort, không
    // chặn kết quả chấm bài nếu lỗi.
    try {
      await createReviewFromMistake({
        userId: params.userId,
        subject: cached.subject,
        topic: cached.topic,
        question: cached.questionText,
        userAnswer: options[params.selectedIndex] ?? `#${params.selectedIndex}`,
        correctAnswer,
        explanation: cached.explanation ?? `Đáp án đúng là "${correctAnswer}".`,
        sourceType: "quiz",
        sourceId: cached.questionId,
      });
    } catch (reviewError) {
      console.error("[quiz] Không thể tạo Review item từ câu sai:", reviewError);
    }
  }

  // Đồng bộ Roadmap khi mastery vừa đổi — best-effort, cùng nguyên
  // tắc với XP/LXP và MistakeLog ở trên. Chỉ cần thử khi CÂU NÀY
  // ĐÚNG (mastery chỉ có thể tăng lên ngưỡng "vững" sau 1 câu đúng,
  // không cần tốn 1 query khi biết chắc sẽ không có gì thay đổi).
  if (isCorrect) {
    try {
      await syncRoadmapAfterMastery(params.userId, cached.subject, cached.topic);
    } catch (roadmapError) {
      console.error("[quiz] Không thể đồng bộ Roadmap:", roadmapError);
    }
  }

  return {
    attemptId: attempt.id,
    isCorrect,
    subject: cached.subject,
    topic: cached.topic,
    difficulty: cached.difficulty,
    xpEarned,
    correctIndex: cached.correctIndex,
    correctAnswer,
    explanation: cached.explanation,
  };
}
