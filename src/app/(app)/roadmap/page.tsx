// ================================================================
// TRANG LỘ TRÌNH HỌC (Roadmap)
// ================================================================
// Mạch tư duy: trang này có 2 trạng thái rõ rệt:
//   1) Chưa có Roadmap nào (GET /api/roadmap trả 404) -> hiển thị
//      form để học sinh đặt mục tiêu lần đầu, gọi
//      POST /api/roadmap/generate (nhánh "tạo goal mới", xem route).
//   2) Đã có Roadmap -> hiển thị timeline theo tháng.
// Không gộp 2 trạng thái vào chung 1 UI phức tạp — tách rõ if/else
// để dễ đọc, vì đây là 2 trải nghiệm khác hẳn nhau (form nhập liệu
// vs xem kết quả).
// ================================================================

"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import type { ApiResponse, RoadmapPlan } from "@/types";

export default function RoadmapPage() {
  const [plan, setPlan] = useState<RoadmapPlan[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsGoal, setNeedsGoal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [goalTitle, setGoalTitle] = useState("Thi chuyên Tin");
  const [targetMonths, setTargetMonths] = useState(6);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadRoadmap();
  }, []);

  async function loadRoadmap() {
    setLoading(true);
    try {
      const res = await fetch("/api/roadmap");
      const json: ApiResponse<RoadmapPlan[]> = await res.json();
      if (json.success) {
        setPlan(json.data);
        setNeedsGoal(false);
      } else if (res.status === 404) {
        setNeedsGoal(true);
      } else {
        setError(json.error);
      }
    } catch {
      setError("Không thể kết nối tới máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  async function createGoalAndGenerate() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/roadmap/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalTitle, targetMonths }),
      });
      const json: ApiResponse<RoadmapPlan[]> = await res.json();
      if (!json.success) throw new Error(json.error);
      setPlan(json.data);
      setNeedsGoal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo lộ trình.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <StateMessage kind="loading" text="Đang tải lộ trình..." />;

  if (needsGoal) {
    return (
      <section style={{ maxWidth: 520, margin: "0 auto" }}>
        <h2 style={{ fontSize: 20, marginBottom: 6 }}>Đặt mục tiêu học tập</h2>
        <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginBottom: 22 }}>
          AI sẽ dựa trên mục tiêu này và hồ sơ năng lực hiện tại để xây lộ trình riêng cho bạn.
        </p>
        <Panel>
          <label style={{ display: "block", fontSize: 13, color: "var(--text-dim)", marginBottom: 6 }}>
            Mục tiêu
          </label>
          <input
            value={goalTitle}
            onChange={(e) => setGoalTitle(e.target.value)}
            style={inputStyle}
          />
          <label style={{ display: "block", fontSize: 13, color: "var(--text-dim)", margin: "16px 0 6px" }}>
            Thời gian (tháng)
          </label>
          <input
            type="number"
            min={1}
            max={12}
            value={targetMonths}
            onChange={(e) => setTargetMonths(Number(e.target.value))}
            style={inputStyle}
          />
          {error && <p style={{ color: "var(--rose)", fontSize: 13, marginTop: 12 }}>{error}</p>}
          <button className="btn-primary" style={{ marginTop: 20 }} onClick={createGoalAndGenerate} disabled={creating}>
            {creating ? "AI đang xây lộ trình..." : "Tạo lộ trình"}
          </button>
        </Panel>
      </section>
    );
  }

  if (error) return <StateMessage kind="error" text={error} />;
  if (!plan) return null;

  return (
    <section>
      <h2 style={{ fontSize: 20 }}>Lộ trình học</h2>
      <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 6 }}>
        Lộ trình tự điều chỉnh dựa trên tốc độ tiến bộ của bạn
      </p>

      <div style={{ marginTop: 20 }}>
        {plan.map((m, idx) => (
          <div key={m.month} style={{ display: "flex", gap: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 26 }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  marginTop: 4,
                  border: "2px solid var(--border)",
                  background:
                    m.topics.every((t) => t.status === "done")
                      ? "var(--cyan)"
                      : m.topics.some((t) => t.status === "current")
                      ? "var(--indigo)"
                      : "#0e1420",
                  flexShrink: 0,
                }}
              />
              {idx < plan.length - 1 && (
                <div style={{ flex: 1, width: 2, background: "var(--border)", margin: "2px 0" }} />
              )}
            </div>
            <div style={{ flex: 1, paddingBottom: 28 }}>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>{m.label}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {m.topics.map((t) => (
                  <div
                    key={t.name}
                    style={{
                      fontSize: 13,
                      padding: "7px 12px",
                      borderRadius: 9,
                      background: "var(--panel-strong)",
                      border: `1px solid ${
                        t.status === "current" ? "var(--indigo)" : t.status === "done" ? "var(--cyan)" : "var(--border)"
                      }`,
                      color:
                        t.status === "current"
                          ? "var(--indigo)"
                          : t.status === "done"
                          ? "var(--cyan)"
                          : t.status === "locked"
                          ? "var(--text-faint)"
                          : "var(--text)",
                    }}
                  >
                    {t.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  background: "var(--panel-strong)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  padding: "10px 12px",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
};
