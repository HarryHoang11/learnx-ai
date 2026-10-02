// ================================================================
// TRANG TẢI TÀI LIỆU LÊN CỘNG ĐỒNG
// ================================================================

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import {
  flattenTopicOptions,
  shouldOfferGeneralTopic,
  type RawTopic,
} from "@/lib/community/topicOptions";
import type { ApiResponse } from "@/types";

const ALLOWED_TYPES = ["pdf", "docx", "doc", "pptx", "ppt", "txt", "md"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/** Số ký tự tối đa cho tiêu đề — chặn sớm ở UI, server vẫn validate lại. */
const TITLE_MAX = 200;

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

/** Lỗi hiển thị SÁT field, không gom lên đầu form. */
type FieldErrors = {
  file?: string;
  title?: string;
  subjectId?: string;
};

export default function CommunityUploadPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<any[]>([]);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);

  // KHÔNG khai báo `fileInputRef`.
  //
  // Lịch sử: bản cũ có `fileInputRef` + `<label onClick={() => ref.current?.click()}>`.
  // Vì `<label>` ĐÃ tự kích hoạt input khi bấm (chuẩn HTML), 1 cú bấm gọi
  // `click()` 2 lần ⇒ lần 2 không còn user activation ⇒ Chrome cảnh báo
  // "File chooser dialog can only be shown with a user activation".
  //
  // Bỏ `onClick` là đủ. Ref từ đó thành vô dụng — nhưng vẫn còn một dòng
  // khai báo treo lơ lửng (và từng bị khai báo TRÙNG 2 lần do chỉnh sửa chồng
  // nhau). Giữ một ref mà không đọc `.current` ở đâu là cruft sinh lại đúng loại
  // bug vừa gặp, nên đã XOÁ HẲN thay vì giữ "một declaration duy nhất".

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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  /**
   * Danh sách chủ đề của môn đang chọn, đã làm phẳng cả tầng `children`.
   *
   * Bản cũ dùng state `topics` + chỉ đọc `subject.topics`, bỏ rơi `children`
   * ⇒ các chuyên đề như "Python", "C++" (con của "Lập trình") không bao giờ
   * hiện. Suy ra từ `selectedSubject` bằng `useMemo` để không phải giữ 2 nguồn
   * sự thật (state + props) cho cùng một dữ liệu.
   */
  const topicOptions = useMemo(
    () => flattenTopicOptions(selectedSubject?.topics as RawTopic[] | undefined),
    [selectedSubject]
  );

  /** Môn chỉ có 1 topic thì ép "Tổng hợp" là vô nghĩa — xem `topicOptions.ts`. */
  const showGeneralTopic = useMemo(
    () => shouldOfferGeneralTopic(selectedSubject?.topics as RawTopic[] | undefined),
    [selectedSubject]
  );

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

  /**
   * Đổi môn học. Nhận `ChangeEvent` (không nhận `string`) cho khớp chữ ký
   * `ChangeEventHandler<HTMLSelectElement>` — bản cũ dùng `as any` để lách,
   * làm mất type-safety ở đúng chỗ quan trọng nhất.
   */
  function handleSubjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const subjectId = e.target.value;
    const subject = subjects.find((s) => s.id === subjectId);
    setSelectedSubject(subject);
    // Xoá `topicId` cũ vì nó thuộc môn trước. KHÔNG tự chọn topic đầu tiên:
    // nếu auto-select, tài liệu "Cân bằng hóa học" sẽ bị gán cứng "Hóa học
    // vô cơ" chỉ vì nó là phần tử đầu của danh sách — đúng lỗi domain mà
    // spec §7 nêu. Chọn là quyền của người dùng.
    setFormData((prev) => ({ ...prev, subjectId, topicId: "" }));
    setFieldErrors((prev) => ({ ...prev, subjectId: undefined }));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    // Bấm "Hủy" trong hộp thoại ⇒ files rỗng. Không coi đây là lỗi.
    if (!picked) return;

    if (!ALLOWED_TYPES.includes(picked.name.split(".").pop()?.toLowerCase() || "")) {
      setFieldErrors(prev => ({
        ...prev,
        file: "Định dạng file không được hỗ trợ. Chỉ chấp nhận: " + ALLOWED_TYPES.join(", "),
      }));
      return;
    }

    if (picked.size > MAX_FILE_SIZE) {
      setFieldErrors(prev => ({ ...prev, file: "File quá lớn. Kích thước tối đa 50MB." }));
      return;
    }

    setFile(picked);
    setFieldErrors(prev => ({ ...prev, file: undefined }));
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

    // Validate TẠI CHỖ field + gán lỗi cạnh ô tương ứng. `setUploadError` kiểu
    // cũ gộp hết lỗi lên đầu form khiến người dùng không biết sửa ô nào.
    const errors: FieldErrors = {};
    if (!file) errors.file = "Vui lòng chọn file.";
    if (!formData.title.trim()) errors.title = "Vui lòng nhập tiêu đề tài liệu.";
    if (!formData.subjectId) errors.subjectId = "Vui lòng chọn môn học.";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      // Đưa tiêu điểm về ô đầu tiên sai để bàn phím/mobile không phải cuộn tìm.
      const firstBad = document.getElementById("cu-file") ?? document.getElementById("cu-title");
      firstBad?.focus();
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("file", file!);
      formDataToSend.append("title", formData.title.trim());
      if (formData.description) formDataToSend.append("description", formData.description);
      formDataToSend.append("subjectId", formData.subjectId);
      // topicId rỗng => KHÔNG gửi. Server lưu `undefined` (xem
      // community-document.service.ts) ⇒ tài liệu đa lĩnh vực không bị gán
      // nhầm một chủ đề vô nghĩa.
      if (formData.topicId) formDataToSend.append("topicId", formData.topicId);
      if (formData.difficulty) formDataToSend.append("difficulty", formData.difficulty);
      if (formData.language) formDataToSend.append("language", formData.language);
      if (formData.grade.trim()) formDataToSend.append("grade", formData.grade.trim());
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
        // Cố ý KHÔNG reset form: người dùng giữ nguyên mọi thứ đã nhập để sửa
        // rồi bấm lại (spec §3 "Error").
        return;
      }

      setUploadSuccess(true);
      setUploadedDocId(result.data.documentId);
      setUploadError(null);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Không thể upload tài liệu"
      );
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
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--cyan)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--on-accent)", fontSize: 24, fontWeight: 700 }}>✓</div>
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
            {/* Vùng chọn file — mở picker bằng CƠ CHẾ NATIVE của `<label>`,
                  không dùng JS.

                  `<label>` bao `<input type="file">` thì bấm vào label sẽ kích
                  hoạt input, và vì chạy NGAY trong event của người dùng nên
                  luôn giữ user activation.

                  Trước đây ở đây có thêm
                  `onClick={() => fileInputRef.current?.click()}` ⇒ 1 cú bấm mở
                  dialog 2 lần, lần 2 không còn activation ⇒ Chrome cảnh báo
                  "File chooser dialog can only be shown with a user activation".
                  Đã bỏ `onClick`; xem note ở phần khai báo state.

                  GIỮ NGUYÊN: validation (định dạng + 50MB trong
                  `handleFileChange`), preview tên/dung lượng, loading state,
                  error state. Chỉ sửa cách mở file picker. */}
            <label
              style={{
                display: "block",
                border: uploading ? "2px dashed var(--cyan)" : "2px dashed var(--border)",
                borderRadius: 12,
                padding: 40,
                textAlign: "center",
                cursor: uploading ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
                background: uploading ? "var(--cyan-soft)" : "var(--panel)",
              }}
            >
              <input
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

          {/* Thông tin tài liệu.

              SỬA (spec §5, §6, §11, §15, §16):
              - Bỏ toàn bộ inline style, dùng class dùng chung `.form-*` như
                Login/Review/Onboarding → đồng bộ design system.
              - Mọi `<select>` bọc `.form-select-wrap` + icon ChevronDown →
                không còn để mỗi OS tự vẽ mũi tên khác nhau.
              - `id`/`htmlFor` liên kết thật label ↔ control (trước đây
                `<label>` không `htmlFor`, không nhấn được vào ô).
              - Lỗi hiện ngay dưới ô + `aria-invalid`/`aria-describedby`. */}
          <Panel>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>📝 Thông tin tài liệu</div>

            {/* `grid-form-2col` có sẵn trong globals.css: 1 cột ở mobile,
                2 cột từ tablet — không hardcode grid ở đây. */}
            <div className="grid-form-2col">
              <div>
                <label className="form-label" htmlFor="cu-title">
                  Tiêu đề<span className="form-req">*</span>
                  <span className="form-label-counter">
                    {formData.title.length}/{TITLE_MAX}
                  </span>
                </label>
                <input
                  id="cu-title"
                  className="form-input"
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="Tiêu đề tài liệu"
                  maxLength={TITLE_MAX}
                  aria-invalid={!!fieldErrors.title}
                  aria-describedby={fieldErrors.title ? "cu-title-err" : undefined}
                />
                {fieldErrors.title && (
                  <p className="form-error" id="cu-title-err" role="alert">
                    {fieldErrors.title}
                  </p>
                )}
              </div>

              <div>
                <label className="form-label" htmlFor="cu-subject">
                  Môn học<span className="form-req">*</span>
                </label>
                <span className="form-select-wrap">
                  <select
                    id="cu-subject"
                    className="form-select"
                    name="subjectId"
                    value={formData.subjectId}
                    onChange={handleSubjectChange}
                    disabled={loadingSubjects}
                    aria-invalid={!!fieldErrors.subjectId}
                    aria-describedby={fieldErrors.subjectId ? "cu-subject-err" : undefined}
                  >
                    <option value="">
                      {loadingSubjects ? "Đang tải môn học..." : "Chọn môn học"}
                    </option>
                    {!loadingSubjects &&
                      subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.icon} {s.name}
                        </option>
                      ))}
                  </select>
                  <ChevronDown className="form-select-caret" size={16} aria-hidden="true" />
                </span>
                {fieldErrors.subjectId && (
                  <p className="form-error" id="cu-subject-err" role="alert">
                    {fieldErrors.subjectId}
                  </p>
                )}
                {subjectsError && <p className="form-error">{subjectsError}</p>}
              </div>
            </div>

            <div className="grid-form-2col">
              {/* Chủ đề — spec §7/§8/§9: danh sách lấy từ taxonomy thật (kể cả
                  tầng `children`), KHÔNG tự chọn sẵn, và mốc rỗng = "Tổng hợp"
                  cho tài liệu đa lĩnh vực. */}
              <div>
                <label className="form-label" htmlFor="cu-topic">
                  Chủ đề
                </label>
                <span className="form-select-wrap">
                  <select
                    id="cu-topic"
                    className="form-select"
                    name="topicId"
                    value={formData.topicId}
                    onChange={handleInputChange}
                    disabled={!topicOptions.length}
                  >
                    <option value="">
                      {!formData.subjectId
                        ? "Chọn môn học trước"
                        : topicOptions.length
                          ? "Tổng hợp (nhiều chủ đề)"
                          : "Môn này chưa có chủ đề"}
                    </option>
                    {topicOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="form-select-caret" size={16} aria-hidden="true" />
                </span>
                {showGeneralTopic && !formData.topicId && (
                  <p className="form-hint">
                    Tài liệu trải qua nhiều mảng? Để trống là coi như “Tổng hợp”.
                  </p>
                )}
              </div>

              <div>
                <label className="form-label" htmlFor="cu-difficulty">
                  Độ khó
                </label>
                <span className="form-select-wrap">
                  <select
                    id="cu-difficulty"
                    className="form-select"
                    name="difficulty"
                    value={formData.difficulty}
                    onChange={handleInputChange}
                  >
                    {DIFFICULTY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="form-select-caret" size={16} aria-hidden="true" />
                </span>
              </div>
            </div>

            <div className="grid-form-2col">
              <div>
                <label className="form-label" htmlFor="cu-language">
                  Ngôn ngữ
                </label>
                <span className="form-select-wrap">
                  <select
                    id="cu-language"
                    className="form-select"
                    name="language"
                    value={formData.language}
                    onChange={handleInputChange}
                  >
                    {LANGUAGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="form-select-caret" size={16} aria-hidden="true" />
                </span>
              </div>

              {/* Khối/Lớp — spec §12: TUỲ CHỌN, không hardcode "11", không tự
                  điền từ profile (vẫn gõ tay được, chỉ gợi ý bằng
                  placeholder). `.form-input` khai báo `height` + `line-height`
                  nên khớp đúng `.form-select` cùng hàng — trước đây lệch dọc
                  vì inline style không có 2 thuộc tính đó. */}
              <div>
                <label className="form-label" htmlFor="cu-grade">
                  Khối/Lớp
                </label>
                <input
                  id="cu-grade"
                  className="form-input"
                  type="text"
                  name="grade"
                  value={formData.grade}
                  onChange={handleInputChange}
                  placeholder="VD: 10, 11, 12, ĐH…"
                />
              </div>
            </div>

            <div>
              <label className="form-label" htmlFor="cu-desc">
                Mô tả
              </label>
              {/* `data-gramm="false"` + `spellCheck={false}` (spec §2):
                  Grammarly extension cắm icon vào góc dưới phải textarea và
                  che mất phần text vừa gõ.

                  KHÔNG dùng CSS/div trắng để che — chính overlay đó cũng bị che
                  và cách đó chỉ "giấu" triệu chứng. Cách đúng là yêu cầu
                  extension không chèn ở field này.

                  `spellCheck={false}` hợp lý vì nội dung là tiếng Việt + thuật
                  ngữ học thuật, gạch đỏ chỉ gây nhiễu. KHÔNG tắt ở các ô
                  tiếng Anh khác của app. */}
              <textarea
                id="cu-desc"
                className="form-textarea"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                maxLength={2000}
                placeholder="Mô tả ngắn gọn nội dung tài liệu…"
                spellCheck={false}
                data-gramm="false"
                data-gramm_editor="false"
                data-enable-grammarly="false"
              />
              <p className="form-hint">Không bắt buộc · tối đa 2000 ký tự</p>
            </div>

            <div>
              <label className="form-label" htmlFor="cu-tags">
                Tags
              </label>
              <input
                id="cu-tags"
                className="form-input"
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleTagsChange}
                placeholder="dynamic programming, algorithm, dp"
              />
              {/* Báo rõ sẽ gửi gì: số tag sau khi bỏ trùng/khoảng trắng thừa
                  (spec §14) — thay vì bắt người dùng tự đếm. */}
              <p className="form-hint">{tagSummary(formData.tags)}</p>
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

          {/* Lỗi submit/API: hiện 1 khối ngay trên footer để người dùng thấy
              ngay sau khi bấm, nhưng dữ liệu form ĐÃ NHẬP vẫn giữ nguyên để
              sửa rồi bấm lại (spec §3 "Error"). */}
          {uploadError && (
            <p className="form-error form-error--global" role="alert">
              {uploadError}
            </p>
          )}

          {/* Footer hành động — spec §3/§4.
              `form-actions`: desktop 2 nút căn phải · mobile 2 nút đều nhau,
              cao ≥44px (MOBILE.md). `form-actions--stack-primary` đưa nút
              chính lên hàng trên ở mobile để ngón cái bấm được dễ hơn. */}
          <div className="form-actions form-actions--stack-primary">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => router.push("/community")}
              disabled={uploading}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={uploading || loadingSubjects || !file}
              aria-busy={uploading}
            >
              {uploading ? "Đang tải lên…" : "📤 Tải lên Cộng đồng"}
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

/**
 * Tóm tắt trạng thái ô Tags (spec §14).
 *
 * Hiển thị đúng những gì sẽ được gửi đi: đã cắt khoảng trắng, bỏ rỗng, bỏ
 * trùng (không phân biệt hoa/thường) — vì `handleTagsChange` gửi chuỗi thô
 * xuống server, nên người dùng cần biết server sẽ thấy bao nhiêu tag.
 */
function tagSummary(raw: string): string {
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const t = part.trim();
    if (t) seen.add(t.toLowerCase());
  }
  const n = seen.size;
  if (n === 0) return "Không bắt buộc · cách nhau bằng dấu phẩy";
  return `${n} tag sẽ được gửi${n === 1 ? "" : "s"}`;
}
