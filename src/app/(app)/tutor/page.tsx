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
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ApiResponse } from "@/types";

// Next.js yêu cầu mọi component dùng useSearchParams() phải nằm trong
// <Suspense>, nếu không sẽ lỗi lúc build (opt toàn trang vào client-side
// rendering không kiểm soát được). Tách TutorPageInner ra để bọc Suspense
// ở component export mặc định, thay vì bọc lẫn vào logic chat bên trong.
export default function TutorPage() {
  return (
    <Suspense fallback={<TutorLoadingFallback />}>
      <TutorPageInner />
    </Suspense>
  );
}

function TutorLoadingFallback() {
  const { t } = useLanguage();
  return <p className="state-msg">{t("common.loading")}</p>;
}

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  tag?: string;
  // Nếu true, tin nhắn AI này đang chờ học sinh chọn mức gợi ý tiếp theo
  awaitingHint?: boolean;
  // Resource cards đính kèm (khi AI/tutor phát hiện intent tìm tài liệu)
  resources?: AttachedResource[];
}

interface AttachedResource {
  id: string;
  title: string;
  type: string;
  url: string | null;
  difficulty: string | null;
  description: string | null;
}

// Intent "xin nguồn học": tìm trong catalog THẬT, không để AI bịa URL.
const RESOURCE_INTENT =
  /(tài liệu|nguồn học|nguồn tham khảo|tham khảo|video|bài tập|tìm.*(học|đọc|tài liệu)|cho.*(link|nguồn)|resource|document)/i;

function extractResourceQuery(message: string, fallbackTopic: string): string {
  const cleaned = message
    .replace(/cho\s+(tôi|mình|em)\s*/gi, "")
    .replace(/(xin|tìm|kiếm|gợi ý|giới thiệu|cho)\s*/gi, "")
    .replace(/(tài liệu|nguồn học|nguồn tham khảo|tham khảo|video|bài tập|link|nguồn|resource|document)s?/gi, "")
    .replace(/(về|với|để học|để đọc|nào|gì|không|ạ|nhé|với)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length >= 2 ? cleaned : fallbackTopic;
}

const HINT_LABELS: Record<1 | 2 | 3, "tutor.hint1" | "tutor.hint2" | "tutor.hint3"> = {
  1: "tutor.hint1",
  2: "tutor.hint2",
  3: "tutor.hint3",
};

function TutorPageInner() {
  const { t, lang } = useLanguage();
  const searchParams = useSearchParams();
  const [topic] = useState("Toán — Đại số"); // MVP: cố định 1 topic; sau này có thể cho học sinh chọn
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      role: "assistant",
      tag: t("tutor.tag"),
      content: t("tutor.greeting"),
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

    // Intent xin nguồn học → tìm catalog THẬT song song với chat AI.
    // Kết quả đính kèm vào tin nhắn AI (resource cards có link thật),
    // KHÔNG chèn vào prompt để AI khỏi bịa URL.
    const wantsResources = RESOURCE_INTENT.test(trimmed);
    const resourcePromise = wantsResources
      ? fetch(`/api/resources?search=${encodeURIComponent(extractResourceQuery(trimmed, topic))}&limit=4`)
          .then((res) => res.json())
          .then((json: ApiResponse<{ resources: AttachedResource[] }>) =>
            json.success ? json.data.resources.filter((r) => r.url) : []
          )
          .catch(() => [])
      : Promise.resolve([] as AttachedResource[]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, topic, hintLevel: 0, language: lang }),
      });
      const json: ApiResponse<{ reply: string }> = await res.json();
      const attached = await resourcePromise;

      if (json.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            tag: t("tutor.tag"),
            content: json.data.reply,
            awaitingHint: true,
            resources: attached.length > 0 ? attached : undefined,
          },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", tag: t("tutor.errorTag"), content: json.error }]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", tag: t("tutor.errorTag"), content: t("common.connectionError") },
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
        body: JSON.stringify({ topic, hintLevel: level, language: lang }),
      });
      const json: ApiResponse<{ reply: string }> = await res.json();

      if (json.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            tag: t(HINT_LABELS[level]),
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
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>{t("tutor.title")}</h2>

      <div className="grid-tutor">
        <Panel style={{ height: 560, display: "flex", flexDirection: "column" }}>
          <div
            ref={logRef}
            style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingRight: 6 }}
          >
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column" }}>
                <ChatBubble role={m.role} content={m.content} tag={m.tag} />
                {m.resources && m.resources.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8, maxWidth: "78%", alignSelf: "flex-start" }}>
                    {m.resources.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          background: "var(--panel)",
                          border: "1px solid var(--border)",
                          borderRadius: 10,
                          padding: "10px 12px",
                          fontSize: 13,
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{r.title}</div>
                        <div style={{ color: "var(--text-dim)", fontSize: 12, marginBottom: 8 }}>
                          {r.type}
                          {r.difficulty ? ` · ${r.difficulty}` : ""}
                          {r.description ? ` — ${r.description.slice(0, 80)}` : ""}
                        </div>
                        {r.url && (
                          <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)", fontWeight: 600, fontSize: 12.5 }}>
                            {t("tutor.openResource")}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {m.awaitingHint && i === messages.length - 1 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <HintButton label={t("tutor.hint1")} onClick={() => requestHint(1)} disabled={sending} />
                    <HintButton label={t("tutor.hint2")} onClick={() => requestHint(2)} disabled={sending} />
                    <HintButton label={t("tutor.hint3")} onClick={() => requestHint(3)} disabled={sending} />
                  </div>
                )}
              </div>
            ))}
            {sending && <div style={{ color: "var(--text-dim)", fontSize: 13 }}>{t("tutor.sending")}</div>}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
              placeholder={t("tutor.inputPh")}
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
              {t("common.send")}
            </button>
          </div>
        </Panel>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Panel>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>{t("tutor.pedagogyTitle")}</div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", lineHeight: 1.6 }}>
              {t("tutor.pedagogyDesc")}
            </div>
          </Panel>
          <Panel>
            <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>{t("tutor.studying")}</div>
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
