// ================================================================
// TRÍCH XUẤT TEXT THẬT từ mọi định dạng file được phép upload
// ================================================================
// Mạch tư duy: pipeline KHÔNG chạm filesystem (bytes đi FormData ->
// Buffer -> DB), nên không có chuyện "file bị khóa" ở đây — các lỗi
// PDF thực tế là: file hỏng/mã hoá, PDF scan không text layer, file
// giả mạo đuôi .pdf, file quá lớn. File này xử lý TẤT CẢ các case đó
// với error code rõ ràng (docErrors.ts), thay vì message chung chung.
//
// Mỗi định dạng là một "container" khác nhau, cần extractor riêng:
//   - .txt/.md   : text thuần, đọc trực tiếp UTF-8.
//   - .pdf       : `pdf-parse`, thu text THEO TỪNG TRANG (pagerender)
//                  để chunk giữ được pageNumber.
//   - .docx      : `mammoth` (đọc XML trong file .zip).
//   - .pptx      : tự giải nén bằng `jszip` + regex thẻ <a:t>.
//   - ảnh        : CHƯA hỗ trợ — cần OCR (xem attemptOcrPdfText()).
//
// Markdown KHÔNG phải bước bắt buộc: output của file này là TEXT
// THUẦN đã normalize — bước tóm tắt/summary phía sau có fail cũng
// không làm mất text/chunk đã xử lý (xem document.service.ts).
// ================================================================

import mammoth from "mammoth";
import JSZip from "jszip";
import {
  DocumentProcessingError,
  type DocumentErrorCode,
} from "./docErrors";

// --- Giới hạn chống file lớn làm sập server / tốn phí AI ---
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
export const MAX_PDF_PAGES = 150;
export const MAX_EXTRACTED_CHARS = 400_000;

export interface PdfPage {
  pageNumber: number;
  text: string;
}

export interface ExtractionResult {
  /** Toàn văn đã normalize (nối các trang) */
  text: string;
  /** Text theo trang — chỉ có với PDF */
  pages: PdfPage[] | null;
  pageCount: number | null;
}

export class UnsupportedFileTypeError extends DocumentProcessingError {
  constructor(detail?: string) {
    super("INVALID_FILE", "FILE_VALIDATION", detail);
    this.name = "UnsupportedFileTypeError";
  }
}

/** Kiểm tra magic bytes PDF (%PDF-) — không tin đuôi file/MIME client. */
export function hasPdfSignature(buffer: Buffer): boolean {
  return (
    buffer.length >= 5 &&
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 && // F
    buffer[4] === 0x2d // -
  );
}

function classifyPdfFailure(err: unknown): DocumentErrorCode {
  const message = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : "";
  const lower = `${name} ${message}`.toLowerCase();
  if (
    lower.includes("password") ||
    lower.includes("encrypted") ||
    lower.includes("decrypt") ||
    lower.includes("needpassword") ||
    lower.includes("incorrectpassword")
  ) {
    return "PDF_ENCRYPTED";
  }
  if (
    lower.includes("invalid pdf") ||
    lower.includes("xref") ||
    lower.includes("trailer") ||
    lower.includes("corrupt") ||
    lower.includes("malformed") ||
    lower.includes("unexpected eof") ||
    lower.includes("end of file") ||
    lower.includes("bad") && lower.includes("header")
  ) {
    return "PDF_CORRUPTED";
  }
  return "PDF_PARSE_FAILED";
}

function strategyErrorMessage(strategy: string, err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return `${strategy}: ${message}`;
}

async function extractPdfPages(buffer: Buffer): Promise<{ pages: PdfPage[]; pageCount: number }> {
  // Strategy A: pdf-parse (nhẹ, đủ với đa số PDF xuất từ Word/print).
  try {
    return await extractPdfPagesViaPdfParse(buffer);
  } catch (errA) {
    // Strategy B: pdfjs-dist hiện đại — xử lý được xref stream nén,
    // object stream... mà pdf-parse 1.1.1 (pdf.js cũ) bó tay ("bad XRef
    // entry"...). Đây là fallback, không phải parser thứ hai chạy song
    // song — chỉ tốn chi phí khi A đã fail.
    try {
      return await extractPdfPagesViaPdfJs(buffer);
    } catch (errB) {
      const message = `${strategyErrorMessage("A", errA)} | ${strategyErrorMessage("B", errB)}`;
      throw new DocumentProcessingError(classifyPdfFailure(errB), "TEXT_EXTRACTION", message);
    }
  }
}

async function extractPdfPagesViaPdfParse(buffer: Buffer): Promise<{ pages: PdfPage[]; pageCount: number }> {
  // Import THẲNG implementation (lib/pdf-parse.js), bỏ qua index.js —
  // index.js của pdf-parse chứa đoạn debug-mode tự đọc file mẫu nội bộ
  // (Fs.readFileSync './test/data/05-versions-space.pdf') khi bundle
  // khiến module.parent undefined -> ENOENT. Lỗi đã biết của pdf-parse
  // + bundler, không phải bug code này.
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default as (
    data: Buffer,
    options?: Record<string, unknown>
  ) => Promise<{ text: string; numpages: number }>;

  const pageTexts = new Map<number, string[]>();
  let fallbackCounter = 0;

  // pagerender thu text từng trang (thay vì chỉ nhận text nối sẵn) để
  // chunk giữ pageNumber. PDF.js page object có pageNumber; nếu thiếu
  // (bản pdfjs khác) thì đếm tăng dần theo thứ tự gọi.
  const pagerender = async (pageData: {
    pageNumber?: number;
    getTextContent: () => Promise<{ items: { str?: string }[] }>;
  }): Promise<string> => {
    const pageNumber = pageData.pageNumber ?? ++fallbackCounter;
    if (pageData.pageNumber === undefined) fallbackCounter = Math.max(fallbackCounter, pageNumber);
    const content = await pageData.getTextContent();
    const strings = content.items.map((item) => item.str ?? "").filter((s) => s !== "");
    const pageText = strings.join(" ");
    if (!pageTexts.has(pageNumber)) pageTexts.set(pageNumber, []);
    pageTexts.get(pageNumber)!.push(pageText);
    return pageText;
  };

  let data: { text: string; numpages: number };
  // Lỗi pdf-parse để nguyên (Error thô) — tầng gọi
  // (extractTextFromBuffer) phân loại thành code cụ thể.
  data = await pdfParse(buffer, { pagerender, max: MAX_PDF_PAGES });

  // pagerender có thể không được gọi với vài PDF rỗng — dựng pages từ
  // những gì thu được, còn lại suy từ text nối.
  const pages: PdfPage[] = [...pageTexts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pageNumber, parts]) => ({ pageNumber, text: parts.join(" ").trim() }));

  if (pages.length === 0 && data.text.trim() !== "") {
    pages.push({ pageNumber: 1, text: data.text.trim() });
  }

  return { pages, pageCount: data.numpages };
}

// Strategy B: pdf.js hiện đại (pdfjs-dist) — đọc trực tiếp từng trang,
// nối item theo hasEOL để giữ xuống dòng (bảng/bullet đỡ dính nhau).
// Dynamic import để không nạp engine nặng khi upload file không phải PDF.
async function extractPdfPagesViaPdfJs(buffer: Buffer): Promise<{ pages: PdfPage[]; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  try {
    const pageCount = pdf.numPages;
    const limit = Math.min(pageCount, MAX_PDF_PAGES);
    const pages: PdfPage[] = [];
    for (let pageNumber = 1; pageNumber <= limit; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      try {
        const content = await page.getTextContent();
        let text = "";
        for (const item of content.items) {
          if (typeof item !== "object" || item === null || !("str" in item)) continue;
          const str = (item as { str?: string }).str ?? "";
          const hasEOL = (item as { hasEOL?: boolean }).hasEOL === true;
          text += str + (hasEOL ? "\n" : " ");
        }
        pages.push({ pageNumber, text: text.trim() });
      } finally {
        page.cleanup();
      }
    }
    return { pages, pageCount };
  } finally {
    // Giải phóng handle parser — KHÔNG để giữ tài nguyên sau khi xong.
    const doc = pdf as unknown as { cleanup?: () => Promise<void>; destroy?: () => Promise<void> };
    if (typeof doc.destroy === "function") await doc.destroy();
    else if (typeof doc.cleanup === "function") await doc.cleanup();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);

  // Mỗi slide 1 file "ppt/slides/slide{N}.xml" — sắp theo số N để giữ
  // đúng thứ tự, không sort chuỗi (slide10 đứng trước slide2).
  const slideFileNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
      const numB = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
      return numA - numB;
    });

  if (slideFileNames.length === 0) {
    throw new DocumentProcessingError("PDF_PARSE_FAILED", "TEXT_EXTRACTION", "File PPTX không chứa slide nào.");
  }

  const slideTexts: string[] = [];
  for (const fileName of slideFileNames) {
    const xml = await zip.files[fileName].async("string");
    // Thẻ <a:t> chứa text hiển thị — regex đủ dùng cho mục đích tóm
    // tắt (không cần giữ layout/vị trí).
    const matches = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    slideTexts.push(matches.join(" "));
  }
  return slideTexts.join("\n\n");
}

// Chuẩn hoá text trích xuất — ƯU TIÊN GIỮ ĐÚNG NỘI DUNG hơn format đẹp:
//   - NFC: gộp ký tự tổ hợp (e + ́) thành ký tự dựng sẵn (ế) — BẮT
//     BUỘC cho tiếng Việt, nếu không dấu sẽ vỡ/rời khi hiển thị.
//   - Xoá ký tự điều khiển (null byte gây crash Postgres 22021).
//   - KHÔNG đụng tới ký tự toán (√ ∑ ∫ α...), heading, bullet, bảng.
export function normalizeExtractedText(raw: string): string {
  const composed = raw.normalize("NFC");
  // eslint-disable-next-line no-control-regex -- cố ý match ký tự điều khiển để loại bỏ
  const noControls = composed.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  return noControls
    .split("\n")
    .map((line) => line.replace(/[ \t\u00A0]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * OCR fallback — CHƯA implement (project chưa có package OCR).
 * Giữ đúng "vị trí cắm" trong pipeline: khi PDF không có text layer,
 * route/service gọi hàm này; hiện tại luôn trả OCR_UNAVAILABLE với
 * hướng dẫn rõ ràng thay vì fail câm.
 *
 * Đề xuất khi cần OCR thật: `tesseract.js` (+ `@tesseract.js/lang-vie`
 * cho tiếng Việt) — chạy được trên Node.js/Windows, không cần binary
 * ngoài; nhược điểm là nặng (~10MB+ model tải runtime) và chậm với
 * PDF nhiều trang — nên chỉ bật theo opt-in từng document.
 */
export async function attemptOcrPdfText(): Promise<never> {
  throw new DocumentProcessingError(
    "OCR_UNAVAILABLE",
    "TEXT_EXTRACTION",
    "PDF không có lớp văn bản và OCR chưa được bật."
  );
}

/**
 * Trích xuất text từ BUFFER (bytes đến từ upload FormData hoặc fileData
 * trong DB khi retry). Ném DocumentProcessingError có code/stage cụ thể
 * — route gọi PHẢI map code -> HTTP status + message (xem specs trong
 * docErrors.ts), không được nuốt thành "Something went wrong".
 */
export async function extractTextFromBuffer(buffer: Buffer, fileType: string): Promise<ExtractionResult> {
  if (!buffer || buffer.length === 0) {
    throw new DocumentProcessingError("FILE_EMPTY", "FILE_VALIDATION");
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new DocumentProcessingError(
      "DOCUMENT_TOO_LARGE",
      "FILE_VALIDATION",
      `File ${(buffer.length / 1024 / 1024).toFixed(1)}MB vượt giới hạn ${MAX_UPLOAD_BYTES / 1024 / 1024}MB.`
    );
  }

  switch (fileType) {
    case "txt":
    case "md":
      return { text: normalizeExtractedText(buffer.toString("utf-8")), pages: null, pageCount: null };
    case "docx": {
      let raw: string;
      try {
        raw = await extractDocxText(buffer);
      } catch (err) {
        throw new DocumentProcessingError("PDF_PARSE_FAILED", "TEXT_EXTRACTION", err instanceof Error ? err.message : String(err));
      }
      return { text: normalizeExtractedText(raw), pages: null, pageCount: null };
    }
    case "pptx": {
      // Lỗi cấu trúc zip/slide đã ném DocumentProcessingError sẵn.
      const raw = await extractPptxText(buffer);
      return { text: normalizeExtractedText(raw), pages: null, pageCount: null };
    }
    case "pdf": {
      if (!hasPdfSignature(buffer)) {
        throw new DocumentProcessingError("INVALID_PDF", "FILE_VALIDATION", "Thiếu magic bytes %PDF-.");
      }
      let pages: PdfPage[];
      let pageCount: number;
      try {
        ({ pages, pageCount } = await extractPdfPages(buffer));
      } catch (err) {
        // extractPdfPages đã thử cả 2 strategy và ném
        // DocumentProcessingError có code cụ thể — giữ nguyên.
        if (err instanceof DocumentProcessingError) throw err;
        throw new DocumentProcessingError(classifyPdfFailure(err), "TEXT_EXTRACTION", err instanceof Error ? err.message : String(err));
      }
      if (pageCount > MAX_PDF_PAGES) {
        throw new DocumentProcessingError(
          "DOCUMENT_TOO_LARGE",
          "FILE_VALIDATION",
          `PDF có ${pageCount} trang, vượt giới hạn ${MAX_PDF_PAGES} trang.`
        );
      }
      const normalizedPages = pages.map((p) => ({ ...p, text: normalizeExtractedText(p.text) }));
      const joined = normalizedPages.map((p) => p.text).filter((t) => t !== "").join("\n\n");
      if (joined === "") {
        // MỌI trang đều không có chữ nhưng file đọc được bình thường ->
        // gần như chắc chắn là PDF scan/ảnh. Phân biệt RÕ với "file
        // hỏng" (đã throw ở trên). Tài liệu ngắn nhưng có chữ THẬT vẫn
        // đi tiếp bình thường — không dùng ngưỡng độ dài để tránh fail
        // nhầm tài liệu 1 trang hợp lệ.
        await attemptOcrPdfText();
      }
      return { text: joined, pages: normalizedPages, pageCount };
    }
    default:
      throw new UnsupportedFileTypeError(
        `Định dạng "${fileType}" chưa được hỗ trợ (hiện hỗ trợ: .txt, .md, .pdf, .docx, .pptx).`
      );
  }
}

/**
 * Trích xuất text từ File trình duyệt (lớp mỏng: File -> Buffer).
 */
export async function extractText(file: File, fileType: string): Promise<ExtractionResult> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return extractTextFromBuffer(buffer, fileType);
}
