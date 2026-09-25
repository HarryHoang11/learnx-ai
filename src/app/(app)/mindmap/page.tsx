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
// zoom/pan, tìm kiếm + highlight, export đa định dạng.

"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import EmptyState from "@/components/ui/EmptyState";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useLanguage } from "@/components/providers/LanguageProvider";
import MindMapExportModal from "@/components/mindmap/MindMapExportModal";
import { computeLayout, getEdgePath, GRAPH_PADDING, type PositionedNode } from "@/lib/mindmap/layout";
import {
  MOBILE_READABLE_ZOOM,
  MOBILE_VIEWPORT_WIDTH,
  boundsOfBoxes,
  computeAnchoredZoom,
  computeFitTransform,
  pinchZoomFactor,
} from "@/lib/mindmap/viewport";
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

// Zoom giới hạn cho mind map. MIN_ZOOM nhỏ để vẫn soi được cả graph lớn
// (nút "Vừa khung" clamp về đây nếu graph quá rộng), MAX_ZOOM vừa đủ để
// đọc node chi tiết mà không vỡ layout.
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const ZOOM_WHEEL_SENSITIVITY = 0.0015;
// Nút +/-: mỗi lần bấm nhân zoom, cho bước tăng/giảm mượt thay vì cộng cứng 0.1.
const ZOOM_BUTTON_FACTOR = 1.2;
// Lề chừa khi auto-fit (px màn hình). Nhỏ là đủ vì bản thân stage đã có
// GRAPH_PADDING quanh graph — cộng thêm lề này thì node ngoài cùng không bao
// giờ chạm mép viewport.
const FIT_ZONE_PADDING = 28;
// Zoom tối đa của auto-fit: graph nhỏ không bị phóng to vỡ nét.
const FIT_MAX_ZOOM = 1;

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
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({});
  // Kích thước node đo thật từ DOM. Layout engine cần biết node wrap mấy dòng
  // thật mới tránh overlap; con số này là nguồn sự thật, ước lượng theo số ký
  // tự chỉ dùng cho bước render đầu tiên.
  const [measuredSizes, setMeasuredSizes] = useState<Record<string, { width: number; height: number }>>({});
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const nodeObserverRef = useRef<ResizeObserver | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const panOriginRef = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null);
  const dragNodeRef = useRef<{ id: string; pointerX: number; pointerY: number; start: { x: number; y: number } } | null>(null);
  // --- Trạng thái điều khiển khung nhìn (pan / zoom / pinch) ---
  // `activePointers` giữ MỌI ngón đang chạm canvas (toạ độ đã trừ rect của
  // canvas) để nhận ra thao tác 2 ngón; `pinch` giữ mốc lúc bắt đầu pinch.
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number; pan: { x: number; y: number }; focal: { x: number; y: number } } | null>(null);
  // Người dùng đã tự tay kéo/zoom chưa: nếu rồi thì KHÔNG auto-fit nữa, tránh
  // cướp vị trí đang xem.
  const userInteractedRef = useRef(false);
  // Số lần auto-fit đã chạy cho mind map hiện tại (tối đa 2: lần đầu khi mở,
  // lần hai sau khi ResizeObserver đo xong kích thước THẬT của node).
  const autoFitCountRef = useRef(0);
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
  /** Node trung tâm — dùng để tô đậm (visual hierarchy) và vẽ edge trục. */
  const rootIds = useMemo(() => new Set(roots.map((root) => root.id)), [roots]);
  const measuredHeights = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [id, size] of Object.entries(measuredSizes)) map[id] = size.height;
    return map;
  }, [measuredSizes]);
  const measuredWidths = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [id, size] of Object.entries(measuredSizes)) map[id] = size.width;
    return map;
  }, [measuredSizes]);



  // Đo kích thước THẬT của từng node trong DOM bằng ResizeObserver rồi đưa
  // ngược vào computeLayout(). Lý do: ước lượng "số ký tự -> số dòng" không
  // biết font thật wrap thế nào, nên khi ước lượng thiếu, node có
  // `overflow: hidden` sẽ CẮT mất chữ và chồng lên node khác. Đo thật là
  // cách duy nhất đảm bảo wrap của trình duyệt là nguồn sự thật.
  //
  // Observer sống suốt vòng đời component; node mới được observe ngay trong
  // callback ref nên effect không phụ thuộc thứ tự khai báo và không cần chạy
  // lại mỗi lần danh sách node đổi.
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      setMeasuredSizes((previous) => {
        let changed = false;
        const next = { ...previous };
        for (const entry of entries) {
          const element = entry.target as HTMLElement;
          const id = element.dataset.nodeId;
          if (!id) continue;
          // scrollHeight đo CHIỀU CAO NỘI DUNG nên dù được đặt `minHeight` cao
          // hơn thực tế, số đo vẫn là chiều cao thật của chữ — đây là điều
          // kiện để vòng lặp đo -> layout -> đo hội tụ (không dao động vô hạn).
          const width = Math.round(element.offsetWidth);
          const height = Math.round(element.scrollHeight);
          const current = next[id];
          if (!current || current.width !== width || current.height !== height) {
            next[id] = { width, height };
            changed = true;
          }
        }
        return changed ? next : previous;
      });
    });
    nodeObserverRef.current = observer;
    for (const element of nodeRefs.current.values()) observer.observe(element);
    return () => {
      observer.disconnect();
      nodeObserverRef.current = null;
    };
  }, []);

  // Node đã từng đo thì xoá số đo cũ, tránh node bị xoá/sửa label xong vẫn
  // dùng kích thước cũ làm layout sai.
  useEffect(() => {
    setMeasuredSizes((previous) => {
      const valid = new Set(nodes.map((node) => node.id));
      const next: Record<string, { width: number; height: number }> = {};
      let changed = false;
      for (const [id, size] of Object.entries(previous)) {
        if (valid.has(id)) next[id] = size;
        else changed = true;
      }
      return changed ? next : previous;
    });
  }, [nodes]);

  const layout = useMemo(
    () => computeLayout(nodes, { measuredHeights, measuredWidths }),
    [nodes, measuredHeights, measuredWidths]
  );
  const displayedNodes = useMemo(
    () => layout.nodes.map((node) => ({
      ...node,
      x: manualPositions[node.id]?.x ?? node.x,
      y: manualPositions[node.id]?.y ?? node.y,
    })),
    [layout.nodes, manualPositions]
  );
  // Bounding box lấy từ LAYOUT ENGINE (KHÔNG tính vị trí kéo tay). Cố ý: nếu
  // tính cả manualPositions thì mỗi lần kéo node vượt qua mép graph,
  // renderOffset lại đổi và node đang kéo bị "đứng yên" dù chuột vẫn đi — đúng
  // lỗi node nhảy vị trí khi kéo. Giữ offset cố định suốt thao tác kéo; node
  // kéo ra ngoài vẫn thấy vì .mindmap-stage không cắt nội dung.
  const graphBounds = useMemo(() => boundsOfBoxes(layout.nodes), [layout.nodes]);
  const renderOffset = useMemo(
    () => ({
      x: GRAPH_PADDING - graphBounds.minX,
      y: GRAPH_PADDING - graphBounds.minY,
    }),
    [graphBounds]
  );
  const graphSize = useMemo(
    () => ({
      width: Math.max(1, graphBounds.maxX - graphBounds.minX + GRAPH_PADDING * 2),
      height: Math.max(1, graphBounds.maxY - graphBounds.minY + GRAPH_PADDING * 2),
    }),
    [graphBounds]
  );
  const renderNodes = useMemo(
    () => displayedNodes.map((node) => ({ ...node, x: node.x + renderOffset.x, y: node.y + renderOffset.y })),
    [displayedNodes, renderOffset]
  );
  const visibleNodeIds = useMemo(() => {
    const visible = new Set<string>();
    const visit = (nodeId: string, blocked: boolean) => {
      if (blocked || visible.has(nodeId)) return;
      visible.add(nodeId);
      for (const child of childrenByParent.get(nodeId) ?? []) {
        visit(child.id, collapsed.has(nodeId));
      }
    };
    for (const root of roots) visit(root.id, false);
    return visible;
  }, [roots, childrenByParent, collapsed]);
  const visibleRenderNodes = useMemo(
    () => renderNodes.filter((node) => visibleNodeIds.has(node.id)),
    [renderNodes, visibleNodeIds]
  );
  const visibleNodeById = useMemo(() => new Map(visibleRenderNodes.map((node) => [node.id, node])), [visibleRenderNodes]);
  // Bounding box của những node ĐANG HIỆN (đã gồm vị trí kéo tay, đã cộng
  // renderOffset) — dùng cho auto-fit / nút "Vừa khung". Fit theo phần đang
  // hiển thị nên khi thu gọn một nhánh, khung nhìn bám theo nhánh còn lại thay
  // vì zoom out vì nhánh đang ẩn.
  const visibleBounds = useMemo(() => boundsOfBoxes(visibleRenderNodes), [visibleRenderNodes]);
  const visibleBoundsRef = useRef(visibleBounds);
  visibleBoundsRef.current = visibleBounds;
  const allEdges = useMemo(() => {
    const edgeMap = new Map<string, MindEdge>();
    for (const edge of layout.edges) edgeMap.set(`${edge.source}->${edge.target}`, edge);
    for (const edge of record?.data?.edges ?? []) {
      edgeMap.set(`${edge.source}->${edge.target}`, edge);
    }
    return Array.from(edgeMap.values());
  }, [layout.edges, record?.data?.edges]);
  const visibleEdges = useMemo(
    () => allEdges.filter((edge) => visibleNodeById.has(edge.source) && visibleNodeById.has(edge.target)),
    [allEdges, visibleNodeById]
  );

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

  // Đánh dấu người dùng đã tự điều khiển khung nhìn (kéo node / kéo nền / zoom
  // / pinch). Từ lúc đó auto-fit không được chạy nữa.
  function markUserInteraction() {
    userInteractedRef.current = true;
  }

  /**
   * Đưa graph vào giữa khung nhìn. Đọc bounding box qua ref nên gọi được từ
   * requestAnimationFrame (sau Auto Layout) mà vẫn dùng số đo MỚI NHẤT — đóng
   * số đo vào closure sẽ center theo kích thước cũ và canvas lệch khỏi giữa.
   *
   * `readableOnly`: dành cho lần auto-fit ĐẦU TIÊN trên màn hình hẹp — giữ
   * zoom đọc được (MOBILE_READABLE_ZOOM) thay vì ép cả graph vào màn hình rồi
   * chữ nhỏ tới mức không đọc được; người dùng pan/pinch tiếp. Nút "Vừa khung"
   * do người dùng bấm thì luôn fit thật.
   */
  function fitCanvas(options: { readableOnly?: boolean } = {}) {
    const viewport = canvasRef.current;
    if (!viewport) return;
    const width = viewport.clientWidth;
    const height = viewport.clientHeight;
    // Chưa layout xong thì đo được 0 — fit lúc này sẽ ra zoom rác.
    if (width < 40 || height < 40) return;
    const narrow = width <= MOBILE_VIEWPORT_WIDTH;
    const result = computeFitTransform({
      viewport: { width, height },
      bounds: visibleBoundsRef.current,
      padding: FIT_ZONE_PADDING,
      minZoom: options.readableOnly && narrow ? MOBILE_READABLE_ZOOM : MIN_ZOOM,
      maxZoom: FIT_MAX_ZOOM,
    });
    setZoom(result.zoom);
    setPan(result.pan);
  }

  // AUTO-FIT — chỉ chạy TỐI ĐA 2 lần cho mỗi mind map: ngay khi mở (layout còn
  // dùng chiều cao ước lượng) và một lần sau khi ResizeObserver đo xong kích
  // thước THẬT của node. graphSize là tín hiệu "layout/dữ liệu đổi".
  // Kéo node, pan, zoom, chọn node hay search KHÔNG kích hoạt auto-fit.
  useEffect(() => {
    autoFitCountRef.current = 0;
    userInteractedRef.current = false;
  }, [record?.id]);

  useEffect(() => {
    if (!record) return;
    if (userInteractedRef.current || autoFitCountRef.current >= 2) return;
    autoFitCountRef.current += 1;
    const frame = window.requestAnimationFrame(() => fitCanvas({ readableOnly: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [record?.id, graphSize.width, graphSize.height]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto Layout: xoá mọi vị trí đã kéo tay để graph về đúng layout engine,
  // rồi center + fit. Dùng 2 frame vì frame đầu áp dụng manual positions mới
  // rỗng, frame sau mới có graphSize chính xác.
  function runAutoLayout() {
    setManualPositions({});
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => fitCanvas()));
  }

  // ---- ZOOM ----
  // zoomTo(nextZoom, focal?) giữ NGUYÊN điểm graph nằm dưới điểm mốc khi zoom —
  // đây là điều làm zoom "có cảm giác" (con trỏ đứng yên, nội dung zoom quanh
  // nó) thay vì mọi thứ bị kéo về góc trên-trái. Không truyền focal thì lấy
  // TÂM viewport, nên nút +/- cũng giữ tâm tương đối.
  //
  // Phép tính nằm ở computeAnchoredZoom (hàm thuần, có test riêng).
  const zoomPanRef = useRef({ zoom: 1, pan: { x: 0, y: 0 } });
  zoomPanRef.current = { zoom, pan };

  /** Tâm viewport trong toạ độ canvas — mốc zoom mặc định cho nút +/-. */
  function viewportCenter() {
    const viewport = canvasRef.current;
    if (!viewport) return { x: 0, y: 0 };
    return { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
  }

  function zoomTo(nextZoom: number, focal?: { x: number; y: number }) {
    markUserInteraction();
    const anchor = focal ?? viewportCenter();
    const current = zoomPanRef.current;
    const result = computeAnchoredZoom({ zoom: current.zoom, pan: current.pan, focal: anchor }, { zoom: nextZoom, focal: anchor }, MIN_ZOOM, MAX_ZOOM);
    setZoom(result.zoom);
    setPan(result.pan);
  }

  function zoomBy(factor: number, focal?: { x: number; y: number }) {
    zoomTo(zoomPanRef.current.zoom * factor, focal);
  }

  // Reset View: về zoom 100% và pan gốc (0,0). Khác "Vừa khung" (fitCanvas)
  // vốn tính zoom để vừa khung chứ không ép 100%.
  function resetView() {
    markUserInteraction();
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  // Zoom bằng chuột: dùng addEventListener với { passive: false } vì React
  // gắn wheel ở root theo kiểu passive nên event.preventDefault() trong
  // onWheel không chặn được cuộn trang — lăn chuột trên canvas sẽ vừa zoom
  // vừa cuộn cả trang.
  useEffect(() => {
    const viewport = canvasRef.current;
    if (!viewport) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      // deltaY âm = lăn lên = phóng to.
      const factor = Math.exp(-event.deltaY * ZOOM_WHEEL_SENSITIVITY);
      zoomBy(factor, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    };
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [record?.id]);

  /**
   * PINCH 2 NGÓN (mobile): `.mindmap-viewport` đặt `touch-action: none` nên
   * trình duyệt không tự pinch-zoom. Không có pinch thì graph lớn trên điện
   * thoại chỉ còn cách bấm nút +/- (rất khó chịu khi vừa kéo vừa thu phóng).
   *
   * Mốc chốt ở lần chạm thứ hai; mọi phép tính đi qua computeAnchoredZoom (hàm
   * thuần, có test) nên không phụ thuộc thứ tự / tần suất pointermove và luôn
   * giữ đúng điểm graph nằm dưới tâm hai ngón.
   */
  function beginPinch() {
    const points = Array.from(activePointersRef.current.values());
    if (points.length < 2) return;
    const [first, second] = points;
    pinchRef.current = {
      distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
      zoom: zoomPanRef.current.zoom,
      pan: zoomPanRef.current.pan,
      focal: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    };
  }

  function updatePinch() {
    const start = pinchRef.current;
    const points = Array.from(activePointersRef.current.values());
    if (!start || points.length < 2) return;
    const [first, second] = points;
    const result = computeAnchoredZoom(
      { zoom: start.zoom, pan: start.pan, focal: start.focal },
      {
        zoom: start.zoom * pinchZoomFactor(start.distance, Math.hypot(second.x - first.x, second.y - first.y)),
        focal: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
      },
      MIN_ZOOM,
      MAX_ZOOM
    );
    setZoom(result.zoom);
    setPan(result.pan);
  }

  // PAN CANVAS: giữ chuột trái trên vùng trống rồi kéo để di chuyển TOÀN BỘ
  // mind map. Phân biệt với drag node ở handleNodePointerDown (node gọi
  // stopPropagation nên event không tới đây).
  //
  // Chỉ bắt đầu pan khi target thực sự là nền — tức là viewport hoặc stage,
  // KHÔNG phải node/edge/nút bấm bên trong. Nhờ vậy bấm vào khoảng trống
  // giữa các node vẫn kéo được canvas, còn bấm vào node thì kéo node.
  function handleCanvasPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    // .mindmap-stage là div rộng bằng cả graph; các node nằm trực tiếp trong
    // stage nên bấm vào khoảng trống của stage chính là bấm nền canvas.
    const isBackdrop = event.currentTarget === target || target.classList.contains("mindmap-stage");
    if (!isBackdrop) return;

    markUserInteraction();
    const rect = event.currentTarget.getBoundingClientRect();
    activePointersRef.current.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    // Ngón thứ 2 chạm nền -> chuyển sang pinch. Bỏ pan đang dở để viewport
    // không vừa zoom vừa trôi.
    if (activePointersRef.current.size >= 2) {
      beginPinch();
      panOriginRef.current = null;
      return;
    }

    panOriginRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    // Bật cursor grabbing đúng lúc kéo (Safari không bắt :active khi dùng
    // pointer capture) và tắt lại khi thả — xem .mindmap-viewport.is-panning.
    event.currentTarget.classList.add("is-panning");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  // Pan tự do theo mọi hướng: chỉ dùng chênh lệch chuột, KHÔNG clamp vào
  // trong khung — người dùng có thể kéo map ra ngoài rồi quay lại bằng
  // nút "Vừa khung" (fitCanvas). Giới hạn cứng ở đây từng khiến map bị
  // "kẹt" không kéo nổi ở góc.
  function handleCanvasPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const pointers = activePointersRef.current;
    if (pointers.has(event.pointerId)) {
      const rect = event.currentTarget.getBoundingClientRect();
      pointers.set(event.pointerId, { x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
    // Đang có 2 ngón trên canvas -> ưu tiên pinch, không pan.
    if (pinchRef.current && pointers.size >= 2) {
      updatePinch();
      return;
    }
    const origin = panOriginRef.current;
    if (!origin) return;
    // Chia cho zoom vì pan tính bằng đơn vị CSS của graph (trước transform),
    // còn chuột di chuyển theo pixel màn hình đã nhân zoom.
    setPan({
      x: origin.panX + (event.clientX - origin.pointerX) / zoom,
      y: origin.panY + (event.clientY - origin.pointerY) / zoom,
    });
  }

  function handleCanvasPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    activePointersRef.current.delete(event.pointerId);
    // Còn < 2 ngón thì pinch kết thúc. Ngón còn lại KHÔNG tự chuyển thành pan
    // (không có panOrigin) — tránh viewport nhảy ngay sau khi nhấc 1 ngón.
    if (activePointersRef.current.size < 2) pinchRef.current = null;
    if (panOriginRef.current) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      panOriginRef.current = null;
    }
    event.currentTarget.classList.remove("is-panning");
  }

  function handleNodePointerDown(event: ReactPointerEvent<HTMLDivElement>, node: PositionedNode) {
    if (event.button !== 0) return;
    event.stopPropagation();
    markUserInteraction();
    dragNodeRef.current = {
      id: node.id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      start: { x: node.x - renderOffset.x, y: node.y - renderOffset.y },
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedId(node.id);
  }

  function handleNodePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragNodeRef.current;
    if (!drag) return;
    event.stopPropagation();
    setManualPositions((previous) => ({
      ...previous,
      [drag.id]: {
        x: drag.start.x + (event.clientX - drag.pointerX) / zoom,
        y: drag.start.y + (event.clientY - drag.pointerY) / zoom,
      },
    }));
  }

  function handleNodePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragNodeRef.current) event.currentTarget.releasePointerCapture(event.pointerId);
    dragNodeRef.current = null;
  }

  function renderCanvasNode(node: PositionedNode) {
    const kids = childrenByParent.get(node.id) ?? [];
    const isCollapsed = collapsed.has(node.id);
    const isSelected = node.id === selectedId;
    const isHit = query !== "" && (node.label.toLowerCase().includes(query) || (node.description ?? "").toLowerCase().includes(query));
    const color = TYPE_COLORS[node.type ?? ""] ?? "var(--text-dim)";
    // Màu viền dùng chung cho 3 cạnh (trên/phải/dưới); cạnh trái dùng màu
    // riêng theo loại node. Tách sẵn vào biến để style object chỉ còn các
    // longhand, tránh lặp ternary 3 lần.
    const borderTone = isSelected ? "var(--indigo)" : isHit ? "var(--cyan)" : "var(--border)";
    // Trạng thái đưa vào CLASS chứ không nhồi thêm inline style: hover/selected
    // cần box-shadow (ring) mà inline style không diễn tả được mức ưu tiên.
    const isRoot = rootIds.has(node.id);
    const nodeClassName = [
      "mindmap-node",
      isRoot ? "mindmap-node--root" : "",
      isSelected ? "mindmap-node--selected" : "",
      isHit ? "mindmap-node--hit" : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <div
        key={node.id}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedId(node.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedId(node.id);
          }
        }}
        onPointerDown={(event) => handleNodePointerDown(event, node)}
        onPointerMove={handleNodePointerMove}
        onPointerUp={handleNodePointerUp}
        onPointerCancel={handleNodePointerUp}
        aria-label={`Node ${node.label}`}
        className={nodeClassName}
        data-node-id={node.id}
        ref={(element) => {
          if (element) {
            nodeRefs.current.set(node.id, element);
            // Observe ngay khi node được gắn vào DOM, kể cả node sinh ra sau
            // lần render đầu (thêm/xoá node) — không phụ thuộc effect chạy lại.
            nodeObserverRef.current?.observe(element);
          } else {
            // React gọi ref với null khi node bị unmount; giữ element cũ để
            // unobserve trước khi xoá khỏi map.
            const previous = nodeRefs.current.get(node.id);
            if (previous) nodeObserverRef.current?.unobserve(previous);
            nodeRefs.current.delete(node.id);
          }
        }}
        style={{
          left: node.x - node.width / 2,
          top: node.y,
          width: node.width,
          // Cố ý KHÔNG đặt height/minHeight theo số đo ở đây. Nếu khoá
          // minHeight bằng chiều cao đo được, node sẽ KHÔNG BAO GIỜ co lại
          // khi người dùng rút ngắn label (nó giữ đúng chiều cao cũ). Để node
          // tự cao theo nội dung thật rồi đo bằng ResizeObserver là cách
          // duy nhất vừa không cắt chữ vừa co giãn đúng. Min-height cố định
          // nhỏ đặt ở CSS (.mindmap-node) cho node 1 dòng trông không quá mỏng.
          background: isSelected ? "var(--indigo-soft)" : "var(--panel-strong)",
          borderTopColor: borderTone,
          borderRightColor: borderTone,
          borderBottomColor: borderTone,
          borderLeftColor: color,
          cursor: "grab",
        }}
      >
        <div className="mindmap-node__content">
          {kids.length > 0 && (
            <button
              type="button"
              className="mindmap-node__toggle"
              onClick={(event) => {
                event.stopPropagation();
                toggleCollapse(node.id);
              }}
              aria-label={isCollapsed ? t("mm.expand", { n: node.label }) : t("mm.collapse", { n: node.label })}
            >
              {isCollapsed ? "+" : "−"}
            </button>
          )}
          <span className="mindmap-node__label">{node.label}</span>
          {node.description && (
            // `title` giữ nguyên văn đầy đủ cho trường hợp mô tả dài bị
            // line-clamp ở CSS cắt bớt — node trong canvas chỉ là bản tóm tắt.
            <span className="mindmap-node__description" title={node.description}>
              {node.description}
            </span>
          )}
        </div>
        {isHit && <span className="mindmap-node__match" aria-hidden="true">●</span>}
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
          <div style={{ fontSize: 12.5, color: "var(--mm-meta)" }}>
            {t("mm.nodes", { n: nodes.length })}{dirty ? ` · ${t("mm.unsaved")}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={deleteMindMap} style={{ color: "var(--rose)" }}>
            {t("common.delete")}
          </button>
          <button
            className="btn-secondary"
            onClick={() => zoomBy(1 / ZOOM_BUTTON_FACTOR)}
            disabled={zoom <= MIN_ZOOM + 0.001}
            aria-label={t("mm.zoomOut")}
          >
            −
          </button>
          {/* Hiển thị % đồng thời là nút Reset View: bấm vào số % để về
              zoom 100% + pan gốc. Nhờ vậy không cần thêm một nút riêng cho
              reset khi người dùng chỉ muốn thoát chế độ zoom đã phóng to. */}
          <button
            className="btn-secondary"
            onClick={resetView}
            aria-label={t("mm.resetView")}
            title={t("mm.resetView")}
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="btn-secondary"
            onClick={() => zoomBy(ZOOM_BUTTON_FACTOR)}
            disabled={zoom >= MAX_ZOOM - 0.001}
            aria-label={t("mm.zoomIn")}
          >
            +
          </button>
          <button className="btn-secondary" onClick={runAutoLayout} aria-label={t("mm.autoLayout")}>
            {t("mm.autoLayout")}
          </button>
          <button className="btn-secondary" onClick={() => fitCanvas()} aria-label={t("mm.fitCanvas")}>
            {t("mm.fitCanvas")}
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

      <div className="grid-progress mindmap-grid">
        <Panel className="mindmap-panel">
          <div
            ref={canvasRef}
            className="mindmap-viewport"
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            // Zoom chuột do useEffect gắn trực tiếp (non-passive) — xem
            // handleWheel ở trên; onWheel của React không chặn được cuộn trang.
          >
            {visibleRenderNodes.length === 0 ? (
              <p className="state-msg">{t("mm.noNodes")}</p>
            ) : (
              <div
                className="mindmap-stage"
                style={{
                  width: graphSize.width,
                  height: graphSize.height,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                }}
              >
                <svg className="mindmap-edges" width={graphSize.width} height={graphSize.height} viewBox={`0 0 ${graphSize.width} ${graphSize.height}`} aria-hidden="true">
                  {visibleEdges.map((edge) => {
                    const source = visibleNodeById.get(edge.source);
                    const target = visibleNodeById.get(edge.target);
                    if (!source || !target) return null;
                    return (
                      <path
                        key={edge.id}
                        // Nhánh nối trực tiếp từ node trung tâm vẽ đậm hơn (trunk)
                        // để mắt bám được cấu trúc chính trước khi đọc nhánh con.
                        className={rootIds.has(edge.source) ? "mindmap-edge--trunk" : undefined}
                        d={getEdgePath(source, target)}
                      />
                    );
                  })}
                </svg>
                {visibleRenderNodes.map((node) => renderCanvasNode(node))}
              </div>
            )}
          </div>
        </Panel>

        <Panel className="mindmap-detail">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{t("mm.nodeDetail")}</div>
          {!selected ? (
            <p style={{ color: "var(--mm-meta)", fontSize: 13.5 }}>{t("mm.pickNode")}</p>
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
                <p style={{ fontSize: 13, color: "var(--mm-desc)", marginTop: 12, lineHeight: 1.6 }}>
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
