// ================================================================
// <ChatBubble /> — 1 tin nhắn trong khung chat AI Tutor
// ================================================================
// Mạch tư duy: tách khỏi page.tsx vì đây là đơn vị hiển thị lặp lại
// nhiều lần trong 1 danh sách (chat log) — tách component giúp trang
// Tutor chỉ lo state/logic gọi API, không lẫn lộn với chi tiết style
// từng bong bóng chat.
// ================================================================

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
        whiteSpace: "pre-wrap",
      }}
    >
      {tag && (
        <span style={{ fontSize: 10.5, color: "var(--cyan)", fontWeight: 600, display: "block", marginBottom: 5 }}>
          {tag}
        </span>
      )}
      {content}
    </div>
  );
}
