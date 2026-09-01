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
// ================================================================

"use client";

import { useEffect, useRef, useState } from "react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import type { ApiResponse } from "@/types";

interface DocumentSummary {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  summary: string | null;
  uploadedAt: string;
}

export default function LibraryPage() {
  const [docs, setDocs] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadDocs() {
    try {
      const res = await fetch("/api/documents");
      const json: ApiResponse<DocumentSummary[]> = await res.json();
      if (json.success) {
        setDocs(json.data);
        // Nếu còn tài liệu "processing", tiếp tục poll; nếu hết thì dừng
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

  useEffect(() => {
    loadDocs();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      const json: ApiResponse<{ documentId: string }> = await res.json();
      if (!json.success) throw new Error(json.error);

      await loadDocs();
      // Bắt đầu poll mỗi 3s để cập nhật trạng thái "processing" -> "ready"
      if (!pollRef.current) {
        pollRef.current = setInterval(loadDocs, 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể upload tài liệu.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

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
          marginBottom: 22,
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

      {loading && <StateMessage kind="loading" text="Đang tải danh sách tài liệu..." />}
      {error && <StateMessage kind="error" text={error} />}

      {!loading && (
        <Panel>
          {docs.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>Chưa có tài liệu nào — hãy upload ở trên.</p>
          ) : (
            docs.map((d) => (
              <div
                key={d.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 4px",
                  borderBottom: "1px solid var(--border-soft)",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{d.fileName}</div>
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>
                    {statusLabel(d.status)}
                    {d.summary ? ` · ${d.summary.slice(0, 60)}${d.summary.length > 60 ? "..." : ""}` : ""}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 11.5,
                    color: "var(--text-dim)",
                    background: "var(--panel-strong)",
                    padding: "4px 9px",
                    borderRadius: 7,
                  }}
                >
                  {d.fileType.toUpperCase()}
                </span>
              </div>
            ))
          )}
        </Panel>
      )}
    </section>
  );
}

function statusLabel(status: string): string {
  if (status === "processing") return "⏳ Đang xử lý...";
  if (status === "ready") return "✓ Đã xử lý";
  if (status === "failed") return "✗ Xử lý lỗi";
  return status;
}
