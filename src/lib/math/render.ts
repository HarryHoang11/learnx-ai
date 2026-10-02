// ================================================================
// KATeX RENDER DÙNG CHUNG — parse nghiêm trước, tự cứu công thức lỗi
// ================================================================
// Mạch tư duy: SafeMath và MarkdownLite trước đây gọi
// `katex.renderToString(..., { throwOnError: false })` — mọi lỗi cú pháp
// bị vẽ thành CHỮ ĐỎ (`mathcolor="#cc0000"`), tức người dùng thấy dấu
// LaTeX lỗi mà không biết vì sao. Ở đây đổi thứ tự xử lý, và GIỮ NGUYÊN
// kết quả với công thức hợp lệ:
//
//   1. Parse với `throwOnError: true` — công thức ĐÚNG thì ra HTML giống
//      hệt trước đây (không đổi 1 byte).
//   2. Chỉ khi parse FAIL mới thử "cứu": repairLatex() gộp `\\` thừa và
//      đổi `\textsuperscript`/`\textsubscript` về cú pháp KaTeX hiểu. An
//      toàn vì chỉ chạy khi bản gốc ĐÃ HỎNG — công thức hợp lệ dùng `\\`
//      ngắt dòng (matrix/cases) không bao giờ rơi vào nhánh này.
//   3. Vẫn lỗi thì render với `throwOnError: false` — GIỮ NGUYÊN hành vi
//      cũ (vẽ lỗi màu đỏ) thay vì trắng trang/crash.
//
// Dùng chung 1 chỗ này cho cả hai renderer hiện có nên không tạo ra
// renderer thứ ba, và cấu hình KaTeX chỉ nằm ở một file.
// ================================================================

import katex from "katex";
import { repairLatex } from "./segments";

// `strict:false` giữ nguyên hành vi cũ (tiếng Việt trong \text{} không bị
// báo lỗi nghiêm ngặt). `trust:false` = KHÔNG bật \href/\url → an toàn.
const KATEX_BASE = { output: "html" as const, strict: false, trust: false };

export function renderMathHtml(latex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(latex, { ...KATEX_BASE, displayMode, throwOnError: true });
  } catch {
    const repaired = repairLatex(latex);
    if (repaired !== latex) {
      try {
        return katex.renderToString(repaired, { ...KATEX_BASE, displayMode, throwOnError: true });
      } catch {
        // repaired vẫn lỗi -> rơi xuống nhánh dưới.
      }
    }
    return katex.renderToString(latex, { ...KATEX_BASE, displayMode, throwOnError: false });
  }
}