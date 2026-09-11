// ================================================================
// POST /api/documents/[id]/summary/download — Download summary in various formats
// ================================================================
// Generates PDF, DOCX, TXT, or MD file from AI summary
// ================================================================

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId, unauthorizedResponse } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { ApiResponse } from "@/types";

type Format = 'pdf' | 'docx' | 'txt' | 'md';

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
    
    // Title
    doc.fontSize(20).text(`${baseName} — Tóm tắt AI`, { align: 'center' });
    doc.moveDown();
    
    // Content - parse markdown-like content
    const lines = summary.split('\n');
    for (const line of lines) {
      if (line.startsWith('## ')) {
        doc.moveDown(0.5);
        doc.fontSize(16).text(line.slice(3));
      } else if (line.startsWith('### ')) {
        doc.moveDown(0.3);
        doc.fontSize(14).text(line.slice(4));
      } else if (line.startsWith('**') && line.endsWith('**')) {
        doc.fontSize(12).font('Helvetica-Bold').text(line.slice(2, -2));
        doc.font('Helvetica');
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        doc.fontSize(12).text(`  • ${line.slice(2)}`);
      } else if (line.match(/^\d+\. /)) {
        doc.fontSize(12).text(`  ${line}`);
      } else if (line.trim()) {
        doc.fontSize(12).text(line);
      }
      doc.moveDown(0.2);
    }
    
    doc.moveDown();
    doc.fontSize(10).fillColor('gray').text('Tóm tắt được tạo bởi LearnX AI', { align: 'center' });
    doc.end();
  });
}

async function generateDOCX(fileName: string, summary: string): Promise<Uint8Array> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx');
  
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  const lines = summary.split('\n');
  const children = [
    new Paragraph({
      text: `${baseName} — Tóm tắt AI`,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({ text: '' }),
  ];
  
  for (const line of lines) {
    if (line.startsWith('## ')) {
      children.push(new Paragraph({
        text: line.slice(3),
        heading: HeadingLevel.HEADING_1,
      }));
    } else if (line.startsWith('### ')) {
      children.push(new Paragraph({
        text: line.slice(4),
        heading: HeadingLevel.HEADING_2,
      }));
    } else if (line.startsWith('**') && line.endsWith('**')) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line.slice(2, -2), bold: true, size: 24 })],
      }));
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      children.push(new Paragraph({
        text: `• ${line.slice(2)}`,
        indent: { left: 720 },
      }));
    } else if (line.match(/^\d+\. /)) {
      children.push(new Paragraph({
        text: line,
        indent: { left: 720 },
      }));
    } else if (line.trim()) {
      children.push(new Paragraph({
        text: line,
        spacing: { after: 120 },
      }));
    }
  }
  
  children.push(
    new Paragraph({ text: '' }),
    new Paragraph({
      text: 'Tóm tắt được tạo bởi LearnX AI',
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'Tóm tắt được tạo bởi LearnX AI', size: 20, color: '999999' })],
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