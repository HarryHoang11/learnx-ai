// Unit test cho tokenizer inline + table parser của MarkdownLite.
// Chỉ test hàm thuần túy (không render DOM) nên nhanh và ổn định.
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
// Import tương đối vì vitest chưa cấu hình resolve alias @/.
import MarkdownLite, { tokenizeInline, tryParseTable } from "../MarkdownLite";

describe("tokenizeInline", () => {
  it("bold + code giữ nguyên hành vi cũ", () => {
    expect(tokenizeInline("**đậm** và `code`")).toEqual([
      { kind: "bold", text: "đậm" },
      { kind: "text", text: " và " },
      { kind: "code", text: "code" },
    ]);
  });

  it("italic *ví dụ* ở biên từ", () => {
    expect(tokenizeInline("đây là *ví dụ* nhé")).toEqual([
      { kind: "text", text: "đây là " },
      { kind: "italic", text: "ví dụ" },
      { kind: "text", text: " nhé" },
    ]);
  });

  it("KHÔNG parse italic trong từ — Ans(*i*) giữ nguyên (bảo vệ ký hiệu toán)", () => {
    expect(tokenizeInline("Ans(*i*)=function(Ans(*j*))")).toEqual([
      { kind: "text", text: "Ans(*i*)=function(Ans(*j*))" },
    ]);
  });

  it("KHÔNG parse a*b hay 2*3 thành italic", () => {
    expect(tokenizeInline("tính a*b và 2*3 giúp mình")).toEqual([
      { kind: "text", text: "tính a*b và 2*3 giúp mình" },
    ]);
  });
});

describe("tryParseTable", () => {
  it("nhận bảng pipe hợp lệ", () => {
    const table = tryParseTable(["| A | B |", "|---|---|", "| 1 | 2 |"]);
    expect(table).toEqual({ header: ["A", "B"], rows: [["1", "2"]] });
  });

  it("từ chối khi thiếu dòng phân cách", () => {
    expect(tryParseTable(["| A | B |", "| 1 | 2 |"])).toBeNull();
  });

  it("từ chối khi số cột lệch", () => {
    expect(tryParseTable(["| A | B |", "|---|---|", "| 1 |"])).not.toBeNull();
    expect(tryParseTable(["nope", "---"]) === null).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// HTML NESTING — chặn "In HTML, <div> cannot be a descendant of <p>".
//
// Cảnh báo này chỉ xuất hiện ở RUNTIME khi React render, nên typecheck/lint
// đều không bắt được. Test ở đây render thật ra HTML rồi kiểm tra CẤU TRÚC
// cây: mọi <div class="math-block"> phải là ANH/EM với <p>, không lồng bên
// trong. Công thức dùng đúng case đang lỗi trong báo cáo.
// ---------------------------------------------------------------------------
describe("cấu trúc HTML hợp lệ (block math không nằm trong <p>)", () => {
  // Công thức gây warning "In HTML, <div> cannot be a descendant of <p>".
  const CEVA = String.raw`\frac{MB}{MC}\cdot\frac{CN}{NA}\cdot\frac{AP}{PB}=1`;
  // Dùng hằng thay vì viết "$$" trực tiếp trong template literal: `$$` kèm
  // ${...} sẽ bị JS hiểu thành "$" + interpolation + "$" (chỉ 1 dấu $ mỗi
  // bên) — dễ sai âm thầm, đã xảy ra khi viết test lần đầu.
  const D = "$" + "$";

  // File test là .ts nên không dùng JSX — createElement tương đương.
  const render = (content: string) =>
    renderToStaticMarkup(createElement(MarkdownLite, { content }));

  it("bỏ qua phần text rỗng, không sinh <p></p> rỗng", () => {
    const html = render(`${D}${CEVA}${D}`);
    expect(html).toContain('class="math-block"');
    // Không có đoạn văn rỗng nào được tạo ra.
    expect(html).not.toMatch(/<p[^>]*>\s*<\/p>/);
  });

  it("display math đứng một mình: KHÔNG bọc trong <p>", () => {
    const html = render(`${D}\n${CEVA}\n${D}`);
    expect(html).toContain('class="math-block"');
    // <p> chỉ chứa text, không chứa thẻ div.
    expect(html).not.toMatch(/<p[^>]*>[^<]*<div/);
    expect(html).not.toMatch(/<p[^>]*>(?:(?!<\/p>).)*math-block(?:(?!<\/p>).)*<\/p>/);
  });

  it("math nằm giữa text: tách thành <p> trước / <div> / <p> sau", () => {
    const html = render(`Đoạn trước ${D}x^2+y^2=z^2${D} Đoạn sau`);
    expect(html).toMatch(/<p[^>]*>[\s\S]*?Đoạn trước[\s\S]*?<\/p>/);
    expect(html).toMatch(/math-block/);
    expect(html).toMatch(/<p[^>]*>[\s\S]*?Đoạn sau[\s\S]*?<\/p>/);
    // Bất kỳ <p> nào cũng không được chứa math-block.
    expect(html).not.toMatch(/<p[^>]*>(?:(?!<\/p>).)*math-block(?:(?!<\/p>).)*<\/p>/);
  });

  it("inline math vẫn nằm trong <p> (không đổi hành vi)", () => {
    const html = render(`Ví dụ $x^2+y^2=z^2$ trong đoạn văn.`);
    expect(html).toMatch(/<p[^>]*>[\s\S]*math-inline[\s\S]*<\/p>/);
    expect(html).not.toContain('class="math-block"');
  });

  it("công thức hiển thị giữ nguyên nội dung LaTeX (không mất \\frac, \\cdot)", () => {
    const html = render(`${D}\n${CEVA}\n${D}`);
    // KaTeX sinh .frac và .cdot thành phần tử riêng — chứng minh công thức
    // được render đầy đủ chứ không bị mất ký hiệu.
    expect(html).toContain("frac");
    expect(html).toContain("cdot");
    expect(html).toContain(`aria-label="${CEVA}"`);
  });

  it("display math nhiều dòng vẫn là 1 khối duy nhất", () => {
    const html = render(`${D}\n\\begin{aligned}\na &= b \\\\\nc &= d\n\\end{aligned}\n${D}`);
    const blocks = html.match(/class="math-block"/g) ?? [];
    expect(blocks).toHaveLength(1);
    expect(html).not.toMatch(/<p[^>]*>(?:(?!<\/p>).)*math-block(?:(?!<\/p>).)*<\/p>/);
  });

  it("công thức hiển thị trong list item không tạo <p> lồng nhau", () => {
    const html = render(`- Bước 1: ${D}${CEVA}${D}`);
    expect(html).toContain("<li");
    expect(html).toContain('class="math-block"');
    // <li> chứa <div> là hợp lệ; chỉ cần chắc không có <p> bọc div.
    expect(html).not.toMatch(/<p[^>]*>(?:(?!<\/p>).)*math-block(?:(?!<\/p>).)*<\/p>/);
  });
});
