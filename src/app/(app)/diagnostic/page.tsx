// ================================================================
// TRANG KIỂM TRA NĂNG LỰC (Diagnostic Test)
// ================================================================
// Mạch tư duy: khác bản demo HTML tĩnh (câu hỏi + độ khó được lập
// trình cứng sẵn trong 1 mảng JS), trang này gọi THẬT
// /api/assessment/start -> /api/assessment/answer (lặp lại tới khi
// done=true) -> /api/assessment/result. Toàn bộ logic thích ứng
// (adaptive branching) nằm ở BACKEND (assessment.service.ts), trang
// này chỉ hiển thị câu hỏi backend trả về và gửi lựa chọn của học
// sinh — không tự tính độ khó tiếp theo ở phía client.
// ================================================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import SkillBar from "@/components/ui/SkillBar";
import StateMessage from "@/components/ui/StateMessage";
import SafeMath from "@/components/math/SafeMath";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ApiResponse, GeneratedQuestion, SkillMasteryPoint } from "@/types";

type Phase = "idle" | "loading" | "in_progress" | "finished" | "error";

interface CompletionActivity {
  recorded: boolean;
  alreadyRecorded?: boolean;
  xpEarned: number;
  streak: { current: number; longest: number };
}

export default function DiagnosticPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [question, setQuestion] = useState<GeneratedQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [profile, setProfile] = useState<SkillMasteryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<CompletionActivity | null>(null);

  async function start() {
    setPhase("loading");
    setError(null);
    setCompletion(null);
    try {
      const res = await fetch("/api/assessment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: "Toán" }),
      });
      const json: ApiResponse<{ assessmentId: string; question: GeneratedQuestion }> = await res.json();
      if (!json.success) throw new Error(json.error);

      setAssessmentId(json.data.assessmentId);
      setQuestion(json.data.question);
      setAnsweredCount(0);
      setSelected(null);
      setPhase("in_progress");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("diagnostic.startFail"));
      setPhase("error");
    }
  }

  async function answer(index: number) {
    if (!question || !assessmentId || selected !== null) return;
    setSelected(index);

    try {
      const res = await fetch("/api/assessment/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId, question, selectedIndex: index }),
      });
      const json: ApiResponse<
        { done: true; activity?: CompletionActivity } | { done: false; isCorrect: boolean; nextQuestion: GeneratedQuestion }
      > = await res.json();
      if (!json.success) throw new Error(json.error);

      setAnsweredCount((c) => c + 1);
      if (json.data.done && json.data.activity) {
        setCompletion(json.data.activity);
      }

      // Đợi 700ms để học sinh kịp thấy màu đúng/sai trước khi chuyển câu —
      // giữ đúng cảm giác "thấy phản hồi" như bản demo HTML tĩnh trước đó.
      setTimeout(async () => {
        if (json.data.done) {
          await loadResult();
        } else {
          setQuestion(json.data.nextQuestion);
          setSelected(null);
        }
      }, 700);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("diagnostic.answerFail"));
      setPhase("error");
    }
  }

  async function loadResult() {
    setPhase("loading");
    try {
      const res = await fetch("/api/assessment/result");
      const json: ApiResponse<{ profile: SkillMasteryPoint[]; weakTopics: string[] }> = await res.json();
      if (!json.success) throw new Error(json.error);
      setProfile(json.data.profile);
      setPhase("finished");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("diagnostic.resultFail"));
      setPhase("error");
    }
  }

  return (
    <section style={{ maxWidth: 640, margin: "0 auto" }}>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>{t("diagnostic.title")}</h2>
      <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginBottom: 22 }}>
        {t("diagnostic.subtitle")}
      </p>

      {phase === "idle" && (
        <Panel style={{ textAlign: "center", padding: 40 }}>
          <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>
            {t("diagnostic.intro")}
          </p>
          <button className="btn-primary" onClick={start}>
            {t("diagnostic.start")}
          </button>
        </Panel>
      )}

      {phase === "loading" && <StateMessage kind="loading" text={t("diagnostic.loading")} />}
      {phase === "error" && error && <StateMessage kind="error" text={error} />}

      {phase === "in_progress" && question && (
        <>
          <ProgressDots done={answeredCount} total={16} />
          <Panel style={{ padding: "26px 26px" }}>
            <span
              style={{
                fontSize: 11.5,
                padding: "3px 9px",
                borderRadius: 99,
                display: "inline-block",
                marginBottom: 14,
                background:
                  question.difficulty === "easy"
                    ? "var(--cyan-soft)"
                    : question.difficulty === "medium"
                    ? "var(--indigo-soft)"
                    : "var(--amber-soft)",
                color:
                  question.difficulty === "easy"
                    ? "var(--cyan)"
                    : question.difficulty === "medium"
                    ? "var(--indigo)"
                    : "var(--amber)",
              }}
            >
              {question.difficulty === "easy" ? t("diagnostic.easy") : question.difficulty === "medium" ? t("diagnostic.medium") : t("diagnostic.hard")}
            </span>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, lineHeight: 1.6 }}>
              <SafeMath text={question.text} />
            </div>

            {question.options.map((opt, i) => {
              const isCorrectOpt = i === question.correctIndex;
              const isSelected = selected === i;
              let border = "var(--border)";
              let bg = "var(--panel-strong)";
              if (selected !== null) {
                if (isCorrectOpt) {
                  border = "var(--cyan)";
                  bg = "var(--cyan-soft)";
                } else if (isSelected) {
                  border = "var(--rose)";
                  bg = "rgba(239,106,125,0.14)";
                }
              }
              return (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  disabled={selected !== null}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "13px 16px",
                    marginBottom: 9,
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: 11,
                    color: "var(--text)",
                    fontSize: 14,
                    cursor: selected !== null ? "default" : "pointer",
                  }}
                >
                  <SafeMath text={opt} />
                </button>
              );
            })}
          </Panel>
        </>
      )}

      {phase === "finished" && (
        <div>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, marginBottom: 6 }}>{t("diagnostic.doneTitle")}</h2>
            <p style={{ color: "var(--text-dim)", fontSize: 14 }}>{t("diagnostic.doneSubtitle")}</p>
          </div>
          {completion && (
            <Panel style={{ marginBottom: 16, textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{t("diagnostic.completed")}</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", fontSize: 13.5 }}>
                {completion.recorded && (
                  <span style={{ color: "var(--cyan)", fontWeight: 700 }}>
                    {t("diagnostic.xpLine", { n: completion.xpEarned })}
                  </span>
                )}
                <span style={{ color: "var(--text-dim)" }}>
                  {t("diagnostic.streakLine", { n: completion.streak.current })}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 6 }}>
                {completion.recorded ? t("diagnostic.activityRecorded") : t("diagnostic.activityRepeat")}
              </div>
            </Panel>
          )}
          <Panel style={{ padding: 30 }}>
            {profile.length === 0 ? (
              <p style={{ color: "var(--text-dim)" }}>{t("diagnostic.noProfile")}</p>
            ) : (
              profile.map((s) => (
                <SkillBar key={`${s.subject}-${s.topic}`} name={`${s.subject} · ${s.topic}`} percent={s.masteryPercent} isWeak={s.isWeak} />
              ))
            )}
            <div style={{ textAlign: "center", marginTop: 20 }}>
              <button className="btn-primary" onClick={() => router.push("/roadmap")}>
                {t("diagnostic.viewRoadmap")}
              </button>
            </div>
          </Panel>
        </div>
      )}
    </section>
  );
}

function ProgressDots({ done, total }: { done: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 5, marginBottom: 22 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 5,
            flex: 1,
            borderRadius: 99,
            background: i < done ? "var(--cyan)" : i === done ? "var(--indigo)" : "rgba(255,255,255,0.09)",
          }}
        />
      ))}
    </div>
  );
}
