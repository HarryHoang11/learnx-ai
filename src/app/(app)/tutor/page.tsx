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
import { readApi } from "@/lib/api/readApi";

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
  // Tin nhắn lỗi: lưu lại câu hỏi đã gửi để render nút "Thử lại" (xem
  // retryMessage). Trên mất mạng di động, lỗi rất hay xảy ra và bắt người
  // dùng tự gõ lại là trải nghiệm rất tệ — nút thử lại 1 chạm là chuẩn
  // của mọi app chat. `undefined` = tin nhắn bình thường, không hiện nút.
  retry?: { text: string; kind: "chat" | "hint"; level?: 1 | 2 | 3 };
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
  const topic = searchParams?.get("topic")?.trim() || "Chủ đề học tập";
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      role: "assistant",
      tag: t("tutor.tag"),
      content: t("tutor.greeting"),
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  // Tự cuộn xuống tin nhắn mới, NHƯNG chỉ khi người dùng đang ở đáy.
  //
  // Vì sao phải kiểm tra: bản gốc luôn `scrollTo(scrollHeight)` mỗi lần có
  // tin nhắn mới. Người dùng đang đọc lại lịch sử chat (cuộn lên) sẽ bị
  // "giật" về đáy, mất đúng nội dung họ đang xem — trên màn hình điện thoại
  // đọc lại là hành vi rất phổ biến.
  //
  // Ngưỡng 80px: coi như "đang ở đáy" khi cách đáy không quá 1 hàng tin nhắn,
  // để thao tác vuốt nhẹ cũng không bị cảm giác bám.
  const STICKY_THRESHOLD_PX = 80;
  const shouldStickRef = useRef(true);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (!log || !shouldStickRef.current) return;
    log.scrollTo({ top: log.scrollHeight });
  }, [messages]);

  // Người dùng cuộn lên khỏi đáy thì tắt tự-cuộn; cuộn xuống đáy thì bật lại.
  function handleLogScroll() {
    const log = logRef.current;
    if (!log) return;
    const distanceFromBottom = log.scrollHeight - log.scrollTop - log.clientHeight;
    shouldStickRef.current = distanceFromBottom <= STICKY_THRESHOLD_PX;
  }

  // Nếu vào trang qua /tutor?q=... (từ ô hỏi ở Trang chủ), tự gửi luôn
  useEffect(() => {
    const q = searchParams?.get("q");
    if (q) sendMessage(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setSending(true);
    // Người dùng vừa chủ động gửi tin nên đang muốn xem câu trả lời sắp tới →
    // bật lại tự-cuộn, kể cả khi trước đó họ đang đọc lại lịch sử ở giữa
    // khung. Không có dòng này thì câu trả lời có thể hiện ra ngoài khung nhìn
    // mà người dùng không thấy.
    shouldStickRef.current = true;

    // Intent xin nguồn học → tìm catalog THẬT song song với chat AI.
    // Kết quả đính kèm vào tin nhắn AI (resource cards có link thật),
    // KHÔNG chèn vào prompt để AI khỏi bịa URL.
    const wantsResources = RESOURCE_INTENT.test(trimmed);
    const resourcePromise = wantsResources
      ? fetch(`/api/resources?search=${encodeURIComponent(extractResourceQuery(trimmed, topic))}&limit=4`)
          .then((res) => readApi<{ resources: AttachedResource[] }>(res, "GET /api/resources"))
          .then((json) => (json.success ? json.data.resources.filter((r) => r.url) : []))
          // Tìm tài liệu là PHỤ cho câu trả lời AI — hỏng thì chỉ không có
          // card, tuyệt đối không được làm hỏng cả tin nhắn chat.
          .catch(() => [])
      : Promise.resolve([] as AttachedResource[]);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, topic, hintLevel: 0, language: lang }),
      });
      // Đọc qua readApi (không phải res.json() thẳng): server/proxy có thể trả
      // HTML khi lỗi 5xx — `res.json()` sẽ ném SyntaxError và nếu lộ message
      // ra UI, người dùng thấy "Unexpected token '<'". readApi ném TransportError
      // để nhánh catch hiển thị thông báo dễ hiểu + có nút thử lại.
      const json = await readApi<{ reply: string }>(res, "POST /api/ai/chat");
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
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            tag: t("tutor.errorTag"),
            content: json.error,
            retry: { text: trimmed, kind: "chat" },
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          tag: t("tutor.errorTag"),
          content: t("common.connectionError"),
          retry: { text: trimmed, kind: "chat" },
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  /** Xoá tin nhắn lỗi đang hiển thị rồi gửi lại y hệt — dùng cho nút "Thử lại". */
  function retryMessage(message: DisplayMessage) {
    if (!message.retry || sending) return;
    setMessages((prev) => prev.filter((m) => m !== message));
    if (message.retry.kind === "hint" && message.retry.level) {
      void requestHint(message.retry.level);
    } else {
      void sendMessage(message.retry.text);
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
      const json = await readApi<{ reply: string }>(res, "POST /api/ai/hint");

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
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            tag: t("tutor.errorTag"),
            content: json.error,
            retry: { text: topic, kind: "hint", level },
          },
        ]);
      }
    } catch {
      // KHÔNG setSending(false) ở đây: `finally` ngay bên dưới đã lo, gọi 2
      // lần là code thừa (và dễ gây nháy trạng thái nếu sau này thêm logic).
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          tag: t("tutor.errorTag"),
          content: t("common.connectionError"),
          retry: { text: topic, kind: "hint", level },
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 16 }}>{t("tutor.title")}</h2>

      <div className="grid-tutor">
        {/* class "tutor-panel" thay cho height cố định 560px:
            - Desktop: cao đúng 560px như trước, KHÔNG đổi hành vi cũ.
            - Mobile: cao theo khung nhìn (dvh) + chiều cao TỐI THIỂU 360px.
              Lý do: bàn phím Android mở làm WebView co còn ~350px; panel cao
              cứng 560px khiến ô nhập (đang sticky ở đáy panel) bị đẩy vượt
              ra ngoài khung nhìn — người dùng mở bàn phím là MẤT ô nhập,
              đúng lỗi kinh điển của web trên mobile. `dvh` bám theo khung
              nhìn động nên ô nhập luôn nằm trong màn hình. */}
        <Panel className="tutor-panel">
          <div
            ref={logRef}
            onScroll={handleLogScroll}
            // overscroll-behavior: contain chặn hiện tượng "cuộn lây" (kéo
            // trang ngoài theo khi đã ở cuối khung chat) — chuẩn app native.
            style={{
              flex: 1,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              paddingRight: 6,
              overscrollBehavior: "contain",
              WebkitOverflowScrolling: "touch",
            }}
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
                          /* rel="noopener noreferrer" thay cho "noreferrer" một
                             mình: noreferrer đã ngắt window.opener nhưng
                             noreferrer ở WebView Capacitor có thể mở link
                             NGOÀI app (mở trình duyệt) làm người dùng mất
                             ngữ cảnh. Ưu tiên mở trong CÙNG WebView — app
                             không cài trình duyệt riêng nên cũng không mất
                             gì khi quay lại. */
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="tutor-resource__link"
                          >
                            {t("tutor.openResource")}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {m.retry && (
                  <div className="tutor-retry">
                    <button
                      type="button"
                      className="tutor-retry__btn"
                      onClick={() => retryMessage(m)}
                      disabled={sending}
                    >
                      {t("common.retry")}
                    </button>
                  </div>
                )}
                {m.awaitingHint && i === messages.length - 1 && (
                  <div className="tutor-hints">
                    <HintButton label={t("tutor.hint1")} onClick={() => requestHint(1)} disabled={sending} />
                    <HintButton label={t("tutor.hint2")} onClick={() => requestHint(2)} disabled={sending} />
                    <HintButton label={t("tutor.hint3")} onClick={() => requestHint(3)} disabled={sending} />
                  </div>
                )}
              </div>
            ))}
            {/* aria-live="polite": screen reader đọc nhẹ "AI đang trả lời..." mỗi
                khi bật/tắt mà không cắt ngang nội dung đang đọc. `role="status"`
                là vùng trạng thái chuẩn cho thông báo không chặn. */}
            {sending && (
              <div className="tutor-typing" role="status" aria-live="polite">
                <span className="tutor-typing__dot" aria-hidden="true" />
                <span className="tutor-typing__dot" aria-hidden="true" />
                <span className="tutor-typing__dot" aria-hidden="true" />
                <span className="sr-only">{t("tutor.sending")}</span>
              </div>
            )}
          </div>

          {/* class "tutor-composer": trên mobile ô nhập dính sát đáy màn hình
              (sticky) và tự nhấc lên trên thanh nav dưới + safe-area, nên lúc
              đang đọc lịch sử chat người dùng vẫn gõ được ngay (xem
              globals.css). Không có class này thì ô nhập trôi lên khỏi màn
              hình và phải cuộn ngược xuống mới gõ tiếp — rất bực mobile. */}
          <div className="tutor-composer" style={{ display: "flex", gap: 10, marginTop: 16 }}>
            {/* autoComplete="off" + autoCapitalize="sentences": bàn phím
                Android hay tự ghi hoa chữ cái đầu và autoCorrect tiếng Anh cho
                tin nhắn tiếng Việt — đặt tường minh để hành vi gõ đúng ý. */}
            <input
              id="tutor-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
              // enterKeyHint: bàn phím mở ra hiện nút "Gửi" thay vì "xuống
              // dòng" trên điện thoại — đúng thao tác gõ tin nhắn.
              enterKeyHint="send"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="sentences"
              spellCheck={false}
              placeholder={t("tutor.inputPh")}
              style={{
                flex: 1,
                // minWidth: 0 là bắt buộc trong flex: input có kích thước nội
                // tại mặc định và sẽ KHÔNG co lại, làm cả hàng tràn ngang ở
                // 320px (bản gốc không có, nên ô nhập tràn khỏi màn hình).
                minWidth: 0,
                background: "var(--panel-strong)",
                border: "1px solid var(--border)",
                borderRadius: 11,
                padding: "12px 14px",
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
              }}
            />
            {/* type="button" để không vô tình submit form cha; aria-label vì nút
                chỉ có chữ, screen reader đọc "Gửi" là đủ nhưng label tường minh
                giúp khi nút bị đổi nhãn theo ngôn ngữ. */}
            <button
              type="button"
              className="btn-primary tutor-composer__send"
              onClick={() => sendMessage(input)}
              disabled={sending}
            >
              {sending ? t("tutor.sending") : t("common.send")}
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
    // class "tutor-hint-btn" (thay cho padding/fontSize inline): trên mobile
    // nút gợi ý phải đạt vùng chạm 44px — bản gốc cao ~26px, quá nhỏ với
    // ngón tay và dễ bấm trượt sang tin nhắn khác. Desktop giữ nguyên kích
    // thước cũ (xem globals.css @media 880px).
    <button
      type="button"
      className="tutor-hint-btn"
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
