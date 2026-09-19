// ================================================================
// <ChatBubble /> — 1 tin nhắn trong khung chat AI Tutor
// ================================================================
// Mạch tư duy: tách khỏi page.tsx vì đây là đơn vị hiển thị lặp lại
// nhiều lần trong 1 danh sách (chat log) — tách component giúp trang
// Tutor chỉ lo state/logic gọi API, không lẫn lộn với chi tiết style
// từng bong bóng chat.
//
// Tin nhắn AI render qua MarkdownLite (HỆ THỐNG markdown duy nhất,
// dùng chung với tóm tắt tài liệu — KHÔNG tạo renderer thứ hai):
// headings/bold/italic/list/code/quote/table + công thức KaTeX.
// Tin nhắn user giữ text thuần để phản ánh đúng điều đã gõ.
// ================================================================

import MarkdownLite from "@/components/documents/MarkdownLite";

interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  tag?: string; // vd "AI GIA SƯ", "GỢI Ý" — nhãn nhỏ phía trên nội dung
}

export default function ChatBubble({ role, content, tag }: ChatBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      style={{
        maxWidth: "78%",
        alignSelf: isUser ? "flex-end" : "flex-start",
        padding: "12px 15px",
        borderRadius: 14,
        fontSize: 14,
        lineHeight: 1.55,
        background: isUser ? "var(--indigo-soft)" : "var(--panel-strong)",
        border: isUser ? "1px solid rgba(124,108,240,0.3)" : "1px solid var(--border)",
        // `pre-wrap` chỉ đúng cho tin nhắn USER (text thuần, giữ
        // nguyên dấu xuống dòng người dùng đã gõ). Áp lên CẢ nhánh AI
        // (đã qua MarkdownLite -> HTML thật, có <p>/<br>/list riêng)
        // là bug: 2 cơ chế xuống dòng chồng lên nhau (literal "\n" từ
        // pre-wrap + block element của HTML) gây sai line-height đoạn
        // văn xen công thức toán, và xung đột với `white-space: nowrap`
        // của .math-inline (globals.css) — đúng loại "conflicting
        // white-space" cần audit. Nhánh AI để mặc định "normal", để
        // HTML/KaTeX tự kiểm soát spacing.
        whiteSpace: isUser ? "pre-wrap" : "normal",
      }}
    >
      {tag && (
        <span style={{ fontSize: 10.5, color: "var(--cyan)", fontWeight: 600, display: "block", marginBottom: 5 }}>
          {tag}
        </span>
      )}
      {/* Tin nhắn AI đi qua MarkdownLite (markdown + KaTeX); tin nhắn
          user giữ text thường để phản ánh đúng điều user đã gõ. */}
      {isUser ? content : <MarkdownLite content={content} />}
    </div>
  );
}
