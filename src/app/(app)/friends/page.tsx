// ================================================================
// TRANG BẠN BÈ — tìm kiếm, kết bạn, lời mời, hồ sơ bạn
// ================================================================

"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import LevelProgressBar from "@/components/ui/LevelProgressBar";
import type { ApiResponse } from "@/types";

interface FriendUser {
  id: string;
  name: string | null;
  nickname: string | null;
  image: string | null;
  level: number;
  lifetimeXP: number;
}

interface RelationEntry {
  id: string;
  status: string;
  isRequester: boolean;
  createdAt: string;
  friend: FriendUser;
}

interface FriendsData {
  friends: RelationEntry[];
  incoming: RelationEntry[];
  outgoing: RelationEntry[];
}

interface SearchResult extends FriendUser {
  email: string;
  relation: { status: string; isRequester: boolean } | null;
}

interface FriendProfile {
  user: FriendUser & { lifetimeLXP: number };
  streak: { current: number; longest: number; lastLearningDay: string | null };
  masteryAvg: number;
  skillCount: number;
  achievements: { code: string; title: string; icon: string | null; unlockedAt: string }[];
  recentActivity: { type: string; subject: string | null; topic: string | null; xpAwarded: number; occurredAt: string }[];
}

type Tab = "friends" | "incoming" | "outgoing";

const formatNumber = (num: number) => num.toLocaleString("vi-VN");

export default function FriendsPage() {
  const [data, setData] = useState<FriendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("friends");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<FriendProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/friends");
      const json: ApiResponse<FriendsData> = await res.json();
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
  }, []);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(query.trim())}`);
      const json: ApiResponse<SearchResult[]> = await res.json();
      if (json.success) setResults(json.data);
    } finally {
      setSearching(false);
    }
  }

  async function postJSON(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json: ApiResponse<unknown> = await res.json();
    if (!json.success) alert(json.error);
    else {
      setResults(null);
      setQuery("");
      await load();
    }
  }

  async function removeFriendship(friendshipId: string, label: string) {
    if (!confirm(`${label}?`)) return;
    const res = await fetch(`/api/friends/${friendshipId}`, { method: "DELETE" });
    const json: ApiResponse<unknown> = await res.json();
    if (!json.success) alert(json.error);
    else await load();
  }

  async function openProfile(friendId: string) {
    setProfileId(friendId);
    setProfile(null);
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/friends/${friendId}`);
      const json: ApiResponse<FriendProfile> = await res.json();
      if (json.success) setProfile(json.data);
      else alert(json.error);
    } finally {
      setProfileLoading(false);
    }
  }

  if (loading) return <StateMessage kind="loading" text="Đang tải bạn bè..." />;
  if (error) return <StateMessage kind="error" text={error} />;

  const list =
    tab === "friends" ? data?.friends ?? [] : tab === "incoming" ? data?.incoming ?? [] : data?.outgoing ?? [];

  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>Bạn bè</h2>
      <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 0, marginBottom: 18 }}>
        Kết bạn để so tài học tập và xem tiến độ của nhau.
      </p>

      <Panel style={{ marginBottom: 16 }}>
        <form onSubmit={search} style={{ display: "flex", gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên, nickname hoặc email (≥ 2 ký tự)..."
            style={{ flex: 1, background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", color: "var(--text)", fontSize: 13.5, outline: "none" }}
          />
          <button type="submit" className="btn-primary" disabled={searching} style={{ fontSize: 13 }}>
            {searching ? "..." : "Tìm"}
          </button>
        </form>
        {results && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {results.length === 0 && (
              <p style={{ color: "var(--text-dim)", fontSize: 13 }}>Không tìm thấy ai phù hợp.</p>
            )}
            {results.map((u) => (
              <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 4px", borderTop: "1px solid var(--border-soft)" }}>
                <div style={{ fontSize: 13.5 }}>
                  <strong>{u.name || u.nickname || "Ẩn danh"}</strong>
                  <span style={{ color: "var(--text-dim)" }}> · Lv.{u.level} · {formatNumber(u.lifetimeXP)} XP</span>
                </div>
                {!u.relation && (
                  <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => postJSON("/api/friends/request", { addresseeId: u.id })}>
                    Kết bạn
                  </button>
                )}
                {u.relation?.status === "PENDING" && (
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    {u.relation.isRequester ? "Đã gửi lời mời" : "Đang chờ bạn duyệt (xem tab Lời mời)"}
                  </span>
                )}
                {u.relation?.status === "ACCEPTED" && (
                  <span style={{ fontSize: 12, color: "var(--cyan)" }}>✓ Bạn bè</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {(
          [
            { key: "friends", label: `Bạn bè (${data?.friends.length ?? 0})` },
            { key: "incoming", label: `Lời mời đến (${data?.incoming.length ?? 0})` },
            { key: "outgoing", label: `Đã gửi (${data?.outgoing.length ?? 0})` },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={tab === t.key ? "btn-primary" : "btn-secondary"} style={{ fontSize: 13 }}>
            {t.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Panel>
          <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>
            {tab === "friends" && "Chưa có bạn bè — hãy tìm kiếm và gửi lời mời ở trên."}
            {tab === "incoming" && "Không có lời mời nào đang chờ."}
            {tab === "outgoing" && "Bạn chưa gửi lời mời nào."}
          </p>
        </Panel>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {list.map((r) => (
            <Panel key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{r.friend.name || r.friend.nickname || "Ẩn danh"}</div>
                <span style={{ fontSize: 12, color: "var(--amber)", fontWeight: 600 }}>Lv.{r.friend.level}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>
                {formatNumber(r.friend.lifetimeXP)} XP
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => openProfile(r.friend.id)}>
                  Xem hồ sơ
                </button>
                {tab === "incoming" && (
                  <>
                    <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => postJSON("/api/friends/respond", { friendshipId: r.id, action: "accept" })}>
                      Chấp nhận
                    </button>
                    <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => postJSON("/api/friends/respond", { friendshipId: r.id, action: "reject" })}>
                      Từ chối
                    </button>
                  </>
                )}
                {tab === "outgoing" && (
                  <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => removeFriendship(r.id, "Hủy lời mời đã gửi")}>
                    Hủy lời mời
                  </button>
                )}
                {tab === "friends" && (
                  <button className="btn-secondary" style={{ fontSize: 12, color: "var(--rose)" }} onClick={() => removeFriendship(r.id, "Xóa bạn này khỏi danh sách")}>
                    Xóa bạn
                  </button>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}

      {profileId && (
        <div className="modal-overlay" onClick={() => { setProfileId(null); setProfile(null); }}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            {profileLoading && <StateMessage kind="loading" text="Đang tải hồ sơ..." />}
            {profile && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>{profile.user.name || profile.user.nickname || "Ẩn danh"}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>
                      Level {profile.user.level} · {formatNumber(profile.user.lifetimeXP)} XP · {formatNumber(profile.user.lifetimeLXP)} LXP · 🔥 {profile.streak.current} ngày · Mastery TB {profile.masteryAvg}% ({profile.skillCount} chủ đề)
                    </div>
                  </div>
                  <button onClick={() => { setProfileId(null); setProfile(null); }} aria-label="Đóng" style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>
                    ×
                  </button>
                </div>
                <LevelProgressBar lifetimeXP={profile.user.lifetimeXP} />
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  Huy hiệu ({profile.achievements.length})
                </div>
                {profile.achievements.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Chưa có huy hiệu nào.</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {profile.achievements.slice(0, 12).map((a) => (
                      <span key={a.code} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 99, background: "var(--panel-strong)", border: "1px solid var(--border)" }}>
                        {a.icon} {a.title}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Hoạt động gần đây</div>
                {profile.recentActivity.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>Chưa có hoạt động nào.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {profile.recentActivity.map((a, i) => (
                      <div key={i} style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
                        {a.type}{a.subject ? ` · ${a.subject}` : ""}{a.topic ? ` — ${a.topic}` : ""} (+{a.xpAwarded} XP)
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
