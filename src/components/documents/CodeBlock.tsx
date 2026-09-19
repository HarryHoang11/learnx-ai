// ================================================================
// <CodeBlock /> — khối code trong nội dung AI/Markdown
// ================================================================
// Mạch tư duy: code block là nơi hay bị "vỡ layout" nhất (dòng dài,
// mobile hẹp). Tách thành component riêng để:
//   - có nút Copy (dùng clipboard API, fallback im lặng nếu trình duyệt
//     chặn) — trước đây code block chỉ có <pre> trần, không copy được;
//   - hiển thị NHÃN NGÔN NGỮ lấy từ fence (```ts) để người học biết
//     đoạn code thuộc ngôn ngữ nào (phục vụ môn Tin học);
//   - cuộn NGANG ngay trong khối (overflow-x: auto) nên không đẩy cả
//     trang thành scroll ngang trên mobile — đúng yêu cầu chống
//     overflow (đặc biệt với code dài).
// ================================================================

"use client";

import { useState } from "react";

interface CodeBlockProps {
  code: string;
  language?: string;
}

export default function CodeBlock({ code, language }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Trình duyệt cũ / không có quyền clipboard: bỏ qua im lặng,
      // không phá UX bằng alert.
      setCopied(false);
    }
  }

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span>{language ? language.toUpperCase() : "CODE"}</span>
        <button
          type="button"
          className="code-block-copy-btn"
          onClick={handleCopy}
          aria-label={copied ? "Đã sao chép" : "Sao chép mã"}
        >
          {copied ? "Đã chép" : "Sao chép"}
        </button>
      </div>
      <pre className="code-block-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}
