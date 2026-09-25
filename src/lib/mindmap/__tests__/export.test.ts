import { describe, expect, it } from "vitest";
import {
  sanitizeFilename,
  generateMindMapSVG,
  generateMindMapMarkdown,
  toMindMapJsonExport,
} from "../export";
import { computeLayout, getEdgePath, NODE_DESC_MAX_LINES } from "../layout";
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

// Đúng cấu trúc mind map trong ảnh: 5 nhánh chính, nhánh "Chiến lược giải"
// có 4 bước con nằm sát nhau — đây là trường hợp hay vỡ nhất.
const ceva: MindMapData = {
  version: 1,
  nodes: [
    { id: "root", label: "Định lý Ceva và Menelaus", parentId: null, type: "root" },
    { id: "b1", label: "Song song", parentId: "root", type: "concept" },
    { id: "b2", label: "Thẳng hàng", parentId: "root", type: "concept" },
    { id: "b3", label: "Mẫu bài thường gặp", parentId: "root", type: "concept" },
    { id: "b4", label: "Kết hợp Ceva và Menelaus", parentId: "root", type: "concept" },
    { id: "b5", label: "Chiến lược giải", parentId: "root", type: "concept" },
    { id: "s1", label: "Bước 1: Xác định công thức", parentId: "b5", type: "detail" },
    { id: "s2", label: "Bước 2: Tìm tỉ số phụ trợ", parentId: "b5", type: "detail" },
    { id: "s3", label: "Bước 3: Thay vào công thức", parentId: "b5", type: "detail" },
    { id: "s4", label: "Bước 4: Kết luận", parentId: "b5", type: "detail" },
  ],
  edges: [],
};

function boxOf(node: { x: number; y: number; width: number; height: number }) {
  return {
    left: node.x - node.width / 2,
    right: node.x + node.width / 2,
    top: node.y,
    bottom: node.y + node.height,
  };
}

function overlappingPairs(nodes: ReturnType<typeof computeLayout>["nodes"], tolerance = 0.5) {
  const pairs: string[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = boxOf(nodes[i]);
      const b = boxOf(nodes[j]);
      const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (overlapX > tolerance && overlapY > tolerance) {
        pairs.push(`${nodes[i].id}/${nodes[j].id}`);
      }
    }
  }
  return pairs;
}

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
  it("keeps descendants on branch-specific radial tracks instead of forcing a single column", () => {
    const layout = computeLayout(sample.nodes);
    const root = layout.nodes.find((node) => node.id === "root")!;
    const branchNodes = layout.nodes.filter((node) => node.parentId === "root");
    const angles = branchNodes.map((node) => Math.atan2(node.y + node.height / 2 - (root.y + root.height / 2), node.x - root.x));
    expect(new Set(angles.map((angle) => angle.toFixed(2))).size).toBe(branchNodes.length);
    expect(layout.width).toBeGreaterThan(root.x);
    expect(layout.height).toBeGreaterThan(0);
  });

  it("keeps children of collapsed UI nodes because exports always contain the full graph", () => {
    const layout = computeLayout(sample.nodes);
    expect(layout.nodes.map((n) => n.id)).toContain("d1");
    expect(layout.edges.map((e) => `${e.source}->${e.target}`)).toContain("c1->d1");
  });

  it("lays out the Ceva/Menelaus map as a radial mind map, not one column", () => {
    const layout = computeLayout(ceva.nodes);
    const root = layout.nodes.find((node) => node.id === "root")!;
    const rootCenter = { x: root.x, y: root.y + root.height / 2 };
    const branches = layout.nodes.filter((node) => node.parentId === "root");

    // Nhánh chính phải nằm ở nhiều hướng khác nhau quanh root.
    const angles = branches.map((node) =>
      Math.atan2(node.y + node.height / 2 - rootCenter.y, node.x - rootCenter.x)
    );
    expect(new Set(angles.map((angle) => angle.toFixed(2))).size).toBe(branches.length);

    // Dùng bán kính lớn ở cả hai bên trái/phải, không dồn hết về một cột.
    const leftCount = branches.filter((node) => node.x < rootCenter.x).length;
    const rightCount = branches.filter((node) => node.x > rootCenter.x).length;
    expect(leftCount).toBeGreaterThan(0);
    expect(rightCount).toBeGreaterThan(0);
  });

  it("never overlaps nodes in the Ceva/Menelaus map, including the four step nodes", () => {
    const layout = computeLayout(ceva.nodes);
    expect(overlappingPairs(layout.nodes)).toEqual([]);
  });

  it("keeps the four step nodes of one branch inside that branch's own region", () => {
    const layout = computeLayout(ceva.nodes);
    const root = layout.nodes.find((node) => node.id === "root")!;
    const parent = layout.nodes.find((node) => node.id === "b5")!;
    const steps = layout.nodes.filter((node) => node.parentId === "b5");
    expect(steps).toHaveLength(4);

    const distance = (node: typeof root) =>
      Math.hypot(node.x - root.x, node.y + node.height / 2 - (root.y + root.height / 2));

    // Mỗi step phải nằm xa hơn branch cha theo bán kính (tức là mở rộng ra
    // ngoài), đồng thời không vượt quá bán kính của các node cùng tầng khác.
    const parentRadius = distance(parent);
    for (const step of steps) {
      expect(distance(step)).toBeGreaterThan(parentRadius);
    }

    // Và 4 step phải có khoảng cách thực trên ít nhất một trục, không chồng
    // lên nhau thành một cột sát nhau (radial nên chúng fan theo góc khác nhau).
    const sorted = [...steps].sort((a, b) => a.y - b.y);
    for (let i = 1; i < sorted.length; i += 1) {
      const previous = sorted[i - 1];
      const current = sorted[i];
      const gapX = Math.max(boxOf(previous).left - boxOf(current).right, boxOf(current).left - boxOf(previous).right);
      const gapY = current.y - (previous.y + previous.height);
      expect(Math.max(gapX, gapY)).toBeGreaterThan(0);
    }
  });

  it("keeps every node inside the reported bounding box so exports never crop", () => {
    const layout = computeLayout(ceva.nodes);
    for (const node of layout.nodes) {
      const box = boxOf(node);
      expect(box.left).toBeGreaterThanOrEqual(-1);
      expect(box.top).toBeGreaterThanOrEqual(-1);
      expect(box.right).toBeLessThanOrEqual(layout.width + 1);
      expect(box.bottom).toBeLessThanOrEqual(layout.height + 1);
    }
  });

  it("grows the canvas when a node label gets much longer", () => {
    const shortLayout = computeLayout([
      { id: "root", label: "Root", parentId: null },
      { id: "a", label: "A", parentId: "root" },
    ]);
    const longLayout = computeLayout([
      { id: "root", label: "Root", parentId: null },
      { id: "a", label: "A".repeat(220), parentId: "root" },
    ]);
    const longNode = longLayout.nodes.find((node) => node.id === "a")!;
    const shortNode = shortLayout.nodes.find((node) => node.id === "a")!;
    expect(longNode.width).toBeGreaterThan(shortNode.width);
    expect(longNode.height).toBeGreaterThan(shortNode.height);
    expect(overlappingPairs(longLayout.nodes)).toEqual([]);
  });

  it("uses DOM-measured node sizes when they are provided, so real wrapping wins over estimation", () => {
    const nodes = [
      { id: "root", label: "Root", parentId: null },
      { id: "a", label: "Một nhãn rất dài để ép trình duyệt wrap thành nhiều dòng", parentId: "root" },
    ];

    // Không đo: dùng ước lượng (export chạy ngoài DOM).
    const estimated = computeLayout(nodes);
    const estimatedA = estimated.nodes.find((node) => node.id === "a")!;

    // Có đo: số đo thật của DOM phải được dùng, kể cả khi nhỏ hơn ước lượng.
    const measured = computeLayout(nodes, {
      measuredHeights: { a: 96, root: 60 },
      measuredWidths: { a: 200, root: 220 },
    });
    const measuredA = measured.nodes.find((node) => node.id === "a")!;

    expect(measuredA.height).toBe(96);
    expect(measuredA.width).toBe(200);
    expect(measuredA.height).not.toBe(estimatedA.height);
    expect(overlappingPairs(measured.nodes)).toEqual([]);
  });

  it("ignores invalid or zero measurements and falls back to the estimate", () => {
    const nodes = [
      { id: "root", label: "Root", parentId: null },
      { id: "a", label: "A".repeat(80), parentId: "root" },
    ];
    const baseline = computeLayout(nodes);
    const baselineA = baseline.nodes.find((node) => node.id === "a")!;

    const withBadMeasurements = computeLayout(nodes, {
      measuredHeights: { a: 0, root: Number.NaN },
      measuredWidths: { a: -50 },
    });
    const badA = withBadMeasurements.nodes.find((node) => node.id === "a")!;

    expect(badA.height).toBe(baselineA.height);
    expect(badA.width).toBe(baselineA.width);
  });

  it("re-lays out cleanly after adding and removing nodes", () => {
    const withExtra = computeLayout([
      ...ceva.nodes,
      { id: "s5", label: "Bước 5: Kiểm tra đáp án", parentId: "b5", type: "detail" },
    ]);
    expect(overlappingPairs(withExtra.nodes)).toEqual([]);

    const afterDelete = computeLayout(ceva.nodes.filter((node) => node.id !== "s2"));
    expect(afterDelete.nodes.map((node) => node.id)).not.toContain("s2");
    expect(overlappingPairs(afterDelete.nodes)).toEqual([]);
  });

  it("keeps edge endpoints on the node border instead of the node centre", () => {
    const layout = computeLayout(ceva.nodes);
    const root = layout.nodes.find((node) => node.id === "root")!;
    const branch = layout.nodes.find((node) => node.id === "b1")!;
    const path = getEdgePath(root, branch);

    // Path dạng: "M x0,y0 C c1x,c1y c2x,c2y x1,y1" -> lấy 4 cặp số đầu-cuối.
    const numbers = (path.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    expect(numbers).toHaveLength(8);
    const start = { x: numbers[0], y: numbers[1] };
    const end = { x: numbers[6], y: numbers[7] };

    const onBorder = (point: { x: number; y: number }, node: typeof root) => {
      const box = boxOf(node);
      const epsilon = 0.01;
      return (
        (Math.abs(point.x - box.left) < epsilon || Math.abs(point.x - box.right) < epsilon) ||
        (Math.abs(point.y - box.top) < epsilon || Math.abs(point.y - box.bottom) < epsilon)
      );
    };

    // Điểm bắt đầu/kết thúc phải nằm trên viền node chứ không phải tâm node.
    expect(onBorder(start, root)).toBe(true);
    expect(onBorder(end, branch)).toBe(true);
    expect(start).not.toEqual({ x: root.x, y: root.y + root.height / 2 });
  });

  it("does not overlap any measured node after radial relaxation", () => {
    const layout = computeLayout(sample.nodes);
    for (let i = 0; i < layout.nodes.length; i += 1) {
      for (let j = i + 1; j < layout.nodes.length; j += 1) {
        const a = layout.nodes[i];
        const b = layout.nodes[j];
        const horizontalGap = Math.abs(a.x - b.x) - (a.width + b.width) / 2;
        const verticalGap = Math.abs(a.y - b.y) - (a.height + b.height) / 2;
        expect(horizontalGap > 0 || verticalGap > 0).toBe(true);
      }
    }
  });

  it("keeps the Ceva/Menelaus example grouped into readable branches", () => {
    const nodes: MindMapData["nodes"] = [
      { id: "root", label: "Định lý Ceva và Menelaus", parentId: null, type: "root" },
      { id: "parallel", label: "Song song", parentId: "root" },
      { id: "collinear", label: "Thẳng hàng", parentId: "root" },
      { id: "template", label: "Mẫu bài thường gặp", parentId: "root" },
      { id: "combined", label: "Kết hợp Ceva và Menelaus", parentId: "root" },
      { id: "strategy", label: "Chiến lược giải", parentId: "root" },
      { id: "step1", label: "Bước 1: Xác định công thức", parentId: "strategy" },
      { id: "step2", label: "Bước 2: Tìm tỉ số phụ trợ", parentId: "strategy" },
      { id: "step3", label: "Bước 3: Thay vào công thức", parentId: "strategy" },
      { id: "step4", label: "Bước 4: Kết luận", parentId: "strategy" },
    ];
    const layout = computeLayout(nodes);
    expect(layout.nodes).toHaveLength(nodes.length);
    expect(layout.edges).toHaveLength(9);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
    for (const edge of layout.edges) {
      const source = layout.nodes.find((node) => node.id === edge.source)!;
      const target = layout.nodes.find((node) => node.id === edge.target)!;
      expect(getEdgePath(source, target)).toMatch(/^M[-.0-9]+,[-.0-9]+ C/);
    }
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

  // Lỗi cũ: mô tả được vẽ 1 dòng, cắt ở 120 ký tự, KHÔNG xuống dòng nên chữ
  // dài tràn ra ngoài rect của node — nhìn như text "bay" bên cạnh node. Test
  // này khoá lại: mọi dòng chữ phải nằm trong chiều cao card và mô tả dài phải
  // được cắt gọn trong NODE_DESC_MAX_LINES dòng (có dấu "…" báo còn nội dung).
  it("vẽ mô tả node nằm gọn trong card và xuống dòng thay vì tràn ra ngoài", () => {
    const description =
      "Đoạn tỉ lệ khi đường song song cắt hai cạnh của tam giác và tạo ra các tỉ số bằng nhau cần chứng minh trong bài toán, sau đó áp dụng vào tam giác đồng dạng để suy ra điều phải chứng minh.";
    const nodes = [
      { id: "r", label: "Định lý Ceva", parentId: null, type: "root", description },
      { id: "c1", label: "Nhánh con", parentId: "r", type: "concept", description },
      { id: "c2", label: "Nhánh thứ hai", parentId: "r", type: "concept" },
    ];

    const svg = generateMindMapSVG({ version: 1, nodes, edges: [] });
    const positioned = new Map(computeLayout(nodes).nodes.map((node) => [node.id, node]));

    for (const node of nodes) {
      const start = svg.indexOf(`data-node-id="${node.id}"`);
      expect(start).toBeGreaterThan(-1);
      const group = svg.slice(start, svg.indexOf("</g>", start));
      const baselines = [...group.matchAll(/<text x="[-\d.]+" y="([-\d.]+)"/g)].map((match) => Number(match[1]));
      const height = positioned.get(node.id)!.height;

      // Tiêu đề luôn có ít nhất 1 dòng; node có mô tả phải nhiều hơn thế.
      expect(baselines.length).toBeGreaterThanOrEqual(node.description ? 2 : 1);
      for (const baseline of baselines) {
        expect(baseline).toBeGreaterThan(0);
        expect(baseline).toBeLessThanOrEqual(height);
      }
    }

    // Mô tả dài hơn 3 dòng bị cắt và phải đánh dấu "…" cho người đọc.
    const rootStart = svg.indexOf('data-node-id="r"');
    const rootGroup = svg.slice(rootStart, svg.indexOf("</g>", rootStart));
    expect(rootGroup).toContain("…");
    expect(rootGroup.split("<text").length - 1).toBe(1 + NODE_DESC_MAX_LINES);
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
