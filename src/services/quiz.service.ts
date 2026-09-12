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
import type { Difficulty, GeneratedQuestion } from "@/types";

interface RawQuestionFromAI {
  text: string;
  options: string[];
  correctIndex: number;
}

// Sinh 1 câu hỏi quiz bằng AI theo (subject, topic, difficulty).
// Trả về kèm "id" tạm (không lưu DB ở bước này) — DB chỉ ghi nhận khi
// học sinh THỰC SỰ trả lời (xem submitQuizAnswer), tránh rác dữ liệu
// từ những câu AI sinh ra nhưng học sinh chưa làm.
export async function generateQuizQuestion(
  userId: string,
  subject: string,
  topic: string,
  difficulty: Difficulty
): Promise<GeneratedQuestion> {
  const prompt = buildQuestionGenPrompt(subject, topic, difficulty);
  const raw = await generateJSON<RawQuestionFromAI>({
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
  });

  const question: GeneratedQuestion = {
    id: crypto.randomUUID(),
    text: raw.text,
    options: raw.options,
    correctIndex: raw.correctIndex,
    difficulty,
    subject,
    topic,
  };

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
}): Promise<{ isCorrect: boolean }> {
  // Server-side verification: look up the cached question to verify
  // the correctIndex. This prevents cheating by modifying the
  // client-side question object.
  const cached = await prisma.quizQuestionCache.findUnique({
    where: { questionId: params.questionId },
  });

  if (!cached || cached.userId !== params.userId) {
    throw new Error("Question not found or not authorized");
  }

  const isCorrect = params.selectedIndex === cached.correctIndex;

  await prisma.attempt.create({
    data: {
      userId: params.userId,
      assessmentId: null, // null vì đây là quiz luyện tập, không thuộc phiên diagnostic nào
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
  });

  // Delete the cached question after use (one-shot)
  await prisma.quizQuestionCache.delete({
    where: { questionId: params.questionId },
  });

  return { isCorrect };
}
