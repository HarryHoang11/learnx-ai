// Unit test cho tokenizer inline + table parser của MarkdownLite.
// Chỉ test hàm thuần túy (không render DOM) nên nhanh và ổn định.
import { describe, expect, it } from "vitest";
// Import tương đối vì vitest chưa cấu hình resolve alias @/.
import { tokenizeInline, tryParseTable } from "../MarkdownLite";

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
