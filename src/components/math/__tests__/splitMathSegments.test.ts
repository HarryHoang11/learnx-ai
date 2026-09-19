// Unit test cho math segmenter dùng chung (SafeMath/MarkdownLite).
// Chạy bằng `npm test` (vitest). Chỉ test hàm thuần túy
// splitMathSegments — không render KaTeX/DOM nên nhanh và ổn định.
import { describe, expect, it } from "vitest";
// Import tương đối (không dùng alias @/) vì vitest của project chưa
// cấu hình resolve alias — giống cách router.test.ts đang làm.
import { splitMathSegments } from "../SafeMath";

describe("splitMathSegments", () => {
  it("giữ nguyên text thường (không có math)", () => {
    expect(splitMathSegments("Xin chào bạn")).toEqual([
      { type: "text", content: "Xin chào bạn", display: false },
    ]);
  });

  it("nhận $$..$$ là block math", () => {
    const segs = splitMathSegments("Giải $$\\sqrt{2x+3} + \\sqrt{x-1} = 5$$ nhé");
    expect(segs).toEqual([
      { type: "text", content: "Giải ", display: false },
      { type: "math", content: "\\sqrt{2x+3} + \\sqrt{x-1} = 5", display: true },
      { type: "text", content: " nhé", display: false },
    ]);
  });

  it("nhận \\(..\\) là inline math", () => {
    const segs = splitMathSegments("Nghiệm là \\(x^2+1\\) đúng không?");
    expect(segs[1]).toEqual({ type: "math", content: "x^2+1", display: false });
  });

  it("nhận \\[..\\] là block math", () => {
    const segs = splitMathSegments("\\[\\frac{a+b}{c}\\]");
    expect(segs).toEqual([{ type: "math", content: "\\frac{a+b}{c}", display: true }]);
  });

  it("nhận $..$ khi ruột là toán, bỏ qua khi là tiền tệ", () => {
    const math = splitMathSegments("Giá trị $x^2 + y^2 = z^2$ này");
    expect(math[1].type).toBe("math");

    const money = splitMathSegments("Giá 50$ nhé");
    expect(money.every((s) => s.type === "text")).toBe(true);
  });

  it("nhận ký hiệu đơn $x$ là math (yêu cầu Workspace)", () => {
    const segs = splitMathSegments("Xét $x$ và $MB$ trong tam giác");
    expect(segs.filter((s) => s.type === "math")).toHaveLength(2);
    expect(segs[1]).toEqual({ type: "math", content: "x", display: false });
  });

  it("không nhầm tiền tệ có cặp $ thành math", () => {
    const price = splitMathSegments("Giá $50,000$ hôm nay");
    expect(price.every((s) => s.type === "text")).toBe(true);
  });

  it("chuỗi rỗng cho mảng rỗng", () => {
    expect(splitMathSegments("")).toEqual([]);
  });

  it("Vietnamese text with LaTeX block math ($$...$$)", () => {
    const input = `Chứng minh các điểm thẳng hàng bằng định lý Ceva và Menelaus.

$$
\\frac{MB}{NC}\\cdot\\frac{PA}{MC}\\cdot\\frac{NA}{PB}=1
$$

Kết luận: Học sinh cần nhớ công thức Ceva và Menelaus.`;
    const segs = splitMathSegments(input);
    expect(segs).toHaveLength(3);
    expect(segs[0].type).toBe("text");
    expect(segs[0].content).toBe("Chứng minh các điểm thẳng hàng bằng định lý Ceva và Menelaus.\n\n");
    expect(segs[1].type).toBe("math");
    expect(segs[1].display).toBe(true);
    expect(segs[2].type).toBe("text");
    expect(segs[2].content).toContain("Kết luận");
  });

  it("Vietnamese text with LaTeX inline math (\\(...\\))", () => {
    const input = "Xét tam giản ABC với M, N, P nằm trên các cạnh tương ứng. Công thức \\(\\frac{a}{b} = k\\) áp dụng.";
    const segs = splitMathSegments(input);
    expect(segs).toHaveLength(3);
    expect(segs[0].type).toBe("text");
    expect(segs[1].type).toBe("math");
    expect(segs[1].content).toBe("\\frac{a}{b} = k");
    expect(segs[2].type).toBe("text");
  });

  it("Preserves Vietnamese diacritics through normalization", () => {
    const input = "Chứng minh, kiểm chứng, ứng dụng, cộng thức";
    const segs = splitMathSegments(input);
    expect(segs).toHaveLength(1);
    expect(segs[0].content).toBe("Chứng minh, kiểm chứng, ứng dụng, cộng thức");
  });
});
