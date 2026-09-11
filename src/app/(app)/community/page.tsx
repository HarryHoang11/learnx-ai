// ================================================================
// TRANG CỘNG ĐỒNG (Community Browse)
// ================================================================

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import SubjectFilter from "@/components/community/SubjectFilter";
import CommunityDocumentCard from "@/components/community/DocumentCard";
import ContributorLeaderboard from "@/components/community/ContributorLeaderboard";
import type { ApiResponse, SubjectWithTopics, BrowseFilters } from "@/types";
import type { LeaderboardEntry } from "@/services/contribution.service";

const SORT_OPTIONS = [
  { value: "newest", label: "Mới nhất" },
  { value: "quality", label: "Chất lượng cao" },
  { value: "popular", label: "Phổ biến" },
  { value: "rating", label: "Đánh giá cao" },
  { value: "downloads", label: "Tải nhiều nhất" },
];

const TRUST_LEVELS = [
  { value: "", label: "Tất cả" },
  { value: "HIGH_QUALITY", label: "Chất lượng cao" },
  { value: "COMMUNITY_VERIFIED", label: "Đã xác minh" },
  { value: "NEW", label: "Mới" },
  { value: "NEEDS_REVIEW", label: "Cần xem xét" },
  { value: "LOW_QUALITY", label: "Chất lượng thấp" },
];

// Next.js yêu cầu mọi component dùng useSearchParams() phải nằm trong
// <Suspense> (xem tutor/page.tsx) — tách Inner ra để bọc ở export mặc định.
export default function CommunityPage() {
  return (
    <Suspense fallback={<p className="state-msg">Đang tải...</p>}>
      <CommunityPageInner />
    </Suspense>
  );
}

function CommunityPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [subjects, setSubjects] = useState<SubjectWithTopics[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [docLoading, setDocLoading] = useState(false);
  const [lbLoading, setLbLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalDocs, setTotalDocs] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [filters, setFilters] = useState<BrowseFilters>({
    subjectId: searchParams.get("subjectId") || "",
    topicId: searchParams.get("topicId") || "",
    difficulty: searchParams.get("difficulty") || "",
    language: searchParams.get("language") || "",
    grade: searchParams.get("grade") || "",
    search: searchParams.get("search") || "",
    sortBy: searchParams.get("sortBy") || "newest",
    trustLevel: searchParams.get("trustLevel") || "",
    page: parseInt(searchParams.get("page") || "1"),
    limit: 20,
  });

  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"weekly" | "monthly" | "alltime">("alltime");
  const [lbSubjectId, setLbSubjectId] = useState<string | undefined>(undefined);

  async function loadSubjects() {
    try {
      const res = await fetch("/api/community/subjects?includeTopics=true");
      const json = await res.json();
      if (json.success) setSubjects(json.data);
    } catch (err) {
      console.error("Failed to load subjects:", err);
    }
  }

  async function loadDocuments(append = false) {
    if (append) setDocLoading(true);
    else setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.set(key, String(value));
      });
      if (append) params.set("page", String(filters.page + 1));

      const res = await fetch(`/api/community/documents?${params.toString()}`);
      const json = await res.json();

      if (json.success) {
        if (append) {
          setDocuments(prev => [...prev, ...json.data.documents]);
        } else {
          setDocuments(json.data.documents);
        }
        setTotalDocs(json.data.total);
        setTotalPages(json.data.totalPages);
      } else {
        setError(json.error || "Không thể tải tài liệu");
      }
    } catch (err) {
      setError("Không thể kết nối tới máy chủ");
    } finally {
      setLoading(false);
      setDocLoading(false);
    }
  }

  async function loadLeaderboard() {
    setLbLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("period", leaderboardPeriod);
      if (lbSubjectId) params.set("subjectId", lbSubjectId);
      params.set("limit", "10");

      const res = await fetch(`/api/community/leaderboard?${params.toString()}`);
      const json = await res.json();
      if (json.success) setLeaderboard(json.data);
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
    } finally {
      setLbLoading(false);
    }
  }

  useEffect(() => {
    loadSubjects();
    loadLeaderboard();
  }, []);

  useEffect(() => {
    loadDocuments(false);
  }, [filters.subjectId, filters.topicId, filters.difficulty, filters.language, filters.grade, filters.search, filters.sortBy, filters.trustLevel, filters.page]);

  async function handleSubjectChange(subjectId: string) {
    setFilters(prev => ({ ...prev, subjectId, topicId: "", page: 1 }));
  }

  async function handleTopicChange(topicId: string) {
    setFilters(prev => ({ ...prev, topicId, page: 1 }));
  }

  function handleClearFilters() {
    setFilters(prev => ({ ...prev, subjectId: "", topicId: "", page: 1 }));
  }

  function handleSortChange(sortBy: string) {
    setFilters(prev => ({ ...prev, sortBy, page: 1 }));
  }

  function handleTrustLevelChange(trustLevel: string) {
    setFilters(prev => ({ ...prev, trustLevel, page: 1 }));
  }

  function handlePageChange(page: number) {
    setFilters(prev => ({ ...prev, page }));
  }

  function handleLoadMore() {
    if (filters.page < totalPages && !docLoading) {
      setFilters(prev => ({ ...prev, page: prev.page + 1 }));
    }
  }

  function handleLeaderboardPeriodChange(period: "weekly" | "monthly" | "alltime") {
    setLeaderboardPeriod(period);
    loadLeaderboard();
  }

  function handleLbSubjectChange(subjectId: string | undefined) {
    setLbSubjectId(subjectId);
    loadLeaderboard();
  }

  const hasFilters = filters.subjectId || filters.topicId || filters.difficulty || filters.language || filters.grade || filters.search || filters.trustLevel;

  return (
    <section>
      <div style={{ display: "flex", gap: 24, marginBottom: 24 }}>
        {/* Sidebar - Filters */}
        <aside style={{ width: 320, flexShrink: 0 }}>
          <SubjectFilter
            subjects={subjects}
            selectedSubjectId={filters.subjectId || undefined}
            selectedTopicId={filters.topicId || undefined}
            onSubjectChange={handleSubjectChange}
            onTopicChange={handleTopicChange}
            onClear={handleClearFilters}
          />

          <Panel style={{ marginTop: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Bộ lọc khác</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>Độ khó</label>
                <select
                  value={filters.difficulty}
                  onChange={(e) => setFilters(prev => ({ ...prev, difficulty: e.target.value, page: 1 }))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "var(--panel-strong)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text)",
                    fontSize: 13,
                  }}
                >
                  <option value="">Tất cả</option>
                  <option value="easy">Dễ</option>
                  <option value="medium">Trung bình</option>
                  <option value="hard">Khó</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>Độ tin cậy</label>
                <select
                  value={filters.trustLevel}
                  onChange={(e) => setFilters(prev => ({ ...prev, trustLevel: e.target.value, page: 1 }))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "var(--panel-strong)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text)",
                    fontSize: 13,
                  }}
                >
                  {TRUST_LEVELS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-dim)", marginBottom: 6 }}>Sắp xếp</label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value, page: 1 }))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "var(--panel-strong)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--text)",
                    fontSize: 13,
                  }}
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </Panel>
        </aside>

        {/* Main Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 600 }}>Cộng đồng Kiến thức</h1>
              <p style={{ color: "var(--text-dim)", marginTop: 4 }}>
                Khám phá, chia sẻ và học tập từ tài liệu cộng đồng
              </p>
            </div>
            <button
              className="btn-primary"
              onClick={() => router.push("/community/upload")}
              style={{ padding: "10px 18px", fontSize: 13.5 }}
            >
              ⬆ Tải tài liệu
            </button>
          </div>

          {/* Stats Bar */}
          <div style={{ display: "flex", gap: 24, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--panel)", borderRadius: 8, border: "1px solid var(--border-soft)" }}>
              <span style={{ color: "var(--cyan)" }}>📄</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{documents.length + (totalDocs - documents.length > 0 ? ` / ${totalDocs}` : "")}</div>
                <div style={{ fontSize: 11, color: "var(--text-faint)" }}>Tài liệu</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "var(--panel)", borderRadius: 8, border: "1px solid var(--border-soft)" }}>
              <span style={{ color: "var(--indigo)" }}>👥</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{leaderboard.length > 0 ? leaderboard[0].contributionPoints : 0} CP</div>
                <div style={{ fontSize: 11, color: "var(--text-faint)" }}>Top contributor</div>
              </div>
            </div>
          </div>

          {/* Search & Sort Bar */}
          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
              <input
                type="text"
                placeholder="🔍 Tìm kiếm tài liệu, chủ đề, tác giả..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
                style={{
                  width: "100%",
                  padding: "10px 14px 10px 40px",
                  background: "var(--panel-strong)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  color: "var(--text)",
                  fontSize: 13.5,
                  outline: "none",
                }}
              />
            </div>
          </div>

          {hasFilters && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Bộ lọc:</span>
              {filters.subjectId && subjects.find(s => s.id === filters.subjectId) && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "var(--indigo-soft)", borderRadius: 99, fontSize: 12, color: "var(--indigo)" }}>
                  {subjects.find(s => s.id === filters.subjectId)?.icon} {subjects.find(s => s.id === filters.subjectId)?.name}
                  <button onClick={() => setFilters(p => ({ ...p, subjectId: "", topicId: "", page: 1 }))} style={{ marginLeft: 4, background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              )}
              {filters.topicId && subjects.find(s => s.id === filters.subjectId)?.topics?.find(t => t.id === filters.topicId) && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "var(--indigo-soft)", borderRadius: 99, fontSize: 12, color: "var(--indigo)" }}>
                  {subjects.find(s => s.id === filters.subjectId)?.topics?.find(t => t.id === filters.topicId)?.name}
                  <button onClick={() => setFilters(p => ({ ...p, topicId: "", page: 1 }))} style={{ marginLeft: 4, background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              )}
              {filters.difficulty && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "var(--amber-soft)", borderRadius: 99, fontSize: 12, color: "var(--amber)" }}>
                  {filters.difficulty === "easy" ? "Dễ" : filters.difficulty === "medium" ? "Trung bình" : "Khó"}
                  <button onClick={() => setFilters(p => ({ ...p, difficulty: "", page: 1 }))} style={{ marginLeft: 4, background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              )}
              {filters.trustLevel && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "var(--rose-soft)", borderRadius: 99, fontSize: 12, color: "var(--rose)" }}>
                  {TRUST_LEVELS.find(t => t.value === filters.trustLevel)?.label}
                  <button onClick={() => setFilters(p => ({ ...p, trustLevel: "", page: 1 }))} style={{ marginLeft: 4, background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              )}
              <button
                onClick={() => setFilters(p => ({ ...p, subjectId: "", topicId: "", difficulty: "", trustLevel: "", page: 1 }))}
                style={{ padding: "4px 10px", background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 99, fontSize: 12, color: "var(--text-dim)", cursor: "pointer" }}
              >
                Xóa tất cả bộ lọc
              </button>
            </div>
          )}

          {/* Document Grid */}
          {loading && <StateMessage kind="loading" text="Đang tải tài liệu..." />}
          {error && <StateMessage kind="error" text={error} />}
          {!loading && !error && documents.length === 0 && (
            <StateMessage kind="loading" text="Chưa có tài liệu nào phù hợp. Hãy thử bỏ bộ lọc hoặc tải tài liệu mới!" />
          )}
          {!loading && !error && documents.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
              {documents.map(doc => (
                <CommunityDocumentCard
                  key={doc.id}
                  document={doc}
                  onClick={() => router.push(`/community/documents/${doc.id}`)}
                  onSave={() => { /* TODO */ }}
                  onDownload={() => { /* TODO */ }}
                  saved={false}
                />
              ))}
            </div>
          )}

          {/* Load More */}
          {!loading && !docLoading && filters.page < totalPages && (
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <button
                className="btn-secondary"
                onClick={handleLoadMore}
                disabled={docLoading}
                style={{ padding: "12px 24px", fontSize: 13.5 }}
              >
                {docLoading ? "Đang tải..." : `Xem thêm (${documents.length}/${totalDocs})`}
              </button>
            </div>
          )}

          {/* Leaderboard Sidebar on Desktop - could be moved to separate page */}
          {leaderboard.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>🏆 Top Contributors</h2>
              <ContributorLeaderboard
                leaderboard={leaderboard.slice(0, 5)}
                period={leaderboardPeriod}
                onPeriodChange={handleLeaderboardPeriodChange}
                loading={lbLoading}
              />
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <button
                  className="btn-secondary"
                  onClick={() => router.push("/community/leaderboard")}
                  style={{ padding: "8px 16px", fontSize: 12.5 }}
                >
                  Xem bảng xếp hạng đầy đủ →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function formatNumber(num: number) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}