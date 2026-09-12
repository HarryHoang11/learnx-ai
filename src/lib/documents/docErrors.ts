// ================================================================
// ERROR MODEL THỐNG NHẤT cho document pipeline
// ================================================================
// Mạch tư duy: trước đây mọi lỗi upload/parse đều dồn về 1-2 message
// chung ("Không thể đọc nội dung file này...") nên UI không phân biệt
// nổi PDF hỏng / PDF scan / file quá lớn / lỗi AI tạm thời — học sinh
// chỉ thấy "File bị khóa" kiểu mơ hồ. Từ nay mỗi lỗi mang code + stage
// + retryable + message tiếng Việt cho user. errorMessage lưu DB có
// prefix "[CODE]" để UI suy ra nguyên nhân mà không cần đổi API.
//
// Không log nội dung tài liệu — chỉ log metadata (size, pages...).

export type DocumentStage =
  | "FILE_VALIDATION"
  | "TEXT_EXTRACTION"
  | "NORMALIZATION"
  | "CHUNKING"
  | "EMBEDDING"
  | "AI_PROCESSING"
  | "DATABASE";

export type DocumentErrorCode =
  | "FILE_UPLOAD_FAILED"
  | "FILE_EMPTY"
  | "INVALID_FILE"
  | "INVALID_PDF"
  | "PDF_CORRUPTED"
  | "PDF_ENCRYPTED"
  | "PDF_PARSE_FAILED"
  | "PDF_NO_TEXT_LAYER"
  | "OCR_UNAVAILABLE"
  | "DOCUMENT_TOO_LARGE"
  | "DOCUMENT_EMPTY"
  | "CHUNKING_FAILED"
  | "EMBEDDING_FAILED"
  | "AI_PROCESSING_FAILED";

interface ErrorSpec {
  /** Message tiếng Việt hiển thị cho user */
  userMessage: string;
  /** Gợi ý khắc phục hiển thị kèm */
  suggestion: string;
  /** Lỗi tạm thời (sự cố mạng/AI) → cho retry; lỗi dữ liệu → không */
  retryable: boolean;
  /** HTTP status route nên trả */
  httpStatus: number;
}

export const DOCUMENT_ERROR_SPECS: Record<DocumentErrorCode, ErrorSpec> = {
  FILE_UPLOAD_FAILED: {
    userMessage: "Không thể tải file lên.",
    suggestion: "Kiểm tra kết nối mạng rồi thử lại.",
    retryable: true,
    httpStatus: 500,
  },
  FILE_EMPTY: {
    userMessage: "File rỗng (0 byte).",
    suggestion: "Chọn lại file còn nguyên vẹn trên máy của bạn.",
    retryable: false,
    httpStatus: 400,
  },
  INVALID_FILE: {
    userMessage: "Định dạng file chưa được hỗ trợ.",
    suggestion: "Hiện hỗ trợ .txt, .md, .pdf, .docx, .pptx.",
    retryable: false,
    httpStatus: 400,
  },
  INVALID_PDF: {
    userMessage: "File không phải PDF hợp lệ.",
    suggestion: "File có đuôi .pdf nhưng nội dung không phải PDF — kiểm tra lại file gốc.",
    retryable: false,
    httpStatus: 400,
  },
  PDF_CORRUPTED: {
    userMessage: "File PDF bị hỏng, không đọc được.",
    suggestion: "Mở file bằng trình đọc PDF trên máy; nếu mở được, thử in lại thành PDF mới rồi upload.",
    retryable: false,
    httpStatus: 422,
  },
  PDF_ENCRYPTED: {
    userMessage: "File PDF đặt mật khẩu nên không đọc được.",
    suggestion: "Gỡ mật khẩu file PDF rồi upload lại.",
    retryable: false,
    httpStatus: 422,
  },
  PDF_PARSE_FAILED: {
    userMessage: "Không trích xuất được nội dung PDF.",
    suggestion: "Cấu trúc PDF này parser chưa hỗ trợ — thử in lại thành PDF mới rồi upload.",
    retryable: false,
    httpStatus: 422,
  },
  PDF_NO_TEXT_LAYER: {
    userMessage: "PDF không có lớp văn bản (có thể là file scan/ảnh).",
    suggestion: "File scan cần OCR — hiện LearnX chưa hỗ trợ OCR nên hãy dùng bản PDF có text.",
    retryable: false,
    httpStatus: 422,
  },
  OCR_UNAVAILABLE: {
    userMessage: "Chưa hỗ trợ OCR cho file scan.",
    suggestion: "Dùng bản PDF có text thay vì ảnh chụp/scan.",
    retryable: false,
    httpStatus: 422,
  },
  DOCUMENT_TOO_LARGE: {
    userMessage: "Tài liệu quá lớn để xử lý.",
    suggestion: "Chia nhỏ tài liệu rồi upload từng phần.",
    retryable: false,
    httpStatus: 413,
  },
  DOCUMENT_EMPTY: {
    userMessage: "Không tìm thấy nội dung nào trong file.",
    suggestion: "Kiểm tra file có nội dung text thật (không phải file trắng/scan).",
    retryable: false,
    httpStatus: 422,
  },
  CHUNKING_FAILED: {
    userMessage: "Không chia nhỏ được nội dung tài liệu.",
    suggestion: "Thử lại sau ít phút.",
    retryable: true,
    httpStatus: 500,
  },
  EMBEDDING_FAILED: {
    userMessage: "Không tạo được embedding (AI quá tải).",
    suggestion: "Đợi ít phút rồi bấm Thử lại — không cần upload lại.",
    retryable: true,
    httpStatus: 503,
  },
  AI_PROCESSING_FAILED: {
    userMessage: "AI đang quá tải, chưa tóm tắt được.",
    suggestion: "Đợi ít phút rồi bấm Thử lại — không cần upload lại.",
    retryable: true,
    httpStatus: 503,
  },
};

export class DocumentProcessingError extends Error {
  readonly code: DocumentErrorCode;
  readonly stage: DocumentStage;
  readonly retryable: boolean;
  readonly httpStatus: number;
  readonly userMessage: string;
  readonly suggestion: string;

  constructor(code: DocumentErrorCode, stage: DocumentStage, detail?: string) {
    const spec = DOCUMENT_ERROR_SPECS[code];
    super(detail ? `[${code}] ${detail}` : `[${code}] ${spec.userMessage}`);
    this.name = "DocumentProcessingError";
    this.code = code;
    this.stage = stage;
    this.retryable = spec.retryable;
    this.httpStatus = spec.httpStatus;
    this.userMessage = spec.userMessage;
    this.suggestion = spec.suggestion;
  }
}

/** Lấy code từ errorMessage đã lưu DB (định dạng "[CODE] ..."). */
export function parseErrorCode(errorMessage: string | null | undefined): DocumentErrorCode | null {
  if (!errorMessage) return null;
  const match = errorMessage.match(/^\[([A-Z_]+)\]/);
  if (!match) return null;
  const code = match[1] as DocumentErrorCode;
  return code in DOCUMENT_ERROR_SPECS ? code : null;
}

/** Bản tiếng Anh của message/suggestion theo code (UI song ngữ). */
export const DOCUMENT_ERROR_TEXT_EN: Record<DocumentErrorCode, { userMessage: string; suggestion: string }> = {
  FILE_UPLOAD_FAILED: {
    userMessage: "Could not upload the file.",
    suggestion: "Check your connection and try again.",
  },
  FILE_EMPTY: {
    userMessage: "File is empty (0 bytes).",
    suggestion: "Pick an intact file from your device.",
  },
  INVALID_FILE: {
    userMessage: "File format is not supported yet.",
    suggestion: "Supported: .txt, .md, .pdf, .docx, .pptx.",
  },
  INVALID_PDF: {
    userMessage: "File is not a valid PDF.",
    suggestion: "The .pdf extension doesn't match its content — check the original file.",
  },
  PDF_CORRUPTED: {
    userMessage: "PDF file is corrupted and unreadable.",
    suggestion: "Open it in a PDF reader; if it opens, print it to a new PDF and upload again.",
  },
  PDF_ENCRYPTED: {
    userMessage: "PDF is password-protected and unreadable.",
    suggestion: "Remove the PDF password and upload again.",
  },
  PDF_PARSE_FAILED: {
    userMessage: "Could not extract PDF content.",
    suggestion: "This PDF structure isn't supported yet — try printing it to a new PDF and uploading.",
  },
  PDF_NO_TEXT_LAYER: {
    userMessage: "PDF has no text layer (possibly a scanned file).",
    suggestion: "Scanned files need OCR — LearnX doesn't support OCR yet, so use a text-based PDF.",
  },
  OCR_UNAVAILABLE: {
    userMessage: "OCR for scanned files is not supported.",
    suggestion: "Use a text-based PDF instead of a photo/scan.",
  },
  DOCUMENT_TOO_LARGE: {
    userMessage: "Document is too large to process.",
    suggestion: "Split it into smaller parts and upload each.",
  },
  DOCUMENT_EMPTY: {
    userMessage: "No content found in the file.",
    suggestion: "Make sure the file has real text (not blank/scanned).",
  },
  CHUNKING_FAILED: {
    userMessage: "Could not split the document content.",
    suggestion: "Try again in a few minutes.",
  },
  EMBEDDING_FAILED: {
    userMessage: "Could not create embeddings (AI overloaded).",
    suggestion: "Wait a few minutes and hit Retry — no need to re-upload.",
  },
  AI_PROCESSING_FAILED: {
    userMessage: "AI is overloaded and couldn't summarize yet.",
    suggestion: "Wait a few minutes and hit Retry — no need to re-upload.",
  },
};

/** Spec hiển thị cho UI từ errorMessage DB (null-safe), theo ngôn ngữ UI. */
export function describeDocumentError(
  errorMessage: string | null | undefined,
  lang: "vi" | "en" = "vi"
): {
  userMessage: string;
  suggestion: string;
  retryable: boolean;
} {
  const code = parseErrorCode(errorMessage);
  if (!code) {
    return lang === "en"
      ? {
          userMessage: "Could not process the document.",
          suggestion: "Try again in a few minutes or re-upload the file.",
          retryable: true,
        }
      : {
          userMessage: "Không thể xử lý tài liệu.",
          suggestion: "Thử lại sau ít phút hoặc upload lại file.",
          retryable: true,
        };
  }
  const spec = DOCUMENT_ERROR_SPECS[code];
  if (lang === "en") {
    const en = DOCUMENT_ERROR_TEXT_EN[code];
    return { userMessage: en.userMessage, suggestion: en.suggestion, retryable: spec.retryable };
  }
  return { userMessage: spec.userMessage, suggestion: spec.suggestion, retryable: spec.retryable };
}

// Structured logging theo stage — chỉ metadata, KHÔNG log nội dung.
export function logDocumentStage(
  documentId: string | null,
  stage: DocumentStage,
  details: Record<string, string | number | boolean>
): void {
  console.info(`[DOCUMENT] stage=${stage} doc=${documentId ?? "n/a"} ${JSON.stringify(details)}`);
}

export function logDocumentError(
  documentId: string | null,
  stage: DocumentStage,
  err: unknown
): void {
  const code = err instanceof DocumentProcessingError ? err.code : "UNKNOWN";
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[DOCUMENT] stage=${stage} doc=${documentId ?? "n/a"} code=${code} error=${message}`);
}
