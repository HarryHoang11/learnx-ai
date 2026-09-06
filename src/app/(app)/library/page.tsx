// ================================================================
// TRANG THƯ VIỆN (Library)
// ================================================================
// Mạch tư duy: form upload gửi FormData thật tới /api/documents/upload
// (khớp với route đã xây — dùng req.formData(), KHÔNG phải JSON).
// Sau khi upload xong, trang tự động poll lại danh sách mỗi vài giây
// trong lúc còn tài liệu ở trạng thái "processing", để học sinh thấy
// trạng thái tự chuyển sang "ready" mà không cần bấm refresh tay —
// vì processDocument() ở backend chạy NỀN (fire-and-forget), không
// trả kết quả ngay trong response upload.
//
// NÂNG CẤP (redesign Thư viện tài liệu):
//   - Card tách rõ 3 trạng thái, có nút "Xem tóm tắt" mở modal đọc đầy
//     đủ (MarkdownLite render đẹp) + nút tải xuống (.md, Blob tạo ở
//     client, KHÔNG gọi AI lại) — xem DocumentCard/DocumentDetailModal.
//   - Trạng thái "failed" có nút "Thử lại" gọi POST .../retry (đọc lại
//     file gốc đã lưu, KHÔNG bắt upload lại).
//   - setDocs(json.data) LUÔN thay thế toàn bộ mảng (không append) —
//     đây vốn đã là cách chống duplicate ở tầng FRONTEND, giữ nguyên.
//     Duplicate do double-submit được chặn thêm ở BACKEND (xem
//     api/documents/upload/route.ts).
// ================================================================

"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import DocumentCard from "@/components/documents/DocumentCard";
import DocumentDetailModal, { type LibraryDocument } from "@/components/documents/DocumentDetailModal";
import type { ApiResponse } from "@/types";

export default function LibraryPage() {
  const [docs, setDocs] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadDocs() {
    try {
      const res = await fetch("/api/documents");
      const json: ApiResponse<LibraryDocument[]> = await res.json();
      if (json.success) {
        // Thay thế TOÀN BỘ mảng bằng dữ liệu mới nhất từ server — đây
        // chính là điểm mấu chốt chống duplicate ở tầng frontend: danh
        // sách LUÔN phản ánh đúng những gì DB có, không bao giờ APPEND
        // thêm vào mảng cũ (vốn là nguyên nhân phổ biến gây duplicate
        // ở nhiều app khác, nhưng code này chưa từng mắc lỗi đó).
        setDocs(json.data);
        const stillProcessing = json.data.some((d) => d.status === "processing");
        if (!stillProcessing && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } else {
        setError(json.error);
      }
    } catch {
      setError("Không thể kết nối tới máy chủ.");
    } finally {
      setLoading(false);
    }
  }

  function ensurePolling() {
    if (!pollRef.current) {
      pollRef.current = setInterval(loadDocs, 3000);
    }
  }

  useEffect(() => {
    loadDocs();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      const json: ApiResponse<{ documentId: string }> = await res.json();
      if (!json.success) throw new Error(json.error);

      await loadDocs();
      ensurePolling();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Không thể upload tài liệu.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRetry(docId: string) {
    setRetryingId(docId);
    setUploadError(null);
    try {
      const res = await fetch(`/api/documents/${docId}/retry`, { method: "POST" });
      const json: ApiResponse<{ documentId: string }> = await res.json();
      if (!json.success) throw new Error(json.error);

      await loadDocs();
      ensurePolling();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Không thể thử lại, vui lòng thử lại sau.");
    } finally {
      setRetryingId(null);
    }
  }

  const openDoc = docs.find((d) => d.id === openDocId) ?? null;

  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 18 }}>Thư viện tài liệu</h2>

      <label
        style={{
          display: "block",
          border: "1.5px dashed var(--border)",
          borderRadius: 14,
          padding: 36,
          textAlign: "center",
          color: "var(--text-dim)",
          fontSize: 13.5,
          marginBottom: 12,
          cursor: uploading ? "not-allowed" : "pointer",
        }}
      >
        {uploading ? "Đang tải lên..." : "⇧ Chọn PDF, Word, PowerPoint hoặc ảnh — LearnX sẽ tự tạo tóm tắt"}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          disabled={uploading}
          style={{ display: "none" }}
        />
      </label>

      {uploadError && (
        <div style={{ marginBottom: 14 }}>
          <StateMessage kind="error" text={uploadError} />
        </div>
      )}

      {loading && <StateMessage kind="loading" text="Đang tải danh sách tài liệu..." />}
      {error && <StateMessage kind="error" text={error} />}

      {!loading && !error && (
        <Panel>
          {docs.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>Chưa có tài liệu nào — hãy upload ở trên.</p>
          ) : (
            docs.map((d) => (
              <DocumentCard
                key={d.id}
                doc={d}
                onOpenSummary={() => setOpenDocId(d.id)}
                onRetry={() => handleRetry(d.id)}
                retrying={retryingId === d.id}
              />
            ))
          )}
        </Panel>
      )}

      {openDoc && <DocumentDetailModal doc={openDoc} onClose={() => setOpenDocId(null)} />}
    </section>
  );
}
