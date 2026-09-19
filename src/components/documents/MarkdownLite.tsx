// ================================================================
// <MarkdownLite /> — render Markdown nhẹ + công thức toán KaTeX
// ================================================================
// Mạch tư duy: parser Markdown dòng-theo-dòng tự viết (heading,
// list, bold, code block) vẫn giữ nguyên để không thêm dependency
// markdown nặng; RIÊNG công thức toán dùng KaTeX chuẩn (không tự
// parse bằng regex) qua splitMathSegments() dùng chung với SafeMath.
//
// Quy tắc italic BẢO VỆ ký hiệu toán: `*text*` chỉ thành nghiêng khi
// KHÔNG nằm trong từ (2 phía là biên/khoảng trắng/dấu câu) —
// `Ans(*i*)` giữ nguyên chữ, còn `*ví dụ*` thì nghiêng. Đây là điểm
// khác cố ý so với CommonMark để không bóp méo ký hiệu hàm.
// ================================================================

"use client";

import { useState, type ReactNode } from "react";
import katex from "katex";
// Import tương đối (không dùng alias @/) vì vitest của project chưa
// cấu hình resolve alias — Next.js build vẫn resolve bình thường.
import { splitMathSegments } from "../math/SafeMath";

interface MarkdownLiteProps {
  content: string;
}

// Copy button cho code block — tự viết bằng Clipboard API + emoji/ký
// tự Unicode (✓/⧉) thay vì thêm icon library mới, giữ đúng triết lý
// "không thêm dependency" của file này. State "copied" tự tắt sau 1.5s.
function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="code-copy-btn"
      aria-label={copied ? "Đã sao chép" : "Sao chép code"}
      onClick={() => {
        navigator.clipboard?.writeText(code).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }).catch(() => {});
      }}
    >
      {copied ? "✓ Đã chép" : "⧉ Copy"}
    </button>
  );
}

export type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "code"; text: string };

// Gom display math nhiều dòng ($$...$$, \[...\]) thành 1 "siêu dòng" để
// parser dòng-theo-dòng không cắt vỡ công thức. Hàm thuần túy — test
// được bằng vitest. Code block ```...``` được tôn trọng: math delimiter
// bên trong code KHÔNG gom (đó là code mẫu, không phải công thức).
export function mergeDisplayMathLines(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let buffer: string[] | null = null;
  let closer: "$$" | "\\]" | null = null;
  let inCodeBlock = false;

  const openerOf = (trimmed: string): "$$" | "\\[" | null => {
    if (trimmed.startsWith("$$") && !trimmed.slice(2).includes("$$")) return "$$";
    if (trimmed.includes("\\[") && !trimmed.includes("\\]")) return "\\[";
    return null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      if (buffer) out.push(buffer.join("\n"));
      buffer = null;
      closer = null;
      out.push(line);
      continue;
    }
    if (inCodeBlock) {
      out.push(line);
      continue;
    }
    if (!buffer) {
      const opener = openerOf(trimmed);
      if (opener) {
        buffer = [line];
        closer = opener === "$$" ? "$$" : "\\]";
      } else {
        out.push(line);
      }
      continue;
    }
    buffer.push(line);
    if (closer === "$$" ? trimmed.includes("$$") : trimmed.includes("\\]")) {
      out.push(buffer.join("\n"));
      buffer = null;
      closer = null;
    }
  }
  if (buffer) out.push(buffer.join("\n"));
  return out.join("\n");
}

// Tách inline thành token (hàm thuần túy — test được bằng vitest).
// Thứ tự ưu tiên: code > bold > italic có biên. Italic yêu cầu mở `*`
// ở ĐẦU chuỗi hoặc sau whitespace, và đóng `*` không dính chữ/số —
// để `Ans(*i*)`, `f(*x*)`, `a*b`, `2*3` giữ nguyên chữ (bảo vệ ký hiệu
// toán), còn `*ví dụ*` trong văn xuôi thì nghiêng. Đây là điểm khác
// cố ý so với CommonMark, đã document và có test khóa hành vi.
export function tokenizeInline(input: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+?\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushText = (text: string) => {
    if (text !== "") tokens.push({ kind: "text", text });
  };

  while ((match = pattern.exec(input)) !== null) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;

    if (raw.startsWith("**")) {
      pushText(input.slice(lastIndex, start));
      tokens.push({ kind: "bold", text: raw.slice(2, -2) });
      lastIndex = end;
      continue;
    }
    if (raw.startsWith("`")) {
      pushText(input.slice(lastIndex, start));
      tokens.push({ kind: "code", text: raw.slice(1, -1) });
      lastIndex = end;
      continue;
    }
    // Single-*: kiểm tra biên trước khi coi là italic.
    const prev = start > 0 ? input[start - 1] : " ";
    const next = end < input.length ? input[end] : " ";
    const isWordChar = (ch: string) => /[A-Za-z0-9]/.test(ch);
    const isSpace = (ch: string) => /\s/.test(ch);
    if ((start === 0 || isSpace(prev)) && !isWordChar(next)) {
      pushText(input.slice(lastIndex, start));
      tokens.push({ kind: "italic", text: raw.slice(1, -1) });
      lastIndex = end;
    }
    // Biên không hợp lệ (vd Ans(*i*)): để nguyên, tiếp tục quét SAU
    // vị trí hiện tại để không kẹt vòng lặp — phần text này sẽ được
    // gom vào pushText cuối cùng.
  }

  pushText(input.slice(lastIndex));
  return tokens;
}

export interface ParsedTable {
  header: string[];
  rows: string[][];
}

// Nhận diện bảng pipe (| a | b | + dòng phân cách |---|---|).
// Hàm thuần túy — test được. Trả null nếu không phải bảng hợp lệ.
export function tryParseTable(lines: string[]): ParsedTable | null {
  if (lines.length < 2) return null;
  const splitRow = (line: string): string[] | null => {
    const t = line.trim();
    if (!t.startsWith("|") || !t.endsWith("|")) return null;
    return t
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
  };
  const header = splitRow(lines[0]);
  if (!header || header.length === 0) return null;
  const sep = splitRow(lines[1]);
  if (!sep || sep.length !== header.length || !sep.every((c) => /^:?-{1,}:?$/.test(c))) return null;
  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const row = splitRow(lines[i]);
    if (!row || row.length === 0) break;
    rows.push(row);
  }
  return { header, rows };
}
// Render phần *inline* của 1 dòng: math LaTeX (\(..\), $$..$$) qua
// KaTeX trước, sau đó bold/italic/code trên text thường qua tokenizer.
// Thứ tự này bảo đảm công thức và code không bao giờ bị parse lẫn.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return splitMathSegments(text).map((seg, si) => {
    if (seg.type === "math") {
      const html = katex.renderToString(seg.content, {
        throwOnError: false,
        displayMode: seg.display,
        output: "html",
        strict: false,
        trust: false,
      });
      return seg.display ? (
        <div
          key={`${keyPrefix}-m${si}`}
          className="math-block"
          role="img"
          aria-label={seg.content}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <span
          key={`${keyPrefix}-m${si}`}
          className="math-inline"
          role="img"
          aria-label={seg.content}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    }
    const tokens = tokenizeInline(seg.content);
    return tokens.map((tok, i) => {
      const key = `${keyPrefix}-t${si}-${i}`;
      if (tok.kind === "bold") {
        return <strong key={key}>{tok.text}</strong>;
      }
      if (tok.kind === "italic") {
        return <em key={key}>{tok.text}</em>;
      }
      if (tok.kind === "code") {
        return (
          <code
            key={key}
            style={{
              background: "var(--panel-strong)",
              padding: "1px 6px",
              borderRadius: 4,
              fontSize: "0.9em",
            }}
          >
            {tok.text}
          </code>
        );
      }
      return <span key={key}>{tok.text}</span>;
    });
  });
}

export default function MarkdownLite({ content }: MarkdownLiteProps) {
  // Gom display math nhiều dòng THÀNH 1 siêu dòng trước khi parser
  // dòng-theo-dòng chạy (mergeDisplayMathLines tôn trọng code block).
  const lines = mergeDisplayMathLines(content).split("\n");
  const blocks: ReactNode[] = [];

  let i = 0;
  let listBuffer: { ordered: boolean; items: string[] } | null = null;

  function flushList() {
    if (!listBuffer) return;
    const ListTag = listBuffer.ordered ? "ol" : "ul";
    blocks.push(
      <ListTag key={`list-${blocks.length}`} style={{ margin: "6px 0 14px", paddingLeft: 22, lineHeight: 1.7 }}>
        {listBuffer.items.map((item, idx) => (
          <li key={idx}>{renderInline(item, `li-${blocks.length}-${idx}`)}</li>
        ))}
      </ListTag>
    );
    listBuffer = null;
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code block ```lang ... ```
    if (trimmed.startsWith("```")) {
      flushList();
      const language = trimmed.slice(3).trim(); // vd "js", "python", hoặc rỗng
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // bỏ qua dòng ``` đóng
      const codeText = codeLines.join("\n");
      blocks.push(
        <div key={`code-${blocks.length}`} className="code-block-wrapper">
          <div className="code-block-header">
            <span className="code-block-lang">{language || "code"}</span>
            <CodeCopyButton code={codeText} />
          </div>
          <pre className="code-block-pre">
            <code>{codeText}</code>
          </pre>
        </div>
      );
      continue;
    }

    // Bảng pipe (| a | b | + dòng |---|---|): gom các dòng liên tiếp
    // bắt đầu bằng | rồi validate qua tryParseTable — không hợp lệ thì
    // rơi xuống render đoạn văn thường (không mất nội dung).
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith("|")) {
        tableLines.push(lines[j]);
        j++;
      }
      const table = tryParseTable(tableLines);
      if (table) {
        flushList();
        blocks.push(
          <div key={`table-${blocks.length}`} style={{ overflowX: "auto", margin: "8px 0 14px" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13.5 }}>
              <thead>
                <tr>
                  {table.header.map((h, hi) => (
                    <th
                      key={hi}
                      style={{
                        border: "1px solid var(--border)",
                        background: "var(--panel-strong)",
                        padding: "8px 10px",
                        textAlign: "left",
                        fontWeight: 700,
                      }}
                    >
                      {renderInline(h, `th-${blocks.length}-${hi}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => (
                      <td key={ci} style={{ border: "1px solid var(--border-soft)", padding: "8px 10px", lineHeight: 1.6 }}>
                        {renderInline(cell, `td-${blocks.length}-${ri}-${ci}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        i = j;
        continue;
      }
      // Không phải bảng hợp lệ: để vòng lặp xử lý như dòng thường.
    }

    // Blockquote: các dòng liên tiếp bắt đầu bằng > (1 cấp, lồng nhau
    // gộp chung) — dùng cho "Gợi ý:", lưu ý của AI.
    if (trimmed.startsWith(">")) {
      flushList();
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={`quote-${blocks.length}`}
          style={{
            margin: "8px 0 14px",
            padding: "10px 14px",
            borderLeft: "3px solid var(--indigo)",
            background: "var(--indigo-soft)",
            borderRadius: "0 10px 10px 0",
            fontSize: 14,
            lineHeight: 1.7,
          }}
        >
          {quoteLines.map((q, qi) => (
            <div key={qi}>{renderInline(q, `q-${blocks.length}-${qi}`)}</div>
          ))}
        </blockquote>
      );
      continue;
    }

    // Heading # / ## / ###
    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const sizeByLevel = { 1: 19, 2: 16.5, 3: 14.5 } as const;
      blocks.push(
        <div
          key={`h-${blocks.length}`}
          style={{
            fontSize: sizeByLevel[level as 1 | 2 | 3],
            fontWeight: 700,
            marginTop: blocks.length === 0 ? 0 : 20,
            marginBottom: 8,
            color: "var(--text)",
          }}
        >
          {renderInline(text, `h-${blocks.length}`)}
        </div>
      );
      i++;
      continue;
    }

    // Bullet list: -, *, •
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      if (!listBuffer || listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: false, items: [] };
      }
      listBuffer.items.push(bulletMatch[1]);
      i++;
      continue;
    }

    // Numbered list: "1. ", "2. "...
    const numberedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (numberedMatch) {
      if (!listBuffer || !listBuffer.ordered) {
        flushList();
        listBuffer = { ordered: true, items: [] };
      }
      listBuffer.items.push(numberedMatch[1]);
      i++;
      continue;
    }

    // Dòng trống — kết thúc list hiện tại (nếu có), không render gì thêm
    if (trimmed === "") {
      flushList();
      i++;
      continue;
    }

    // Đoạn văn thường
    flushList();
    blocks.push(
      <p key={`p-${blocks.length}`} style={{ margin: "0 0 12px", lineHeight: 1.7 }}>
        {renderInline(trimmed, `p-${blocks.length}`)}
      </p>
    );
    i++;
  }
  flushList();

  return <div style={{ fontSize: 14.5, color: "var(--text)" }}>{blocks}</div>;
}
