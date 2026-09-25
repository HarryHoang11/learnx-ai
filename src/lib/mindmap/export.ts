// ================================================================
// MIND MAP EXPORT SERVICE
// ================================================================
// Tách logic export khỏi page.tsx thành service riêng — service này
// CHỈ chứa pure function (SVG string, Markdown string, Blob),
// không biết gì về UI framework. Modal component gọi service này.
//
// Hỗ trợ 5 định dạng: SVG, PNG, PDF, JSON, Markdown.
// Export lấy TOÀN BỘ graph (tính bounding box, không screenshot viewport).
// ================================================================

import katex from "katex";
import { type MindMapData, type MindMapNode, type MindMapEdge } from "./graph";
import { computeLayout, deriveEdges, getEdgePath, NODE_TYPE_COLORS, NODE_DESC_CHAR_WIDTH, NODE_DESC_FONT_SIZE, NODE_DESC_LINE_HEIGHT, NODE_DESC_MAX_LINES, escapeXml, EXPORT_BG, EXPORT_PANEL, EXPORT_TEXT, EXPORT_TEXT_DIM, type PositionedNode } from "./layout";
import { splitMathSegments } from "../math/segments";

export const EXPORT_FORMATS = ["svg", "png", "pdf", "json", "md"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ExportFormatOption {
  value: ExportFormat;
  label: string;
  description: string;
  icon: string;
}

/**
 * Tên file tự động từ tên mind map — sanitize để tránh lỗi trên Windows/macOS.
 *
 * CHÚ Ý: chỉ loại ký tự CẤM trong tên file (`\ / : * ? " < > |`) và ký tự
 * điều khiển, GIỮ nguyên chữ có dấu tiếng Việt. Dùng `\p{L}`/`\p{N}`
 * (Unicode property escapes) chứ KHÔNG dùng `\w` — `\w` chỉ khớp ASCII
 * nên sẽ biến "Ôn thi" thành "_n thi", sai với app tiếng Việt.
 */
export function sanitizeFilename(name: string, extension: string): string {
  const base = name
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/[^\p{L}\p{N}._\- ]/gu, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^[_.\- ]+|[_.\- ]+$/g, "")
    .trim();
  return `${base || "mindmap"}.${extension}`;
}

/**
 * Danh sách edge ĐẦY ĐỦ: hợp của edge khai báo tường minh (data.edges) và
 * edge suy ra từ `parentId`, khử trùng theo source->target. Cần thiết vì
 * dữ liệu do AI sinh hoặc dữ liệu lưu cũ có thể chỉ có `parentId` mà mảng
 * `edges` rỗng — dùng đúng 1 hàm này để JSON/Markdown/SVG không lệch nhau.
 */
export function resolveEdges(data: MindMapData): MindMapEdge[] {
  const byKey = new Map<string, MindMapEdge>();
  for (const e of data.edges) byKey.set(`${e.source}->${e.target}`, e);
  for (const e of deriveEdges(data.nodes)) {
    const key = `${e.source}->${e.target}`;
    if (!byKey.has(key)) byKey.set(key, e);
  }
  return Array.from(byKey.values());
}

export interface MindMapExportPayload {
  format: "learnx-ai-mindmap";
  version: 1;
  title: string;
  exportedAt: string;
  /** Dữ liệu ở cấp ngoài để tương thích trực tiếp với import/schema hiện tại. */
  nodes: MindMapData["nodes"];
  edges: MindMapData["edges"];
  /** Snapshot chuẩn của dữ liệu, giữ cho các importer cũ đọc `data`. */
  data: MindMapData;
  layout: {
    width: number;
    height: number;
    nodes: Array<{
      id: string;
      position: { x: number; y: number; width: number; height: number };
      style: { fill: string; stroke: string; radius: number; fontSize: number; fontWeight: number };
      metadata: { type?: string; description?: string };
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      style: { stroke: string; strokeWidth: number };
    }>;
  };
}

/** Tạo payload backup có cả dữ liệu schema hiện tại và layout/style đã render. */
export function createMindMapExportPayload(data: MindMapData, title: string): MindMapExportPayload {
  const result = computeLayout(data.nodes);
  const positioned = new Map(result.nodes.map((node) => [node.id, node]));
  const edges = resolveEdges(data);

  return {
    format: "learnx-ai-mindmap",
    version: 1,
    title,
    exportedAt: new Date().toISOString(),
    nodes: data.nodes,
    edges,
    data: {
      version: data.version ?? 1,
      nodes: data.nodes,
      edges,
    },
    layout: {
      width: result.width,
      height: result.height,
      nodes: result.nodes.map((node) => ({
        id: node.id,
        position: { x: node.x - node.width / 2, y: node.y, width: node.width, height: node.height },
        style: {
          fill: node.parentId === null ? "#1b2233" : "#1a1f2d",
          stroke: NODE_TYPE_COLORS[node.type ?? ""] ?? "#94a0b8",
          radius: node.parentId === null ? 14 : 10,
          fontSize: node.parentId === null ? 15 : 13.5,
          fontWeight: node.parentId === null ? 700 : 500,
        },
        metadata: {
          ...(node.type ? { type: node.type } : {}),
          ...(node.description ? { description: node.description } : {}),
        },
      })),
      edges: edges
        .filter((edge) => positioned.has(edge.source) && positioned.has(edge.target))
        .map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          style: { stroke: "rgba(201,211,255,0.2)", strokeWidth: 1.5 },
        })),
    },
  };
}

/** Tạo dữ liệu JSON đầy đủ để backup & restore. */
export function toMindMapJsonExport(data: MindMapData, title: string): string {
  return JSON.stringify(createMindMapExportPayload(data, title), null, 2);
}

function wrapNodeLabel(label: string, width: number): string[] {
  const maxChars = Math.max(8, Math.floor((width - 36) / 7.2));
  const words = label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line && (line + " " + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line += `${line ? " " : ""}${word}`;
    }
  }
  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

function renderMathSVG(latex: string, display: boolean): string {
  // MathML is self-contained in SVG and remains vector when the file is
  // zoomed. SVG Canvas rasterization is supported by current Chromium/WebKit;
  // if a runtime cannot render MathML, the text fallback keeps the formula
  // readable instead of producing an empty node.
  const mathml = katex.renderToString(latex, {
    throwOnError: false,
    displayMode: display,
    output: "mathml",
    strict: false,
    trust: false,
  });
  return `<span class="math" data-latex="${escapeXml(latex)}">${mathml}</span>`;
}

function renderLabelSVG(label: string, width: number, isRoot: boolean): string {
  const segments = splitMathSegments(label);
  if (!segments.some((segment) => segment.type === "math")) {
    return wrapNodeLabel(label, width)
      .map(
        (line, index) =>
          `<text x="${width / 2}" y="${28 + index * 20}" text-anchor="middle" font-size="${isRoot ? 15 : 13.5}" fill="${EXPORT_TEXT}" font-weight="${isRoot ? 700 : 500}">${escapeXml(line)}</text>`
      )
      .join("");
  }

  // Mixed text/math labels are centered as MathML foreign objects, with a
  // visible raw-label fallback for SVG viewers without MathML support.
  const math = segments.find((segment) => segment.type === "math");
  const html = math?.type === "math" ? renderMathSVG(math.content, math.display) : "";
  return `<foreignObject x="12" y="18" width="${width - 24}" height="${Math.max(28, width / 2)}"><div xmlns="http://www.w3.org/1999/xhtml" style="color:${EXPORT_TEXT};font:13px system-ui,sans-serif;line-height:1.35;text-align:center;width:100%;overflow-wrap:anywhere">${html || escapeXml(label)}</div></foreignObject><text x="${width / 2}" y="${Math.min(34, width / 2 + 18)}" text-anchor="middle" font-size="11" fill="${EXPORT_TEXT}">${escapeXml(label)}</text>`;
}

/** Render mô tả của node thành các dòng nằm GỌN TRONG card (yêu cầu 3).
 *
 * Trước đây mô tả được vẽ 1 dòng, cắt ở 120 ký tự, không xuống dòng — chữ dài
 * tràn ra ngoài rect của node và trông như text "bay" bên cạnh node. Giờ mô tả
 * wrap theo cùng hệ số với layout (NODE_DESC_*), tối đa NODE_DESC_MAX_LINES
 * dòng và neo vào ĐÁY card nên luôn nằm trong node dù card cao bao nhiêu.
 */
function renderDescriptionSVG(node: PositionedNode): string {
  if (!node.description) return "";
  const maxChars = Math.max(8, Math.floor((node.width - 44) / NODE_DESC_CHAR_WIDTH));
  const lines = wrapDescription(node.description, maxChars);
  const lastBaseline = node.height - 10;
  const firstBaseline = lastBaseline - (lines.length - 1) * NODE_DESC_LINE_HEIGHT;
  return lines
    .map(
      (line, index) =>
        `<text x="${node.width / 2}" y="${firstBaseline + index * NODE_DESC_LINE_HEIGHT}" text-anchor="middle" font-size="${NODE_DESC_FONT_SIZE}" fill="${EXPORT_TEXT_DIM}">${escapeXml(line)}</text>`
    )
    .join("");
}

/** Wrap mô tả theo số ký tự mỗi dòng, tối đa NODE_DESC_MAX_LINES dòng. */
function wrapDescription(description: string, maxChars: number): string[] {
  const words = description.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let truncated = false;
  for (const word of words) {
    if (line && line.length + word.length + 1 > maxChars) {
      lines.push(line);
      line = word;
      if (lines.length === NODE_DESC_MAX_LINES) {
        truncated = true;
        break;
      }
    } else {
      line += line ? ` ${word}` : word;
    }
  }
  if (!truncated && line && lines.length < NODE_DESC_MAX_LINES) lines.push(line);
  // Canvas dùng line-clamp nên tự thêm "…"; SVG phải tự thêm để người đọc biết
  // là còn nội dung (và để 2 nơi hiển thị giống nhau).
  if (truncated && lines.length > 0) lines[lines.length - 1] = `${lines[lines.length - 1]}…`;
  return lines;
}

/** Render one positioned node into the same coordinate system as the graph edges. */
function renderNodeSVG(node: PositionedNode, isRoot: boolean): string {
  const stroke = NODE_TYPE_COLORS[node.type ?? ""] ?? "#94a0b8";
  const fill = isRoot ? EXPORT_PANEL : "#151b29";
  const x = node.x - node.width / 2;
  const y = node.y;
  const label = renderLabelSVG(node.label, node.width, isRoot);
  const description = renderDescriptionSVG(node);

  // The node is positioned from the full layout, not from the current canvas
  // transform, so branches outside the viewport remain in the exported file.
  return `<g data-node-id="${escapeXml(node.id)}" transform="translate(${x},${y})"><rect x="0" y="0" width="${node.width}" height="${node.height}" rx="${isRoot ? 14 : 10}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>${label}${description}</g>`;
}

/**
 * Sinh SVG string cho TOÀN BỘ graph — không chỉ viewport.
 * Bounding box được tính từ computeLayout() để bao phủ mọi node.
 */
export function generateMindMapSVG(
  data: MindMapData,
  options?: { title?: string }
): string {
  const title = options?.title ?? "Mind Map";

  const allNodes = data.nodes;
  const layout = computeLayout(allNodes);
  const { nodes: positioned, width, height } = layout;

  const nodeMap = new Map(positioned.map((n) => [n.id, n] as const));
  const roots = positioned.filter((n) => n.parentId === null);
  const rootIds = new Set(roots.map((r) => r.id));

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${width} ${height}" style="background:${EXPORT_BG};font-family:system-ui,sans-serif">`;
  svg += `<style>text{font-family:'Noto Sans',system-ui,sans-serif;}</style>`;

  // Title bar
  svg += `<text x="${width / 2}" y="20" text-anchor="middle" font-size="18" font-weight="700" fill="${EXPORT_TEXT}">${escapeXml(title)}</text>`;

  // Edges — vẽ TRƯỚC node để nằm sau (z-order). Dùng resolveEdges() thay vì
  // layout.edges để cả edge khai báo tường minh (không suy ra được từ
  // parentId) cũng được vẽ; edge trỏ tới node bị thu gọn/không có trong
  // layout sẽ tự bị bỏ qua ở bước tra nodeMap.
  for (const edge of resolveEdges(data)) {
    const source = nodeMap.get(edge.source);
    const target = nodeMap.get(edge.target);
    if (!source || !target) continue;
    svg += `<path d="${getEdgePath(source, target)}" stroke="rgba(201,211,255,0.2)" stroke-width="1.5" fill="none"/>`;
  }

  // Nodes
  for (const node of positioned) {
    svg += renderNodeSVG(node, rootIds.has(node.id));
  }

  svg += `</svg>`;
  return svg;
}

/**
 * Chuyển SVG string thành PNG Blob bằng browser Canvas API.
 * Scale 2x cho PNG chất lượng cao.
 */
export async function svgToPngBlob(svgString: string, scale: number = 2): Promise<Blob> {
  if (typeof document === "undefined") {
    throw new Error("svgToPngBlob chỉ chạy ở browser.");
  }

  const widthMatch = svgString.match(/width="(\d+(?:\.\d+)?)/);
  const heightMatch = svgString.match(/height="(\d+(?:\.\d+)?)/);
  const rawWidth = widthMatch ? parseFloat(widthMatch[1]) : 800;
  const rawHeight = heightMatch ? parseFloat(heightMatch[1]) : 600;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(rawWidth * scale);
  canvas.height = Math.round(rawHeight * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không thể tạo canvas context.");

  ctx.fillStyle = EXPORT_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const img = new Image();
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  return new Promise<Blob>((resolve, reject) => {
    img.onload = () => {
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Không thể tạo PNG blob."))),
        "image/png"
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không thể tải SVG để rasterize."));
    };
    img.src = url;
  });
}

/** Sinh Markdown outline từ cây mind map. */
export function generateMindMapMarkdown(data: MindMapData, title: string): string {
  const roots = data.nodes.filter((n) => n.parentId === null);
  const lines: string[] = [
    `# ${title}`,
    `*Exported from LearnX AI Mind Map — ${data.nodes.length} nodes, ${resolveEdges(data).length} edges.*\n`,
  ];
  const visited = new Set<string>();

  function renderTree(node: MindMapNode, depth: number): void {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    const prefix = depth === 0 ? "# " : depth === 1 ? "## " : "  ".repeat(depth - 1) + "- ";
    let line = `${prefix}${node.label}`;
    if (node.type && node.type !== "root") line += ` *(type: ${node.type})*`;
    lines.push(line);
    if (node.description) {
      lines.push(`${"  ".repeat(depth)}> ${node.description}`);
    }
    const children = data.nodes.filter((n) => n.parentId === node.id);
    for (const child of children) renderTree(child, depth + 1);
  }

  for (const root of roots) renderTree(root, 0);
  lines.push("\n---");
  lines.push("*Generated by LearnX AI.*");
  return lines.join("\n");
}

/** Trigger download của một Blob ở client. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Trigger download của text string ở client. */
export function downloadText(text: string, filename: string, mimeType: string): void {
  const blob = new Blob([text], { type: mimeType });
  downloadBlob(blob, filename);
}