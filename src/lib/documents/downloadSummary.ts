// ================================================================
// Tải tóm tắt AI xuống dạng .md — CHẠY Ở CLIENT, không gọi API/AI lại
// ================================================================
// Mạch tư duy: summary đã có sẵn trong state (từ GET /api/documents),
// nên "tải xuống" chỉ đơn giản là đóng gói text hiện có thành Blob rồi
// trigger download qua thẻ <a> tạm — không cần round-trip lên server,
// càng không gọi lại AI (đúng yêu cầu "download không gọi AI lại").
// Dùng chung giữa DocumentCard (nút tải nhanh) và DocumentDetailModal
// (nút tải trong modal) để tránh viết trùng logic 2 nơi.
// ================================================================

// Tên file .md dựa theo tên tài liệu gốc, ví dụ:
// "Bai tap nang cao He thuc luong.pdf" -> "Bai_tap_nang_cao_He_thuc_luong_summary.md"
export function toSummaryFileName(originalName: string): string {
  const base = originalName.replace(/\.[^/.]+$/, "");
  const safe = base
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  return `${safe || "tai_lieu"}_summary.md`;
}

export function downloadSummaryAsMarkdown(fileName: string, summary: string) {
  const blob = new Blob([summary], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = toSummaryFileName(fileName);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
