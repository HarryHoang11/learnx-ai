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
import { useLanguage } from "@/components/providers/LanguageProvider";
import MindMapExportModal from "@/components/mindmap/MindMapExportModal";
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
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { push } = useToast();
  const id = searchParams?.get("id") ?? null;

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
  const [exportOpen, setExportOpen] = useState(false);

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
      .catch(() => setError(t("common.connectionError")))
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
      push("error", t("mm.emptyName"));
      return;
    }
    markDirty(nodes.map((n) => (n.id === selected.id ? { ...n, label: editLabel.trim(), description: editDesc.trim() || undefined } : n)));
    push("success", t("mm.updated"));
  }

  function addChild() {
    if (!selected) return;
    const childId = `n-${Date.now()}`;
    markDirty([...nodes, { id: childId, label: t("mm.newNode"), parentId: selected.id, type: "detail" }]);
    setSelectedId(childId);
  }

  function deleteSelected() {
    if (!selected) return;
    if (selected.parentId === null) {
      push("error", t("mm.noDeleteRoot"));
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
    push("success", t("mm.deleted"));
  }

  async function save() {
    if (!record) return;
    setSaving(true);
    try {
      // Recompute edges from current nodes to avoid stale edges
      const edgeSet = new Map<string, MindEdge>();
      for (const n of nodes) {
        if (n.parentId) {
          const key = `${n.parentId}->${n.id}`;
          if (!edgeSet.has(key)) {
            edgeSet.set(key, { id: key, source: n.parentId, target: n.id });
          }
        }
      }
      const edges = Array.from(edgeSet.values());
      const res = await fetch(`/api/mindmap/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { version: record.data?.version ?? 1, nodes, edges } }),
      });
      const json: ApiResponse<MindMapRecord> = await res.json();
      if (!json.success) {
        push("error", json.error);
        return;
      }
      setRecord(json.data);
      setDirty(false);
      push("success", t("mm.saved"));
    } catch {
      push("error", t("mm.saveFail"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteMindMap() {
    if (!record) return;
    if (!confirm(t("mm.deleteConfirm", { title: record.title }))) return;
    try {
      const res = await fetch(`/api/mindmap/${record.id}`, { method: "DELETE" });
      const json: ApiResponse<{ id: string }> = await res.json();
      if (!json.success) {
        push("error", json.error);
        return;
      }
      push("success", t("mm.deletedMap"));
      // Remove from list and redirect
      setList((prev) => (prev ? prev.filter((m) => m.id !== record.id) : prev));
      router.push("/mindmap");
    } catch {
      push("error", t("mm.deleteFail"));
    }
  }

  async function createBlankMindMap() {
    try {
      const res = await fetch("/api/mindmap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t("mm.blankTitle"),
          data: { version: 1, nodes: [], edges: [] },
        }),
      });
      const json: ApiResponse<MindMapRecord> = await res.json();
      if (!json.success) {
        push("error", json.error);
        return;
      }
      push("success", t("mm.createdMap"));
      router.push(`/mindmap?id=${json.data.id}`);
    } catch {
      push("error", t("mm.createFail"));
    }
  }

  // Dữ liệu export lấy từ STATE đang hiển thị (không đọc lại DB) để file
  // khớp đúng những gì người dùng thấy, kể cả thay đổi chưa bấm Lưu.
  const exportData = useMemo<MindMapData>(() => {
    const edgeSet = new Map<string, MindEdge>();
    for (const n of nodes) {
      if (n.parentId) {
        const key = `${n.parentId}->${n.id}`;
        if (!edgeSet.has(key)) edgeSet.set(key, { id: key, source: n.parentId, target: n.id });
      }
    }
    return { version: 1, nodes, edges: Array.from(edgeSet.values()) };
  }, [nodes]);

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
            borderTop: `1px solid ${isSelected ? "var(--indigo)" : isHit ? "var(--cyan)" : "var(--border)"}`,
            borderRight: `1px solid ${isSelected ? "var(--indigo)" : isHit ? "var(--cyan)" : "var(--border)"}`,
            borderBottom: `1px solid ${isSelected ? "var(--indigo)" : isHit ? "var(--cyan)" : "var(--border)"}`,
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
              aria-label={isCollapsed ? t("mm.expand", { n: n.label }) : t("mm.collapse", { n: n.label })}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 8 }}>
          <h2 className="page-title" style={{ margin: 0 }}>Mind Map</h2>
          <button className="btn-primary" onClick={createBlankMindMap}>
            {t("mm.create")}
          </button>
        </div>
        {(list?.length ?? 0) === 0 ? (
          <EmptyState
            icon="🧠"
            title={t("mm.emptyTitle")}
            description={t("mm.emptyDesc")}
            actionLabel={t("mm.create")}
            onAction={createBlankMindMap}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {list!.map((m) => (
              <Panel key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{m.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 4 }}>
                    {t("mm.nodes", { n: m.data?.nodes?.length ?? 0 })}
                    {m.subject ? ` · ${m.subject}` : ""}
                    {m.topic ? ` · ${m.topic}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  <button className="btn-secondary" onClick={() => router.push(`/mindmap?id=${m.id}`)}>
                    {t("mm.open")}
                  </button>
                  <button className="btn-secondary" onClick={() => {
                    if (confirm(t("mm.deleteConfirm", { title: m.title }))) {
                      (async () => {
                        try {
                          const res = await fetch(`/api/mindmap/${m.id}`, { method: "DELETE" });
                          const json: ApiResponse<{ id: string }> = await res.json();
                          if (!json.success) { push("error", json.error); return; }
                          push("success", t("mm.deletedMap"));
                          setList((prev) => (prev ? prev.filter((x) => x.id !== m.id) : prev));
                        } catch {
                          push("error", t("mm.deleteFail"));
                        }
                      })();
                    }
                  }} style={{ color: "var(--rose)" }}>
                    {t("common.delete")}
                  </button>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </section>
    );
  }

  // --- Chi tiết 1 mind map ---
  if (!record) return <StateMessage kind="error" text={t("mm.notFound")} />;

  return (
    <section className="page-enter">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>{record.title}</h2>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>
            {t("mm.nodes", { n: nodes.length })}{dirty ? ` · ${t("mm.unsaved")}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={deleteMindMap} style={{ color: "var(--rose)" }}>
            {t("common.delete")}
          </button>
          <button className="btn-secondary" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} aria-label={t("mm.zoomOut")}>
            −
          </button>
          <button className="btn-secondary" onClick={() => setZoom(1)} aria-label={t("mm.zoomReset")}>
            {Math.round(zoom * 100)}%
          </button>
          <button className="btn-secondary" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))} aria-label={t("mm.zoomIn")}>
            +
          </button>
          <button className="btn-secondary" onClick={() => setExportOpen(true)}>
            {t("mm.export")}
          </button>
          <button className="btn-primary" onClick={save} disabled={saving || !dirty}>
            {saving ? t("mm.saving") : t("mm.save")}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 14, maxWidth: 420 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("mm.searchPh")}
          aria-label={t("mm.searchAria")}
          className="form-input"
        />
      </div>

      <div className="grid-progress">
        <Panel>
          <div className="scroll-x-mobile">
            <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", minWidth: 280 }}>
              {roots.length === 0 ? (
                <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>{t("mm.noNodes")}</p>
              ) : (
                roots.map((r) => renderNode(r, 0, new Set()))
              )}
            </div>
          </div>
        </Panel>

        <Panel>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{t("mm.nodeDetail")}</div>
          {!selected ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>{t("mm.pickNode")}</p>
          ) : (
            <div>
              <label className="form-label" htmlFor="mm-label">{t("mm.nodeName")}</label>
              <input
                id="mm-label"
                className="form-input"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
              />
              <label className="form-label" htmlFor="mm-desc">{t("mm.nodeDesc")}</label>
              <textarea
                id="mm-desc"
                className="form-textarea"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn-primary" onClick={updateSelected} style={{ fontSize: 12.5 }}>
                  {t("mm.update")}
                </button>
                <button className="btn-secondary" onClick={addChild} style={{ fontSize: 12.5 }}>
                  {t("mm.addChild")}
                </button>
                <button className="btn-secondary" onClick={deleteSelected} style={{ fontSize: 12.5 }}>
                  {t("mm.delete")}
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

      <MindMapExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title={record.title}
        data={exportData}
      />
    </section>
  );
}

export default function MindMapPage() {
  const { t } = useLanguage();
  return (
    <Suspense fallback={<p className="state-msg">{t("mm.loading")}</p>}>
      <MindMapPageInner />
    </Suspense>
  );
}
