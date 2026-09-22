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

const NODE_HEIGHT = 42;
const NODE_WIDTH = 200;
const LEVEL_WIDTH = 160;
const V_GAP = 18;
const MARGIN = 40;

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

function nodeWidth(node: MindMapNode): number {
  if (node.type === "root") return 240;
  if (node.type === "concept") return 200;
  return 180;
}

function nodeHeight(node: MindMapNode): number {
  const w = nodeWidth(node);
  const charsPerLine = Math.floor((w - 32) / 11);
  const lines = Math.max(1, Math.ceil(node.label.length / charsPerLine));
  return Math.min(lines, 3) * 24 + 28;
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
 * Tính layout cho toàn bộ graph.
 * `collapsed` là tập id node đang thu gọn — node con của chúng sẽ
 * KHÔNG được bao gồm trong export để tránh file khổng lồ vô nghĩa.
 */
export function computeLayout(
  nodes: MindMapNode[],
  collapsed: Set<string> = new Set()
): LayoutResult {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const childrenByParent = new Map<string, MindMapNode[]>();

  for (const n of nodes) {
    if (n.parentId) {
      const siblings = childrenByParent.get(n.parentId) || [];
      siblings.push(n);
      childrenByParent.set(n.parentId, siblings);
    }
  }

  const roots = nodes.filter((n) => n.parentId === null);

  if (roots.length === 0) {
    const positioned: PositionedNode[] = nodes.map((n, i) => ({
      ...n,
      x: NODE_WIDTH / 2 + MARGIN,
      y: MARGIN + i * (NODE_HEIGHT + V_GAP),
      width: nodeWidth(n),
      height: nodeHeight(n),
    }));
    return {
      nodes: positioned,
      edges: deriveEdges(nodes),
      width: NODE_WIDTH + MARGIN * 2,
      height: nodes.length * (NODE_HEIGHT + V_GAP) + MARGIN * 2,
    };
  }

  // --- Pass 1: tính subtree height ---
  const subtreeHeight = new Map<string, number>();

  function computeHeight(nodeId: string, visited: Set<string>): number {
    if (visited.has(nodeId)) return 0;
    visited.add(nodeId);
    const isCollapsed = collapsed.has(nodeId);
    const kids = isCollapsed
      ? []
      : (childrenByParent.get(nodeId) || []).filter((k) => !visited.has(k.id));

    if (kids.length === 0) {
      subtreeHeight.set(nodeId, NODE_HEIGHT);
      return NODE_HEIGHT;
    }

    let total = 0;
    for (const kid of kids) {
      total += computeHeight(kid.id, new Set(visited));
    }
    total += V_GAP * (kids.length - 1);
    subtreeHeight.set(nodeId, total);
    return total;
  }

  for (const root of roots) {
    computeHeight(root.id, new Set());
  }

  // --- Pass 2: gán tọa độ ---
  const positions = new Map<string, PositionedNode>();
  const positionedEdges: MindMapEdge[] = [];
  let maxX = 0;
  let maxY = 0;
  let yCursor = MARGIN;

  function assignPos(
    nodeId: string,
    depth: number,
    yStart: number,
    visited: Set<string>
  ): number {
    if (visited.has(nodeId)) return yStart;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId)!;
    const isCollapsed = collapsed.has(nodeId);
    const kids = isCollapsed
      ? []
      : (childrenByParent.get(nodeId) || []).filter((k) => !visited.has(k.id));

    const w = nodeWidth(node);
    const h = nodeHeight(node);

    const x = depth * LEVEL_WIDTH + MARGIN + w / 2;
    const y = yStart;

    positions.set(nodeId, { ...node, x, y, width: w, height: h });
    maxX = Math.max(maxX, x + w / 2 + MARGIN);
    maxY = Math.max(maxY, y + h + MARGIN);

    let nextY = yStart + h + V_GAP;

    if (kids.length > 0) {
      const childTotal = kids.reduce(
        (sum, k) => sum + (subtreeHeight.get(k.id) || NODE_HEIGHT),
        0
      );
      const childSpacing = V_GAP * (kids.length - 1);
      const totalChild = childTotal + childSpacing;
      const parentCenterY = yStart + h / 2;
      let childY = parentCenterY - totalChild / 2;

      for (const kid of kids) {
        positionedEdges.push({
          id: `${nodeId}->${kid.id}`,
          source: nodeId,
          target: kid.id,
        });
        const childH = subtreeHeight.get(kid.id) || NODE_HEIGHT;
        assignPos(kid.id, depth + 1, childY, visited);
        childY += childH + V_GAP;
        nextY = Math.max(nextY, childY);
      }
    }

    return nextY;
  }

  for (const root of roots) {
    yCursor = assignPos(root.id, 0, yCursor, new Set());
    yCursor += V_GAP;
  }

  return {
    nodes: Array.from(positions.values()),
    edges: positionedEdges,
    width: maxX,
    height: maxY,
  };
}