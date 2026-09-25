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
import { splitMathSegments } from "../../lib/math/segments";

// Relative import keeps this pure helper compatible with Vitest; the
// compatibility export preserves existing SafeMath imports used across the UI.
export { splitMathSegments, type MathSegment } from "../../lib/math/segments";
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
