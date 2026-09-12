// ================================================================
// TRANG TẢI TÀI LIỆU LÊN CỘNG ĐỒNG
// ================================================================

"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import type { ApiResponse } from "@/types";

const ALLOWED_TYPES = ["pdf", "docx", "doc", "pptx", "ppt", "txt", "md"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Dễ" },
  { value: "medium", label: "Trung bình" },
  { value: "hard", label: "Khó" },
];

const LANGUAGE_OPTIONS = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
  { value: "other", label: "Khác" },
];

const VISIBILITY_OPTIONS = [
  { value: "COMMUNITY", label: "Cộng đồng (public)" },
  { value: "PRIVATE", label: "Riêng tư (chỉ mình tôi)" },
];

const REPORT_REASONS = [
  { value: "WRONG_INFO", label: "Sai thông tin" },
  { value: "SPAM", label: "Spam" },
  { value: "DUPLICATE", label: "Trùng lặp" },
  { value: "MISLEADING", label: "Gây hiểu lầm" },
  { value: "INAPPROPRIATE", label: "Nội dung không phù hợp" },
  { value: "COPYRIGHT", label: "Vi phạm bản quyền" },
  { value: "WRONG_SUBJECT", label: "Sai môn học/chủ đề" },
  { value: "OTHER", label: "Khác" },
];

export default function CommunityUploadPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    subjectId: "",
    topicId: "",
    difficulty: "medium",
    language: "vi",
    grade: "",
    tags: "",
    visibility: "COMMUNITY",
  });

  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  useEffect(() => {
    loadSubjects();
  }, []);

  async function loadSubjects() {
    try {
      setLoadingSubjects(true);
      const res = await fetch("/api/community/subjects?includeTopics=true");
      const json = await res.json();
      if (json.success) setSubjects(json.data);
      else setSubjectsError(json.error);
    } catch {
      setSubjectsError("Không thể kết nối tới máy chủ");
    } finally {
      setLoadingSubjects(false);
    }
  }

  function handleSubjectChange(subjectId: string) {
    const subject = subjects.find(s => s.id === subjectId);
    setSelectedSubject(subject);
    setFormData(prev => ({ ...prev, subjectId, topicId: "" }));
    if (subject) setTopics(subject.topics || []);
    else setTopics([]);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.name.split(".").pop()?.toLowerCase() || "")) {
      setUploadError("Định dạng file không được hỗ trợ. Chỉ chấp nhận: " + ALLOWED_TYPES.join(", "));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setUploadError("File quá lớn. Kích thước tối đa 50MB.");
      return;
    }

    setFile(file);
    setUploadError(null);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setUploadError(null);
  }

  function handleTagsChange(e: React.ChangeEvent<HTMLInputElement>) {
    const tags = e.target.value.split(",").map(t => t.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, tags: tags.join(", ") }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUploadError(null);

    if (!file) {
      setUploadError("Vui lòng chọn file");
      return;
    }

    if (!formData.title.trim()) {
      setUploadError("Vui lòng nhập tiêu đề tài liệu");
      return;
    }

    if (!formData.subjectId) {
      setUploadError("Vui lòng chọn môn học");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("file", file);
      formDataToSend.append("title", formData.title);
      if (formData.description) formDataToSend.append("description", formData.description);
      formDataToSend.append("subjectId", formData.subjectId);
      if (formData.topicId) formDataToSend.append("topicId", formData.topicId);
      if (formData.difficulty) formDataToSend.append("difficulty", formData.difficulty);
      if (formData.language) formDataToSend.append("language", formData.language);
      if (formData.grade) formDataToSend.append("grade", formData.grade);
      if (formData.tags) formDataToSend.append("tags", formData.tags);
      if (formData.visibility) formDataToSend.append("visibility", formData.visibility);

      const res = await fetch("/api/community/documents", {
        method: "POST",
        body: formDataToSend,
      });
      const result = await res.json();

      if (!result.success) {
        if (result.data?.isDuplicate) {
          setUploadError("File này đã được tải lên gần đây. Vui lòng không tải trùng lặp.");
        } else {
          setUploadError(result.error || "Không thể tải lên tài liệu");
        }
        return;
      }

      setUploadSuccess(true);
      setUploadedDocId(result.data.documentId);
      setUploadError(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Không thể upload tài liệu");
    } finally {
      setUploading(false);
    }
  }

  async function getCurrentUserIdFromCookie(): Promise<string> {
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      return data?.user?.id || "";
    } catch {
      return "";
    }
  }

  return (
    <section style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 8 }}>Tải tài liệu lên Cộng đồng</h1>
        <p style={{ color: "var(--text-dim)", fontSize: 15 }}>Chia sẻ kiến thức, giúp cộng đồng học tập tốt hơn</p>
      </div>

      {uploadSuccess && uploadedDocId && (
        <>
          <Panel style={{ marginBottom: 24, borderColor: "var(--cyan)", background: "var(--cyan-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--cyan)", display: "flex", alignItems: "center", justifyContent: "center", color: "#0a0e16", fontSize: 24, fontWeight: 700 }}>✓</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>Tải lên thành công!</div>
                <div style={{ color: "var(--text-dim)", marginTop: 4 }}>Tài liệu của bạn đang được xử lý. AI sẽ tạo tóm tắt và đánh giá chất lượng.</div>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
                <button className="btn-primary" onClick={() => router.push(`/community/documents/${uploadedDocId}`)}>
                  Xem tài liệu
                </button>
                <button className="btn-secondary" onClick={() => router.push("/community")}>
                  Về Cộng đồng
                </button>
                <button className="btn-secondary" onClick={() => { setUploadSuccess(false); setFile(null); setFormData({ title: "", description: "", subjectId: "", topicId: "", difficulty: "medium", language: "vi", grade: "", tags: "", visibility: "COMMUNITY" }); }}>
                  Tải thêm
                </button>
              </div>
            </div>
          </Panel>
        </>
      )}

      {!uploadSuccess && (
        <>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* File Upload */}
          <Panel>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>📁 Chọn file</div>
            <label
              style={{
                display: "block",
                border: uploading ? "2px dashed var(--cyan)" : "2px dashed var(--border)",
                borderRadius: 12,
                padding: 40,
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.15s ease",
                background: uploading ? "var(--cyan-soft)" : "var(--panel)",
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept={ALLOWED_TYPES.map(t => "." + t).join(",")}
                style={{ display: "none" }}
                disabled={uploading}
              />
              {file ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ fontSize: 32 }}>📄</div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{file.name}</div>
                    <div style={{ color: "var(--text-dim)", fontSize: 13 }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 36 }}>⬆️</div>
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontWeight: 500 }}>Kéo thả file vào đây hoặc bấm để chọn</div>
                    <div style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 4 }}>
                      Hỗ trợ: PDF, DOCX, PPTX, TXT, MD • Tối đa 50MB
                    </div>
                  </div>
                </>
              )}
            </label>
            {uploadError && <div style={{ color: "var(--rose)", fontSize: 13, marginTop: 8 }}>{uploadError}</div>}
          </Panel>

          {/* Form Fields */}
          <Panel>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>📝 Thông tin tài liệu</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Tiêu đề *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Tiêu đề tài liệu"
                  style={{ width: "100%", padding: "10px 12px", background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14 }}
                  required
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Môn học *</label>
                <select
                  name="subjectId"
                  value={formData.subjectId}
                  onChange={e => { handleSubjectChange(e.target.value); handleInputChange({ target: { name: "subjectId", value: e.target.value } } as any); }}
                  style={{ width: "100%", padding: "10px 12px", background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14 }}
                  disabled={loadingSubjects}
                >
                  <option value="">{loadingSubjects ? "Đang tải môn học..." : "Chọn môn học"}</option>
                  {!loadingSubjects && subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                </select>
                {subjectsError && <p style={{ color: "var(--rose)", fontSize: 12, marginTop: 4 }}>{subjectsError}</p>}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Chủ đề</label>
                <select
                  name="topicId"
                  value={formData.topicId}
                  onChange={handleInputChange}
                  style={{ width: "100%", padding: "10px 12px", background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14 }}
                  disabled={!topics.length}
                >
                  <option value="">Chọn chủ đề (tùy chọn)</option>
                  {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Độ khó</label>
                <select
                  name="difficulty"
                  value={formData.difficulty}
                  onChange={handleInputChange}
                  style={{ width: "100%", padding: "10px 12px", background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14 }}
                >
                  {DIFFICULTY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Ngôn ngữ</label>
                <select
                  name="language"
                  value={formData.language}
                  onChange={handleInputChange}
                  style={{ width: "100%", padding: "10px 12px", background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14 }}
                >
                  {LANGUAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Khối/Lớp (tùy chọn)</label>
                <input
                  type="text"
                  name="grade"
                  value={formData.grade}
                  onChange={handleInputChange}
                  placeholder="Ví dụ: 10, 11, 12, ĐH, Cao đẳng..."
                  style={{ width: "100%", padding: "10px 12px", background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14 }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Mô tả (tùy chọn)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                placeholder="Mô tả ngắn gọn nội dung tài liệu..."
                style={{ width: "100%", padding: "10px 12px", background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14, fontFamily: "inherit", resize: "vertical" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6 }}>Tags (cách nhau bằng dấu phẩy)</label>
              <input
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleTagsChange}
                placeholder="Ví dụ: dynamic programming, algorithm, dp, knapsack"
                style={{ width: "100%", padding: "10px 12px", background: "var(--panel-strong)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontSize: 14 }}
              />
            </div>
          </Panel>

          {/* Visibility & Settings */}
          <Panel>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>🔒 Cài đặt hiển thị</div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Chế độ hiển thị</label>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {VISIBILITY_OPTIONS.map(opt => (
                  <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", border: `2px solid ${formData.visibility === opt.value ? "var(--indigo)" : "var(--border)"}`, borderRadius: 10, background: formData.visibility === opt.value ? "var(--indigo-soft)" : "var(--panel)", cursor: "pointer", transition: "all 0.15s" }}>
                    <input
                      type="radio"
                      name="visibility"
                      value={opt.value}
                      checked={formData.visibility === opt.value}
                      onChange={handleInputChange}
                      style={{ accentColor: "var(--indigo)" }}
                    />
                    <span style={{ fontWeight: 500 }}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </Panel>

          {/* Submit */}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <button type="button" className="btn-secondary" onClick={() => router.push("/community")} disabled={uploading}>
              Hủy
            </button>
            <button type="submit" className="btn-primary" disabled={uploading} style={{ padding: "12px 24px", fontSize: 14.5 }}>
              {uploading ? "Đang tải lên..." : "📤 Tải lên Cộng đồng"}
            </button>
          </div>
        </form>
        </>
      )}
    </section>
  );
}

function formatNumber(num: number) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}