// ================================================================
// <MarkdownLite /> — render Markdown nhẹ, KHÔNG phụ thuộc thư viện
// ngoài (react-markdown...)
// ================================================================
// Mạch tư duy: project không có package.json trong bản audit hiện có
// (không rõ đã cài sẵn thư viện markdown nào chưa) — thay vì yêu cầu
// `npm install react-markdown` (rủi ro nếu môi trường build của user
// chưa có mạng/registry lúc build), tự viết 1 parser dòng-theo-dòng
// đơn giản, đủ khớp với ĐÚNG format mà buildDocumentSummaryPrompt()
// yêu cầu AI xuất ra (xem lib/ai/prompts.ts): heading ##, bullet -,
// numbered list, bold **text**, code block ```, inline `code`.
//
// KHÔNG cố parse toàn bộ CommonMark spec (bảng, footnote, link ảnh
// phức tạp...) — nếu sau này cần Markdown đầy đủ hơn, khuyến nghị cài
// `react-markdown` + `remark-gfm` thay thế file này, phần còn lại của
// UI (modal, buttons) không cần đổi gì.
// ================================================================

import type { ReactNode } from "react";

interface MarkdownLiteProps {
  content: string;
}

// Render phần *inline* của 1 dòng: **bold**, `code`, còn lại là text
// thường. Trả về mảng React node để chèn xen kẽ.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter((p) => p !== "");
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
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
            fontFamily: "monospace",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={key}>{part}</span>;
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
