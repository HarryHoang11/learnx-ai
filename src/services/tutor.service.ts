// ================================================================
// TUTOR SERVICE
// ================================================================
// Mạch tư duy: service này chỉ làm 2 việc — (1) đọc/ghi lịch sử chat
// vào bảng Conversation, và (2) gọi AI với đúng system prompt theo
// hintLevel hiện tại (logic Socratic thật sự nằm ở lib/ai/prompts.ts,
// KHÔNG lặp lại ở đây, để tránh 2 nơi cùng quyết định "AI nên nói gì").
// ================================================================

import { generateText } from "@/lib/ai/gemini";
import { buildTutorSystemPrompt } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db/prisma";
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
  hintLevel: 0 | 1 | 2 | 3;
}): Promise<{ reply: string; conversationId: string }> {
  const conversation = await getOrCreateConversation(params.userId, params.topic);
  const history = (conversation.messages as unknown as ChatMessage[]) ?? [];

  // Thêm tin nhắn của học sinh vào lịch sử TRƯỚC khi gọi AI, để nếu
  // AI lỗi giữa chừng thì tin nhắn học sinh vẫn không bị mất khi họ
  // load lại trang.
  const updatedHistory: ChatMessage[] = [
    ...history,
    { role: "user", content: params.userMessage, hintLevel: params.hintLevel },
  ];

  const systemPrompt = buildTutorSystemPrompt(params.topic, params.hintLevel);

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
