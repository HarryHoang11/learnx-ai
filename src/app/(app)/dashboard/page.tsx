// ================================================================
// TRANG CHỦ (Home)
// ================================================================
// Mạch tư duy: trang này lấy dữ liệu THẬT từ /api/progress (đã xây ở
// backend) để hiển thị stats + đề xuất ôn tập dựa trên topic yếu
// nhất — KHÔNG hard-code số liệu như bản demo HTML tĩnh trước đó.
// Ô "Hỏi LearnX AI" chuyển thẳng sang trang /tutor kèm câu hỏi qua
// query param, để AI Tutor xử lý tiếp (tránh trang Home tự gọi luôn
// /api/ai/chat — giữ đúng nguyên tắc 1 trang lo 1 việc).
// ================================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import StatCard from "@/components/ui/StatCard";
import StateMessage from "@/components/ui/StateMessage";
import TodaySchedule from "@/components/calendar/TodaySchedule";
import type { ApiResponse, SkillMasteryPoint } from "@/types";

interface ProgressData {
  skillMap: SkillMasteryPoint[];
  totalAttempts: number;
  accuracyPercent: number;
  streakDays: number;
}

export default function HomePage() {
  const router = useRouter();
  const [askValue, setAskValue] = useState("");
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/progress")
      .then((res) => res.json())
      .then((json: ApiResponse<ProgressData>) => {
        if (json.success) setProgress(json.data);
        else setError(json.error);
      })
      .catch(() => setError("Không thể kết nối tới máy chủ."))
      .finally(() => setLoading(false));
  }, []);

  function goToTutor() {
    const q = askValue.trim();
    router.push(q ? `/tutor?q=${encodeURIComponent(q)}` : "/tutor");
  }

  // Chủ đề yếu nhất để đề xuất ôn tập — nếu chưa có dữ liệu (học sinh
  // mới, chưa làm bài nào), ẩn hẳn khối đề xuất thay vì bịa nội dung.
  const weakest = progress?.skillMap
    .filter((s) => s.isWeak)
    .sort((a, b) => a.masteryPercent - b.masteryPercent)[0];

  return (
    <section>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 27, fontWeight: 600 }}>Chào buổi tối 👋</h1>
        <p style={{ color: "var(--text-dim)", fontSize: 14.5, marginTop: 6 }}>
          Hôm nay bạn muốn học gì tiếp theo?
        </p>

        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--panel-strong)",
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: "13px 16px",
          }}
        >
          <span style={{ opacity: 0.5 }}>✺</span>
          <input
            value={askValue}
            onChange={(e) => setAskValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && goToTutor()}
            placeholder="Hỏi LearnX AI, ví dụ: giải thích quy hoạch động..."
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontSize: 14.5,
            }}
          />
          <button className="btn-primary" onClick={goToTutor}>
            Hỏi
          </button>
        </div>
      </div>

      {loading && <StateMessage kind="loading" text="Đang tải dữ liệu học tập..." />}
      {error && <StateMessage kind="error" text={error} />}

      {progress && (
        <>
          <div className="grid-stats" style={{ margin: "22px 0 28px" }}>
            <StatCard value={`🔥 ${progress.streakDays}`} label="Ngày học liên tục" />
            <StatCard value={progress.totalAttempts} label="Bài đã làm" />
            <StatCard value={`${progress.accuracyPercent}%`} label="Độ chính xác" />
            <StatCard value={progress.skillMap.length} label="Chủ đề đã theo dõi" />
          </div>

          <div style={{ marginBottom: 28 }}>
            <TodaySchedule />
          </div>

          {weakest ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, margin: "30px 0 14px" }}>LearnX đề xuất</div>
              <Panel style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>
                    Ôn lại {weakest.subject} — {weakest.topic}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 3 }}>
                    Bạn đang ở mức {weakest.masteryPercent}% chủ đề này — nên ôn trước khi sang bài mới
                  </div>
                </div>
                <button className="btn-primary" onClick={() => router.push("/roadmap")}>
                  Xem lộ trình
                </button>
              </Panel>
            </>
          ) : (
            <Panel style={{ marginTop: 20 }}>
              <div style={{ fontSize: 14, color: "var(--text-dim)" }}>
                Bạn chưa có dữ liệu năng lực nào — hãy làm bài{" "}
                <a href="/diagnostic" style={{ color: "var(--cyan)" }}>
                  Kiểm tra năng lực
                </a>{" "}
                trước để LearnX hiểu bạn đang mạnh/yếu ở đâu.
              </div>
            </Panel>
          )}
        </>
      )}
    </section>
  );
}
