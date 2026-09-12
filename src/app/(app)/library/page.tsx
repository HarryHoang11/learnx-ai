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
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ApiResponse } from "@/types";

import { SUBJECTS, CUSTOM_SUBJECT_VALUE } from "@/lib/constants/subjects";

const DIFFICULTY_KEYS = [
  { value: "easy", labelKey: "doc.difficulty.easy" },
  { value: "medium", labelKey: "doc.difficulty.medium" },
  { value: "hard", labelKey: "doc.difficulty.hard" },
] as const;

export default function LibraryPage() {
  const { t } = useLanguage();
  const [docs, setDocs] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [openDocId, setOpenDocId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  // File đã chọn nhưng chưa upload — hiện form metadata (môn/chủ đề/độ
  // khó) trước khi gửi, đúng spec upload (Phase 9).
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [metaSubject, setMetaSubject] = useState("");
  const [metaTopic, setMetaTopic] = useState("");
  const [metaDifficulty, setMetaDifficulty] = useState("medium");
  const [metaDescription, setMetaDescription] = useState("");
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
      setError(t("common.connectionError"));
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

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setPendingFile(file);
  }

  function cancelPending() {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (!pendingFile || uploading) return;
    if (!metaSubject) {
      setUploadError(t("library.needSubject"));
      return;
    }

    setUploading(true);
    setUploadError(null);
    // Upload là 1 POST duy nhất nhưng server làm 2 việc thật nối tiếp:
    // nhận bytes + validate + trích xuất text — label phản ánh đúng để
    // user không tưởng app treo với file lớn. Sau đó poll trạng thái
    // "processing" (chunk + embedding + tóm tắt AI) cho tới ready/failed.
    setUploadStage(t("library.stageUpload"));
    try {
      const formData = new FormData();
      formData.append("file", pendingFile);
      formData.append("subject", metaSubject);
      if (metaTopic.trim()) formData.append("topic", metaTopic.trim());
      formData.append("difficulty", metaDifficulty);
      if (metaDescription.trim()) formData.append("description", metaDescription.trim());

      const res = await fetch("/api/documents/upload", { method: "POST", body: formData });
      const json: ApiResponse<{ documentId: string }> = await res.json();
      if (!json.success) throw new Error(json.error);

      setUploadStage(t("library.stageExtract"));
      await loadDocs();
      ensurePolling();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t("library.uploadFail"));
    } finally {
      setUploading(false);
      setUploadStage(null);
      setPendingFile(null);
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
      setUploadError(err instanceof Error ? err.message : t("library.retryFail"));
    } finally {
      setRetryingId(null);
    }
  }

  const openDoc = docs.find((d) => d.id === openDocId) ?? null;

  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 18 }}>{t("library.title")}</h2>

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
        {/* Chỉ nhận đúng định dạng pipeline hỗ trợ (.txt/.md/.pdf/
            .docx/.pptx) — trước đây label mời cả "ảnh" nhưng ảnh luôn
            fail extraction, gây hiểu nhầm "upload lỗi". */}
        {uploading ? (uploadStage ?? t("library.uploading")) : t("library.dropHint")}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md"
          onChange={handleFileSelect}
          disabled={uploading}
          style={{ display: "none" }}
        />
      </label>

      {/* Form metadata hiện sau khi chọn file, trước khi upload thật —
          đúng spec: File + Subject (bắt buộc) + Topic + Difficulty +
          Description. */}
      {pendingFile && !uploading && (
        <Panel style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, wordBreak: "break-word" }}>
            {pendingFile.name}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 12 }}>
            {(pendingFile.size / 1024).toFixed(0)} {t("library.metaHint")}
          </div>
          <div className="grid-form-2col" style={{ marginBottom: 10 }}>
            <div>
              <label className="form-label" htmlFor="doc-subject">{t("library.subject")}</label>
              <select
                id="doc-subject"
                className="form-input"
                value={metaSubject}
                onChange={(e) => setMetaSubject(e.target.value)}
                required
              >
                <option value="">{t("library.pickSubject")}</option>
                {SUBJECTS.map((s) => (
                  <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
                ))}
                <option value={CUSTOM_SUBJECT_VALUE}>{t("library.subjects.other")}</option>
              </select>
            </div>
            <div>
              <label className="form-label" htmlFor="doc-difficulty">{t("library.difficulty")}</label>
              <select
                id="doc-difficulty"
                className="form-input"
                value={metaDifficulty}
                onChange={(e) => setMetaDifficulty(e.target.value)}
              >
                {DIFFICULTY_KEYS.map((o) => (
                  <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label className="form-label" htmlFor="doc-topic">{t("library.topic")}</label>
            <input
              id="doc-topic"
              className="form-input"
              value={metaTopic}
              onChange={(e) => setMetaTopic(e.target.value)}
              placeholder={t("library.topicPh")}
              maxLength={120}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="form-label" htmlFor="doc-desc">{t("library.description")}</label>
            <textarea
              id="doc-desc"
              className="form-textarea"
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder={t("library.descriptionPh")}
              rows={2}
              maxLength={500}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn-primary" onClick={handleUpload}>
              {t("library.upload")}
            </button>
            <button type="button" className="btn-secondary" onClick={cancelPending}>
              {t("common.cancel")}
            </button>
          </div>
        </Panel>
      )}

      {uploadError && (
        <div style={{ marginBottom: 14 }}>
          <StateMessage kind="error" text={uploadError} />
        </div>
      )}

      {loading && <StateMessage kind="loading" text={t("library.loading")} />}
      {error && <StateMessage kind="error" text={error} />}

      {!loading && !error && (
        <Panel>
          {docs.length === 0 ? (
            <p style={{ color: "var(--text-dim)", fontSize: 13.5 }}>{t("library.empty")}</p>
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
