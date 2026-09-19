// ================================================================
// TUTOR CONTEXT SERVICE — nguồn học + câu hỏi gợi ý cho AI Tutor
// ================================================================
// Mạch tư duy: khối "NGUỒN ĐANG DÙNG" và "CÂU HỎI GỢI Ý" ở AI Tutor
// phải lấy dữ liệu THẬT:
//   - sources: tài liệu người dùng đã upload (bảng Document, status=
//     "ready") — chính là nguồn RAG mà tutor dùng để grounding.
//   - suggestedQuestions: sinh bởi AI dựa trên chủ đề + tóm tắt tài
//     liệu + điểm yếu + lỗi gần đây. Nếu AI lỗi (quá tải), trả về câu
//     hỏi suy TRỰC TIẾP từ chủ đề (không phải danh sách cố định cho
//     mọi chủ đề) để UI không bị trống.
// ================================================================

import { prisma } from "@/lib/db/prisma";
import { generateJSON } from "@/lib/ai/router";
import { buildSuggestedQuestionsPrompt } from "@/lib/ai/prompts";

export interface TutorSource {
  id: string;
  fileName: string;
  subject: string | null;
  topic: string | null;
  hasSummary: boolean;
}

// Danh sách nguồn học THẬT của người dùng (chỉ tài liệu đã xử lý xong).
export async function listTutorSources(userId: string): Promise<TutorSource[]> {
  const documents = await prisma.document.findMany({
    where: { userId, status: "ready" },
    orderBy: { uploadedAt: "desc" },
    take: 30,
    select: { id: true, fileName: true, subject: true, topic: true, summary: true },
  });
  return documents.map((d) => ({
    id: d.id,
    fileName: d.fileName,
    subject: d.subject,
    topic: d.topic,
    hasSummary: !!d.summary,
  }));
}

export interface SuggestedContext {
  questions: string[];
  generated: boolean;
}

const MAX_QUESTIONS = 3;

function normalizeQuestions(value: unknown): string[] {
  const raw = value as { questions?: unknown };
  if (!raw || !Array.isArray(raw.questions)) throw new Error("AI không trả về danh sách câu hỏi hợp lệ.");
  const questions = raw.questions
    .map((q) => (typeof q === "string" ? q.trim() : ""))
    .filter((q) => q.length > 0)
    .slice(0, MAX_QUESTIONS);
  if (questions.length === 0) throw new Error("AI không trả về câu hỏi nào hợp lệ.");
  return questions;
}

// Câu hỏi fallback suy TỪ CHỦ ĐỀ — chỉ dùng khi AI không khả dụng, để
// người học vẫn có điểm bắt đầu. Vẫn bám chủ đề, không phải list cứng
// dùng cho mọi trường hợp.
function fallbackQuestions(topic: string): string[] {
  return [
    `Vì sao ${topic} lại quan trọng và nó giải quyết vấn đề gì?`,
    `Cho mình một ví dụ từng bước về ${topic}.`,
    `Lỗi thường gặp nhất khi làm bài về ${topic} là gì?`,
  ];
}

export async function suggestQuestions(params: {
  userId: string;
  topic: string;
  documentId?: string | null;
}): Promise<SuggestedContext> {
  const [weakProgress, recentMistakes, document] = await Promise.all([
    prisma.learningProgress.findMany({
      where: { userId: params.userId },
      orderBy: { mastery: "asc" },
      take: 3,
      select: { subject: true, topic: true },
    }),
    prisma.mistakeLog.findMany({
      where: { userId: params.userId },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { topic: true, questionText: true },
    }),
    params.documentId
      ? prisma.document.findFirst({
          where: { id: params.documentId, userId: params.userId },
          select: { summary: true },
        })
      : Promise.resolve(null),
  ]);

  const prompt = buildSuggestedQuestionsPrompt({
    topic: params.topic,
    documentSummary: document?.summary ?? null,
    weakTopics: weakProgress.map((p) => `${p.subject}/${p.topic}`),
    recentMistakes: recentMistakes.map((m) => m.topic),
  });

  try {
    const questions = await generateJSON<string[]>(
      { systemPrompt: prompt.system, userPrompt: prompt.user, jsonMode: true },
      normalizeQuestions
    );
    return { questions, generated: true };
  } catch (err) {
    // Không log ở mức lỗi nặng để không làm nhiễu log khi AI quá tải —
    // nhưng vẫn ghi để debug được.
    console.warn("[tutor-context] Không sinh được câu hỏi gợi ý, dùng fallback theo chủ đề:", err);
    return { questions: fallbackQuestions(params.topic), generated: false };
  }
}
