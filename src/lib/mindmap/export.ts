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

import { type MindMapData, type MindMapNode, type MindMapEdge } from "./graph";
import { computeLayout, deriveEdges, NODE_TYPE_COLORS, escapeXml, EXPORT_BG, EXPORT_TEXT } from "./layout";

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

/** Tạo dữ liệu JSON đầy đủ để backup & restore. */
export function toMindMapJsonExport(data: MindMapData, title: string): string {
  const payload = {
    version: 1,
    title,
    nodes: data.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      parentId: n.parentId,
      type: n.type,
      description: n.description,
    })),
    edges: resolveEdges(data).map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
  return JSON.stringify(payload, null, 2);
}

/** Render một node thành SVG element (gọi bởi generateMindMapSVG). */
function renderNodeSVG(
  node: MindMapNode & { x: number; y: number; width: number; height: number },
  isRoot: boolean
): string {
  const color = NODE_TYPE_COLORS[node.type ?? ""] ?? "#94a0b8";
  const rx = isRoot ? 14 : 10;
  const w = node.width;
  const h = node.height;
  const bgColor = isRoot ? "#1b2233" : "#1a1f2d";

  // Word-wrap label
  const words = node.label.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const charsPerLine = Math.floor((w - 36) / 11);
  for (const word of words) {
    if ((line + " " + word).length > charsPerLine && line.length > 0) {
      lines.push(line);
      line = word;
    } else {
      line += (line ? " " : "") + word;
    }
  }
  if (line) lines.push(line);
  if (lines.length === 0) lines.push("");

  let svg = `<g transform="translate(${node.x - w / 2},${node.y})">`;
  svg += `<rect x="0" y="0" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="${bgColor}" stroke="${color}" stroke-width="1"/>`;
  svg += `<rect x="0" y="0" width="3" height="${h}" fill="${color}"/>`;

  if (node.type && node.type !== "root") {
    svg += `<rect x="${w - 46}" y="4" width="42" height="16" rx="3" ry="3" fill="${color}" opacity="0.2"/>`;
    svg += `<text x="${w - 25}" y="15" text-anchor="middle" font-size="10" fill="${color}" font-weight="600">${escapeXml(node.type)}</text>`;
  }

  lines.forEach((ln, i) => {
    svg += `<text x="${w / 2}" y="${28 + i * 18}" text-anchor="middle" font-size="13" fill="${EXPORT_TEXT}" font-weight="${isRoot ? "700" : "500"}">${escapeXml(ln)}</text>`;
  });

    svg += `</g>`;
  return svg;
}

/**
 * Sinh SVG string cho TOÀN BỘ graph — không chỉ viewport.
 * Bounding box được tính từ computeLayout() để bao phủ mọi node.
 */
export function generateMindMapSVG(
  data: MindMapData,
  options?: { collapsed?: Set<string>; title?: string }
): string {
  const { collapsed = new Set<string>() } = options || {};
  const title = options?.title ?? "Mind Map";

  const allNodes = data.nodes;
  const layout = computeLayout(allNodes, collapsed);
  const { nodes: positioned, edges, width, height } = layout;

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
    const sx = source.x;
    const sy = source.y + source.height / 2;
    const tx = target.x;
    const ty = target.y + target.height / 2;
    const midX = (sx + tx) / 2;
    svg += `<path d="M${sx},${sy} C${midX},${sy} ${midX},${ty} ${tx},${ty}" stroke="rgba(201,211,255,0.2)" stroke-width="1.5" fill="none"/>`;
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