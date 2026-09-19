// ================================================================
// <TutorSidePanel /> — cột phải của AI Gia sư
// ================================================================
// Gồm 3 khối THẬT:
//   1) 6 chế độ đồng hành (TutorModeBar).
//   2) NGUỒN ĐANG DÙNG — danh sách tài liệu user đã upload (từ
//      /api/tutor/context), chọn được để grounding câu trả lời; hiện
//      kèm môn/chủ đề nếu có.
//   3) CÂU HỎI GỢI Ý — sinh theo ngữ cảnh (chủ đề + tài liệu + điểm
//      yếu), bấm để hỏi ngay.
// Trạng thái tải/lỗi của từng khối được hiện riêng, không che lỗi.
// ================================================================

"use client";

import Panel from "@/components/ui/Panel";
import TutorModeBar from "./TutorModeBar";
import type { TutorMode, TutorSource } from "./types";

interface TutorSidePanelProps {
  topic: string;
  activeMode: TutorMode;
  onSelectMode: (mode: TutorMode) => void;
  modeBusy: boolean;

  sources: TutorSource[] | null;
  sourcesLoading: boolean;
  sourcesError: string | null;
  activeSourceId: string | null;
  onSelectSource: (id: string | null) => void;

  suggestedQuestions: string[];
  suggestionsLoading: boolean;
  suggestionsGenerated: boolean;
  onAsk: (question: string) => void;
  sending: boolean;
}

const eyebrowStyle: React.CSSProperties = {
  color: "var(--cyan)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
};

export default function TutorSidePanel({
  topic,
  activeMode,
  onSelectMode,
  modeBusy,
  sources,
  sourcesLoading,
  sourcesError,
  activeSourceId,
  onSelectSource,
  suggestedQuestions,
  suggestionsLoading,
  suggestionsGenerated,
  onAsk,
  sending,
}: TutorSidePanelProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Panel>
        <TutorModeBar activeMode={activeMode} onSelect={onSelectMode} disabled={modeBusy} />
        <p style={{ fontSize: 12, color: "var(--text-dim)", margin: "12px 0 0", lineHeight: 1.5 }}>
          Mỗi chế độ đổi cách AI đồng hành — không chỉ đổi giao diện. AI sẽ trả lời ngay theo chế độ bạn chọn.
        </p>
      </Panel>

      <Panel>
        <div style={eyebrowStyle}>Nguồn đang dùng</div>
        {sourcesLoading ? (
          <p style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 10 }}>Đang tải nguồn học…</p>
        ) : sourcesError ? (
          <p style={{ fontSize: 12.5, color: "var(--rose)", marginTop: 10 }}>{sourcesError}</p>
        ) : sources && sources.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            <button
              type="button"
              className={`source-select${activeSourceId === null ? " active" : ""}`}
              onClick={() => onSelectSource(null)}
              aria-pressed={activeSourceId === null}
            >
              Không dùng tài liệu (chỉ theo chủ đề)
            </button>
            {sources.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`source-select${activeSourceId === s.id ? " active" : ""}`}
                onClick={() => onSelectSource(s.id)}
                aria-pressed={activeSourceId === s.id}
                title={s.fileName}
              >
                <span style={{ display: "block", fontWeight: 600, marginBottom: 2 }}>{s.fileName}</span>
                {(s.subject || s.topic) && (
                  <span style={{ display: "block", fontSize: 10.5, color: "var(--text-faint)" }}>
                    {[s.subject, s.topic].filter(Boolean).join(" · ")}
                    {s.hasSummary ? "" : " · chưa có tóm tắt"}
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 10, lineHeight: 1.5 }}>
            Chưa có tài liệu nào đã xử lý xong. Hãy tải tài liệu ở Thư viện để AI trả lời dựa trên nguồn của bạn.
          </p>
        )}
      </Panel>

      <Panel>
        <div style={eyebrowStyle}>Câu hỏi gợi ý</div>
        {suggestionsLoading ? (
          <p style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 10 }}>Đang tạo câu hỏi theo ngữ cảnh…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                type="button"
                className="source-select"
                onClick={() => onAsk(q)}
                disabled={sending}
                style={{ textAlign: "left" }}
              >
                {q}
              </button>
            ))}
            {!suggestionsGenerated && suggestedQuestions.length > 0 && (
              <span style={{ fontSize: 10.5, color: "var(--text-faint)" }}>
                Gợi ý theo chủ đề (AI đang bận, thử lại sau để có gợi ý sát tài liệu hơn).
              </span>
            )}
          </div>
        )}
      </Panel>

      <Panel>
        <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>Đang học</div>
        <div style={{ fontWeight: 600, fontSize: 14, overflowWrap: "anywhere" }}>{topic}</div>
      </Panel>
    </div>
  );
}
