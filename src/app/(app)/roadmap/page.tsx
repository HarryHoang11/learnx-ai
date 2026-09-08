// ================================================================
// TRANG LỘ TRÌNH HỌC (Roadmap) — HỖ TRỢ NHIỀU LỘ TRÌNH
// ================================================================
// Mạch tư duy: trang này giờ có 3 trạng thái:
//   1) Chưa có lộ trình nào (GET /api/roadmaps trả mảng rỗng) -> hiển
//      thị form đặt mục tiêu lần đầu (giữ NGUYÊN JSX gốc, chỉ đổi
//      hàm gọi từ POST /api/roadmap/generate -> POST /api/roadmaps).
//   2) Đã có >=1 lộ trình -> hiển thị:
//      - Dropdown "Lộ trình hiện tại" để chuyển đổi nhanh.
//      - Timeline của lộ trình đang chọn (JSX gốc, giữ nguyên).
//      - Khu vực "Lộ trình của tôi" — danh sách card, mỗi card có
//        action Tiếp tục/Đánh dấu hoàn thành/Xoá.
//   3) Form "+ Tạo lộ trình mới" (dùng lại y hệt JSX form ở trạng thái
//      1, chỉ khác chỗ gọi xong thì thêm vào danh sách thay vì thay
//      thế toàn bộ trang).
//
// KHÔNG đụng /api/roadmap (số ít) hay roadmap.service.ts's
// generateRoadmap()/getLatestRoadmap() — trang này chỉ gọi API MỚI
// (/api/roadmaps số nhiều), giữ flow onboarding cũ nguyên vẹn nếu có
// nơi khác còn phụ thuộc (hiện tại đã xác nhận không còn nơi nào khác
// gọi /api/roadmap ngoài chính trang này trước đây).
// ================================================================

"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import RoadmapCard from "@/components/roadmap/RoadmapCard";
import DeleteRoadmapDialog from "@/components/roadmap/DeleteRoadmapDialog";
import type { ApiResponse, GoalWithRoadmap, RoadmapPlan } from "@/types";

const CREATE_NEW_VALUE = "__create_new__";

export default function RoadmapPage() {
  const [goals, setGoals] = useState<GoalWithRoadmap[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GoalWithRoadmap | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [goalTitle, setGoalTitle] = useState("Thi chuyên Tin");
  const [targetMonths, setTargetMonths] = useState(6);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadGoals();
  }, []);

  async function loadGoals(preferGoalId?: string) {
    setLoading(true);
    try {
      const res = await fetch("/api/roadmaps");
      const json: ApiResponse<GoalWithRoadmap[]> = await res.json();
      if (!json.success) {
        setError(json.error);
        return;
      }
      setGoals(json.data);
      setError(null);

      if (json.data.length === 0) {
        setSelectedGoalId(null);
      } else if (preferGoalId && json.data.some((g) => g.id === preferGoalId)) {
        setSelectedGoalId(preferGoalId);
      } else {
        // Functional update — đọc selectedGoalId hiện tại qua callback
        // của setState thay vì qua closure của loadGoals(), tránh phụ
        // thuộc vào giá trị "đóng băng" tại thời điểm loadGoals() được
        // tạo ra (đây là warning THẬT của react-hooks/exhaustive-deps,
        // không phải noise — sửa đúng bản chất thay vì disable rule).
        setSelectedGoalId((prev) => {
          const stillValid = prev && json.data.some((g) => g.id === prev);
          return stillValid ? prev : json.data[0].id;
        });
      }
    } catch {
      setError("Không thể kết nối tới máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/roadmaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalTitle, targetMonths }),
      });
      const json: ApiResponse<GoalWithRoadmap> = await res.json();
      if (!json.success) throw new Error(json.error);

      setShowCreateForm(false);
      await loadGoals(json.data.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Không thể tạo lộ trình.");
    } finally {
      setCreating(false);
    }
  }

  async function handleMarkCompleted(goal: GoalWithRoadmap) {
    setActionError(null);
    try {
      const res = await fetch(`/api/roadmaps/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      const json: ApiResponse<GoalWithRoadmap> = await res.json();
      if (!json.success) throw new Error(json.error);
      await loadGoals(goal.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không thể cập nhật lộ trình.");
    }
  }

  async function handleReactivate(goal: GoalWithRoadmap) {
    setActionError(null);
    try {
      const res = await fetch(`/api/roadmaps/${goal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACTIVE" }),
      });
      const json: ApiResponse<GoalWithRoadmap> = await res.json();
      if (!json.success) throw new Error(json.error);
      await loadGoals(goal.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không thể cập nhật lộ trình.");
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/roadmaps/${deleteTarget.id}`, { method: "DELETE" });
      const json: ApiResponse<{ deleted: true }> = await res.json();
      if (!json.success) throw new Error(json.error);

      const wasSelected = selectedGoalId === deleteTarget.id;
      setDeleteTarget(null);
      await loadGoals(wasSelected ? undefined : selectedGoalId ?? undefined);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không thể xoá lộ trình.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <StateMessage kind="loading" text="Đang tải lộ trình..." />;
  if (error) return <StateMessage kind="error" text={error} />;
  if (!goals) return null;

  // ------------------------------------------------------------
  // Trạng thái 1: CHƯA có lộ trình nào — form đặt mục tiêu lần đầu.
  // Trạng thái 3: user bấm "+ Tạo lộ trình mới" khi đã có sẵn lộ trình
  // khác — DÙNG LẠI y hệt form này (showCreateForm=true).
  // ------------------------------------------------------------
  if (goals.length === 0 || showCreateForm) {
    return (
      <section style={{ maxWidth: 520, margin: "0 auto" }}>
        {goals.length > 0 && (
          <button
            className="btn-secondary"
            onClick={() => setShowCreateForm(false)}
            style={{ marginBottom: 16, fontSize: 12.5, padding: "6px 12px" }}
          >
            ← Quay lại danh sách lộ trình
          </button>
        )}
        <h2 style={{ fontSize: 20, marginBottom: 6 }}>Đặt mục tiêu học tập</h2>
        <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginBottom: 22 }}>
          AI sẽ dựa trên mục tiêu này và hồ sơ năng lực hiện tại để xây lộ trình riêng cho bạn.
          {goals.length > 0 && " Lộ trình cũ của bạn sẽ không bị mất."}
        </p>
        <Panel>
          <label style={{ display: "block", fontSize: 13, color: "var(--text-dim)", marginBottom: 6 }}>
            Mục tiêu
          </label>
          <input value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} style={inputStyle} />
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
          {createError && <p style={{ color: "var(--rose)", fontSize: 13, marginTop: 12 }}>{createError}</p>}
          <button className="btn-primary" style={{ marginTop: 20 }} onClick={handleCreate} disabled={creating}>
            {creating ? "AI đang xây lộ trình..." : "Tạo lộ trình"}
          </button>
        </Panel>
      </section>
    );
  }

  const selectedGoal = goals.find((g) => g.id === selectedGoalId) ?? goals[0];

  return (
    <section>
      <h2 style={{ fontSize: 20 }}>Lộ trình học</h2>
      <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 6, marginBottom: 20 }}>
        Lộ trình tự điều chỉnh dựa trên tốc độ tiến bộ của bạn
      </p>

      {actionError && (
        <div style={{ marginBottom: 16 }}>
          <StateMessage kind="error" text={actionError} />
        </div>
      )}

      {/* --- Selector "Lộ trình hiện tại" --- */}
      <div style={{ marginBottom: 24, maxWidth: 420 }}>
        <label style={{ display: "block", fontSize: 12.5, color: "var(--text-dim)", marginBottom: 6 }}>
          Lộ trình hiện tại
        </label>
        <select
          value={selectedGoal.id}
          onChange={(e) => {
            if (e.target.value === CREATE_NEW_VALUE) {
              setShowCreateForm(true);
            } else {
              setSelectedGoalId(e.target.value);
            }
          }}
          style={inputStyle}
        >
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.status === "COMPLETED" ? "✓ " : ""}
              {g.title} — {g.progressPercent}%
            </option>
          ))}
          <option value={CREATE_NEW_VALUE}>+ Tạo lộ trình mới</option>
        </select>
      </div>

      {/* --- Timeline của lộ trình đang chọn (JSX gốc, giữ nguyên) --- */}
      {selectedGoal.plan ? (
        <RoadmapTimeline plan={selectedGoal.plan} />
      ) : (
        <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>
          Lộ trình này chưa có kế hoạch chi tiết (có thể do AI xử lý lỗi lúc tạo).
        </p>
      )}

      {/* --- Khu vực quản lý "Lộ trình của tôi" --- */}
      <div style={{ marginTop: 40 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ fontSize: 16 }}>Lộ trình của tôi</h3>
          <button className="btn-secondary" onClick={() => setShowCreateForm(true)} style={{ fontSize: 12.5, padding: "7px 14px" }}>
            + Tạo lộ trình mới
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {goals.map((g) => (
            <RoadmapCard
              key={g.id}
              goal={g}
              isSelected={g.id === selectedGoal.id}
              onSelect={() => setSelectedGoalId(g.id)}
              onMarkCompleted={() => handleMarkCompleted(g)}
              onReactivate={() => handleReactivate(g)}
              onDelete={() => setDeleteTarget(g)}
            />
          ))}
        </div>
      </div>

      {deleteTarget && (
        <DeleteRoadmapDialog
          goalTitle={deleteTarget.title}
          deleting={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      )}
    </section>
  );
}

// Timeline theo tháng — TÁCH NGUYÊN VẸN từ JSX gốc của trang (không
// đổi 1 dòng logic/style nào), chỉ đặt vào component riêng để trang
// chính không bị phình to khi thêm phần quản lý nhiều lộ trình.
function RoadmapTimeline({ plan }: { plan: RoadmapPlan[] }) {
  return (
    <div>
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
