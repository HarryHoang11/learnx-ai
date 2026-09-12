// ================================================================
// TRANG BẠN BÈ — tìm kiếm, kết bạn, lời mời, hồ sơ bạn
// ================================================================

"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import LevelProgressBar from "@/components/ui/LevelProgressBar";
import { useToast } from "@/components/ui/Toast";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { localeFor } from "@/lib/i18n/dictionary";
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

export default function FriendsPage() {
  const { t, lang } = useLanguage();
  const { push } = useToast();
  const formatNumber = (num: number) => num.toLocaleString(localeFor(lang));
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
      setError(t("common.connectionError"));
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
    if (!json.success) push("error", json.error);
    else {
      setResults(null);
      setQuery("");
      await load();
    }
  }

  async function removeFriendship(friendshipId: string, confirmKey: "friends.cancelInviteConfirm" | "friends.removeConfirm") {
    if (!confirm(t(confirmKey))) return;
    const res = await fetch(`/api/friends/${friendshipId}`, { method: "DELETE" });
    const json: ApiResponse<unknown> = await res.json();
    if (!json.success) push("error", json.error);
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
      else push("error", json.error);
    } finally {
      setProfileLoading(false);
    }
  }

  if (loading) return <StateMessage kind="loading" text={t("friends.loading")} />;
  if (error) return <StateMessage kind="error" text={error} />;

  const list =
    tab === "friends" ? data?.friends ?? [] : tab === "incoming" ? data?.incoming ?? [] : data?.outgoing ?? [];

  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>{t("friends.title")}</h2>
      <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 0, marginBottom: 18 }}>
        {t("friends.subtitle")}
      </p>

      <Panel style={{ marginBottom: 16 }}>
        <form onSubmit={search} style={{ display: "flex", gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("friends.searchPh")}
            style={{ flex: 1, background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", color: "var(--text)", fontSize: 13.5, outline: "none" }}
          />
          <button type="submit" className="btn-primary" disabled={searching} style={{ fontSize: 13 }}>
            {searching ? "..." : t("friends.search")}
          </button>
        </form>
        {results && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {results.length === 0 && (
              <p style={{ color: "var(--text-dim)", fontSize: 13 }}>{t("friends.noResult")}</p>
            )}
            {results.map((u) => (
              <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "8px 4px", borderTop: "1px solid var(--border-soft)" }}>
                <div style={{ fontSize: 13.5 }}>
                  <strong>{u.name || u.nickname || t("friends.anonymous")}</strong>
                  <span style={{ color: "var(--text-dim)" }}> · Lv.{u.level} · {formatNumber(u.lifetimeXP)} XP</span>
                </div>
                {!u.relation && (
                  <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => postJSON("/api/friends/request", { addresseeId: u.id })}>
                    {t("friends.add")}
                  </button>
                )}
                {u.relation?.status === "PENDING" && (
                  <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                    {u.relation.isRequester ? t("friends.sent") : t("friends.pendingHint")}
                  </span>
                )}
                {u.relation?.status === "ACCEPTED" && (
                  <span style={{ fontSize: 12, color: "var(--cyan)" }}>{t("friends.isFriend")}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {(
          [
            { key: "friends", label: t("friends.tabFriends", { n: data?.friends.length ?? 0 }) },
            { key: "incoming", label: t("friends.tabIncoming", { n: data?.incoming.length ?? 0 }) },
            { key: "outgoing", label: t("friends.tabOutgoing", { n: data?.outgoing.length ?? 0 }) },
          ] as { key: Tab; label: string }[]
        ).map((tb) => (
          <button key={tb.key} onClick={() => setTab(tb.key)} className={tab === tb.key ? "btn-primary" : "btn-secondary"} style={{ fontSize: 13 }}>
            {tb.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <Panel>
          <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>
            {tab === "friends" && t("friends.emptyFriends")}
            {tab === "incoming" && t("friends.emptyIncoming")}
            {tab === "outgoing" && t("friends.emptyOutgoing")}
          </p>
        </Panel>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {list.map((r) => (
            <Panel key={r.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{r.friend.name || r.friend.nickname || t("friends.anonymous")}</div>
                <span style={{ fontSize: 12, color: "var(--amber)", fontWeight: 600 }}>Lv.{r.friend.level}</span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>
                {formatNumber(r.friend.lifetimeXP)} XP
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => openProfile(r.friend.id)}>
                  {t("friends.viewProfile")}
                </button>
                {tab === "incoming" && (
                  <>
                    <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => postJSON("/api/friends/respond", { friendshipId: r.id, action: "accept" })}>
                      {t("friends.accept")}
                    </button>
                    <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => postJSON("/api/friends/respond", { friendshipId: r.id, action: "reject" })}>
                      {t("friends.reject")}
                    </button>
                  </>
                )}
                {tab === "outgoing" && (
                  <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => removeFriendship(r.id, "friends.cancelInviteConfirm")}>
                    {t("friends.cancelInvite")}
                  </button>
                )}
                {tab === "friends" && (
                  <button className="btn-secondary" style={{ fontSize: 12, color: "var(--rose)" }} onClick={() => removeFriendship(r.id, "friends.removeConfirm")}>
                    {t("friends.remove")}
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
            {profileLoading && <StateMessage kind="loading" text={t("friends.profileLoading")} />}
            {profile && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 700 }}>{profile.user.name || profile.user.nickname || t("friends.anonymous")}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>
                      {t("friends.profileStats", {
                        lv: profile.user.level,
                        xp: formatNumber(profile.user.lifetimeXP),
                        lxp: formatNumber(profile.user.lifetimeLXP),
                        streak: profile.streak.current,
                        avg: profile.masteryAvg,
                        n: profile.skillCount,
                      })}
                    </div>
                  </div>
                  <button onClick={() => { setProfileId(null); setProfile(null); }} aria-label={t("common.close")} style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>
                    ×
                  </button>
                </div>
                <LevelProgressBar lifetimeXP={profile.user.lifetimeXP} />
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                  {t("friends.badges", { n: profile.achievements.length })}
                </div>
                {profile.achievements.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{t("friends.noBadges")}</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                    {profile.achievements.slice(0, 12).map((a) => (
                      <span key={a.code} style={{ fontSize: 12, padding: "4px 10px", borderRadius: 99, background: "var(--panel-strong)", border: "1px solid var(--border)" }}>
                        {a.icon} {a.title}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{t("friends.recentActivity")}</div>
                {profile.recentActivity.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{t("friends.noActivity")}</p>
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
