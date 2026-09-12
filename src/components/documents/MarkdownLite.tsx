// ================================================================
// <MarkdownLite /> — render Markdown nhẹ + công thức toán KaTeX
// ================================================================
// Mạch tư duy: parser Markdown dòng-theo-dòng tự viết (heading,
// list, bold, code block) vẫn giữ nguyên để không thêm dependency
// markdown nặng; RIÊNG công thức toán dùng KaTeX chuẩn (không tự
// parse bằng regex) qua splitMathSegments() dùng chung với SafeMath.
// ================================================================

import type { ReactNode } from "react";
import katex from "katex";
import { splitMathSegments } from "@/components/math/SafeMath";

interface MarkdownLiteProps {
  content: string;
}

// Render phần *inline* của 1 dòng: math LaTeX (\(..\), $$..$$) qua
// KaTeX, **bold**, `code`, còn lại là text thường. Math được tách
// TRƯỚC rồi mới format bold/code trên text — code block và công thức
// không bao giờ parse lẫn nhau.
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
    const parts = seg.content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter((p) => p !== "");
    return parts.map((part, i) => {
      const key = `${keyPrefix}-t${si}-${i}`;
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={key}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith("`") && part.endsWith("`")) {
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
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={key}>{part}</span>;
    });
  });
}

export default function MarkdownLite({ content }: MarkdownLiteProps) {
  const lines = content.split("\n");
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

    // Code block ```...```
    if (trimmed.startsWith("```")) {
      flushList();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // bỏ qua dòng ``` đóng
      blocks.push(
        <pre
          key={`code-${blocks.length}`}
          style={{
            background: "var(--panel-strong)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "12px 14px",
            overflowX: "auto",
            fontSize: 13,
            fontFamily: "monospace",
            margin: "8px 0 14px",
          }}
        >
          <code>{codeLines.join("\n")}</code>
        </pre>
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
