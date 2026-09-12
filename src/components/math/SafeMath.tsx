// ================================================================
// Math rendering system DUY NHẤT của LearnX AI (KaTeX)
// ================================================================
// Mạch tư duy: mọi công thức toán ở tutor chat, tóm tắt tài liệu,
// đề diagnostic/quiz/exercise TRƯỚC ĐÂY render raw text nên LaTeX
// như "\sqrt{2x+3}" hiện nguyên xi, đáp án dính nhau khó đọc.
// Component này là nơi DUY NHẤT biến LaTeX thành công thức đẹp —
// mọi chỗ hiển thị nội dung AI-generated/user-generated đều dùng nó,
// không tự parse bằng regex riêng.
//
// Hỗ trợ: $$..$$ block, \[..\] block, \(..\) inline, $..$ inline
// (single-$ chỉ render khi ruột chứa dấu hiệu toán học để không nuốt
// ký hiệu tiền tệ như "50$"). KaTeX throwOnError:false nên công thức
// lỗi cú pháp tự rơi về text thường — không bao giờ trắng trang.
//
// An toàn: text thường render qua React node (tự escape); chỉ HTML
// do CHÍNH KaTeX sinh ra mới đi qua dangerouslySetInnerHTML (KaTeX
// không passthrough HTML thô từ input). renderToString là thuần túy
// nên SSR và client cho cùng output — không hydration mismatch.
// ================================================================

"use client";

import { useMemo } from "react";
import katex from "katex";

export interface MathSegment {
  type: "text" | "math";
  content: string;
  display: boolean;
}

// Tách text thành text/math theo delimiters. Hàm thuần túy — dùng
// được cả trong MarkdownLite mà không cần render KaTeX 2 lần.
export function splitMathSegments(input: string): MathSegment[] {
  const pattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;
  const segments: MathSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: input.slice(lastIndex, match.index), display: false });
    }
    const raw = match[0];
    let latex = "";
    let display = false;

    if (raw.startsWith("$$")) {
      latex = raw.slice(2, -2);
      display = true;
    } else if (raw.startsWith("\\[")) {
      latex = raw.slice(2, -2);
      display = true;
    } else if (raw.startsWith("\\(")) {
      latex = raw.slice(2, -2);
      display = false;
    } else {
      // Single-$: chỉ coi là math khi ruột có dấu hiệu toán học —
      // nếu không (vd giá tiền "50$") thì giữ nguyên text.
      const inner = raw.slice(1, -1);
      if (inner.trim() !== "" && /[\\^_{}=+\-*/|<>∫∑∏√∞∂∆∇∈∉≤≥≠≈±×÷]/.test(inner)) {
        latex = inner;
        display = false;
      } else {
        segments.push({ type: "text", content: raw, display: false });
        lastIndex = match.index + raw.length;
        continue;
      }
    }

    segments.push({ type: "math", content: latex, display });
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < input.length) {
    segments.push({ type: "text", content: input.slice(lastIndex), display: false });
  }
  return segments;
}

function MathNode({ latex, display }: { latex: string; display: boolean }) {
  const html = useMemo(
    () =>
      katex.renderToString(latex, {
        throwOnError: false,
        displayMode: display,
        output: "html",
        strict: false,
        trust: false,
      }),
    [latex, display]
  );

  if (display) {
    return (
      <div
        className="math-block"
        role="img"
        aria-label={latex}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <span
      className="math-inline"
      role="img"
      aria-label={latex}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface SafeMathProps {
  text: string;
  className?: string;
}

export default function SafeMath({ text, className }: SafeMathProps) {
  const segments = useMemo(() => splitMathSegments(text), [text]);

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.type === "math" ? (
          <MathNode key={i} latex={seg.content} display={seg.display} />
        ) : (
          <span key={i}>{seg.content}</span>
        )
      )}
    </span>
  );
}
