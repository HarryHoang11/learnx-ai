// ================================================================
// <DocumentDetailModal /> — xem tóm tắt AI đầy đủ + tải xuống
// ================================================================
// Mạch tư duy: GET /api/documents (danh sách) đã trả "summary" ĐẦY ĐỦ,
// không cắt ngắn (xem api/documents/route.ts) — nên modal này nhận
// thẳng document object từ state của trang Library để mở TỨC THÌ,
// không cần gọi thêm API/hiện loading spinner khi user vừa click "Xem
// tóm tắt". API GET /api/documents/:id vẫn tồn tại độc lập (phục vụ
// nhu cầu khác như link chia sẻ trực tiếp), nhưng KHÔNG bắt buộc phải
// gọi lại ở đây — gọi thêm sẽ chỉ làm chậm UX mà không có lợi ích gì
// (dữ liệu y hệt, document đã "ready" thì summary không đổi nữa).
// ================================================================

"use client";

import MarkdownLite from "./MarkdownLite";
import { downloadSummaryAsMarkdown } from "@/lib/documents/downloadSummary";

export interface LibraryDocument {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  summary: string | null;
  errorMessage: string | null;
  hasOriginalFile: boolean;
  uploadedAt: string;
  updatedAt: string;
}

interface DocumentDetailModalProps {
  doc: LibraryDocument;
  onClose: () => void;
}

// Tên file .md tải xuống dựa theo tên tài liệu gốc — xem toSummaryFileName
// trong lib/documents/downloadSummary.ts (dùng chung với DocumentCard).

export default function DocumentDetailModal({ doc, onClose }: DocumentDetailModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-row">
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15.5, fontWeight: 600, wordBreak: "break-word" }}>{doc.fileName}</div>
            <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4 }}>
              {doc.fileType.toUpperCase()} · Cập nhật {new Date(doc.updatedAt).toLocaleString("vi-VN")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            style={{
              background: "none",
              border: "none",
              color: "var(--text-dim)",
              fontSize: 20,
              cursor: "pointer",
              lineHeight: 1,
              padding: 4,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div className="modal-body-scroll">
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: 0.5,
              color: "var(--cyan)",
              marginBottom: 14,
            }}
          >
            TÓM TẮT AI
          </div>

          {doc.summary ? (
            <MarkdownLite content={doc.summary} />
          ) : (
            <p style={{ color: "var(--text-dim)", fontSize: 14 }}>Chưa có tóm tắt cho tài liệu này.</p>
          )}
        </div>

        <div className="modal-footer-row">
          {doc.summary && (
            <button className="btn-secondary" onClick={() => downloadSummaryAsMarkdown(doc.fileName, doc.summary!)}>
              ↓ Tải tóm tắt
            </button>
          )}
          {doc.hasOriginalFile && (
            // Thẻ <a> điều hướng thẳng tới route download (server trả
            // Content-Disposition: attachment) — KHÔNG cần fetch bằng
            // JS, để trình duyệt tự xử lý luồng tải file nhị phân
            // (đơn giản, hoạt động tốt với file lớn hơn so với tự fetch
            // rồi tạo Blob trong bộ nhớ).
            <a className="btn-secondary" href={`/api/documents/${doc.id}/download`} download>
              ↓ Tải tài liệu gốc
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
