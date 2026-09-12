// ================================================================
// <ExerciseSolver /> — xem đề + nộp bài, dùng chung cho /practice
// và chi tiết task roadmap (tránh 2 nơi tự viết form chấm riêng).
// ================================================================

"use client";

import { useEffect, useState } from "react";
import StateMessage from "@/components/ui/StateMessage";
import SafeMath from "@/components/math/SafeMath";
import { useToast } from "@/components/ui/Toast";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ApiResponse } from "@/types";

interface ExerciseDetail {
  id: string;
  title: string;
  subject: string;
  topic: string;
  difficulty: string;
  statement: string;
  constraints: string | null;
  examples: unknown;
  solvedByMe: boolean;
  hasSampleAnswer: boolean;
  author: { id: string; name: string | null; nickname: string | null } | null;
}

interface SubmitResult {
  attemptId: string;
  isCorrect: boolean;
  score: number;
  hasSampleAnswer: boolean;
  isFirstSolve: boolean;
  xpEarned: number;
}

export default function ExerciseSolver({ exerciseId, onSolved }: { exerciseId: string; onSolved?: () => void }) {
  const { push } = useToast();
  const { t } = useLanguage();
  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnswer("");
    fetch(`/api/exercises/${exerciseId}`)
      .then((res) => res.json())
      .then((json: ApiResponse<ExerciseDetail>) => {
        if (json.success) setExercise(json.data);
        else setError(json.error);
      })
      .catch(() => setError(t("common.connectionError")))
      .finally(() => setLoading(false));
  }, [exerciseId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/exercises/${exerciseId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer }),
      });
      const json: ApiResponse<SubmitResult> = await res.json();
      if (!json.success) {
        setError(json.error);
        return;
      }
      setResult(json.data);
      setError(null);
      if (json.data.isCorrect) {
        if (json.data.isFirstSolve && json.data.xpEarned > 0) {
          push("success", t("exercise.toastCorrect", { n: json.data.xpEarned }));
        } else if (!json.data.isFirstSolve) {
          push("info", t("exercise.toastRepeat"));
        }
        onSolved?.();
      }
    } catch {
      setError(t("exercise.submitFail"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <StateMessage kind="loading" text={t("exercise.loading")} />;
  if (error) return <StateMessage kind="error" text={error} />;
  if (!exercise) return null;

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{exercise.title}</div>
      <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>
        {exercise.subject} · {exercise.topic} · {exercise.difficulty === "easy" ? t("exercise.difficulty.easy") : exercise.difficulty === "hard" ? t("exercise.difficulty.hard") : t("exercise.difficulty.medium")}
        {exercise.solvedByMe && <span style={{ color: "var(--cyan)", marginLeft: 8 }}>{t("exercise.solvedBefore")}</span>}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.7, marginTop: 12, whiteSpace: "pre-wrap" }}>
        <SafeMath text={exercise.statement} />
      </div>
      {exercise.constraints && (
        <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 10, whiteSpace: "pre-wrap" }}>
          {t("exercise.constraints", { t: exercise.constraints })}
        </div>
      )}
      {exercise.examples != null && exercise.examples !== "" && (
        <pre style={{ fontSize: 12.5, background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, overflowX: "auto", marginTop: 10 }}>
          {typeof exercise.examples === "string" ? exercise.examples : JSON.stringify(exercise.examples, null, 2)}
        </pre>
      )}

      <form onSubmit={submit} style={{ marginTop: 14 }}>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={4}
          placeholder={t("exercise.answerPh")}
          style={{ width: "100%", background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", color: "var(--text)", fontSize: 14, outline: "none", resize: "vertical" as const }}
        />
        <button type="submit" className="btn-primary" disabled={submitting || !answer.trim()} style={{ marginTop: 10, fontSize: 13.5 }}>
          {submitting ? t("exercise.submitting") : t("exercise.submit")}
        </button>
      </form>

      {result && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: result.isCorrect ? "var(--cyan-soft)" : "var(--panel-strong)",
            fontSize: 13.5,
          }}
        >
          {result.isCorrect ? (
            <div>
              {result.isFirstSolve ? t("exercise.correctFirst", { xp: result.xpEarned }) : t("exercise.correctRepeat")}
            </div>
          ) : result.hasSampleAnswer ? (
            <div>{t("exercise.wrongSample")}</div>
          ) : (
            <div>{t("exercise.recorded")}</div>
          )}
        </div>
      )}
    </div>
  );
}
