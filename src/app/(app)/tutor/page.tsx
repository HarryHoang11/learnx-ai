// ================================================================
// TRANG AI GIA SƯ (Tutor)
// ================================================================
// Mạch tư duy: khác bản demo HTML tĩnh (kịch bản hint được lập trình
// SẴN cho đúng 1 bài mẫu), trang này gọi THẬT /api/ai/chat và
// /api/ai/hint — nghĩa là Gemini trả lời thật theo prompt Socratic đã
// viết ở lib/ai/prompts.ts, hoạt động với BẤT KỲ câu hỏi nào, không
// chỉ bài x²-5x+6=0 mẫu.
//
// State "hintLevel" được giữ Ở CLIENT (không phải server) vì đây là
// UI-state thuần tuý ("học sinh đang muốn xin gợi ý mức mấy cho tin
// nhắn NÀY") — server chỉ cần biết hintLevel tại thời điểm gọi, không
// cần nhớ giữa các lần render.
// ================================================================

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Panel from "@/components/ui/Panel";
import ChatBubble from "@/components/tutor/ChatBubble";
import type { ApiResponse } from "@/types";

// Next.js yêu cầu mọi component dùng useSearchParams() phải nằm trong
// <Suspense>, nếu không sẽ lỗi lúc build (opt toàn trang vào client-side
// rendering không kiểm soát được). Tách TutorPageInner ra để bọc Suspense
// ở component export mặc định, thay vì bọc lẫn vào logic chat bên trong.
export default function TutorPage() {
  return (
    <Suspense fallback={<p className="state-msg">Đang tải...</p>}>
      <TutorPageInner />
    </Suspense>
  );
}

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  tag?: string;
  // Nếu true, tin nhắn AI này đang chờ học sinh chọn mức gợi ý tiếp theo
  awaitingHint?: boolean;
}

const HINT_LABELS: Record<1 | 2 | 3, string> = {
  1: "🟢 Gợi ý",
  2: "🟡 Hướng dẫn",
  3: "🔴 Lời giải",
};

function TutorPageInner() {
  const searchParams = useSearchParams();
  const [topic] = useState("Toán — Đại số"); // MVP: cố định 1 topic; sau này có thể cho học sinh chọn
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      role: "assistant",
      tag: "AI GIA SƯ",
      content: "Chào bạn! Mình là LearnX AI. Cứ hỏi mình bất cứ bài nào bạn đang vướng nhé.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages]);

  // Nếu vào trang qua /tutor?q=... (từ ô hỏi ở Trang chủ), tự gửi luôn
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) sendMessage(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, topic, hintLevel: 0 }),
      });
      const json: ApiResponse<{ reply: string }> = await res.json();

      if (json.success) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", tag: "AI GIA SƯ", content: json.data.reply, awaitingHint: true },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", tag: "LỖI", content: json.error }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", tag: "LỖI", content: "Không thể kết nối tới AI Gia sư, thử lại sau." },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function requestHint(level: 1 | 2 | 3) {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/ai/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, hintLevel: level }),
      });
      const json: ApiResponse<{ reply: string }> = await res.json();

      if (json.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            tag: HINT_LABELS[level],
            content: json.data.reply,
            awaitingHint: level < 3, // sau lời giải (level 3) thì không mời gợi ý thêm nữa
          },
        ]);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>AI Gia sư</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 20 }}>
        <Panel style={{ height: 560, display: "flex", flexDirection: "column" }}>
          <div
            ref={logRef}
            style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingRight: 6 }}
          >
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                <ChatBubble role={m.role} content={m.content} tag={m.tag} />
                {m.awaitingHint && i === messages.length - 1 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <HintButton label="🟢 Gợi ý" onClick={() => requestHint(1)} disabled={sending} />
                    <HintButton label="🟡 Hướng dẫn" onClick={() => requestHint(2)} disabled={sending} />
                    <HintButton label="🔴 Lời giải" onClick={() => requestHint(3)} disabled={sending} />
                  </div>
                )}
              </div>
            ))}
            {sending && <div style={{ color: "var(--text-dim)", fontSize: 13 }}>AI đang trả lời...</div>}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
              placeholder="Nhập câu hỏi của bạn..."
              style={{
                flex: 1,
                background: "var(--panel-strong)",
                border: "1px solid var(--border)",
                borderRadius: 11,
                padding: "12px 14px",
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button className="btn-primary" onClick={() => sendMessage(input)} disabled={sending}>
              Gửi
            </button>
          </div>
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>Chế độ sư phạm</div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
              AI sẽ gợi ý từng bước thay vì đưa đáp án ngay, để bạn tự tư duy trước.
            </div>
          </Panel>
          <Panel>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>Đang học</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{topic}</div>
          </Panel>
        </div>
      </div>
    </section>
  );
}

function HintButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 12,
        padding: "6px 11px",
        borderRadius: 8,
        cursor: disabled ? "not-allowed" : "pointer",
        border: "1px solid var(--border)",
        background: "var(--panel)",
        color: "var(--text-dim)",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}
