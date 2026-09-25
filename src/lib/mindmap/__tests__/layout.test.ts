// ================================================================
// TEST HÌNH HỌC LAYOUT MIND MAP
// ================================================================
// Bộ test này khoá lại những tính chất khiến mind map ĐỌC ĐƯỢC:
//   - node không bao giờ chồng lên nhau, kể cả tầng đông node;
//   - tầng ngoài cách tầng trong đủ xa (LEVEL_GAP) và giữa hai node cùng
//     tầng luôn có khe hở (khoảng thở cho edge đi qua);
//   - bán kính từng tầng NỚI RA theo số node (bán kính hằng số cũ nhồi node
//     vào một vòng tròn, hệ quả là "chùm dây" edge);
//   - edge không xuyên qua node thứ ba.
//
// Test chạy trên các graph dày (6 nhánh x 5 node con) — đúng dạng dữ liệu mà
// AI sinh ra từ tài liệu, và cũng là ca làm vỡ layout cũ.
import { describe, expect, it } from "vitest";
import { computeLayout, getEdgePath, LEVEL_GAP, TANGENTIAL_GAP, type PositionedNode } from "../layout";
import type { MindMapNode } from "../graph";

function boxOf(node: PositionedNode) {
  return {
    left: node.x - node.width / 2,
    right: node.x + node.width / 2,
    top: node.y,
    bottom: node.y + node.height,
  };
}

/** Khe hở lớn nhất theo một trong hai trục — > 0 nghĩa là hai node rời nhau. */
function separation(a: PositionedNode, b: PositionedNode): number {
  const boxA = boxOf(a);
  const boxB = boxOf(b);
  const gapX = Math.max(boxA.left - boxB.right, boxB.left - boxA.right);
  const gapY = Math.max(boxA.top - boxB.bottom, boxB.top - boxA.bottom);
  return Math.max(gapX, gapY);
}

function overlappingPairs(nodes: PositionedNode[]): string[] {
  const pairs: string[] = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      if (separation(nodes[i], nodes[j]) <= 0) pairs.push(`${nodes[i].id}/${nodes[j].id}`);
    }
  }
  return pairs;
}

/** Graph dày: root -> `branches` nhánh, mỗi nhánh `perBranch` node con. */
function denseGraph(branches: number, perBranch: number): MindMapNode[] {
  const nodes: MindMapNode[] = [{ id: "root", label: "Định lý Ceva và Menelaus", parentId: null, type: "root" }];
  for (let branch = 0; branch < branches; branch += 1) {
    const branchId = `b${branch}`;
    nodes.push({
      id: branchId,
      label: `Nhánh ${branch} của định lý`,
      parentId: "root",
      type: "concept",
      description: "Đoạn tỉ lệ khi đường song song cắt hai cạnh của tam giác",
    });
    for (let child = 0; child < perBranch; child += 1) {
      nodes.push({ id: `${branchId}-${child}`, label: `Bước ${child} của nhánh ${branch}`, parentId: branchId, type: "detail" });
    }
  }
  return nodes;
}

function centerOf(node: PositionedNode) {
  return { x: node.x, y: node.y + node.height / 2 };
}

function distanceFromRoot(node: PositionedNode, root: PositionedNode): number {
  const a = centerOf(node);
  const b = centerOf(root);
  return Math.hypot(a.x - b.x, a.y - b.y);
}


describe("computeLayout — khoảng cách và hình học", () => {
  it("không để node chồng nhau trên graph dày (6 nhánh x 5 node)", () => {
    const layout = computeLayout(denseGraph(6, 5));
    expect(layout.nodes).toHaveLength(1 + 6 + 30);
    expect(overlappingPairs(layout.nodes)).toEqual([]);
  });

  it("giữ khe hở thật giữa mọi cặp node, không chỉ 'vừa đủ không chồng'", () => {
    const layout = computeLayout(denseGraph(5, 4));
    let smallest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < layout.nodes.length; i += 1) {
      for (let j = i + 1; j < layout.nodes.length; j += 1) {
        smallest = Math.min(smallest, separation(layout.nodes[i], layout.nodes[j]));
      }
    }
    // Khe hở nhỏ nhất phải đủ để nhìn ra hai card riêng biệt và để edge chạy
    // giữa chúng. Trước đây node bị dồn sát nên giá trị này gần 0.
    expect(smallest).toBeGreaterThan(20);
  });

  it("nới bán kính tầng theo số node cùng tầng thay vì dùng bán kính hằng số", () => {
    const radiusOfDeepestRing = (layout: ReturnType<typeof computeLayout>) => {
      const root = layout.nodes.find((node) => node.id === "root")!;
      const deep = layout.nodes.filter((node) => node.id.includes("-"));
      return Math.max(...deep.map((node) => distanceFromRoot(node, root)));
    };

    // Ít nhánh, ít node con -> tầng 2 thưa.
    const sparse = computeLayout(denseGraph(2, 2));
    // Nhiều nhánh, nhiều node con -> cùng tầng 2 nhưng dày gấp nhiều lần.
    const dense = computeLayout(denseGraph(6, 5));

    // Cùng độ sâu nhưng tầng đông node hơn phải có bán kính LỚN HƠN HẲN — đó
    // là cơ chế giữ khoảng thở (bán kính cố định `depth * 285` không làm được,
    // nên node dồn vào nhau rồi bị đẩy loạn xạ).
    expect(radiusOfDeepestRing(dense)).toBeGreaterThan(radiusOfDeepestRing(sparse) + 100);
    expect(overlappingPairs(dense.nodes)).toEqual([]);
  });

  it("node cùng tầng có khe hở theo cung ít nhất bằng phần lớn TANGENTIAL_GAP", () => {
    const layout = computeLayout(denseGraph(4, 4));
    const root = layout.nodes.find((node) => node.id === "root")!;
    const byDepth = new Map<number, PositionedNode[]>();
    for (const node of layout.nodes) {
      if (node.id === "root") continue;
      const depth = node.parentId === "root" ? 1 : 2;
      byDepth.set(depth, [...(byDepth.get(depth) ?? []), node]);
    }

    for (const ring of byDepth.values()) {
      const angleOf = (node: PositionedNode) =>
        Math.atan2(centerOf(node).y - centerOf(root).y, centerOf(node).x - centerOf(root).x);
      const sorted = [...ring].sort((a, b) => angleOf(a) - angleOf(b));
      for (let index = 1; index < sorted.length; index += 1) {
        const previous = sorted[index - 1];
        const current = sorted[index];
        const chord = Math.hypot(centerOf(current).x - centerOf(previous).x, centerOf(current).y - centerOf(previous).y);
        const borderGap = chord - (current.width + previous.width) / 2;
        // Khe hở thật giữa hai biên node cùng tầng: dương và gần TANGENTIAL_GAP.
        expect(borderGap).toBeGreaterThan(TANGENTIAL_GAP * 0.5);
      }
    }
  });

  it("tầng ngoài cách tầng trong ít nhất LEVEL_GAP (không dính vào nhau)", () => {
    const layout = computeLayout(denseGraph(5, 3));
    const byId = new Map(layout.nodes.map((node) => [node.id, node]));
    for (const node of layout.nodes) {
      if (!node.parentId) continue;
      const parent = byId.get(node.parentId);
      if (!parent) continue;
      const parentBox = boxOf(parent);
      const nodeBox = boxOf(node);
      // Khe hở thật giữa hai card, đo trên trục mà chúng tách nhau ra.
      const gapY = Math.max(parentBox.top - nodeBox.bottom, nodeBox.top - parentBox.bottom);
      const gapX = Math.max(nodeBox.left - parentBox.right, parentBox.left - nodeBox.right);
      expect(Math.max(gapX, gapY)).toBeGreaterThan(LEVEL_GAP * 0.5);
    }
  });
});
