// ================================================================
// POST /api/documents/[id]/summary/download — Download summary in various formats
// ================================================================
// Generates PDF, DOCX, TXT, or MD file from AI summary
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse } from "@/types";
import path from "path";
import fs from "fs";

type Format = 'pdf' | 'docx' | 'txt' | 'md';

// Font paths for Noto Sans (supports Vietnamese + math symbols)
const FONT_DIR = path.join(process.cwd(), "src", "fonts");
const FONT_REGULAR = path.join(FONT_DIR, "NotoSans-Regular.ttf");
const FONT_BOLD = path.join(FONT_DIR, "NotoSans-Bold.ttf");
const FONT_ITALIC = path.join(FONT_DIR, "NotoSans-Italic.ttf");
const FONT_BOLD_ITALIC = path.join(FONT_DIR, "NotoSans-BoldItalic.ttf");

function generateMarkdown(fileName: string, summary: string): string {
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  return `# ${baseName} — Tóm tắt AI\n\n${summary}\n\n---\n*Tóm tắt được tạo bởi LearnX AI*`;
}

function generateText(fileName: string, summary: string): string {
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  return `${baseName} — Tóm tắt AI\n\n${summary}\n\n---\nTóm tắt được tạo bởi LearnX AI`;
}

async function generatePDF(fileName: string, summary: string): Promise<Uint8Array> {
  // Dynamic import to avoid build issues if not installed
  const { default: PDFDocument } = await import('pdfkit');
  
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];
    
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    
    const baseName = fileName.replace(/\.[^/.]+$/, '');
    
    // Register Noto Sans fonts (supports Vietnamese + math symbols)
    // Check if font files exist, fallback to Helvetica if not
    const hasFonts = fs.existsSync(FONT_REGULAR) && fs.existsSync(FONT_BOLD) && 
                     fs.existsSync(FONT_ITALIC) && fs.existsSync(FONT_BOLD_ITALIC);
    
    if (hasFonts) {
      doc.registerFont('NotoSans', FONT_REGULAR);
      doc.registerFont('NotoSans-Bold', FONT_BOLD);
      doc.registerFont('NotoSans-Italic', FONT_ITALIC);
      doc.registerFont('NotoSans-BoldItalic', FONT_BOLD_ITALIC);
    }
    
    // Title
    doc.fontSize(20).font(hasFonts ? 'NotoSans-Bold' : 'Helvetica-Bold').text(`${baseName} — Tóm tắt AI`, { align: 'center' });
    doc.moveDown();
    
    // Content - parse markdown-like content
    const lines = summary.split('\n');
    for (const line of lines) {
      if (line.startsWith('## ')) {
        doc.moveDown(0.5);
        doc.fontSize(16).font(hasFonts ? 'NotoSans-Bold' : 'Helvetica-Bold').text(line.slice(3));
      } else if (line.startsWith('### ')) {
        doc.moveDown(0.3);
        doc.fontSize(14).font(hasFonts ? 'NotoSans-Bold' : 'Helvetica-Bold').text(line.slice(4));
      } else if (line.startsWith('**') && line.endsWith('**')) {
        doc.fontSize(12).font(hasFonts ? 'NotoSans-Bold' : 'Helvetica-Bold').text(line.slice(2, -2));
        doc.font(hasFonts ? 'NotoSans' : 'Helvetica');
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        doc.fontSize(12).font(hasFonts ? 'NotoSans' : 'Helvetica').text(`  • ${line.slice(2)}`);
      } else if (line.match(/^\d+\. /)) {
        doc.fontSize(12).font(hasFonts ? 'NotoSans' : 'Helvetica').text(`  ${line}`);
      } else if (line.trim()) {
        doc.fontSize(12).font(hasFonts ? 'NotoSans' : 'Helvetica').text(line);
      }
      doc.moveDown(0.2);
    }
    
    doc.moveDown();
    doc.fontSize(10).font(hasFonts ? 'NotoSans-Italic' : 'Helvetica-Oblique').fillColor('gray').text('Tóm tắt được tạo bởi LearnX AI', { align: 'center' });
    doc.end();
  });
}

async function generateDOCX(fileName: string, summary: string): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');
  
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  const lines = summary.split('\n');
  
  // Use Noto Sans (Unicode-capable) as default font for all text
  // This ensures Vietnamese characters and math symbols render correctly
  const children = [
    new Paragraph({
      text: `${baseName} — Tóm tắt AI`,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      ...{ font: "Noto Sans" },
    }),
    new Paragraph({ text: '' }),
  ];
  
  for (const line of lines) {
    if (line.startsWith('## ')) {
      children.push(new Paragraph({
        text: line.slice(3),
        heading: HeadingLevel.HEADING_1,
        ...{ font: "Noto Sans" },
      }));
    } else if (line.startsWith('### ')) {
      children.push(new Paragraph({
        text: line.slice(4),
        heading: HeadingLevel.HEADING_2,
        ...{ font: "Noto Sans" },
      }));
    } else if (line.startsWith('**') && line.endsWith('**')) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line.slice(2, -2), bold: true, size: 24, font: "Noto Sans" })],
      }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      children.push(new Paragraph({
        text: `• ${line.slice(2)}`,
        indent: { left: 720 },
        ...{ font: "Noto Sans" },
      }));
    } else if (line.match(/^\d+\. /)) {
      children.push(new Paragraph({
        text: line,
        indent: { left: 720 },
        ...{ font: "Noto Sans" },
      }));
    } else if (line.trim()) {
      children.push(new Paragraph({
        text: line,
        spacing: { after: 120 },
        ...{ font: "Noto Sans" },
      }));
    }
  }
  
  children.push(
    new Paragraph({ text: '' }),
    new Paragraph({
      ...{ font: "Noto Sans" },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Tóm tắt được tạo bởi LearnX AI', size: 20, color: '999999', font: "Noto Sans" })],
    })
  );
  
  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return unauthorizedResponse();

    const { id } = await params;

    const body = await req.json();
    const format = body.format as Format;

    if (!format || !['pdf', 'docx', 'txt', 'md'].includes(format)) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Định dạng không hợp lệ. Hỗ trợ: pdf, docx, txt, md" },
        { status: 400 }
      );
    }

    const doc = await prisma.document.findUnique({
      where: { id },
      select: { userId: true, fileName: true, summary: true },
    });

    if (!doc || doc.userId !== userId) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Không tìm thấy tài liệu." },
        { status: 404 }
      );
    }

    if (!doc.summary) {
      return NextResponse.json<ApiResponse<never>>(
        { success: false, error: "Tài liệu này chưa có tóm tắt." },
        { status: 404 }
      );
    }

    let content: string | Uint8Array;
    let mimeType: string;
    let extension: string;

    const baseName = doc.fileName.replace(/\.[^/.]+$/, '');
    const downloadName = `${baseName}_summary.${format}`;

    switch (format) {
      case 'md':
        content = generateMarkdown(doc.fileName, doc.summary);
        mimeType = 'text/markdown;charset=utf-8';
        extension = 'md';
        break;
      case 'txt':
        content = generateText(doc.fileName, doc.summary);
        mimeType = 'text/plain;charset=utf-8';
        extension = 'txt';
        break;
      case 'pdf':
        content = await generatePDF(doc.fileName, doc.summary);
        mimeType = 'application/pdf';
        extension = 'pdf';
        break;
      case 'docx':
        content = await generateDOCX(doc.fileName, doc.summary);
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        extension = 'docx';
        break;
      default:
        return NextResponse.json<ApiResponse<never>>(
          { success: false, error: "Định dạng không được hỗ trợ." },
          { status: 400 }
        );
    }

    const encodedName = encodeURIComponent(downloadName);

    // Convert Uint8Array to Buffer for NextResponse
    const responseBody = content instanceof Uint8Array ? Buffer.from(content) : content;

    return new NextResponse(responseBody, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, max-age=0, must-revalidate',
      },
    });
  } catch (err) {
    console.error("[api/documents/[id]/summary/download] Error:", err);
    return NextResponse.json<ApiResponse<never>>(
      { success: false, error: "Không thể tạo file tải xuống, thử lại sau." },
      { status: 500 }
    );
  }
}