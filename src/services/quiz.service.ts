// ================================================================
// QUIZ SERVICE
// ================================================================
// Mạch tư duy: khác với Assessment (bài kiểm tra thích ứng ban đầu),
// Quiz là bài LUYỆN TẬP học sinh chủ động chọn chủ đề để làm thêm.
// Vẫn dùng chung bảng Attempt + updateMastery() từ assessment.service
// (KHÔNG viết lại logic cập nhật mastery ở đây) — chỉ khác ở chỗ
// Quiz không có assessmentId (xem field optional trong schema).
// ================================================================

import { generateJSON } from "@/lib/ai/gemini";
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
  subject: string,
  topic: string,
  difficulty: Difficulty
): Promise<GeneratedQuestion> {
  const prompt = buildQuestionGenPrompt(subject, topic, difficulty);
  const raw = await generateJSON<RawQuestionFromAI>({
    systemPrompt: prompt.system,
    userPrompt: prompt.user,
  });

  return {
    id: crypto.randomUUID(),
    text: raw.text,
    options: raw.options,
    correctIndex: raw.correctIndex,
    difficulty,
    subject,
    topic,
  };
}

// Ghi nhận câu trả lời của học sinh: lưu Attempt + cập nhật mastery.
// Đây là điểm chạm DUY NHẤT giữa "học sinh làm quiz" và "hồ sơ năng
// lực" — nếu sau này thêm loại bài tập mới (vd flashcard tự chấm),
// chỉ cần gọi lại đúng 2 hàm này (prisma.attempt.create + updateMastery).
export async function submitQuizAnswer(params: {
  userId: string;
  question: GeneratedQuestion;
  selectedIndex: number;
}): Promise<{ isCorrect: boolean }> {
  const isCorrect = params.selectedIndex === params.question.correctIndex;

  await prisma.attempt.create({
    data: {
      userId: params.userId,
      assessmentId: null, // null vì đây là quiz luyện tập, không thuộc phiên diagnostic nào
      subject: params.question.subject,
      topic: params.question.topic,
      difficulty: params.question.difficulty,
      question: params.question.text,
      isCorrect,
    },
  });

  await updateMastery({
    userId: params.userId,
    subject: params.question.subject,
    topic: params.question.topic,
    isCorrect,
  });

  return { isCorrect };
}
