// ================================================================
// TUTOR SERVICE
// ================================================================
// Mạch tư duy: service này chỉ làm 2 việc — (1) đọc/ghi lịch sử chat
// vào bảng Conversation, và (2) gọi AI với đúng system prompt theo
// hintLevel hiện tại (logic Socratic thật sự nằm ở lib/ai/prompts.ts,
// KHÔNG lặp lại ở đây, để tránh 2 nơi cùng quyết định "AI nên nói gì").
// ================================================================

import { generateText } from "@/lib/ai/router";
import { buildSocraticPrompt } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db/prisma";
import { getLearningContext } from "@/services/personalization.service";
import { prefersNoDirectAnswer } from "@/lib/personalization/context";
import type { ChatMessage } from "@/types";

// Lấy hội thoại hiện tại của user (tạo mới nếu chưa có) — MVP đơn
// giản hoá thành "mỗi user có 1 conversation đang mở cho mỗi topic",
// thay vì hỗ trợ nhiều thread song song (có thể mở rộng sau).
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

export async function sendTutorMessage(params: {
  userId: string;
  topic: string;
  userMessage: string;
  hintLevel: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  language?: "vi" | "en";
}): Promise<{ reply: string; conversationId: string }> {
  const conversation = await getOrCreateConversation(params.userId, params.topic);
  const history = (conversation.messages as unknown as ChatMessage[]) ?? [];
  const [activeGoal, topicProgress] = await Promise.all([
    prisma.learningGoal.findFirst({
      where: { userId: params.userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      select: { title: true, subject: true, targetOutcome: true },
    }),
    prisma.learningProgress.findMany({
      where: { userId: params.userId, topic: { contains: params.topic, mode: "insensitive" } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { subject: true, topic: true, mastery: true, attempts: true },
    }),
  ]);

  // Thêm tin nhắn của học sinh vào lịch sử TRƯỚC khi gọi AI, để nếu
  // AI lỗi giữa chừng thì tin nhắn học sinh vẫn không bị mất khi họ
  // load lại trang.
  const updatedHistory: ChatMessage[] = [
    ...history,
    { role: "user", content: params.userMessage, hintLevel: params.hintLevel },
  ];

  const learningContext = `\n\nNGỮ CẢNH HỌC TẬP THẬT:
- Mục tiêu hiện tại: ${activeGoal?.title ?? "chưa đặt mục tiêu"}
- Môn: ${activeGoal?.subject ?? "chưa xác định"}
- Kết quả mong muốn: ${activeGoal?.targetOutcome ?? "chưa xác định"}
- Hồ sơ chủ đề: ${topicProgress.length > 0 ? topicProgress.map((item) => `${item.subject}/${item.topic}: ${Math.round(item.mastery * 100)}% sau ${item.attempts} lượt`).join("; ") : "chưa có dữ liệu"}
Hãy điều chỉnh ví dụ và mức độ giải thích theo ngữ cảnh này, nhưng không bịa số liệu ngoài dữ liệu được cung cấp.`;

  // ---- NGỮ CẢNH CÁ NHÂN HOÁ (Learning Profile) ----
  // Đây là chỗ hồ sơ onboarding trở thành HÀNH VI THẬT của AI. Khối ngữ cảnh
  // đến từ getLearningContext() (dùng chung với Diagnostic/Roadmap) nên đổi
  // 1 tuỳ chọn trong Account là Tutor đổi hành vi ngay ở lượt chat kế tiếp.
  //
  // best-effort: hồ sơ lỗi KHÔNG được làm hỏng Tutor — học sinh vẫn cần gia sư
  // dù không đọc được hồ sơ.
  let profileContext = "";
  let aiPreferences: string[] = [];
  try {
    const context = await getLearningContext(params.userId, { language: params.language });
    aiPreferences = context.summary.aiPreferences;
    if (context.prompt) profileContext = `\n\nHỒ SƠ NGƯỜI DÙNG (tự khai, dùng để điều chỉnh cách dạy):\n${context.prompt}`;
  } catch (err) {
    console.warn("[tutor] Không dựng được ngữ cảnh hồ sơ:", err);
  }

  // Quy tắc CỨNG dè lên mặc định: nếu user chọn "không đưa đáp án ngay" thì
  // kể cả hintLevel = 6 (cấp "lời giải đầy đủ" mặc định) cũng KHÔNG được đưa
  // đáp án — vì đó chính là điều họ đã yêu cầu ở onboarding.
  const blockFinalAnswer =
    prefersNoDirectAnswer(aiPreferences) && params.hintLevel === 6
      ? `\n\nLƯU Ý QUAN TRỌNG: người dùng đã chọn "không đưa đáp án ngay" trong hồ sơ học tập.
Dù cấp độ gợi ý là 6, KHÔNG được đưa lời giải hoàn chỉnh. Hãy đưa gợi ý mạnh nhất
vẫn dừng trước bước kết luận, rồi hỏi học sinh tự hoàn thiện.`
      : "";

  const systemPrompt =
    buildSocraticPrompt(params.topic, params.hintLevel, params.language === "en" ? "en" : "vi") +
    learningContext +
    profileContext +
    blockFinalAnswer;

  // Truyền vài lượt hội thoại gần nhất làm ngữ cảnh (không truyền cả
  // lịch sử để tránh vượt giới hạn token) — 6 tin nhắn gần nhất là đủ
  // cho 1 luồng hỏi-đáp-gợi ý thông thường.
  const recentContext = updatedHistory
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Học sinh" : "AI"}: ${m.content}`)
    .join("\n");

  const reply = await generateText({
    systemPrompt,
    userPrompt: recentContext,
  });

  updatedHistory.push({ role: "assistant", content: reply });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { messages: updatedHistory as unknown as object },
  });

  return { reply, conversationId: conversation.id };
}
