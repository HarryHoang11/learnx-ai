// ================================================================
// TRANG LUYỆN TẬP (Practice) — ngân hàng bài tập + chấm + XP
// ================================================================

"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import ExerciseSolver from "@/components/exercise/ExerciseSolver";
import type { ApiResponse } from "@/types";

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

const DIFF_LABEL: Record<string, string> = { easy: "Dễ", medium: "Trung bình", hard: "Khó" };

export default function PracticePage() {
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
      setError("Không thể kết nối tới máy chủ.");
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
        <h2 style={{ fontSize: 20, margin: 0 }}>Luyện tập 🧪</h2>
        <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Đóng" : "+ Đóng góp bài tập"}
        </button>
      </div>
      <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 0, marginBottom: 18 }}>
        Làm đúng lần đầu được cộng XP — nộp lại không farm thêm.
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
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm đề bài..." style={inputStyle} />
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Môn" style={{ ...inputStyle, maxWidth: 140 }} />
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Chủ đề" style={{ ...inputStyle, maxWidth: 160 }} />
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ ...inputStyle, maxWidth: 140 }}>
            <option value="">Mọi độ khó</option>
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
          <button type="submit" className="btn-primary" style={{ fontSize: 13 }}>Lọc</button>
        </form>
      </Panel>

      {loading && <StateMessage kind="loading" text="Đang tải bài tập..." />}
      {error && <StateMessage kind="error" text={error} />}
      {!loading && !error && data && data.exercises.length === 0 && (
        <Panel>
          <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>
            Chưa có bài tập nào phù hợp — hãy nới bộ lọc hoặc đóng góp bài đầu tiên!
          </p>
        </Panel>
      )}

      {!loading && !error && data && data.exercises.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {data.exercises.map((e) => (
            <Panel key={e.id}>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>{e.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6 }}>
                {e.subject} · {e.topic} · {DIFF_LABEL[e.difficulty] ?? e.difficulty} · {e._count.attempts} lượt nộp
              </div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 4 }}>
                Bởi {e.author?.name || e.author?.nickname || "Ẩn danh"}
              </div>
              <button className="btn-primary" style={{ fontSize: 12.5, marginTop: 12 }} onClick={() => setSolveId(e.id)}>
                Làm bài
              </button>
            </Panel>
          ))}
        </div>
      )}

      {solveId && (
        <div className="modal-overlay" onClick={() => setSolveId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setSolveId(null)} aria-label="Đóng" style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>
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
      setError("Không thể tạo bài tập.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Panel style={{ marginBottom: 16 }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input placeholder="Tiêu đề bài tập *" required value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder="Môn *" required value={subject} onChange={(e) => setSubject(e.target.value)} style={{ ...inputStyle }} />
          <input placeholder="Chủ đề *" required value={topic} onChange={(e) => setTopic(e.target.value)} style={{ ...inputStyle }} />
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ ...inputStyle }}>
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
        </div>
        <textarea placeholder="Đề bài *" required value={statement} onChange={(e) => setStatement(e.target.value)} rows={4} style={{ ...inputStyle, resize: "vertical" as const }} />
        <input placeholder="Đáp án mẫu để chấm tự động (tùy chọn — bỏ trống = bài tự luận)" value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} style={inputStyle} />
        {error && <p style={{ color: "var(--rose)", fontSize: 13 }}>{error}</p>}
        <button type="submit" className="btn-primary" disabled={submitting} style={{ fontSize: 13.5 }}>
          {submitting ? "Đang tạo..." : "Đóng góp bài tập"}
        </button>
      </form>
    </Panel>
  );
}
