// Test thực tế cho extraction pipeline (vitest, không cần DB/AI).
// Bao phủ: Test 1 (PDF text đơn giản), 2 (tiếng Việt NFC + toán),
// 3 (nhiều trang + pageNumber), 4 (công thức/ký hiệu giữ nguyên),
// 5 (scan → OCR_UNAVAILABLE, phân biệt với file hỏng), 7 (đồng thời),
// 9 (validation magic bytes/empty/oversize), 10 (corrupt), 11 (N/A —
// không còn bước Markdown bắt buộc trong pipeline).
import { describe, expect, it } from "vitest";
import PDFDocument from "pdfkit";
import {
  extractTextFromBuffer,
  hasPdfSignature,
  normalizeExtractedText,
} from "../extractText";
import { DocumentProcessingError } from "../docErrors";

// Dựng PDF thật bằng pdfkit (dependency đã có) — không cần file mẫu
// ngoài repo, không chạm filesystem.
function makePdfkitBuffer(pages: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    for (const text of pages) {
      doc.addPage();
      doc.font("Helvetica").fontSize(14).text(text || " ", 72, 72);
    }
    doc.end();
  });
}

// Dựng PDF tay tối giản (1 object/page) — kiểm soát tuyệt đối nội
// dung, dùng cho case scan (page không có text operator nào).
function makeHandPdf(pageStreams: string[]): Buffer {
  const objects: string[] = [];
  // 1: Catalog, 2: Pages (điền Kids sau), fonts...
  const kids: string[] = [];
  let objNo = 3;
  const contentObjNos: number[] = [];
  for (const stream of pageStreams) {
    const contentNo = objNo++;
    const fontNo = objNo++;
    const pageNo = objNo++;
    kids.push(`${pageNo} 0 R`);
    contentObjNos.push(contentNo);
    objects.push(
      `${contentNo} 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream\nendobj`
    );
    objects.push(`${fontNo} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);
    objects.push(
      `${pageNo} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentNo} 0 R /Resources << /Font << /F1 ${fontNo} 0 R >> >> >>\nendobj`
    );
  }
  const head = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>\nendobj\n`;
  void contentObjNos;
  let offset = Buffer.byteLength(head);
  const offsets: number[] = [0, 0, 0]; // index theo objNo (1-based, bỏ 0)
  const bodyParts: string[] = [];
  // objNo 1, 2 nằm trong head — tính offset của chúng:
  const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  const obj2 = `2 0 obj\n<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${kids.length} >>\nendobj\n`;
  void obj1;
  void obj2;
  // Dựng lại head chuẩn để offset khớp: head đã gồm obj1+obj2.
  offsets[1] = 9; // sau "%PDF-1.4\n" (9 bytes)
  offsets[2] = offsets[1] + Buffer.byteLength(obj1);
  let cursor = offset;
  for (const part of objects) {
    offsets.push(cursor);
    bodyParts.push(part);
    cursor += Buffer.byteLength(part + "\n");
  }
  const body = bodyParts.join("\n") + "\n";
  const xrefOffset = Buffer.byteLength(head + body);
  const totalObjs = offsets.length - 1;
  let xref = `xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= totalObjs; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(head + body + xref + trailer, "latin1");
}

describe("hasPdfSignature", () => {
  it("nhận %PDF-, từ chối file giả mạo", () => {
    expect(hasPdfSignature(Buffer.from("%PDF-1.7 rest"))).toBe(true);
    expect(hasPdfSignature(Buffer.from("PK\x03\x04 fake"))).toBe(false);
    expect(hasPdfSignature(Buffer.alloc(0))).toBe(false);
  });
});

describe("normalizeExtractedText", () => {
  it("Test 2a: gộp dấu tổ hợp tiếng Việt về NFC (Nguyễn Du)", () => {
    // "Nguyễn": Nguy + ễ tách (e + mũ U+0302 + ngã U+0303) + n Du
    const decomposed = "Nguy\u0065\u0302\u0303n Du";
    expect(normalizeExtractedText(decomposed)).toBe("Nguyễn Du");
  });

  it("Test 2b/4: giữ nguyên ký tự toán, Hy Lạp, công thức", () => {
    const math = "x² + 2x + 1 = 0, √(x + 1), ∑ ∫ α β γ ≤ ≥ ≠ π";
    expect(normalizeExtractedText(math)).toBe(math);
  });

  it("xoá null byte gây crash Postgres, giữ text", () => {
    expect(normalizeExtractedText("ab\u0000cd")).toBe("abcd");
  });
});

describe("extractTextFromBuffer — validation", () => {
  it("Test 9a: buffer rỗng → FILE_EMPTY", async () => {
    await expect(extractTextFromBuffer(Buffer.alloc(0), "pdf")).rejects.toMatchObject({
      code: "FILE_EMPTY",
    });
  });

  it("Test 9b: file quá lớn → DOCUMENT_TOO_LARGE", async () => {
    const big = Buffer.alloc(21 * 1024 * 1024, 0x61);
    await expect(extractTextFromBuffer(big, "txt")).rejects.toMatchObject({
      code: "DOCUMENT_TOO_LARGE",
    });
  });

  it("Test 9c: đuôi .pdf nhưng không phải PDF → INVALID_PDF", async () => {
    await expect(extractTextFromBuffer(Buffer.from("PK fake zip"), "pdf")).rejects.toMatchObject({
      code: "INVALID_PDF",
    });
  });

  it("định dạng lạ → INVALID_FILE (giữ tên class cũ)", async () => {
    const err = await extractTextFromBuffer(Buffer.from("hi"), "image").catch((e) => e);
    expect(err.code).toBe("INVALID_FILE");
    expect(err.name).toBe("UnsupportedFileTypeError");
  });
});

describe("extractTextFromBuffer — PDF thật", () => {
  it("Test 1: PDF text đơn giản đọc được", async () => {
    const buf = await makePdfkitBuffer(["Phuong trinh bac hai x + 1 = 0"]);
    const res = await extractTextFromBuffer(buf, "pdf");
    expect(res.text).toContain("Phuong trinh bac hai");
    expect(res.pageCount).toBe(1);
  }, 30000);

  it("Test 3: PDF nhiều trang, giữ pageNumber từng trang", async () => {
    const buf = await makePdfkitBuffer(["Trang mot alpha", "Trang hai beta", "Trang ba gamma"]);
    const res = await extractTextFromBuffer(buf, "pdf");
    expect(res.pageCount).toBe(3);
    expect(res.pages?.length).toBe(3);
    expect(res.pages?.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
    expect(res.pages?.[1].text).toContain("Trang hai");
  }, 30000);

  it("Test 3b/6: PDF 30 trang trích xuất đủ, đúng thứ tự trang", async () => {
    const contents = Array.from({ length: 30 }, (_, i) => `Noi dung trang so ${i + 1} voi van ban tieng Viet co dau: hoc tap`);
    const buf = await makePdfkitBuffer(contents);
    const res = await extractTextFromBuffer(buf, "pdf");
    expect(res.pageCount).toBe(30);
    expect(res.pages?.length).toBe(30);
    expect(res.pages?.[0].text).toContain("trang so 1");
    expect(res.pages?.[29].text).toContain("trang so 30");
    // Toàn văn nối đủ các trang theo thứ tự
    const firstIdx = res.text.indexOf("trang so 1");
    const lastIdx = res.text.indexOf("trang so 30");
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(lastIdx).toBeGreaterThan(firstIdx);
  }, 120000);

  it("Test 5: PDF scan (page không text) → OCR_UNAVAILABLE, không phải 'file hỏng'", async () => {
    const buf = makeHandPdf([""]); // content stream rỗng
    const err = await extractTextFromBuffer(buf, "pdf").catch((e) => e);
    expect(err).toBeInstanceOf(DocumentProcessingError);
    expect(err.code).toBe("OCR_UNAVAILABLE");
    expect(err.userMessage).toContain("scan");
  }, 30000);

  it("Test 10: PDF corrupt (có signature nhưng xref/code hỏng) → code hỏng hóc", async () => {
    const buf = Buffer.from("%PDF-1.4\n%garbage\x00\x01\x02trailer broken {{{", "latin1");
    const err = await extractTextFromBuffer(buf, "pdf").catch((e) => e);
    expect(["PDF_CORRUPTED", "PDF_PARSE_FAILED", "OCR_UNAVAILABLE"]).toContain(err.code);
    expect(err.stage).toBe("TEXT_EXTRACTION");
  }, 30000);

  it("Test 7: 2 request đồng thời không ảnh hưởng nhau (không shared state)", async () => {
    const [a, b] = await Promise.all([
      makePdfkitBuffer(["Noi dung A"]),
      makePdfkitBuffer(["Noi dung B"]),
    ]);
    const [ra, rb] = await Promise.all([
      extractTextFromBuffer(a, "pdf"),
      extractTextFromBuffer(b, "pdf"),
    ]);
    expect(ra.text).toContain("Noi dung A");
    expect(rb.text).toContain("Noi dung B");
    expect(ra.text).not.toContain("Noi dung B");
  }, 30000);
});
