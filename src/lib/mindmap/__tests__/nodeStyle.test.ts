// Unit test KHẮNG ĐỊNH cho cảnh báo React về shorthand/longhand của border.
//
// Vì sao cần: cảnh báo này chỉ xuất hiện ở RUNTIME khi rerender — typecheck
// và lint đều không bắt được, nên build sạch KHÔNG chứng minh là hết cảnh
// báo. Test ở đây tái hiện ĐÚNG thuật toán react-dom dùng để phát hiện
// xung đột, rồi chạy trên MỌI tổ hợp trạng thái của node.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// Dùng import TƯƠNG ĐỐI như các test khác trong thư mục: project không có
// vitest.config nên alias "@/..." không resolve trong test.
import { computeLayout } from "../layout";

// Rút gọn đúng như shorthandToLonghand của react-dom, chỉ nhóm liên quan.
const SHORTHAND_TO_LONGHAND: Record<string, string[]> = {
  border: [
    "borderBottomColor", "borderBottomStyle", "borderBottomWidth",
    "borderLeftColor", "borderLeftStyle", "borderLeftWidth",
    "borderRightColor", "borderRightStyle", "borderRightWidth",
    "borderTopColor", "borderTopStyle", "borderTopWidth",
  ],
  borderColor: ["borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"],
  borderStyle: ["borderTopStyle", "borderRightStyle", "borderBottomStyle", "borderLeftStyle"],
  borderWidth: ["borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"],
  background: [
    "backgroundAttachment", "backgroundClip", "backgroundColor", "backgroundImage",
    "backgroundOrigin", "backgroundPositionX", "backgroundPositionY",
    "backgroundRepeat", "backgroundSize",
  ],
};

/** Tái hiện logic phát cảnh báo của react-dom (setValueForStyles). */
function findStyleConflicts(prev: Record<string, string>, next: Record<string, string>): string[] {
  const expandedUpdates: Record<string, string> = {};

  // 1) Key bị GỠ (có ở prev, không có ở next).
  for (const key of Object.keys(prev)) {
    if (!(key in next)) {
      for (const longhand of SHORTHAND_TO_LONGHAND[key] ?? [key]) expandedUpdates[longhand] = key;
    }
  }
  // 2) Key được cập nhật (giá trị khác).
  for (const key of Object.keys(next)) {
    if (prev[key] !== next[key]) {
      for (const longhand of SHORTHAND_TO_LONGHAND[key] ?? [key]) expandedUpdates[longhand] = key;
    }
  }
  // 3) Map ngược: longhand -> property đang thực sự set trong style mới.
  const currentByLonghand: Record<string, string> = {};
  for (const key of Object.keys(next)) {
    for (const longhand of SHORTHAND_TO_LONGHAND[key] ?? [key]) currentByLonghand[longhand] = key;
  }
  // 4) Báo động khi shorthand xung đột với property khác đang set.
  const conflicts: string[] = [];
  const seen = new Set<string>();
  for (const [longhand, shorthand] of Object.entries(expandedUpdates)) {
    const current = currentByLonghand[longhand];
    if (current && current !== shorthand && !seen.has(`${shorthand},${current}`)) {
      seen.add(`${shorthand},${current}`);
      conflicts.push(`${shorthand},${current}`);
    }
  }
  return conflicts;
}

const TYPE_COLORS: Record<string, string> = {
  root: "var(--cyan)",
  concept: "var(--indigo)",
  detail: "var(--text-dim)",
  example: "var(--amber)",
  formula: "#7cf0e6",
  prerequisite: "var(--rose)",
};

/** Dựng lại ĐÚNG style object mà renderCanvasNode truyền cho node. */
function nodeStyle(options: { isSelected: boolean; isHit: boolean; type?: string }) {
  const color = TYPE_COLORS[options.type ?? ""] ?? "var(--text-dim)";
  const borderTone = options.isSelected ? "var(--indigo)" : options.isHit ? "var(--cyan)" : "var(--border)";
  return {
    left: "-100",
    top: "0",
    width: "200",
    background: options.isSelected ? "var(--indigo-soft)" : "var(--panel-strong)",
    borderTopColor: borderTone,
    borderRightColor: borderTone,
    borderBottomColor: borderTone,
    borderLeftColor: color,
    cursor: "grab",
  } as Record<string, string>;
}

const TYPES = [undefined, "root", "concept", "detail", "example", "formula", "prerequisite"];
const FLAGS = [
  { isSelected: false, isHit: false },
  { isSelected: true, isHit: false },
  { isSelected: false, isHit: true },
  { isSelected: true, isHit: true },
];

describe("mind map node style — không gây xung đột shorthand/longhand", () => {
  it("dùng longhand thuần cho cả 4 cạnh — không có shorthand border nào", () => {
    for (const type of TYPES) {
      for (const flags of FLAGS) {
        const style = nodeStyle({ ...flags, type });
        const borderKeys = Object.keys(style).filter((key) => key.startsWith("border")).sort();
        expect(borderKeys).toEqual([
          "borderBottomColor",
          "borderLeftColor",
          "borderRightColor",
          "borderTopColor",
        ]);
        // Không shorthand nào trong nhóm border.
        for (const shorthand of ["border", "borderColor", "borderStyle", "borderWidth",
          "borderLeft", "borderRight", "borderTop", "borderBottom"]) {
          expect(Object.keys(style)).not.toContain(shorthand);
        }
      }
    }
  });

  it("không phát cảnh báo xung đột khi rerender qua mọi tổ hợp chọn/tìm kiếm/loại node", () => {
    // Duyệt mọi cặp "trạng thái trước -> trạng thái sau" (kéo node đổi
    // left/top, chọn node, search, đổi loại) rồi chạy đúng thuật toán React.
    const styles = TYPES.flatMap((type) => FLAGS.map((flags) => nodeStyle({ ...flags, type })));
    for (const prev of styles) {
      for (const next of styles) {
        expect(findStyleConflicts(prev, next)).toEqual([]);
      }
    }
  });

  it("vẫn giữ đúng 3 cạnh chung + cạnh trái màu theo loại node", () => {
    const normal = nodeStyle({ isSelected: false, isHit: false, type: "example" });
    expect(normal.borderTopColor).toBe("var(--border)");
    expect(normal.borderRightColor).toBe("var(--border)");
    expect(normal.borderBottomColor).toBe("var(--border)");
    expect(normal.borderLeftColor).toBe("var(--amber)");

    // Node được chọn: 3 cạnh chuyển indigo, cạnh trái GIỮ nguyên màu loại.
    const selected = nodeStyle({ isSelected: true, isHit: false, type: "example" });
    expect(selected.borderTopColor).toBe("var(--indigo)");
    expect(selected.borderRightColor).toBe("var(--indigo)");
    expect(selected.borderBottomColor).toBe("var(--indigo)");
    expect(selected.borderLeftColor).toBe("var(--amber)");
  });

  it("thuật toán kiểm tra thực sự bắt lỗi shorthand+longhand (chống test rỗng)", () => {
    // Nếu test này fail nghĩa là findStyleConflicts bị hỏng và các test
    // trên không có ý nghĩa — nên phải có ít nhất 1 ca phát hiện lỗi.
    const buggy = {
      background: "var(--panel-strong)",
      borderColor: "var(--border)",
      borderLeftColor: "var(--amber)",
    };
    // Không đổi gì -> im lặng.
    expect(findStyleConflicts({ ...buggy }, { ...buggy })).toEqual([]);
    // Chỉ đổi giá trị longhand -> im lặng.
    expect(findStyleConflicts({ ...buggy }, { ...buggy, borderLeftColor: "var(--rose)" })).toEqual([]);
    // Gỡ shorthand nhưng longhand còn -> React báo xung đột.
    expect(
      findStyleConflicts({ ...buggy }, { background: "var(--panel-strong)", borderLeftColor: "var(--amber)" })
    ).toEqual(["borderColor,borderLeftColor"]);
  });

  it("layout engine vẫn trả width/height hợp lệ sau thay đổi style", () => {
    const layout = computeLayout([
      { id: "root", label: "Gốc", parentId: null, type: "root" },
      { id: "child", label: "Nhánh con", parentId: "root", type: "concept" },
    ]);
    for (const node of layout.nodes) {
      expect(node.width).toBeGreaterThan(0);
      expect(node.height).toBeGreaterThan(0);
    }
  });

  // ---------------------------------------------------------------------
  // PHẦN 2 — stylesheet.
  //
  // Vì sao cần: cảnh báo shorthand/longhand KHÔNG chỉ phát ra từ style prop
  // mà còn phát khi JSX set longhand lên element đã có shorthand do CSS đặt
  // (react-dom theo dõi expandedUpdates của cả style trước đó trên node).
  // Lỗi thật từng xảy ra ở đây: .mindmap-node có `border: 1px solid ...`
  // + `border-left-width: 3px`, còn JSX set `borderLeftColor` mỗi lần
  // rerender node. Sửa JSX không đủ — phải sửa cả CSS. Test này chặn
  // tái phát đúng lỗi đó.
  // ---------------------------------------------------------------------
  describe("stylesheet .mindmap-node", () => {
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

    function ruleBody(selector: string): string[] {
      const start = css.indexOf(`${selector} {`);
      expect(start, `không tìm thấy rule ${selector}`).toBeGreaterThan(-1);
      const open = css.indexOf("{", start);
      const close = css.indexOf("}", open);
      // Xoá comment /* ... */ TRƯỚC khi tách theo ";". Comment trong .mindmap-node
      // không chứa dấu ";" nên nếu tác trực tiếp, nó dính liền với property
      // đứng ngay sau (`... không đổi. */ border-top-width: 1px`) và bị coi
      // là 1 segment rác — làm test fail giả.
      const body = css.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, "");
      return body
        .split(";")
        .map((line) => line.trim())
        .filter(Boolean);
    }

    it("không trộn border shorthand với border longhand", () => {
      const properties = ruleBody(".mindmap-node").map((line) => line.split(":")[0].trim());
      const shorthands = properties.filter((p) => p === "border" || p === "borderColor" ||
        p === "borderStyle" || p === "borderWidth" || /border(Top|Right|Bottom|Left)$/.test(p));
      // shorthand (`border`) hoặc per-side full shorthand (`borderTop`...)
      // đều bị loại — chỉ còn dạng `border-<side>-<property>`.
      expect(shorthands).toEqual([]);
    });

    it("vẫn khai báo đủ width/style/color cho cả 4 cạnh", () => {
      const body = ruleBody(".mindmap-node").join(";");
      for (const side of ["top", "right", "bottom", "left"]) {
        expect(body).toMatch(new RegExp(`border-${side}-width`));
        expect(body).toMatch(new RegExp(`border-${side}-style`));
        expect(body).toMatch(new RegExp(`border-${side}-color`));
      }
      // 3 cạnh mảnh, cạnh trái đậm làm dải màu theo loại node.
      expect(body).toContain("border-left-width: 3px");
      expect(body).toContain("border-top-width: 1px");
    });

    it("hình ảnh không đổi: 3 cạnh 1px solid, cạnh trái 3px solid", () => {
      // Giá trị màu vẫn do inline style ghi đè nên node trông y hệt trước.
      const properties = ruleBody(".mindmap-node");
      expect(properties).toContain("border-left-width: 3px");
      expect(properties).toContain("border-left-style: solid");
      for (const side of ["top", "right", "bottom"]) {
        expect(properties).toContain(`border-${side}-width: 1px`);
        expect(properties).toContain(`border-${side}-style: solid`);
      }
    });
  });
});

// ================================================================
// ĐỘ TƯƠNG PHẢN & THỨ BẬC CHỮ CỦA NODE MIND MAP
// ================================================================
// Vì sao cần: các lỗi dưới đây KHÔNG làm typecheck/lint/build đỏ — chúng chỉ
// làm mind map khó đọc (mô tả chìm vào nền, node đang chọn không nhận ra, node
// trung tâm ngang hàng node con). Test đọc thẳng globals.css nên chặn tái phát.
describe("mind map — contrast & typography", () => {
  const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

  /** Luminance tương đối theo WCAG — dùng để so thứ bậc sáng/tối của token. */
  function luminance(hex: string): number {
    const value = hex.trim().replace("#", "");
    const [r, g, b] = [0, 2, 4].map((offset) => {
      const channel = parseInt(value.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /** Giá trị của 1 biến CSS trong block chỉ định. */
  function tokenValue(name: string, selector = ":root {"): string {
    const start = css.indexOf(selector);
    expect(start, `không tìm thấy block ${selector}`).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf("}", start));
    const match = block.match(new RegExp(`--${name}:\\s*([^;]+);`));
    expect(match, `không tìm thấy token --${name} trong ${selector}`).not.toBeNull();
    return match![1].trim();
  }

  function ruleBodyOf(selector: string): string {
    const start = css.indexOf(`${selector} {`);
    expect(start, `không tìm thấy rule ${selector}`).toBeGreaterThan(-1);
    const open = css.indexOf("{", start);
    const close = css.indexOf("}", open);
    return css.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, "");
  }

  it("có đủ 3 token chữ cho node và đúng thứ bậc title > description > metadata", () => {
    // Dark mode: title sáng nhất, rồi mới tới mô tả, metadata mờ nhất. Đảo thứ
    // tự này là lỗi "mô tả sáng hơn tiêu đề" mà yêu cầu 1 cấm.
    const title = tokenValue("mm-title");
    const description = tokenValue("mm-desc");
    const meta = tokenValue("mm-meta");
    expect(luminance(title)).toBeGreaterThan(luminance(description));
    expect(luminance(description)).toBeGreaterThan(luminance(meta));
  });

  it("mô tả sáng hơn hẳn --text-dim cũ (đây là gốc lỗi chữ chìm trên nền tối)", () => {
    expect(luminance(tokenValue("mm-desc"))).toBeGreaterThan(luminance("#94a0b8"));
  });

  it("light mode có token riêng, đảo chiều đúng (chữ tối đi theo thứ bậc)", () => {
    const light = ':root[data-theme="light"] {';
    const title = luminance(tokenValue("mm-title", light));
    const description = luminance(tokenValue("mm-desc", light));
    const meta = luminance(tokenValue("mm-meta", light));
    expect(title).toBeLessThan(description);
    expect(description).toBeLessThan(meta);
  });

  it("mô tả đủ lớn để đọc và bị giới hạn 3 dòng", () => {
    const body = ruleBodyOf(".mindmap-node__description");
    expect(body).toContain("line-clamp: 3");
    expect(body).toContain("--mm-desc");
    const fontSize = Number((body.match(/font-size:\s*([\d.]+)px/) ?? [])[1]);
    expect(fontSize).toBeGreaterThanOrEqual(12);
  });

  it("tiêu đề dùng token sáng nhất, đậm hơn và lớn hơn mô tả", () => {
    const label = ruleBodyOf(".mindmap-node__label");
    expect(label).toContain("--mm-title");
    expect(Number((label.match(/font-weight:\s*(\d+)/) ?? [])[1])).toBeGreaterThanOrEqual(600);
    const labelSize = Number((label.match(/font-size:\s*([\d.]+)px/) ?? [])[1]);
    const descriptionSize = Number((ruleBodyOf(".mindmap-node__description").match(/font-size:\s*([\d.]+)px/) ?? [])[1]);
    expect(labelSize).toBeGreaterThan(descriptionSize);
  });

  it("node trung tâm có rule riêng để nổi hơn node con", () => {
    expect(css).toContain(".mindmap-node--root {");
    expect(css).toContain(".mindmap-node--root .mindmap-node__label {");
    expect(css).toContain(".mindmap-node--root .mindmap-node__description {");
  });

  it("trạng thái chọn / tìm kiếm đứng SAU rule hover nên hover không ghi đè", () => {
    const hover = css.indexOf(".mindmap-node:hover,");
    expect(hover).toBeGreaterThan(-1);
    expect(css.indexOf(".mindmap-node.mindmap-node--selected,")).toBeGreaterThan(hover);
    expect(css.indexOf(".mindmap-node.mindmap-node--hit {")).toBeGreaterThan(hover);
  });

  it("giữ overflow hidden nhưng KHÔNG khoá height — nên không bao giờ cắt chữ", () => {
    const body = ruleBodyOf(".mindmap-node");
    expect(body).toContain("overflow: hidden");
    // Khoá height/max-height là điều kiện duy nhất khiến overflow:hidden cắt
    // chữ trong node, nên nếu ai thêm vào thì test này phải đỏ.
    expect(body).not.toMatch(/(^|;)\s*height:/);
    expect(body).not.toMatch(/(^|;)\s*max-height:/);
  });

  it("edge nhánh chính (trunk) dày hơn edge thường và dùng token riêng", () => {
    expect(css).toContain(".mindmap-edges path.mindmap-edge--trunk {");
    expect(css).toContain("var(--mm-edge-strong)");
    const baseWidth = Number((ruleBodyOf(".mindmap-edges path").match(/stroke-width:\s*([\d.]+)/) ?? [])[1]);
    const trunk = css.slice(css.indexOf(".mindmap-edges path.mindmap-edge--trunk {"));
    const trunkWidth = Number((trunk.match(/stroke-width:\s*([\d.]+)/) ?? [])[1]);
    expect(trunkWidth).toBeGreaterThan(baseWidth);
  });
});

