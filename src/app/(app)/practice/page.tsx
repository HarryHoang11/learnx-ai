// ================================================================
// TRANG LUYỆN TẬP (Practice) — ngân hàng bài tập + chấm + XP
// ================================================================

"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import ExerciseSolver from "@/components/exercise/ExerciseSolver";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ApiResponse } from "@/types";
import type { I18nKey } from "@/lib/i18n/dictionary";

interface ExerciseItem {
  id: string;
  title: string;
  subject: string;
  topic: string;
  difficulty: string;
  author: { id: string; name: string | null; nickname: string | null } | null;
  _count: { attempts: number };
}

interface ListData {
  exercises: ExerciseItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const DIFF_KEYS: Record<string, I18nKey> = {
  easy: "practice.diff.easy",
  medium: "practice.diff.medium",
  hard: "practice.diff.hard",
};

export default function PracticePage() {
  const { t } = useLanguage();
  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [solveId, setSolveId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ limit: "20" });
      if (subject.trim()) p.set("subject", subject.trim());
      if (topic.trim()) p.set("topic", topic.trim());
      if (difficulty) p.set("difficulty", difficulty);
      if (search.trim()) p.set("search", search.trim());
      const res = await fetch(`/api/exercises?${p.toString()}`);
      const json: ApiResponse<ListData> = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error);
    } catch {
      setError(t("common.connectionError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 20, margin: 0 }}>{t("practice.title")}</h2>
        <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => setShowForm((v) => !v)}>
          {showForm ? t("common.close") : t("practice.contribute")}
        </button>
      </div>
      <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 0, marginBottom: 18 }}>
        {t("practice.subtitle")}
      </p>

      {showForm && <CreateExerciseForm onCreated={() => { setShowForm(false); load(); }} />}

      <Panel style={{ marginBottom: 16 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("practice.searchPh")} style={inputStyle} />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("practice.subjectPh")} style={{ ...inputStyle, maxWidth: 140 }} />
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("practice.topicPh")} style={{ ...inputStyle, maxWidth: 160 }} />
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ ...inputStyle, maxWidth: 140 }}>
            <option value="">{t("practice.allDiff")}</option>
            <option value="easy">{t("practice.diff.easy")}</option>
            <option value="medium">{t("practice.diff.medium")}</option>
            <option value="hard">{t("practice.diff.hard")}</option>
          </select>
          <button type="submit" className="btn-primary" style={{ fontSize: 13 }}>{t("practice.filter")}</button>
        </form>
      </Panel>

      {loading && <StateMessage kind="loading" text={t("practice.loading")} />}
      {error && <StateMessage kind="error" text={error} />}
      {!loading && !error && data && data.exercises.length === 0 && (
        <Panel>
          <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>
            {t("practice.empty")}
          </p>
        </Panel>
      )}

      {!loading && !error && data && data.exercises.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {data.exercises.map((e) => (
            <Panel key={e.id}>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>{e.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6 }}>
                {e.subject} · {e.topic} · {t(DIFF_KEYS[e.difficulty] ?? "practice.diff.medium")} · {t("practice.attempts", { n: e._count.attempts })}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>
                {t("practice.by", { n: e.author?.name || e.author?.nickname || t("practice.anonymous") })}
              </div>
              <button className="btn-primary" style={{ fontSize: 12.5, marginTop: 12 }} onClick={() => setSolveId(e.id)}>
                {t("practice.solve")}
              </button>
            </Panel>
          ))}
        </div>
      )}

      {solveId && (
        <div className="modal-overlay" onClick={() => setSolveId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setSolveId(null)} aria-label={t("common.close")} style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>
                ×
              </button>
            </div>
            <ExerciseSolver exerciseId={solveId} onSolved={load} />
          </div>
        </div>
      )}
    </section>
  );
}

const inputStyle = {
  background: "var(--panel-strong)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "9px 11px",
  color: "var(--text)",
  fontSize: 13.5,
  outline: "none",
  flex: "1 1 140px",
} as const;

function CreateExerciseForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [statement, setStatement] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subject, topic, difficulty, statement, expectedOutput: expectedOutput || undefined }),
      });
      const json: ApiResponse<unknown> = await res.json();
      if (!json.success) {
        setError(json.error);
        return;
      }
      onCreated();
    } catch {
      setError(t("practice.form.createFail"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel style={{ marginBottom: 16 }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input placeholder={t("practice.form.title")} required value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder={t("practice.form.subject")} required value={subject} onChange={(e) => setSubject(e.target.value)} style={{ ...inputStyle }} />
          <input placeholder={t("practice.form.topic")} required value={topic} onChange={(e) => setTopic(e.target.value)} style={{ ...inputStyle }} />
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ ...inputStyle }}>
            <option value="easy">{t("practice.diff.easy")}</option>
            <option value="medium">{t("practice.diff.medium")}</option>
            <option value="hard">{t("practice.diff.hard")}</option>
          </select>
        </div>
        <textarea placeholder={t("practice.form.statement")} required value={statement} onChange={(e) => setStatement(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" as const }} />
        <input placeholder={t("practice.form.expected")} value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} style={inputStyle} />
        {error && <p style={{ color: "var(--rose)", fontSize: 13 }}>{error}</p>}
        <button type="submit" className="btn-primary" disabled={submitting} style={{ fontSize: 13.5 }}>
          {submitting ? t("practice.form.creating") : t("practice.form.create")}
        </button>
      </form>
    </Panel>
  );
}
