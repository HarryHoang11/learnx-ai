// ================================================================
// TRANG TIẾN ĐỘ (Progress)
// ================================================================
// Mạch tư duy: gọi 2 API riêng biệt đúng như thiết kế ở backend —
// /api/progress (rẻ, chỉ đọc DB, gọi ngay khi vào trang) và
// /api/analytics (tốn 1 lượt gọi AI, cố ý gọi RIÊNG và hiển thị loading
// độc lập cho khối "nhận xét AI", để phần số liệu hiện ra ngay không
// phải đợi AI trả lời xong mới thấy gì).
// ================================================================

"use client";

import { useEffect, useState } from "react";
import Panel from "@/components/ui/Panel";
import StatCard from "@/components/ui/StatCard";
import SkillBar from "@/components/ui/SkillBar";
import StateMessage from "@/components/ui/StateMessage";
import type { ApiResponse, SkillMasteryPoint } from "@/types";

interface ProgressData {
  skillMap: SkillMasteryPoint[];
  totalAttempts: number;
  accuracyPercent: number;
  streakDays: number;
}

export default function ProgressPage() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [insight, setInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(true);

  useEffect(() => {
    fetch("/api/progress")
      .then((res) => res.json())
      .then((json: ApiResponse<ProgressData>) => {
        if (json.success) setProgress(json.data);
        else setError(json.error);
      })
      .catch(() => setError("Không thể kết nối tới máy chủ."))
      .finally(() => setLoading(false));

    // Gọi riêng, không chặn phần số liệu ở trên hiển thị trước
    fetch("/api/analytics")
      .then((res) => res.json())
      .then((json: ApiResponse<{ insight: string }>) => {
        if (json.success) setInsight(json.data.insight);
      })
      .finally(() => setInsightLoading(false));
  }, []);

  if (loading) return <StateMessage kind="loading" text="Đang tải tiến độ..." />;
  if (error) return <StateMessage kind="error" text={error} />;
  if (!progress) return null;

  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 18 }}>Tiến độ học tập</h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <StatCard value={`🔥 ${progress.streakDays}`} label="Ngày liên tục" />
        <StatCard value={progress.totalAttempts} label="Bài đã làm" />
        <StatCard value={`${progress.accuracyPercent}%`} label="Độ chính xác" />
        <StatCard value={progress.skillMap.length} label="Chủ đề đã theo dõi" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, marginTop: 20 }}>
        <Panel>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>Bản đồ năng lực</div>
          {progress.skillMap.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>
              Chưa có dữ liệu — hãy làm bài Kiểm tra năng lực hoặc luyện tập để bắt đầu theo dõi.
            </p>
          ) : (
            progress.skillMap.map((s) => (
              <SkillBar key={`${s.subject}-${s.topic}`} name={`${s.subject} · ${s.topic}`} percent={s.masteryPercent} isWeak={s.isWeak} />
            ))
          )}
        </Panel>

        <Panel>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>Nhận xét từ AI</div>
          {insightLoading ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>AI đang phân tích 7 ngày gần đây...</p>
          ) : (
            <div
              style={{
                background: "var(--indigo-soft)",
                border: "1px solid rgba(124,108,240,0.3)",
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 13.5,
                color: "#d7d3fb",
              }}
            >
              {insight}
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
}
