// Unit test cho error model thống nhất của document pipeline.
import { describe, expect, it } from "vitest";
import {
  describeDocumentError,
  DocumentProcessingError,
  parseErrorCode,
} from "../docErrors";

describe("DocumentProcessingError", () => {
  it("mang code + stage + userMessage tiếng Việt + httpStatus", () => {
    const err = new DocumentProcessingError("PDF_NO_TEXT_LAYER", "TEXT_EXTRACTION");
    expect(err.code).toBe("PDF_NO_TEXT_LAYER");
    expect(err.stage).toBe("TEXT_EXTRACTION");
    expect(err.retryable).toBe(false);
    expect(err.httpStatus).toBe(422);
    expect(err.userMessage).toContain("lớp văn bản");
    expect(err.message.startsWith("[PDF_NO_TEXT_LAYER]")).toBe(true);
  });

  it("lỗi transient (embedding) cho retry + 503", () => {
    const err = new DocumentProcessingError("EMBEDDING_FAILED", "EMBEDDING");
    expect(err.retryable).toBe(true);
    expect(err.httpStatus).toBe(503);
  });
});

describe("parseErrorCode / describeDocumentError", () => {
  it("parse code từ errorMessage DB", () => {
    expect(parseErrorCode("[PDF_CORRUPTED] xref broken")).toBe("PDF_CORRUPTED");
    expect(parseErrorCode(null)).toBeNull();
    expect(parseErrorCode("lỗi lạ không prefix")).toBeNull();
    expect(parseErrorCode("[KHONG_TON_TAI] x")).toBeNull();
  });

  it("UI nhận message + suggestion cho code đã biết", () => {
    const d = describeDocumentError("[DOCUMENT_TOO_LARGE] 99MB");
    expect(d.userMessage).toContain("quá lớn");
    expect(d.suggestion).toContain("Chia nhỏ");
    expect(d.retryable).toBe(false);
  });

  it("UI fallback an toàn cho message lạ/null", () => {
    const d = describeDocumentError(null);
    expect(d.userMessage).toContain("Không thể xử lý");
  });
});
