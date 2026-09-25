// ================================================================
// MIND MAP TREE LAYOUT ENGINE
// ================================================================
// Export phải render TOÀN BỘ graph (mọi node, dù nằm ngoài viewport)
// dưới dạng SVG — không screenshot. Cần tính tọa độ (x, y) của TỪNG
// node trước khi vẽ SVG.
//
// Thuật toán 2-pass:
//   Pass 1 — tính subtree height để biết phân bố children.
//   Pass 2 — gán tọa độ thực: depth → x (indent), y canh giữa parent.
// ================================================================

import type { MindMapNode, MindMapEdge } from "./graph";

export interface PositionedNode extends MindMapNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  nodes: PositionedNode[];
  edges: MindMapEdge[];
  width: number;
  height: number;
}

const MIN_NODE_WIDTH = 160;
const MAX_NODE_WIDTH = 300;
const NODE_TEXT_PADDING = 44;
const NODE_LINE_HEIGHT = 20;
/** Đệm trên+dưới của card node (khớp padding CSS .mindmap-node__content). */
const NODE_VERTICAL_PADDING = 32;
/** Khe giữa dòng tiêu đề và khối description (khớp `gap` của CSS). */
const NODE_DESCRIPTION_GAP = 6;
/**
 * Node CÓ description phải đủ rộng để mô tả xuống dòng đẹp trong ~3 dòng.
 * Nếu để node bám thuần theo độ dài label, node 1 chữ sẽ rộng 160px và đoạn
 * mô tả bị bóp thành cột chữ 12 ký tự -> line-clamp cắt cụt gần hết nội dung.
 */
const MIN_DESCRIBED_NODE_WIDTH = 236;

/* ---- Số liệu DÙNG CHUNG giữa layout, export SVG và CSS node ---- */
// Description đo bằng cùng hệ số ở cả 3 nơi, nếu không chiều cao node tính từ
// layout() sẽ lệch chiều cao thật khi render -> card cắt chữ hoặc hở chỗ.
export const NODE_DESC_FONT_SIZE = 11.5;
/** Bề rộng trung bình 1 ký tự description (px) — dùng để ước lượng số dòng. */
export const NODE_DESC_CHAR_WIDTH = 6.1;
export const NODE_DESC_LINE_HEIGHT = 18;
/** Giới hạn số dòng description hiển thị trong node (line-clamp ở CSS). */
export const NODE_DESC_MAX_LINES = 3;

/**
 * Khoảng hở tối thiểu giữa hai node bất kỳ (khác tầng, khác nhánh) — dùng cho
 * bước chống chồng. Tăng so với trước để edge có chỗ đi giữa hai node thay vì
 * dồn thành một chùm dây.
 */
export const NODE_GAP_X = 84;
export const NODE_GAP_Y = 44;
/** Khoảng hở HƯỚNG TÂM tối thiểu giữa hai tầng liền kề. */
export const LEVEL_GAP = 96;
/** Khoảng hở THEO CUNG tối thiểu giữa hai node CÙNG tầng (cùng bán kính). */
export const TANGENTIAL_GAP = 64;
/** Lề an toàn quanh toàn bộ graph: node ngoài cùng không bao giờ chạm mép stage. */
export const GRAPH_PADDING = 128;
/** Độ cong tối đa của edge — xem getEdgePath(). */
const MAX_EDGE_BEND = 120;

// Màu node theo loại, lấy từ :root dark theme. SVG data URI không
// tham chiếu được CSS variable khi rasterize bởi canvas.
export const NODE_TYPE_COLORS: Record<string, string> = {
  root: "#35d0d8",
  concept: "#7c6cf0",
  detail: "#94a0b8",
  example: "#f5c76a",
  formula: "#7cf0e6",
  prerequisite: "#f07c91",
};

// Màu nền và viền cho SVG/PDF — trùng với dark theme :root.
export const EXPORT_BG = "#0a0e16";
export const EXPORT_PANEL = "#1b2233";
export const EXPORT_BORDER = "rgba(201, 211, 255, 0.12)";
export const EXPORT_TEXT = "#f5f7ff";
/**
 * Chữ mô tả trong file export — trùng --mm-desc của canvas. Mô tả phải sáng
 * vừa đủ đọc trên card tối nhưng KHÔNG sáng bằng tiêu đề (giữ đúng thứ bậc
 * title > description > metadata như trên canvas).
 */
export const EXPORT_TEXT_DIM = "#b6c2d9";

function wrapLabel(label: string, maxChars: number): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean).flatMap((word) => {
    if (word.length <= maxChars) return [word];
    const chunks: string[] = [];
    for (let index = 0; index < word.length; index += maxChars) chunks.push(word.slice(index, index + maxChars));
    return chunks;
  });
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && current.length + word.length + 1 > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current += current ? ` ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

/** Bề rộng node: theo label, nhưng node có description được nới tối thiểu. */
function nodeWidth(node: MindMapNode): number {
  const longestWord = Math.max(...node.label.split(/\s+/).map((word) => word.length), 1);
  const estimated = Math.max(longestWord * 7.2 + NODE_TEXT_PADDING, node.label.length * 6.2 + NODE_TEXT_PADDING);
  const withDescription = node.description
    ? MIN_DESCRIBED_NODE_WIDTH +
      Math.min(MAX_NODE_WIDTH - MIN_DESCRIBED_NODE_WIDTH, node.description.length * 0.45)
    : 0;
  return clampEstimatedWidth(Math.max(estimated, withDescription));
}

/** Bề rộng ước lượng: làm tròn lên 10px cho số đẹp, luôn nằm trong [min, max]. */
function clampEstimatedWidth(value: number): number {
  return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, Math.ceil(value / 10) * 10));
}

/** Bề rộng ĐO ĐƯỢC từ DOM: giữ nguyên số đo, chỉ kẹp vào [min, max]. */
function clampMeasuredWidth(value: number): number {
  return Math.min(MAX_NODE_WIDTH, Math.max(MIN_NODE_WIDTH, Math.ceil(value)));
}

/** Ước lượng height khi CHƯA đo được trong DOM (ví dụ khi export chạy server). */
function estimateNodeHeight(node: MindMapNode): number {
  const width = nodeWidth(node);
  const lines = wrapLabel(node.label, Math.max(10, Math.floor((width - NODE_TEXT_PADDING) / 7.2)));
  let height = NODE_VERTICAL_PADDING + lines.length * NODE_LINE_HEIGHT;
  if (node.description) {
    // Mô tả cũng bị line-clamp ở CSS nên chiều cao ước lượng phải kẹp cùng số
    // dòng — nếu không, lần render đầu (chưa đo DOM) phóng node cao vống lên.
    const descriptionLines = Math.min(
      NODE_DESC_MAX_LINES,
      wrapLabel(node.description, Math.max(8, Math.floor((width - NODE_TEXT_PADDING) / NODE_DESC_CHAR_WIDTH))).length
    );
    height += NODE_DESCRIPTION_GAP + descriptionLines * NODE_DESC_LINE_HEIGHT;
  }
  return height;
}

/**
 * Height cuối cùng dùng cho layout: lấy số đo thật của DOM nếu có, ngược lại
 * mới fallback về ước lượng theo số ký tự.
 *
 * Vì sao cần: ước lượng theo ký tự KHÔNG biết font thật đã wrap mấy dòng, nên
 * node có `overflow: hidden` sẽ cắt mất chữ. Đo bằng ResizeObserver ở client rồi
 * đưa ngược vào đây giúp wrap của trình duyệt là nguồn sự thật, còn con số ước
 * lượng chỉ là fallback cho bước render đầu tiên và cho export chạy ngoài DOM.
 */
function resolveNodeHeight(node: MindMapNode, measuredHeights?: Record<string, number>): number {
  const measured = measuredHeights?.[node.id];
  if (typeof measured === "number" && Number.isFinite(measured) && measured > 0) {
    return Math.ceil(measured);
  }
  return estimateNodeHeight(node);
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Rút gọn edges từ danh sách node (parentId) — dùng cho JSON export. */
export function deriveEdges(nodes: MindMapNode[]): MindMapEdge[] {
  const edgeSet = new Map<string, MindMapEdge>();
  for (const n of nodes) {
    if (n.parentId) {
      const key = `${n.parentId}->${n.id}`;
      if (!edgeSet.has(key)) {
        edgeSet.set(key, { id: key, source: n.parentId, target: n.id });
      }
    }
  }
  return Array.from(edgeSet.values());
}

/**
 * Tính layout và bounding box cho toàn bộ graph đã lưu. Trạng thái collapse
 * chỉ thuộc UI nên export luôn chứa mọi node/edge, kể cả nhánh đang ẩn.
 */
export function computeLayout(
  nodes: MindMapNode[],
  options: { measuredHeights?: Record<string, number>; measuredWidths?: Record<string, number> } = {}
): LayoutResult {
  const measuredHeights = options.measuredHeights;
  const measuredWidths = options.measuredWidths;
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, MindMapNode[]>();
  for (const node of nodes) {
    if (!node.parentId || !nodeMap.has(node.parentId)) continue;
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }

  const roots = nodes.filter((node) => node.parentId === null || !nodeMap.has(node.parentId));
  if (roots.length === 0 || nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  // Kích thước từng node: số đo THẬT của DOM nếu có, không thì ước lượng
  // (export chạy ngoài DOM nên không đo được gì). Tính 1 lần rồi dùng lại cho
  // cả bán kính từng tầng lẫn vị trí node — tránh mỗi bước ước lượng một kiểu.
  const sizeById = new Map<string, { width: number; height: number }>();
  for (const node of nodes) {
    const measuredWidth = measuredWidths?.[node.id];
    const width =
      typeof measuredWidth === "number" && Number.isFinite(measuredWidth) && measuredWidth > 0
        ? clampMeasuredWidth(measuredWidth)
        : nodeWidth(node);
    sizeById.set(node.id, { width, height: resolveNodeHeight(node, measuredHeights) });
  }

  const leafCount = new Map<string, number>();
  const countLeaves = (nodeId: string, visiting = new Set<string>()): number => {
    if (leafCount.has(nodeId)) return leafCount.get(nodeId)!;
    if (visiting.has(nodeId)) return 1;
    const nextVisiting = new Set(visiting).add(nodeId);
    const children = childrenByParent.get(nodeId) ?? [];
    const count = children.length === 0
      ? 1
      : children.reduce((sum, child) => sum + countLeaves(child.id, nextVisiting), 0);
    leafCount.set(nodeId, count);
    return count;
  };

  const angleById = new Map<string, number>();
  const root = roots[0];
  countLeaves(root.id);
  const rootChildren = childrenByParent.get(root.id) ?? [];
  const branchGap = Math.min(0.28, Math.max(0.1, Math.PI / Math.max(8, rootChildren.length * 2)));
  // Trừ `n` khe (KHÔNG phải `n-1`): các nhánh fan thành vòng tròn khép kín nên
  // khe giữa nhánh CUỐI và nhánh ĐẦU cũng phải bằng branchGap. Công thức cũ
  // trừ (n-1) khe nên nhánh cuối dính sát nhánh đầu ở đáy vòng tròn — đúng chỗ
  // người dùng thấy các đường nối chụm lại thành "chùm dây" phía dưới.
  const available = Math.max(Math.PI * 0.8, Math.PI * 2 - branchGap * rootChildren.length);
  let cursor = -available / 2 - Math.PI / 2;
  for (const child of rootChildren) {
    const span = rootChildren.length === 1 ? available : available * countLeaves(child.id) / Math.max(1, leafCount.get(root.id)!);
    const end = cursor + span;
    assignAngles(child.id, cursor, end);
    cursor = end + branchGap;
  }

  function assignAngles(nodeId: string, start: number, end: number): void {
    angleById.set(nodeId, (start + end) / 2);
    const kids = childrenByParent.get(nodeId) ?? [];
    if (kids.length === 0) return;
    const totalLeaves = kids.reduce((sum, kid) => sum + countLeaves(kid.id), 0);
    const childGap = Math.min(0.18, Math.max(0.035, (end - start) / Math.max(8, kids.length * 3)));
    const usable = Math.max(0.08, end - start - childGap * Math.max(0, kids.length - 1));
    let childCursor = start;
    for (const kid of kids) {
      const kidSpan = usable * countLeaves(kid.id) / Math.max(1, totalLeaves);
      const kidEnd = childCursor + kidSpan;
      assignAngles(kid.id, childCursor, kidEnd);
      childCursor = kidEnd + childGap;
    }
  }

  // Tầng (depth) của từng node + BÁN KÍNH THẬT của từng tầng. Đây là gốc rễ
  // của lỗi "chùm dây": bán kính cũ là hằng số `depth * 285`, không biết tầng
  // đó có bao nhiêu node và node rộng bao nhiêu, nên khi tầng đông node thì các
  // node bị nhồi vào một vòng tròn quá nhỏ; bước chống chồng phải đẩy chúng ra
  // hỗn loạn và edge cắt nhau tạo thành chùm.
  const depthById = new Map<string, number>();
  const depthQueue: Array<{ id: string; depth: number }> = roots.map((node) => ({ id: node.id, depth: 0 }));
  for (let index = 0; index < depthQueue.length; index += 1) {
    const entry = depthQueue[index];
    if (depthById.has(entry.id)) continue;
    depthById.set(entry.id, entry.depth);
    for (const child of childrenByParent.get(entry.id) ?? []) {
      depthQueue.push({ id: child.id, depth: entry.depth + 1 });
    }
  }
  const radiusByDepth = computeRingRadii(nodes, depthById, angleById, sizeById);

  const positioned: PositionedNode[] = [];
  const placed = new Set<string>();
  const place = (nodeId: string, depth: number, visited = new Set<string>()): void => {
    if (placed.has(nodeId) || visited.has(nodeId)) return;
    const node = nodeMap.get(nodeId);
    if (!node) return;
    placed.add(nodeId);
    // Kích thước đã tính sẵn một lần trong sizeById (đo DOM hoặc ước lượng).
    const size = sizeById.get(nodeId) ?? { width: nodeWidth(node), height: resolveNodeHeight(node, measuredHeights) };
    const angle = angleById.get(nodeId) ?? 0;
    // Bán kính mỗi tầng phải đủ lớn để chứa node rộng nhất của tầng đó cộng
    // khoảng hở. Nếu cứ dùng một hằng số chung cho mọi tầng, node text
    // dài sẽ tràn vào tầng trong và tầng sâu bị dồn sát tầng ngoài.
    // Bán kính tầng này đã được tính đủ rộng cho MỌI node nằm trên nó —
    // xem computeRingRadii().
    const radius = radiusByDepth.get(depth) ?? depth * (MAX_NODE_WIDTH + LEVEL_GAP);
    positioned.push({
      ...node,
      width: size.width,
      height: size.height,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius - size.height / 2,
    });
    for (const child of childrenByParent.get(nodeId) ?? []) {
      place(child.id, depth + 1, new Set(visited).add(nodeId));
    }
  };
  place(root.id, 0);

  // Keep malformed/cycle data renderable without changing the stored graph.
  for (const [index, node] of nodes.entries()) {
    if (placed.has(node.id)) continue;
    const size = sizeById.get(node.id) ?? { width: nodeWidth(node), height: resolveNodeHeight(node, measuredHeights) };
    positioned.push({
      ...node,
      width: size.width,
      height: size.height,
      x: (index % 3) * (size.width + NODE_GAP_X),
      y: Math.floor(index / 3) * (size.height + NODE_GAP_Y),
    });
  }

  // Collision relaxation works on measured rectangles, not level/index guesses.
  for (let pass = 0; pass < 14; pass += 1) {
    let changed = false;
    for (let i = 0; i < positioned.length; i += 1) {
      for (let j = i + 1; j < positioned.length; j += 1) {
        const a = positioned[i];
        const b = positioned[j];
        const dx = b.x - a.x;
        const centerDy = (b.y + b.height / 2) - (a.y + a.height / 2);
        const overlapX = (a.width + b.width) / 2 + NODE_GAP_X - Math.abs(dx);
        const overlapY = (a.height + b.height) / 2 + NODE_GAP_Y - Math.abs(centerDy);
        if (overlapX <= 0 || overlapY <= 0) continue;
        changed = true;
        if (overlapX < overlapY) {
          const shift = (dx >= 0 ? 1 : -1) * overlapX / 2;
          if (a.id !== root.id) a.x -= shift;
          if (b.id !== root.id) b.x += shift;
        } else {
          const shift = (centerDy >= 0 ? 1 : -1) * overlapY / 2;
          if (a.id !== root.id) a.y -= shift;
          if (b.id !== root.id) b.y += shift;
        }
      }
    }
    if (!changed) break;
  }

  const minX = Math.min(...positioned.map((node) => node.x - node.width / 2));
  const minY = Math.min(...positioned.map((node) => node.y));
  const maxX = Math.max(...positioned.map((node) => node.x + node.width / 2));
  const maxY = Math.max(...positioned.map((node) => node.y + node.height));
  const offsetX = GRAPH_PADDING - minX;
  const offsetY = GRAPH_PADDING - minY;
  for (const node of positioned) node.x += offsetX, node.y += offsetY;

  return {
    nodes: positioned,
    edges: deriveEdges(nodes),
    width: maxX - minX + GRAPH_PADDING * 2,
    height: maxY - minY + GRAPH_PADDING * 2,
  };
}

/**
 * Bán kính của TỪNG TẦNG (radial ring) — nguồn gốc của "khoảng thở" trong mind
 * map. Bán kính được suy từ hình học thật, không dùng hằng số chung:
 *
 *   (a) Hướng tâm — tầng ngoài phải cách tầng trong đủ để hai tầng không chạm:
 *       r[d] >= r[d-1] + nửa rộng lớn nhất tầng trước + LEVEL_GAP
 *             + nửa rộng lớn nhất tầng này.
 *   (b) Theo cung — hai node CÙNG tầng kề nhau về góc phải cách nhau đủ dây
 *       cung (chord) để không chồng: r >= (halfA + halfB + TANGENTIAL_GAP) /
 *       (2 sin(Δ/2)), với Δ là hiệu góc giữa hai node.
 *
 * Nhờ (b), tầng đông node sẽ tự nới bán kính ra thay vì nhồi node, nên khoảng
 * trống giữa các nhánh luôn đủ cho edge chui qua và bước chống chồng phía sau
 * gần như không phải làm gì (đỡ bị đẩy hỗn loạn như trước).
 */
function computeRingRadii(
  nodes: MindMapNode[],
  depthById: Map<string, number>,
  angleById: Map<string, number>,
  sizeById: Map<string, { width: number; height: number }>
): Map<number, number> {
  const ringByDepth = new Map<number, Array<{ angle: number; halfWidth: number }>>();
  const maxHalfWidthByDepth = new Map<number, number>();

  for (const node of nodes) {
    const depth = depthById.get(node.id);
    const size = sizeById.get(node.id);
    if (depth === undefined || !size) continue;
    const entry = { angle: angleById.get(node.id) ?? 0, halfWidth: size.width / 2 };
    const ring = ringByDepth.get(depth) ?? [];
    ring.push(entry);
    ringByDepth.set(depth, ring);
    maxHalfWidthByDepth.set(depth, Math.max(maxHalfWidthByDepth.get(depth) ?? 0, entry.halfWidth));
  }

  const radii = new Map<number, number>();
  // Sắp xếp tầng tăng dần để tầng sau luôn biết bán kính tầng trước; dùng
  // index thay vì depth - 1 để vẫn đúng khi dữ liệu nhảy tầng (thiếu tầng).
  const depths = Array.from(ringByDepth.keys()).sort((a, b) => a - b);
  for (let index = 0; index < depths.length; index += 1) {
    const depth = depths[index];
    if (index === 0) {
      radii.set(depth, 0);
      continue;
    }
    const previousDepth = depths[index - 1];
    let required =
      (radii.get(previousDepth) ?? 0) +
      (maxHalfWidthByDepth.get(previousDepth) ?? 0) +
      LEVEL_GAP +
      (maxHalfWidthByDepth.get(depth) ?? 0);

    const ring = [...(ringByDepth.get(depth) ?? [])].sort((a, b) => a.angle - b.angle);
    if (ring.length > 1) {
      for (let slot = 0; slot < ring.length; slot += 1) {
        const current = ring[slot];
        const next = ring[(slot + 1) % ring.length];
        if (next === current) continue;
        let delta = Math.abs(next.angle - current.angle);
        // Cặp CUỐI -> ĐẦU là cặp kề nhau qua "khe" nối vòng tròn, phải đo bằng
        // cung còn lại (2π - Δ). Bỏ qua cặp này chính là lỗi khiến nhánh cuối
        // và nhánh đầu chạm nhau ở đáy mind map.
        if (slot === ring.length - 1) delta = Math.max(0, Math.PI * 2 - delta);
        delta = Math.min(Math.PI, delta);
        // Hai node trùng góc thì bán kính không tách được — để bước chống chồng
        // (collision relaxation) xử lý.
        if (delta <= 0.0001) continue;
        const needed = (current.halfWidth + next.halfWidth + TANGENTIAL_GAP) / (2 * Math.sin(delta / 2));
        required = Math.max(required, needed);
      }
    }
    radii.set(depth, required);
  }
  return radii;
}

/**
 * Return a cubic edge clipped to the source/target node borders.
 *
 * Bend bị chặn trần (MAX_EDGE_BEND): trước đây bend = 45% độ dài nên edge dài
 * rời node theo phương vuông góc rồi móc ngược lại — nhiều edge như vậy nằm
 * cạnh nhau nhìn thành "chùm dây". Chặn trần giúp edge rời node theo đúng
 * hướng node đích, đi gần thẳng hết quãng rồi mới lượn vào viền đích, nên
 * hướng của từng nhánh đọc được ngay và không xuyên qua node khác.
 */
export function getEdgePath(source: PositionedNode, target: PositionedNode): string {
  const sourceCenter = { x: source.x, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x, y: target.y + target.height / 2 };
  const dx = targetCenter.x - sourceCenter.x;
  const dy = targetCenter.y - sourceCenter.y;
  const sourceScale = 1 / Math.max(Math.abs(dx) / (source.width / 2), Math.abs(dy) / (source.height / 2), 1e-6);
  const targetScale = 1 / Math.max(Math.abs(dx) / (target.width / 2), Math.abs(dy) / (target.height / 2), 1e-6);
  const start = { x: sourceCenter.x + dx * sourceScale, y: sourceCenter.y + dy * sourceScale };
  const end = { x: targetCenter.x - dx * targetScale, y: targetCenter.y - dy * targetScale };
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const distance = horizontal ? Math.abs(end.x - start.x) : Math.abs(end.y - start.y);
  const bend = Math.min(distance * 0.45, MAX_EDGE_BEND);
  const direction = horizontal ? Math.sign(dx || 1) : Math.sign(dy || 1);
  const c1 = horizontal ? { x: start.x + direction * bend, y: start.y } : { x: start.x, y: start.y + direction * bend };
  const c2 = horizontal ? { x: end.x - direction * bend, y: end.y } : { x: end.x, y: end.y - direction * bend };
  return `M${start.x},${start.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${end.x},${end.y}`;
}