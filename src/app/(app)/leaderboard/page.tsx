// ================================================================
// BẢNG XẾP HẠNG — Global / Bạn bè / Môn học / Đóng góp
// ================================================================

"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import type { ApiResponse } from "@/types";

type Scope = "global" | "friends" | "subject" | "contributor";

interface XpEntry {
  userId: string;
  name: string | null;
  nickname: string | null;
  image: string | null;
  level: number;
  lifetimeXP: number;
  rank: number;
  avgMastery?: number;
  topicCount?: number;
}

interface ContributorEntry {
  userId: string;
  name: string;
  nickname?: string;
  image?: string;
  contributionPoints: number;
  level: number;
  totalUploads: number;
  avgQuality: number;
  helpfulVotes: number;
  rank: number;
}

const formatNumber = (num: number) => num.toLocaleString("vi-VN");

const TABS: { key: Scope; label: string }[] = [
  { key: "global", label: "Toàn hệ thống" },
  { key: "friends", label: "Bạn bè" },
  { key: "subject", label: "Theo môn" },
  { key: "contributor", label: "Đóng góp" },
];

export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>("global");
  const [entries, setEntries] = useState<XpEntry[]>([]);
  const [contributors, setContributors] = useState<ContributorEntry[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [subject, setSubject] = useState("Toán");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(s: Scope, subj: string) {
    setLoading(true);
    setError(null);
    try {
      if (s === "contributor") {
        const res = await fetch("/api/community/leaderboard?period=alltime&limit=20");
        const json: ApiResponse<ContributorEntry[]> = await res.json();
        if (json.success) setContributors(json.data);
        else setError(json.error);
      } else if (s === "subject") {
        if (!subj.trim()) {
          setEntries([]);
          return;
        }
        const res = await fetch(`/api/leaderboard/subject?subject=${encodeURIComponent(subj.trim())}&limit=20`);
        const json: ApiResponse<XpEntry[]> = await res.json();
        if (json.success) setEntries(json.data);
        else setError(json.error);
      } else {
        const res = await fetch(`/api/leaderboard?scope=${s}&limit=20`);
        const json: ApiResponse<{ entries: XpEntry[]; myRank: number | null } | XpEntry[]> = await res.json();
        if (!json.success) {
          setError(json.error);
          return;
        }
        if (Array.isArray(json.data)) {
          setEntries(json.data);
          setMyRank(null);
        } else {
          setEntries(json.data.entries);
          setMyRank(json.data.myRank);
        }
      }
    } catch {
      setError("Không thể kết nối tới máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(scope, subject);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>Bảng xếp hạng 🏆</h2>
      <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 0, marginBottom: 18 }}>
        Mọi điểm số lấy từ dữ liệu học tập thật — mở trang hay bấm nút không cộng điểm.
        {myRank !== null && scope === "global" && <> Hạng của bạn: <strong>#{myRank}</strong>.</>}
      </p>

      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setScope(t.key)} className={scope === t.key ? "btn-primary" : "btn-secondary"} style={{ fontSize: 13 }}>
            {t.label}
          </button>
        ))}
      </div>

      {scope === "subject" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            load("subject", subject);
          }}
          style={{ display: "flex", gap: 8, marginBottom: 16 }}
        >
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Nhập tên môn (vd: Toán)"
            style={{ flex: 1, background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", color: "var(--text)", fontSize: 13.5, outline: "none" }}
          />
          <button type="submit" className="btn-secondary" style={{ fontSize: 13 }}>Xem</button>
        </form>
      )}

      {loading && <StateMessage kind="loading" text="Đang tải bảng xếp hạng..." />}
      {error && <StateMessage kind="error" text={error} />}

      {!loading && !error && scope !== "contributor" && entries.length === 0 && (
        <Panel><p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>Chưa có dữ liệu xếp hạng.</p></Panel>
      )}

      {!loading && !error && scope !== "contributor" && entries.length > 0 && (
        <Panel>
          {entries.map((e) => (
            <div key={e.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 4px", borderBottom: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 30, fontWeight: 700, color: e.rank <= 3 ? "var(--amber)" : "var(--text-dim)" }}>#{e.rank}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{e.name || e.nickname || "Ẩn danh"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    Lv.{e.level}
                    {e.avgMastery !== undefined && <> · Mastery TB {e.avgMastery}% ({e.topicCount} chủ đề)</>}
                  </div>
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--cyan)" }}>{formatNumber(e.lifetimeXP)} XP</div>
            </div>
          ))}
        </Panel>
      )}

      {!loading && !error && scope === "contributor" && contributors.length === 0 && (
        <Panel><p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>Chưa có dữ liệu đóng góp.</p></Panel>
      )}

      {!loading && !error && scope === "contributor" && contributors.length > 0 && (
        <Panel>
          {contributors.map((e) => (
            <div key={e.userId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 4px", borderBottom: "1px solid var(--border-soft)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 30, fontWeight: 700, color: e.rank <= 3 ? "var(--amber)" : "var(--text-dim)" }}>#{e.rank}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{e.name || e.nickname || "Ẩn danh"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    {e.totalUploads} tài liệu · Chất lượng {Math.round(e.avgQuality)}
                  </div>
                </div>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--amber)" }}>{formatNumber(e.contributionPoints)} CP</div>
            </div>
          ))}
        </Panel>
      )}
    </section>
  );
}
