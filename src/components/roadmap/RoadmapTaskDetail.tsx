// ================================================================
// <RoadmapTaskDetail /> — tài liệu + bài tập + gợi ý + lên lịch
// cho 1 topic của 1 goal. Dùng chung ExerciseSolver với /practice.
// ================================================================

"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import ExerciseSolver from "@/components/exercise/ExerciseSolver";
import type { ApiResponse } from "@/types";

interface LinkedResource {
  id: string;
  title: string;
  type: string;
  url: string | null;
  subject: string | null;
  topic: string | null;
  difficulty: string | null;
}

interface LinkedExercise {
  id: string;
  title: string;
  subject: string;
  topic: string;
  difficulty: string;
}

interface RoadmapLink {
  id: string;
  topic: string;
  kind: string;
  resource: LinkedResource | null;
  exercise: LinkedExercise | null;
}

interface RecStep {
  order: number;
  title: string;
  detail: string;
  kind: string;
}

interface Recommendation {
  topic: string;
  mastery: number | null;
  steps: RecStep[];
  resources: (LinkedResource & { averageRating: number })[];
  practice: { easy: LinkedExercise[]; medium: LinkedExercise[]; hard: LinkedExercise[] };
}

export default function RoadmapTaskDetail({ goalId, topic }: { goalId: string; topic: string }) {
  const [links, setLinks] = useState<RoadmapLink[]>([]);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<{ resources: LinkedResource[]; exercises: LinkedExercise[] } | null>(null);
  const [solveId, setSolveId] = useState<string | null>(null);
  const [schedDate, setSchedDate] = useState("");
  const [schedStart, setSchedStart] = useState("19:00");
  const [schedEnd, setSchedEnd] = useState("20:00");
  const [schedMsg, setSchedMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [linksRes, recRes, resRes, exRes] = await Promise.all([
        fetch(`/api/roadmaps/${goalId}/resources?topic=${encodeURIComponent(topic)}`),
        fetch(`/api/roadmaps/${goalId}/recommendations?topic=${encodeURIComponent(topic)}`),
        fetch(`/api/resources?topic=${encodeURIComponent(topic)}&limit=10`),
        fetch(`/api/exercises?topic=${encodeURIComponent(topic)}&limit=10`),
      ]);
      const linksJson: ApiResponse<{ links: RoadmapLink[] }> = await linksRes.json();
      const recJson: ApiResponse<Recommendation> = await recRes.json();
      const resJson: ApiResponse<{ resources: LinkedResource[] }> = await resRes.json();
      const exJson: ApiResponse<{ exercises: LinkedExercise[] }> = await exRes.json();
      if (!linksJson.success) throw new Error(linksJson.error);
      if (!recJson.success) throw new Error(recJson.error);
      setLinks(linksJson.data.links);
      setRec(recJson.data);
      setCandidates({
        resources: resJson.success ? resJson.data.resources : [],
        exercises: exJson.success ? exJson.data.exercises : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải chi tiết task.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId, topic]);

  async function linkIt(body: Record<string, string>) {
    const res = await fetch(`/api/roadmaps/${goalId}/resources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, ...body }),
    });
    const json: ApiResponse<unknown> = await res.json();
    if (!json.success) alert(json.error);
    else await load();
  }

  async function unlinkIt(linkId: string) {
    const res = await fetch(`/api/roadmaps/${goalId}/resources?linkId=${linkId}`, { method: "DELETE" });
    const json: ApiResponse<unknown> = await res.json();
    if (!json.success) alert(json.error);
    else await load();
  }

  async function schedule() {
    if (!schedDate) {
      setSchedMsg("Chọn ngày học.");
      return;
    }
    setSchedMsg(null);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Học ${topic}`,
          subject: topic,
          topic,
          learningGoalId: goalId,
          startTime: new Date(`${schedDate}T${schedStart}:00`).toISOString(),
          endTime: new Date(`${schedDate}T${schedEnd}:00`).toISOString(),
        }),
      });
      const json: ApiResponse<unknown> = await res.json();
      setSchedMsg(json.success ? "✓ Đã lên lịch — xem ở trang Lịch học." : json.error);
    } catch {
      setSchedMsg("Không thể lên lịch.");
    }
  }

  if (loading) return <StateMessage kind="loading" text="Đang tải chi tiết task..." />;
  if (error) return <StateMessage kind="error" text={error} />;

  const linkedIds = new Set([
    ...links.map((l) => l.resource?.id).filter(Boolean),
    ...links.map((l) => l.exercise?.id).filter(Boolean),
  ]);

  return (
    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
      {rec && (
        <Panel>
          <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>
            Gợi ý học tập
            {rec.mastery !== null ? ` (mastery hiện tại ${rec.mastery}%)` : " (chưa có dữ liệu mastery)"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {rec.steps.map((s) => (
              <div key={s.order} style={{ fontSize: 13 }}>
                <strong>{s.order}. {s.title}</strong>
                <div style={{ color: "var(--text-dim)", marginTop: 2 }}>{s.detail}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel>
        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>📖 Tài liệu ({links.filter((l) => l.resource).length})</div>
        {links.filter((l) => l.resource).length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Chưa gắn tài liệu nào.</p>
        )}
        {links.filter((l) => l.resource).map((l) => (
          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid var(--border-soft)", fontSize: 13 }}>
            <span>
              {l.resource!.title}
              {l.resource!.url && (
                <> — <a href={l.resource!.url} target="_blank" rel="noreferrer" style={{ color: "var(--cyan)" }}>mở</a></>
              )}
            </span>
            <button className="btn-secondary" style={{ fontSize: 11.5 }} onClick={() => unlinkIt(l.id)}>Gỡ</button>
          </div>
        ))}
        {candidates && candidates.resources.filter((r) => !linkedIds.has(r.id)).length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>Gắn thêm từ catalog:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {candidates.resources.filter((r) => !linkedIds.has(r.id)).slice(0, 5).map((r) => (
                <button key={r.id} className="btn-secondary" style={{ fontSize: 11.5 }} onClick={() => linkIt({ resourceId: r.id, kind: "LEARN" })}>
                  + {r.title.slice(0, 40)}
                </button>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel>
        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>🧪 Luyện tập ({links.filter((l) => l.exercise).length})</div>
        {links.filter((l) => l.exercise).length === 0 && (
          <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Chưa gắn bài tập nào.</p>
        )}
        {links.filter((l) => l.exercise).map((l) => (
          <div key={l.id} style={{ padding: "6px 0", borderTop: "1px solid var(--border-soft)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span>{l.exercise!.title} <span style={{ color: "var(--text-faint)" }}>({l.exercise!.difficulty})</span></span>
              <span style={{ display: "flex", gap: 6 }}>
                <button className="btn-secondary" style={{ fontSize: 11.5 }} onClick={() => setSolveId(solveId === l.exercise!.id ? null : l.exercise!.id)}>
                  {solveId === l.exercise!.id ? "Đóng" : "Làm ngay"}
                </button>
                <button className="btn-secondary" style={{ fontSize: 11.5 }} onClick={() => unlinkIt(l.id)}>Gỡ</button>
              </span>
            </div>
            {solveId === l.exercise!.id && (
              <div style={{ marginTop: 8 }}>
                <ExerciseSolver exerciseId={l.exercise!.id} onSolved={load} />
              </div>
            )}
          </div>
        ))}
        {candidates && candidates.exercises.filter((e) => !linkedIds.has(e.id)).length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>Gắn thêm từ ngân hàng:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {candidates.exercises.filter((e) => !linkedIds.has(e.id)).slice(0, 5).map((e) => (
                <button key={e.id} className="btn-secondary" style={{ fontSize: 11.5 }} onClick={() => linkIt({ exerciseId: e.id, kind: "PRACTICE" })}>
                  + {e.title.slice(0, 40)} ({e.difficulty})
                </button>
              ))}
            </div>
          </div>
        )}
      </Panel>

      <Panel>
        <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 8 }}>🗓 Lên lịch học task này</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="date" value={schedDate} onChange={(e) => setSchedDate(e.target.value)} style={miniInput} />
          <input type="time" value={schedStart} onChange={(e) => setSchedStart(e.target.value)} style={miniInput} />
          <input type="time" value={schedEnd} onChange={(e) => setSchedEnd(e.target.value)} style={miniInput} />
          <button className="btn-primary" style={{ fontSize: 12.5 }} onClick={schedule}>Lên lịch</button>
        </div>
        {schedMsg && <p style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 8 }}>{schedMsg}</p>}
      </Panel>
    </div>
  );
}

const miniInput = {
  background: "var(--panel-strong)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: "7px 10px",
  color: "var(--text)",
  fontSize: 12.5,
  outline: "none",
} as const;
