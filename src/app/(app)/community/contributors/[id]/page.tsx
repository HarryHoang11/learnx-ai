// ================================================================
// TRANG HỒ SƠ NGƯỜI ĐÓNG GÓP
// ================================================================

"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import type { ApiResponse } from "@/types";

export default function ContributorProfilePage() {
  const router = useRouter();
  const routeParams = useParams();
  const contributorId = typeof routeParams?.id === "string" ? routeParams.id : "";
  const [profileData, setProfileData] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [docLoading, setDocLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, [contributorId]);

  async function loadProfile() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/community/contributors/${contributorId}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Không tìm thấy người đóng góp");
        return;
      }
      const data = json.data;
      setProfileData(data);
      setDocuments(data.documents || []);
    } catch (err) {
      setError("Không thể tải hồ sơ người đóng góp");
    } finally {
      setLoading(false);
    }
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  }

  if (loading) return <StateMessage kind="loading" text="Đang tải hồ sơ..." />;
  if (error) return <StateMessage kind="error" text={error} />;
  if (!profileData) return null;
  if (!profileData.profile) return <StateMessage kind="error" text="Không tìm thấy người đóng góp" />;

  const { profile, documents: profileDocuments, stats, recentActivity } = profileData;
  const { user, contributionPoints, level, totalUploads, avgQuality, helpfulVotes, totalDownloads, totalSaves, currentStreak, longestStreak, lastContributionAt } = profile;

  return (
    <section style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {user.image ? (
              <img src={user.image} alt="" style={{ width: 80, height: 80, borderRadius: "50%", border: "3px solid var(--border)" }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg, var(--indigo), var(--cyan))", display: "flex", alignItems: "center", justifyContent: "center", color: "#0a0e16", fontWeight: 700, fontSize: 28 }}>
                {(user.name || user.nickname || "?")[0].toUpperCase()}
              </div>
            )}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h1 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>{user.name || "Ẩn danh"}</h1>
                {user.nickname && <span style={{ color: "var(--text-dim)", fontSize: 18, fontWeight: 500 }}>({user.nickname})</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 8, fontSize: 14, color: "var(--text-dim)" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: "var(--amber)" }}>⭐</span> Level {level}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: "var(--amber)" }}>🌟</span> {formatNumber(contributionPoints)} CP</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ color: "var(--cyan)" }}>🔥</span> {currentStreak} ngày liên tục</span>
              </div>
            </div>
          </div>

          {profileData.profile && (
            <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
              <a href={`/community/contributors/${contributorId}/documents`} style={{ textDecoration: "none" }}>
                <Panel style={{ flex: 1, minWidth: 180, textAlign: "center", padding: "20px 16px", cursor: "pointer", transition: "all 0.15s ease" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "var(--cyan)" }}>{formatNumber(totalUploads)}</div>
                  <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>Tài liệu</div>
                </Panel>
              </a>
              <Panel style={{ flex: 1, minWidth: 180, textAlign: "center", padding: "20px 16px" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--amber)" }}>{avgQuality.toFixed(0)}</div>
                <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>Chất lượng TB</div>
              </Panel>
              <Panel style={{ flex: 1, minWidth: 180, textAlign: "center", padding: "20px 16px" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--green)" }}>{formatNumber(helpfulVotes)}</div>
                <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>Lượt hữu ích</div>
              </Panel>
              <Panel style={{ flex: 1, minWidth: 180, textAlign: "center", padding: "20px 16px" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "var(--indigo)" }}>{formatNumber(totalDownloads)}</div>
                <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>Lượt tải</div>
              </Panel>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 24 }}>
          <Panel>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>Tổng tải về</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{formatNumber(totalDownloads)}</div>
          </Panel>
          <Panel>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>Lượt lưu</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{formatNumber(totalSaves)}</div>
          </Panel>
          <Panel>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>Chất lượng TB</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--cyan)" }}>{avgQuality.toFixed(1)}</div>
          </Panel>
          <Panel>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 4 }}>Lượt hữu ích</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--green)" }}>{formatNumber(helpfulVotes)}</div>
          </Panel>
        </div>

        {/* Top Subjects */}
        {profile.topSubjects && profile.topSubjects.length > 0 && (
          <Panel style={{ marginTop: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>Môn học mạnh</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {profile.topSubjects.map((s: any) => (
                <span key={s.subject} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "var(--panel-strong)", borderRadius: 99, fontSize: 13, fontWeight: 500, border: "1px solid var(--border-soft)" }}>
                  <span style={{ color: "var(--indigo)" }}>📚</span>
                  <span>{s.subject}</span>
                  <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>({s.count})</span>
                </span>
              ))}
            </div>
          </Panel>
        )}

        {/* Recent Documents */}
        {documents.length > 0 && (
          <Panel style={{ marginTop: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>Tài liệu gần đây</div>
              <a href="/community?author=" style={{ fontSize: 13, color: "var(--cyan)", fontWeight: 500 }}>Xem tất cả →</a>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {documents.slice(0, 6).map(doc => (
                <div key={doc.id} style={{ padding: 16, background: "var(--panel-strong)", border: "1px solid var(--border-soft)", borderRadius: 12, transition: "all 0.15s ease" }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{doc.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>
                    {doc.subject && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, marginRight: 8 }}>{doc.subject.icon} {doc.subject.name}</span>}
                    {doc.topic && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", background: "var(--indigo-soft)", borderRadius: 99, fontSize: 11, fontWeight: 600, color: "var(--indigo)" }}>{doc.topic.name}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 11, color: "var(--text-faint)" }}>
                    <span>⭐ {doc.averageRating > 0 ? doc.averageRating.toFixed(1) : "—"}</span>
                    <span>👁 {formatNumber(doc.viewCount || 0)}</span>
                    <span>⬇ {formatNumber(doc.downloadCount || 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {/* Activity Timeline */}
        {recentActivity && recentActivity.length > 0 && (
          <Panel style={{ marginTop: 24 }}>
            <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>Hoạt động gần đây</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {recentActivity.slice(0, 10).map((activity: any, index: number) => (
                <div key={index} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px", background: "var(--panel-strong)", borderRadius: 10, border: "1px solid var(--border-soft)" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--indigo-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--indigo)", fontWeight: 600, fontSize: 14, flexShrink: 0 }}>
                    {activity.type === "upload" && "📤"}
                    {activity.type === "rating" && "⭐"}
                    {activity.type === "review" && "💬"}
                    {activity.type === "download" && "⬇️"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>
                      {activity.type === "upload" && "Đã tải lên tài liệu"}
                      {activity.type === "rating" && "Đã đánh giá tài liệu"}
                      {activity.type === "review" && "Đã viết đánh giá"}
                      {activity.type === "download" && "Đã tải tài liệu"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                      {activity.documentTitle && <span style={{ fontWeight: 500, marginRight: 8 }}>{activity.documentTitle}</span>}
                      {new Date(activity.occurredAt).toLocaleString("vi-VN")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </section>
  );
}
