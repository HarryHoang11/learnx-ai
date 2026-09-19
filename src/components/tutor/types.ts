// ================================================================
// TUTOR — kiểu dữ liệu dùng chung cho trang AI Gia sư
// ================================================================
// Tách riêng khỏi page.tsx để các component con (ChatBubble, mode bar,
// side panel) cùng tham chiếu MỘT định nghĩa, tránh lệch kiểu.
// ================================================================

import type { TutorMode } from "@/lib/ai/prompts";

export type { TutorMode };

export interface Citation {
  documentId: string;
  fileName: string;
  pageNumber: number | null;
  chunkIndex: number;
  excerpt: string;
}

export interface AttachedResource {
  id: string;
  title: string;
  type: string;
  url: string | null;
  difficulty: string | null;
  description: string | null;
}

export interface TutorSource {
  id: string;
  fileName: string;
  subject: string | null;
  topic: string | null;
  hasSummary: boolean;
}

export interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  tag?: string;
  mode?: TutorMode;
  // Tin nhắn AI lỗi — UI hiện nút "Thử lại" kèm đúng mode đã dùng.
  failed?: boolean;
  retryMode?: TutorMode;
  resources?: AttachedResource[];
  citations?: Citation[];
  // Nếu true, tin nhắn AI này đang chờ học sinh chọn mức gợi ý tiếp theo
  awaitingHint?: boolean;
}

// Nhãn hiển thị cho 6 chế độ — thứ tự khớp grid 2 cột ở UI.
export const TUTOR_MODE_META: ReadonlyArray<{ mode: TutorMode; label: string; hint: string }> = [
  { mode: "explain", label: "Giải thích", hint: "AI giải thích khái niệm theo trình độ của bạn" },
  { mode: "hint", label: "Gợi ý", hint: "Chỉ gợi ý từng bước, không lộ đáp án" },
  { mode: "askback", label: "Hỏi ngược tôi", hint: "AI đặt câu hỏi để bạn tự suy luận" },
  { mode: "socratic", label: "Socratic mode", hint: "Dẫn dắt từng bước, không đưa đáp án" },
  { mode: "example", label: "Ví dụ", hint: "AI tạo ví dụ tương tự, giải từng bước" },
  { mode: "summary", label: "Tóm tắt", hint: "Tóm tắt kiến thức, công thức, lỗi thường gặp" },
];
