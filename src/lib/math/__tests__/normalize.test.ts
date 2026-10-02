// Test cho lớp normalizer toán dùng chung (lib/math): chuẩn hoá lệnh,
// gộp escape thừa, và bọc fragment LaTeX TRẦN (AI hay quên delimiter).
// Chạy bằng `npm test` (vitest). Chỉ test hàm thuần túy + KaTeX thật
// (renderToString) nên nhanh, không cần DOM.
//
// Import tương đối vì vitest chưa cấu hình alias "@/" (xem vitest.config.ts).
import { describe, expect, it } from "vitest";
import { collapseDoubleBackslash, normalizeMathLatex, repairLatex, splitMathSegments } from "../segments";
import { renderMathHtml } from "../render";

const mathOf = (input: string) =>
  splitMathSegments(input).filter((s) => s.type === "math").map((s) => s.content);
const textOf = (input: string) =>
  splitMathSegments(input).filter((s) => s.type === "text").map((s) => s.content);

// KaTeX vẽ lỗi cú pháp bằng màu đỏ — đây là thứ user thấy trước đây.
const hasKatexError = (html: string) => html.includes("mathcolor=\"#cc0000\"") || html.includes("katex-error");

describe("case thật: đáp án AI viết \\;\\text{(m/s\\textsuperscript{2})}", () => {
  it("fragment TRẦN không còn hiện raw — được bọc thành math", () => {
    const segs = splitMathSegments("\\;\\text{(m/s\\textsuperscript{2})}");

    expect(segs).toHaveLength(1);
    expect(segs[0].type).toBe("math");
    // \textsuperscript -> ^{2}, \text{...} chứa toán -> \mathrm{...}
    expect(segs[0].content).toBe("\\;\\mathrm{(m/s^{2})}");
    // KHÔNG còn ký tự nào của dạng HTML/lỗi lọt xuống UI.
    expect(segs[0].content).not.toMatch(/textsuperscript|\\\\text/);
  });

  it("render KaTeX ra công thức thật, KHÔNG phải chữ đỏ lỗi", () => {
    const html = renderMathHtml(mathOf("\\;\\text{(m/s\\textsuperscript{2})}")[0], false);

    expect(hasKatexError(html)).toBe(false);
    // KaTeX tách từng ký tự vào span riêng nên không có chuỗi "m/s" liền:
    // kiểm tra đúng 2 dấu hiệu render — chữ đơn vị THẲNG (mathrm) và MŨ.
    expect(html).toContain("mord mathrm");
    expect(html).toContain("msupsub");
  });

  it("AI over-escape (\\\\\\\\) cũng được gộp về 1 dấu \\", () => {
    const segs = splitMathSegments("\\\\;\\\\text{(m/s\\\\textsuperscript{2})}");

    expect(segs).toHaveLength(1);
    expect(segs[0].type).toBe("math");
    expect(segs[0].content).not.toContain("\\\\");
    expect(hasKatexError(renderMathHtml(segs[0].content, false))).toBe(false);
  });
});

describe("BẢO VỆ công thức đang hoạt động (không được phá)", () => {
  it("nội dung DB thực tế \\(15\\ \\text{m/s}\\) render y hệt, không đổi", () => {
    const latex = mathOf("Khi vận tốc đạt \\(15\\ \\text{m/s}\\) nhé")[0];

    expect(latex).toBe("15\\ \\text{m/s}");
    expect(hasKatexError(renderMathHtml(latex, false))).toBe(false);
  });

  it("\\text{m/s} và \\text{m/s}^2 giữ nguyên (không bị đổi thành \\mathrm)", () => {
    expect(normalizeMathLatex("\\text{m/s}")).toBe("\\text{m/s}");
    expect(normalizeMathLatex("\\text{m/s}^2")).toBe("\\text{m/s}^2");
  });

  it("GIỮ \\ \\ ngắt dòng của matrix/cases trong $$...$$", () => {
    const latex = mathOf("$$\\begin{cases}a \\\\ b\\end{cases}$$")[0];

    expect(latex).toContain("\\\\");
    expect(hasKatexError(renderMathHtml(latex, true))).toBe(false);
  });

  it("tiền tệ và text thường không bị đụng", () => {
    expect(splitMathSegments("Giá 50$ nhé").every((s) => s.type === "text")).toBe(true);
    expect(splitMathSegments("Gia tốc là độ biến thiên vận tốc theo thời gian.")).toEqual([
      { type: "text", content: "Gia tốc là độ biến thiên vận tốc theo thời gian.", display: false },
    ]);
  });

  it("code span và đường dẫn file KHÔNG bị bọc nhầm thành công thức", () => {
    expect(splitMathSegments("`a \\frac{b}{c}`").every((s) => s.type === "text")).toBe(true);
    expect(splitMathSegments("Mở file C:\\Users\\test").every((s) => s.type === "text")).toBe(true);
  });
});

describe("danh sách case BẮT BUỘC hiển thị đẹp", () => {
  it("superscript unicode m/s² (text thuần) giữ nguyên", () => {
    expect(splitMathSegments("m/s²")).toEqual([{ type: "text", content: "m/s²", display: false }]);
  });

  it("inline math: $a = \\frac{v-v_0}{t}$", () => {
    expect(mathOf("Gia tốc $a = \\frac{v-v_0}{t}$.")).toEqual(["a = \\frac{v-v_0}{t}"]);
  });

  it("block math: $$s = v_0t + \\frac{1}{2}at^2$$", () => {
    const segs = splitMathSegments("$$\ns = v_0t + \\frac{1}{2}at^2\n$$");
    const math = segs.filter((s) => s.type === "math");

    expect(math).toHaveLength(1);
    expect(math[0].display).toBe(true);
    expect(hasKatexError(renderMathHtml(math[0].content, true))).toBe(false);
  });

  it("subscript $v_0$, căn $\\sqrt{x^2+y^2}$, Hy Lạp $\\Delta v$", () => {
    for (const input of ["$v_0$", "$\\sqrt{x^2+y^2}$", "$\\Delta v$"]) {
      expect(mathOf(input)).toHaveLength(1);
      expect(hasKatexError(renderMathHtml(mathOf(input)[0], false))).toBe(false);
    }
  });

  it("tiếng Việt + công thức: chữ văn xuôi KHÔNG bị nuốt vào math mode", () => {
    const segs = splitMathSegments("Khi \\(a = 2\\,\\text{m/s}^2\\), vận tốc tăng đều.");
    const text = segs.filter((s) => s.type === "text").map((s) => s.content).join(" ");

    expect(text).toContain("Khi");
    expect(text).toContain("vận tốc tăng đều.");
    expect(segs.some((s) => s.type === "math")).toBe(true);
  });

  it("mũ kiểu HTML bên trong \\text{} (delimiter có sẵn) vẫn được cứu", () => {
    const html = renderMathHtml("\\text{(m/s\\textsuperscript{2})}", false);

    expect(hasKatexError(html)).toBe(false);
    expect(html).toContain("mord mathrm");
    expect(html).toContain("msupsub");
  });
});

describe("repairLatex — chỉ dùng khi KaTeX ĐÃ parse lỗi", () => {
  it("gộp escape thừa và chuyển mũ kiểu HTML", () => {
    expect(repairLatex("\\\\frac{a}{b}")).toBe("\\frac{a}{b}");
    expect(repairLatex("2\\textsuperscript{3}")).toBe("2^{3}");
  });

  it("không đụng escape text thường (\\n, \\t)", () => {
    expect(collapseDoubleBackslash("dòng 1\\ndòng 2")).toBe("dòng 1\\ndòng 2");
  });
});