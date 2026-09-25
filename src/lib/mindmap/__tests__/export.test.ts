import { describe, expect, it } from "vitest";
import {
  sanitizeFilename,
  generateMindMapSVG,
  generateMindMapMarkdown,
  toMindMapJsonExport,
} from "../export";
import { computeLayout } from "../layout";
import type { MindMapData } from "../graph";
import { parseMindMapData } from "../graph";

const sample: MindMapData = {
  version: 1,
  nodes: [
    { id: "root", label: "Đạo hàm & Ứng dụng", parentId: null, type: "root" },
    { id: "c1", label: "Định nghĩa đạo hàm", parentId: "root", type: "concept" },
    { id: "c2", label: "Quy tắc chuỗi", parentId: "root", type: "concept" },
    { id: "d1", label: "Ví dụ: f(x) = x^2", parentId: "c1", type: "example" },
    { id: "d2", label: "Cực trị hàm số", parentId: "c2", type: "detail", description: "Ứng dụng trong bài toán thực tế" },
  ],
  edges: [],
};

describe("sanitizeFilename", () => {
  it("replaces characters that are illegal in file names so the download never fails", () => {
    expect(sanitizeFilename('Mind map: "Ôn thi"/2026*?', "png")).toBe("Mind map_ _Ôn thi_2026.png");
  });

  it("keeps Vietnamese diacritics instead of mangling them into underscores", () => {
    expect(sanitizeFilename("Đạo hàm & ứng dụng", "svg")).toBe("Đạo hàm _ ứng dụng.svg");
  });

  it("falls back to a stable base name when the title has no usable characters", () => {
    expect(sanitizeFilename("///", "json")).toBe("mindmap.json");
  });
});

describe("computeLayout", () => {
  it("positions every node including the ones far outside any viewport", () => {
    const layout = computeLayout(sample.nodes);
    expect(layout.nodes).toHaveLength(sample.nodes.length);
    const rootX = layout.nodes.find((n) => n.id === "root")!.x;
    const deepest = layout.nodes.find((n) => n.id === "d1")!;
    expect(deepest.x).toBeGreaterThan(rootX);
    expect(layout.width).toBeGreaterThanOrEqual(deepest.x);
    expect(layout.height).toBeGreaterThan(0);
  });

  it("keeps children of collapsed UI nodes because exports always contain the full graph", () => {
    const layout = computeLayout(sample.nodes);
    expect(layout.nodes.map((n) => n.id)).toContain("d1");
    expect(layout.edges.map((e) => `${e.source}->${e.target}`)).toContain("c1->d1");
  });
});

describe("generateMindMapSVG", () => {
  it("renders the whole graph (all nodes + all edges) instead of the current viewport", () => {
    const svg = generateMindMapSVG(sample, { title: "Ôn tập" });
    for (const node of sample.nodes) {
      expect(svg).toContain(node.label.slice(0, 8));
    }
    // 4 cạnh nối (d1->c1, c2->root, ...) đều phải xuất hiện dưới dạng path.
    expect(svg.match(/<path /g)?.length).toBe(4);
    expect(svg.startsWith("<?xml")).toBe(true);
  });

  it("escapes XML so a label containing markup cannot break the file", () => {
    const svg = generateMindMapSVG({
      version: 1,
      nodes: [{ id: "r", label: "<script>alert(1)</script>", parentId: null }],
      edges: [],
    });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("preserves MathML for formulas and keeps a readable raw-text fallback", () => {
    const svg = generateMindMapSVG({
      version: 1,
      nodes: [{ id: "formula", label: "Đạo hàm: $f'(x)=\\alpha x^2$", parentId: null, type: "formula" }],
      edges: [],
    });
    expect(svg).toContain("<math");
    expect(svg).toContain("data-latex=");
    expect(svg).toContain("Đạo hàm:");
  });

  it("renders explicit edges even when they are not represented by parentId", () => {
    const svg = generateMindMapSVG({
      version: 1,
      nodes: [
        { id: "a", label: "A", parentId: null },
        { id: "b", label: "B", parentId: null },
      ],
      edges: [{ id: "a-b", source: "a", target: "b" }],
    });
    expect(svg.match(/<path /g)?.length).toBe(1);
  });
});

describe("generateMindMapMarkdown", () => {
  it("produces a nested outline with every node label", () => {
    const md = generateMindMapMarkdown(sample, "Đạo hàm");
    expect(md).toContain("# Đạo hàm");
    expect(md).toContain("## Định nghĩa đạo hàm");
    expect(md).toContain("Ví dụ: f(x) = x^2");
    expect(md).toContain("Ứng dụng trong bài toán thực tế");
  });
});

describe("toMindMapJsonExport", () => {
  it("keeps everything needed to rebuild the map later (nodes, parents, types, edges)", () => {
    const parsed = JSON.parse(toMindMapJsonExport(sample, "Đạo hàm")) as {
      version: number;
      data: { nodes: unknown[]; edges: unknown[] };
      nodes: { id: string; parentId: string | null }[];
      edges: { source: string; target: string }[];
      layout: { nodes: unknown[]; edges: unknown[] };
    };
    expect(parsed.version).toBe(1);
    expect(parsed.nodes).toHaveLength(5);
    expect(parsed.nodes.find((n) => n.id === "d1")?.parentId).toBe("c1");
    expect(parsed.edges).toHaveLength(4);
    expect(parsed.data.nodes).toHaveLength(5);
    expect(parsed.layout.nodes).toHaveLength(5);
    expect(parseMindMapData(parsed)).toEqual({
      version: 1,
      nodes: parsed.nodes,
      edges: parsed.edges,
    });
  });
});
