// ================================================================
// TRANG TÀI LIỆU HỌC (Resources) — discovery + rating/report
// ================================================================

"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import type { ApiResponse } from "@/types";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  subject: string | null;
  topic: string | null;
  difficulty: string | null;
  type: string;
  url: string | null;
  averageRating: number;
  ratingCount: number;
  usageCount: number;
  qualityScore: number;
  contributor: { id: string; name: string | null; nickname: string | null };
  createdAt: string;
}

interface ListData {
  resources: Resource[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const TYPE_LABELS: Record<string, string> = {
  ARTICLE: "Bài viết",
  VIDEO: "Video",
  DOCUMENTATION: "Tài liệu",
  DOCUMENT: "Văn bản",
  WEBSITE: "Website",
  EXERCISE_SET: "Bộ bài tập",
  OTHER: "Khác",
};

const SORTS = [
  { value: "quality", label: "Chất lượng" },
  { value: "rating", label: "Đánh giá cao" },
  { value: "popular", label: "Xem nhiều" },
  { value: "newest", label: "Mới nhất" },
];

const formatNumber = (num: number) => num.toLocaleString("vi-VN");

export default function ResourcesPage() {
  const [data, setData] = useState<ListData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [type, setType] = useState("");
  const [sortBy, setSortBy] = useState("quality");
  const [showForm, setShowForm] = useState(false);
  const [rateId, setRateId] = useState<string | null>(null);
  const [rateValue, setRateValue] = useState(5);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ sortBy, limit: "20" });
      if (search.trim()) p.set("search", search.trim());
      if (subject.trim()) p.set("subject", subject.trim());
      if (difficulty) p.set("difficulty", difficulty);
      if (type) p.set("type", type);
      const res = await fetch(`/api/resources?${p.toString()}`);
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
  }, [sortBy]);

  async function submitRate() {
    if (!rateId) return;
    const res = await fetch(`/api/resources/${rateId}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: rateValue }),
    });
    const json: ApiResponse<unknown> = await res.json();
    if (!json.success) alert(json.error);
    else {
      setRateId(null);
      await load();
    }
  }

  async function openResource(r: Resource) {
    try {
      await fetch(`/api/resources/${r.id}/use`, { method: "POST" });
    } catch {
      // Ghi usage thất bại không chặn việc mở tài liệu.
    }
    if (r.url) window.open(r.url, "_blank", "noopener,noreferrer");
  }

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ fontSize: 20, margin: 0 }}>Tài liệu học 📚</h2>
        <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Đóng" : "+ Đóng góp tài liệu"}
        </button>
      </div>
      <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 0, marginBottom: 18 }}>
        Catalog chung do cộng đồng đóng góp — chất lượng tính từ đánh giá thật, lượt đọc và báo cáo.
      </p>

      {showForm && <CreateResourceForm onCreated={() => { setShowForm(false); load(); }} />}

      <Panel style={{ marginBottom: 16 }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
          style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm kiếm tiêu đề, mô tả..."
            style={{ flex: "2 1 200px", background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", color: "var(--text)", fontSize: 13.5, outline: "none" }}
          />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Môn (vd: Toán)"
            style={{ flex: "1 1 120px", background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", color: "var(--text)", fontSize: 13.5, outline: "none" }}
          />
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", color: "var(--text)", fontSize: 13.5 }}>
            <option value="">Mọi độ khó</option>
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", color: "var(--text)", fontSize: 13.5 }}>
            <option value="">Mọi loại</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", color: "var(--text)", fontSize: 13.5 }}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button type="submit" className="btn-primary" style={{ fontSize: 13 }}>Lọc</button>
        </form>
      </Panel>

      {loading && <StateMessage kind="loading" text="Đang tải tài liệu học..." />}
      {error && <StateMessage kind="error" text={error} />}
      {!loading && !error && data && data.resources.length === 0 && (
        <Panel>
          <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>
            Chưa có tài liệu nào phù hợp — hãy nới bộ lọc hoặc đóng góp tài liệu đầu tiên!
          </p>
        </Panel>
      )}

      {!loading && !error && data && data.resources.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          {data.resources.map((r) => (
            <Panel key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{r.title}</div>
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "var(--indigo-soft)", color: "var(--indigo)", fontWeight: 600, whiteSpace: "nowrap" }}>
                  {TYPE_LABELS[r.type] ?? r.type}
                </span>
              </div>
              {r.description && (
                <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 6, lineHeight: 1.5 }}>{r.description}</div>
              )}
              <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                {r.subject && <span>📚 {r.subject}</span>}
                {r.topic && <span>{r.topic}</span>}
                {r.difficulty && <span>{r.difficulty === "easy" ? "Dễ" : r.difficulty === "medium" ? "Trung bình" : "Khó"}</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span style={{ color: "var(--amber)", fontWeight: 600 }}>
                  ★ {r.averageRating > 0 ? r.averageRating.toFixed(1) : "—"} ({r.ratingCount})
                </span>
                <span>👁 {formatNumber(r.usageCount)}</span>
                <span>✦ {Math.round(r.qualityScore)}/100</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 6 }}>
                Đóng góp bởi {r.contributor.name || r.contributor.nickname || "Ẩn danh"}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                {r.url && (
                  <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => openResource(r)}>
                    Mở tài liệu
                  </button>
                )}
                <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => { setRateValue(5); setRateId(r.id); }}>
                  Đánh giá
                </button>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {rateId && (
        <div className="modal-overlay" onClick={() => setRateId(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Đánh giá tài liệu (1–5 ⭐)</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setRateValue(v)}
                  style={{
                    fontSize: 22,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    opacity: rateValue >= v ? 1 : 0.3,
                  }}
                  aria-label={`${v} sao`}
                >
                  ⭐
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn-secondary" style={{ fontSize: 13 }} onClick={() => setRateId(null)}>Hủy</button>
              <button className="btn-primary" style={{ fontSize: 13 }} onClick={submitRate}>Gửi</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function CreateResourceForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [type, setType] = useState("ARTICLE");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, subject, topic, difficulty, type, url }),
      });
      const json: ApiResponse<unknown> = await res.json();
      if (!json.success) {
        setError(json.error);
        return;
      }
      onCreated();
    } catch {
      setError("Không thể tạo tài liệu học.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = {
    background: "var(--panel-strong)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "9px 11px",
    color: "var(--text)",
    fontSize: 13.5,
    outline: "none",
    width: "100%",
  } as const;

  return (
    <Panel style={{ marginBottom: 16 }}>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input placeholder="Tiêu đề *" required value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        <textarea placeholder="Mô tả ngắn" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" as const }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder="Môn" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ ...inputStyle, flex: "1 1 120px" }} />
          <input placeholder="Chủ đề" value={topic} onChange={(e) => setTopic(e.target.value)} style={{ ...inputStyle, flex: "1 1 120px" }} />
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ ...inputStyle, flex: "1 1 120px" }}>
            <option value="easy">Dễ</option>
            <option value="medium">Trung bình</option>
            <option value="hard">Khó</option>
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...inputStyle, flex: "1 1 120px" }}>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <input placeholder="URL https://... *" required value={url} onChange={(e) => setUrl(e.target.value)} style={inputStyle} />
        {error && <p style={{ color: "var(--rose)", fontSize: 13 }}>{error}</p>}
        <button type="submit" className="btn-primary" disabled={submitting} style={{ fontSize: 13.5 }}>
          {submitting ? "Đang tạo..." : "Đóng góp"}
        </button>
      </form>
    </Panel>
  );
}
