// ================================================================
// POST /api/mindmap/export — Generate PDF from mind map PNG
// ================================================================
// PDF được tạo ở SERVER (pdfkit là server-only package). Flow:
//   1. Client tính SVG → rasterize thành PNG (toàn bộ graph)
//   2. Client gửi PNG blob + title lên route này
//   3. Server dùng pdfkit tạo PDF, embed PNG, trả blob về
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import type { ApiResponse } from "@/types";
import path from "path";
import fs from "fs";

// pdfkit đọc font/file bằng `fs` và chỉ chạy được trên Node runtime —
// khai báo tường minh để Next.js KHÔNG bao giờ đẩy route này sang Edge
// runtime (Edge không có `fs` -> route sẽ 500 trên Vercel).
export const runtime = "nodejs";
// Vercel: ảnh mind map lớn (nhiều node) cần thời gian nhúng vào PDF hơn
// mặc định 10s của gói Hobby.
export const maxDuration = 30;

const FONT_DIR = path.join(process.cwd(), "src", "fonts");
const FONT_REGULAR = path.join(FONT_DIR, "NotoSans-Regular.ttf");
const FONT_BOLD = path.join(FONT_DIR, "NotoSans-Bold.ttf");

export async function POST(req: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const formData = await req.formData();
    const title = (formData.get("title") as string) || "mindmap";
    const imageFile = formData.get("image") as File;
    const mimeType = (formData.get("mimeType") as string) || "image/png";

    if (!imageFile || !imageFile.size) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Thiếu dữ liệu ảnh." },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({ margin: 30 });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<void>((resolve, reject) => {
      doc.on("end", () => resolve());
      doc.on("error", reject);
    });

    // Fonts Noto Sans (hỗ trợ tiếng Việt) nếu có, fallback Helvetica.
    let hasFonts = false;
    if (fs.existsSync(FONT_REGULAR) && fs.existsSync(FONT_BOLD)) {
      doc.registerFont("NotoSans", FONT_REGULAR);
      doc.registerFont("NotoSans-Bold", FONT_BOLD);
      hasFonts = true;
    }
    const fontName = hasFonts ? "NotoSans" : "Helvetica";

    // Thêm ảnh vào PDF — pdfkit tự scale để vừa trang.
    const { width: imgWidth, height: imgHeight } = getImageSize(imageBuffer, mimeType);
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 30;
    const maxW = pageWidth - margin * 2;
    const maxH = pageHeight - margin * 2 - 40;

    let drawW = imgWidth;
    let drawH = imgHeight;

    if (drawW > maxW) {
      drawH = (drawH * maxW) / drawW;
      drawW = maxW;
    }
    if (drawH > maxH) {
      drawW = (drawW * maxH) / drawH;
      drawH = maxH;
    }

    const offsetX = (pageWidth - drawW) / 2;
    const offsetY = 40;

    // pdfkit tự tạo sẵn 1 trang khi khởi tạo document — không cần
    // switchToPage/bufferedPageRange (dùng sai API đó có thể tạo trang
    // trắng thừa hoặc ghi vào trang đã đóng).
    doc.image(imageBuffer, offsetX, offsetY, { width: drawW, height: drawH });

    // Footer: ghi TRƯỚC doc.end() và sau khi ảnh đã vẽ xong.
    doc.font(fontName).fontSize(9).fillColor("#94a0b8");
    doc.text(`Exported from LearnX AI — ${title}`, margin, pageHeight - 20, {
      align: "center",
    });

    doc.end();
    await done;

    const pdfBuffer = Buffer.concat(chunks);
    const safeName = `${title.replace(/[\\/:*?"<>|]/g, "_")}.pdf`;
    const encodedName = encodeURIComponent(safeName);
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err) {
    console.error("[api/mindmap/export] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo PDF, thử lại sau." },
      { status: 500 }
    );
  }
}

/** Đọc kích thước PNG/JPG từ header — không cần decode toàn ảnh. */
function getImageSize(buffer: Buffer, mimeType: string): { width: number; height: number } {
  if (mimeType.includes("png")) {
    // PNG header: bytes 16-24 chứa width/height (big-endian 4 byte mỗi thứ).
    const w = buffer.readUInt32BE(16);
    const h = buffer.readUInt32BE(20);
    return { width: w, height: h };
  }
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    // JPEG: tìm marker SOF0 (0xFFC0) để lấy kích thước.
    let i = 2;
    while (i < buffer.length - 1) {
      if (buffer[i] === 0xff) {
        const marker = buffer[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          const h = buffer.readUInt16BE(i + 5);
          const w = buffer.readUInt16BE(i + 7);
          return { width: w, height: h };
        }
        const segLen = buffer.readUInt16BE(i + 2);
        i += 2 + segLen;
      } else {
        i++;
      }
    }
  }
  // Fallback
  return { width: 800, height: 600 };
}