// ================================================================
// TRÍCH XUẤT TEXT THẬT từ mọi định dạng file được phép upload
// ================================================================
// Mạch tư duy: đây là bản NÂNG CẤP thay thế cho giới hạn tạm thời
// trước đó (chỉ chấp nhận .txt/.md). Mỗi định dạng file là một
// "container" khác nhau, cần thư viện chuyên biệt để lấy đúng text
// thật bên trong — KHÔNG thể dùng chung 1 cách đọc (đó chính là lý do
// gây lỗi null byte trước đây: gọi file.text() trên file nhị phân).
//   - .txt/.md   : chính là text thuần, đọc trực tiếp.
//   - .pdf       : dùng `pdf-parse` (đọc cấu trúc PDF, lấy text từng trang).
//   - .docx      : dùng `mammoth` (đọc XML bên trong file .docx, vốn
//                  thực chất là 1 file .zip chứa nhiều XML).
//   - .pptx      : PPTX cũng là .zip chứa XML (mỗi slide 1 file
//                  ppt/slides/slideN.xml). Không có thư viện phổ biến
//                  nào đơn giản như mammoth cho pptx, nên tự giải nén
//                  bằng `jszip` + lấy text bằng regex khớp thẻ <a:t>
//                  (thẻ XML chứa text hiển thị trong PowerPoint) — đủ
//                  tốt cho mục đích tóm tắt, dù không giữ được layout.
//   - ảnh (.png/.jpg/.webp): CHƯA hỗ trợ — cần OCR (vd Google Vision,
//                  Tesseract), nằm ngoài phạm vi bản nâng cấp này.
// ================================================================

import mammoth from "mammoth";
import JSZip from "jszip";

export class UnsupportedFileTypeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedFileTypeError";
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  // QUAN TRỌNG: import "pdf-parse" (index.js của package) sẽ chạy phải
  // đoạn code debug nội bộ của chính nó:
  //   let isDebugMode = !module.parent;
  //   if (isDebugMode) { Fs.readFileSync('./test/data/05-versions-space.pdf') ... }
  // Khi Next.js/webpack bundle code, cách nó wrap module khiến
  // `module.parent` luôn là undefined (dù đang chạy bình thường, không
  // hề ở "debug mode") -> isDebugMode = true -> package tự ý đọc 1 file
  // PDF mẫu nội bộ của NÓ (không phải file user upload) -> ENOENT vì
  // file đó không tồn tại trong node_modules đã cài. Đây là lỗi đã biết
  // của pdf-parse khi dùng chung với bundler (Next.js/Webpack/Vite),
  // không phải bug ở code này.
  //
  // Cách sửa: import THẲNG file implementation thật bên trong package
  // (lib/pdf-parse.js), bỏ qua hoàn toàn index.js — file này KHÔNG có
  // đoạn debug-mode nói trên nên không bao giờ đụng readFileSync thừa.
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const data = await pdfParse(buffer);
  return data.text;
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);

  // Mỗi slide là 1 file riêng "ppt/slides/slide{N}.xml" — sắp xếp
  // theo số N để giữ đúng THỨ TỰ slide trong bài trình bày, KHÔNG
  // theo thứ tự alphabet của tên file (slide10.xml sẽ đứng trước
  // slide2.xml nếu sort theo chuỗi thông thường).
  const slideFileNames = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/\d+/)?.[0] ?? "0", 10);
      const numB = parseInt(b.match(/\d+/)?.[0] ?? "0", 10);
      return numA - numB;
    });

  const slideTexts: string[] = [];
  for (const fileName of slideFileNames) {
    const xml = await zip.files[fileName].async("string");
    // Thẻ <a:t>...</a:t> trong XML của PowerPoint chứa text hiển thị
    // trên slide — regex đơn giản hơn nhiều so với parse full XML,
    // đủ dùng cho mục đích tóm tắt (không cần giữ format/vị trí).
    const matches = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    slideTexts.push(matches.join(" "));
  }
  return slideTexts.join("\n\n");
}

/**
 * Trích xuất text thật từ BUFFER đã có sẵn (dùng khi bytes đến từ DB —
 * vd API retry đọc lại fileData đã lưu — không có object File gốc của
 * trình duyệt). extractText() bên dưới chỉ là lớp mỏng chuyển File
 * thành Buffer rồi gọi hàm này, để 1 nơi DUY NHẤT chứa logic chọn
 * extractor theo fileType.
 */
export async function extractTextFromBuffer(buffer: Buffer, fileType: string): Promise<string> {
  switch (fileType) {
    case "txt":
    case "md":
      return buffer.toString("utf-8");
    case "pdf":
      return extractPdfText(buffer);
    case "docx":
      return extractDocxText(buffer);
    case "pptx":
      return extractPptxText(buffer);
    default:
      throw new UnsupportedFileTypeError(
        `Định dạng file này chưa được hỗ trợ trích xuất nội dung (hiện hỗ trợ: .txt, .md, .pdf, .docx, .pptx).`
      );
  }
}

/**
 * Trích xuất text thật từ file, dựa theo fileType đã suy luận từ tên
 * file (xem inferFileType trong route upload). Ném UnsupportedFileTypeError
 * cho định dạng chưa hỗ trợ (ảnh) — route gọi hàm này PHẢI bắt riêng
 * lỗi này để trả 400 rõ ràng thay vì 500 mơ hồ.
 */
export async function extractText(file: File, fileType: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  return extractTextFromBuffer(buffer, fileType);
}