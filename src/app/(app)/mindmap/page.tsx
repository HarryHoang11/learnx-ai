// ================================================================
// TRANG MIND MAP — xem/sửa/lưu mind map do AI sinh từ tài liệu
// ================================================================
// Mạch tư duy: backend đã có đủ (CRUD + AI generate từ summary),
// nhưng CHƯA CÓ UI nào — đây là khoảng "backend có, UI chưa" trong
// audit. Trang này lấp đúng khoảng đó, không vẽ UI giả:
//   - ?id=... → GET /api/mindmap?id= (data thật từ DB)
//   - Sửa/thêm/xóa node ở client → PUT /api/mindmap/[id] (lưu thật)
//   - Tạo mới: từ modal tóm tắt tài liệu (POST /api/mindmap/generate)
// Cây render đệ quy từ parentId, thu gọn/mở rộng từng nhánh,
// zoom (transform scale), tìm kiếm + highlight, export JSON.

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import type { ApiResponse } from "@/types";

interface MindNode {
  id: string;
  label: string;
  parentId: string | null;
  type?: string;
  description?: string;
}

interface MindEdge {
  id: string;
  source: string;
  target: string;
}

interface MindMapData {
  version?: number;
  nodes: MindNode[];
  edges: MindEdge[];
}

interface MindMapRecord {
  id: string;
  title: string;
  description: string | null;
  sourceDocumentId: string | null;
  subject: string | null;
  topic: string | null;
  data: MindMapData;
  updatedAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  root: "var(--cyan)",
  concept: "var(--indigo)",
  detail: "var(--text-dim)",
  example: "var(--amber)",
  formula: "#7cf0e6",
  prerequisite: "var(--rose)",
};

function MindMapPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push } = useToast();
  const id = searchParams.get("id");

  const [list, setList] = useState<MindMapRecord[] | null>(null);
  const [record, setRecord] = useState<MindMapRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<MindNode[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editLabel, setEditLabel] = useState("");
  const [editDesc, setEditDesc] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    const url = id ? `/api/mindmap?id=${encodeURIComponent(id)}` : "/api/mindmap";
    fetch(url)
      .then((res) => res.json())
      .then((json: ApiResponse<MindMapRecord | MindMapRecord[]>) => {
        if (!json.success) {
          setError(json.error);
          return;
        }
        if (id) {
          const rec = json.data as MindMapRecord;
          setRecord(rec);
          setNodes(Array.isArray(rec.data?.nodes) ? rec.data.nodes : []);
        } else {
          setList(json.data as MindMapRecord[]);
        }
      })
      .catch(() => setError("Không thể kết nối tới máy chủ."))
      .finally(() => setLoading(false));
  }, [id]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, MindNode[]>();
    for (const n of nodes) {
      const key = n.parentId ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    return map;
  }, [nodes]);

  const roots = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id));
    return nodes.filter((n) => n.parentId === null || !ids.has(n.parentId as string));
  }, [nodes]);

  const selected = nodes.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    setEditLabel(selected?.label ?? "");
    setEditDesc(selected?.description ?? "");
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleCollapse(nodeId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  function markDirty(next: MindNode[]) {
    setNodes(next);
    setDirty(true);
  }

  function updateSelected() {
    if (!selected) return;
    if (editLabel.trim() === "") {
      push("error", "Tên node không được để trống.");
      return;
    }
    markDirty(nodes.map((n) => (n.id === selected.id ? { ...n, label: editLabel.trim(), description: editDesc.trim() || undefined } : n)));
    push("success", "Đã cập nhật node (nhớ bấm Lưu).");
  }

  function addChild() {
    if (!selected) return;
    const childId = `n-${Date.now()}`;
    markDirty([...nodes, { id: childId, label: "Node mới", parentId: selected.id, type: "detail" }]);
    setSelectedId(childId);
  }

  function deleteSelected() {
    if (!selected) return;
    if (selected.parentId === null) {
      push("error", "Không thể xóa node gốc.");
      return;
    }
    // Xóa cả nhánh con (chống node mồ côi).
    const toDelete = new Set<string>([selected.id]);
    let expanded = true;
    while (expanded) {
      expanded = false;
      for (const n of nodes) {
        if (n.parentId && toDelete.has(n.parentId) && !toDelete.has(n.id)) {
          toDelete.add(n.id);
          expanded = true;
        }
      }
    }
    markDirty(nodes.filter((n) => !toDelete.has(n.id)));
    setSelectedId(null);
    push("success", "Đã xóa node (nhớ bấm Lưu).");
  }

  async function save() {
    if (!record) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/mindmap/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { version: 1, nodes, edges: record.data?.edges ?? [] } }),
      });
      const json: ApiResponse<MindMapRecord> = await res.json();
      if (!json.success) {
        push("error", json.error);
        return;
      }
      setRecord(json.data);
      setDirty(false);
      push("success", "Đã lưu Mind Map.");
    } catch {
      push("error", "Không thể lưu, thử lại sau.");
    } finally {
      setSaving(false);
    }
  }

  function exportJSON() {
    if (!record) return;
    const blob = new Blob([JSON.stringify({ title: record.title, nodes, edges: record.data?.edges ?? [] }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${record.title.replace(/[\\/:*?"<>|]/g, "_")}.mindmap.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const query = search.trim().toLowerCase();

  function renderNode(n: MindNode, depth: number, visited: Set<string>): React.ReactNode {
    if (visited.has(n.id)) return null; // chống vòng lặp dữ liệu AI lỗi
    visited.add(n.id);
    const kids = childrenByParent.get(n.id) ?? [];
    const isCollapsed = collapsed.has(n.id);
    const isSelected = n.id === selectedId;
    const isHit = query !== "" && (n.label.toLowerCase().includes(query) || (n.description ?? "").toLowerCase().includes(query));
    const color = TYPE_COLORS[n.type ?? ""] ?? "var(--text-dim)";

    return (
      <div key={n.id} style={{ marginLeft: depth === 0 ? 0 : 22 }}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedId(n.id)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSelectedId(n.id);
            }
          }}
          aria-label={`Node ${n.label}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: depth === 0 ? "10px 18px" : "7px 14px",
            margin: "5px 0",
            borderRadius: depth === 0 ? 14 : 10,
            background: isSelected ? "var(--indigo-soft)" : "var(--panel-strong)",
            border: `1px solid ${isSelected ? "var(--indigo)" : isHit ? "var(--cyan)" : "var(--border)"}`,
            borderLeft: `3px solid ${color}`,
            fontSize: depth === 0 ? 15 : 13.5,
            fontWeight: depth === 0 ? 700 : 500,
            cursor: "pointer",
            maxWidth: "100%",
          }}
        >
          {kids.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(n.id);
              }}
              aria-label={isCollapsed ? `Mở rộng ${n.label}` : `Thu gọn ${n.label}`}
              style={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: 6,
                width: 20,
                height: 20,
                fontSize: 12,
                cursor: "pointer",
                lineHeight: 1,
              }}
            >
              {isCollapsed ? "+" : "−"}
            </button>
          )}
          <span>{n.label}</span>
          {kids.length > 0 && (
            <span style={{ fontSize: 11, color: "var(--text-faint)" }}>({kids.length})</span>
          )}
          {isHit && <span style={{ fontSize: 11, color: "var(--cyan)" }}>●</span>}
        </div>
        {!isCollapsed &&
          kids.map((k) => (
            <div key={k.id} style={{ borderLeft: "1px dashed var(--border)", paddingLeft: 4 }}>
              {renderNode(k, depth + 1, visited)}
            </div>
          ))}
      </div>
    );
  }

  if (loading) {
    return (
      <section>
        <Skeleton height={28} width={240} style={{ marginBottom: 18 }} />
        <Skeleton height={320} radius={16} />
      </section>
    );
  }
  if (error) return <StateMessage kind="error" text={error} />;

  // --- Danh sách mind map (không có ?id=) ---
  if (!id) {
    return (
      <section className="page-enter">
        <h2 className="page-title">Mind Map</h2>
        {(list?.length ?? 0) === 0 ? (
          <EmptyState
            icon="🧠"
            title="Chưa có Mind Map nào"
            description="Mở Thư viện → xem tóm tắt tài liệu → bấm “Tạo Mind Map” để AI vẽ sơ đồ từ nội dung bạn đã học."
            actionLabel="Mở Thư viện"
            onAction={() => router.push("/library")}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {list!.map((m) => (
              <Panel key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{m.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>
                    {m.data?.nodes?.length ?? 0} nodes
                    {m.subject ? ` · ${m.subject}` : ""}
                    {m.topic ? ` · ${m.topic}` : ""}
                  </div>
                </div>
                <button className="btn-secondary" onClick={() => router.push(`/mindmap?id=${m.id}`)} style={{ flexShrink: 0 }}>
                  Mở
                </button>
              </Panel>
            ))}
          </div>
        )}
      </section>
    );
  }

  // --- Chi tiết 1 mind map ---
  if (!record) return <StateMessage kind="error" text="Không tìm thấy Mind Map." />;

  return (
    <section className="page-enter">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>{record.title}</h2>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
            {nodes.length} nodes{dirty ? " · có thay đổi chưa lưu" : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} aria-label="Thu nhỏ">
            −
          </button>
          <button className="btn-secondary" onClick={() => setZoom(1)} aria-label="Zoom về 100%">
            {Math.round(zoom * 100)}%
          </button>
          <button className="btn-secondary" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))} aria-label="Phóng to">
            +
          </button>
          <button className="btn-secondary" onClick={exportJSON}>
            Export
          </button>
          <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 14, maxWidth: 420 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm node... (tự highlight ●)"
          aria-label="Tìm node trong mind map"
          className="form-input"
        />
      </div>

      <div className="grid-progress">
        <Panel>
          <div className="scroll-x-mobile">
            <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", minWidth: 280 }}>
              {roots.length === 0 ? (
                <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>Mind map này chưa có node nào.</p>
              ) : (
                roots.map((r) => renderNode(r, 0, new Set()))
              )}
            </div>
          </div>
        </Panel>

        <Panel>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Chi tiết node</div>
          {!selected ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>Bấm vào 1 node để xem và chỉnh sửa.</p>
          ) : (
            <div>
              <label className="form-label" htmlFor="mm-label">Tên node</label>
              <input
                id="mm-label"
                className="form-input"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
              />
              <label className="form-label" htmlFor="mm-desc">Mô tả</label>
              <textarea
                id="mm-desc"
                className="form-textarea"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn-primary" onClick={updateSelected} style={{ fontSize: 12.5 }}>
                  Cập nhật
                </button>
                <button className="btn-secondary" onClick={addChild} style={{ fontSize: 12.5 }}>
                  + Node con
                </button>
                <button className="btn-secondary" onClick={deleteSelected} style={{ fontSize: 12.5 }}>
                  Xóa
                </button>
              </div>
              {selected.description && (
                <p style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 12, lineHeight: 1.6 }}>
                  {selected.description}
                </p>
              )}
            </div>
          )}
        </Panel>
      </div>
    </section>
  );
}

export default function MindMapPage() {
  return (
    <Suspense fallback={<p className="state-msg">Đang tải...</p>}>
      <MindMapPageInner />
    </Suspense>
  );
}
