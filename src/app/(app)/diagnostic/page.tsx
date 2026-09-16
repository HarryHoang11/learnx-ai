// ================================================================
// Diagnostic page — multi-subject support
// ================================================================
// Trước đây hardcode subject="Toán". Bây giờ hiển thị màn hình chọn
// môn học trước khi bắt đầu kiểm tra năng lực — dựa trên danh sách
// môn hợc có sẵn trong hệ thống (từ dictionary).
// ================================================================

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import SkillBar from "@/components/ui/SkillBar";
import StateMessage from "@/components/ui/StateMessage";
import SafeMath from "@/components/math/SafeMath";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { SUBJECTS, CUSTOM_SUBJECT_VALUE } from "@/lib/constants/subjects";
import type { ApiResponse, PublicQuestion, SkillMasteryPoint } from "@/types";

type Phase = "subject_select" | "loading" | "in_progress" | "finished" | "error";

interface CompletionActivity {
  recorded: boolean;
  alreadyRecorded?: boolean;
  xpEarned: number;
  streak: { current: number; longest: number };
}

interface SubjectStatus {
  subject: string;
  completed: boolean;
  completedAt: Date | null;
  lastMastery: number;
}

const AVAILABLE_SUBJECTS = SUBJECTS;

export default function DiagnosticPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("subject_select");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [customSubject, setCustomSubject] = useState<string>("");
  const [subjectStatus, setSubjectStatus] = useState<Map<string, SubjectStatus>>(new Map());
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [answerWasCorrect, setAnswerWasCorrect] = useState<boolean | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [profile, setProfile] = useState<SkillMasteryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<CompletionActivity | null>(null);

  const effectiveSubject = selectedSubject === "Khác" ? customSubject : selectedSubject;

  useEffect(() => {
    fetch("/api/diagnostic/status")
      .then((res) => res.json())
      .then((json: ApiResponse<SubjectStatus[]>) => {
        if (json.success) {
          const map = new Map<string, SubjectStatus>();
          json.data.forEach((s) => map.set(s.subject, s));
          setSubjectStatus(map);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingStatus(false));
  }, []);

  async function start() {
    setPhase("loading");
    setError(null);
    setCompletion(null);
    try {
      const res = await fetch("/api/assessment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: effectiveSubject }),
      });
      const json: ApiResponse<{ assessmentId: string; question: PublicQuestion }> = await res.json();
      if (!json.success) throw new Error(json.error);

      setAssessmentId(json.data.assessmentId);
      setQuestion(json.data.question);
      setAnsweredCount(0);
      setSelected(null);
      setAnswerWasCorrect(null);
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
        body: JSON.stringify({ assessmentId, questionId: question.id, selectedIndex: index }),
      });
      const json: ApiResponse<
        { done: true; activity?: CompletionActivity } | { done: false; isCorrect: boolean; nextQuestion: PublicQuestion }
      > = await res.json();
      if (!json.success) throw new Error(json.error);

      setAnsweredCount((c) => c + 1);
      if (!json.data.done) setAnswerWasCorrect(json.data.isCorrect);
      if (json.data.done && json.data.activity) {
        setCompletion(json.data.activity);
      }

      setTimeout(async () => {
        if (json.data.done) {
          await loadResult();
        } else {
          setQuestion(json.data.nextQuestion);
          setSelected(null);
          setAnswerWasCorrect(null);
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
      const res = await fetch(`/api/assessment/result?subject=${encodeURIComponent(effectiveSubject)}`);
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

      {phase === "subject_select" && (
        <>
          <Panel style={{ marginBottom: 20, padding: "16px 18px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{t("diagnostic.chooseSubject")}</div>
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                if (e.target.value !== CUSTOM_SUBJECT_VALUE) setCustomSubject("");
              }}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                background: "var(--panel-strong)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontSize: 15,
                marginBottom: 14,
              }}
            >
              <option value="">{t("diagnostic.chooseSubject")}</option>
              {AVAILABLE_SUBJECTS.map((s) => {
                const status = subjectStatus.get(s.value);
                const badge = status?.completed
                  ? ` ✓ ${t("diagnostic.alreadyTested")}`
                  : status
                  ? ` ${t("diagnostic.previousResult", { n: status.lastMastery })}`
                  : "";
                return (
                  <option key={s.value} value={s.value}>
                    {t(s.labelKey)}{badge}
                  </option>
                );
              })}
              <option value={CUSTOM_SUBJECT_VALUE}>{CUSTOM_SUBJECT_VALUE}</option>
            </select>
            {selectedSubject === CUSTOM_SUBJECT_VALUE && (
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder={t("diagnostic.customSubject")}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "var(--panel-strong)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: 14,
                  marginBottom: 14,
                }}
              />
            )}
            {loadingStatus && (
              <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{t("diagnostic.loadingStatus")}</div>
            )}
          </Panel>
          <Panel style={{ textAlign: "center", padding: 40 }}>
            <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>{t("diagnostic.intro")}</p>
            <button className="btn-primary" onClick={start} disabled={!effectiveSubject.trim()}>
              {t("diagnostic.start")}
            </button>
          </Panel>
        </>
      )}

      {phase === "loading" && <StateMessage kind="loading" text={t("diagnostic.loading")} />}
      {phase === "error" && error && <StateMessage kind="error" text={error} />}

      {phase === "in_progress" && question && (
        <>
          <ProgressDots done={answeredCount} total={15} />
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
              const isSelected = selected === i;
              let border = "var(--border)";
              let bg = "var(--panel-strong)";
              if (selected !== null) {
                if (isSelected && answerWasCorrect) {
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
              <div>
                <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>
                  {t("diagnostic.subjectTested", { subject: selectedSubject })}
                </div>
                {profile.map((s) => (
                  <SkillBar key={`${s.subject}-${s.topic}`} name={`${s.subject} · ${s.topic}`} percent={s.masteryPercent} isWeak={s.isWeak} />
                ))}
              </div>
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
