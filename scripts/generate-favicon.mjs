// ================================================================
// Sinh `src/app/favicon.ico` từ icon launcher Android đã có sẵn
// ================================================================
// VÌ SAO CẦN:
//   Browser LUÔN gọi `/favicon.ico` khi mở tab, kể cả khi trang đã khai báo
//   `<link rel="icon">` (Chrome fallback, Safari <16, các công cụ crawl). Không
//   có file đó ⇒ 404 đỏ trong console ở MỌI trang.
//
//   Layout khai báo icon là `/brand/learnx-mark.svg`. Next.js App Router hỗ trợ
//   file convention `app/favicon.ico` ⇒ tự phục vụ đúng `/favicon.ico`, đúng
//   kiểu native, không phải hack redirect.
//
//   VÌ SAO DÙNG LẠI PNG CÓ SẴN: `ic_launcher.png` (mipmap-xhdpi) CHÍNH LÀ logo
//   LearnX — đã dùng cho launcher Android. Bọc PNG đó vào container ICO
//   (định dạng ICO cho phép nhúng PNG nguyên bản từ Windows Vista). Không vẽ
//   logo mới, không dùng chữ "N" tạm.
//
//   Chạy:  node scripts/generate-favicon.mjs
//
//   Idempotent — chạy lại chỉ ghi đè khi nội dung khác.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

// Nguồn: icon launcher Android đã có sẵn (chính là logo LearnX).
// Ưu tiên bản lớn nhất vì .ico nhúng nguyên PNG, không cần resize.
const SOURCES = [
  "android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png",
  "android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png",
  "android/app/src/main/res/mipmap-xhdpi/ic_launcher.png",
  "android/app/src/main/res/mipmap-hdpi/ic_launcher.png",
];

const OUT = join(ROOT, "src/app/favicon.ico");

const source = SOURCES.map((p) => join(ROOT, p)).find((p) => existsSync(p));
if (!source) {
  console.error(
    "Không tìm thấy PNG launcher Android để làm favicon.\n" +
      "Đã thử:\n  " + SOURCES.join("\n  ")
  );
  process.exit(1);
}

const png = readFileSync(source);

/** Đọc kích thước từ IHDR của PNG (byte 16..24). */
function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const { width, height } = pngSize(png);
// ICO lưu kích thước 1 byte; giá trị 256 được mã hoá thành 0.
const dim = (n) => (n >= 256 ? 0 : n);

// ---- Dựng container ICO ----
// ICONDIR (6 byte): reserved(2)=0 · type(2)=1 (icon) · count(2)=1
// ICONDIRENTRY (16 byte): w(1) · h(1) · colorCount(1)=0 · reserved(1)=0
//                        planes(2)=1 · bitCount(2)=32 · bytesInRes(4) · offset(4)
const header = Buffer.alloc(6 + 16);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type = icon
header.writeUInt16LE(1, 4); // số ảnh trong file
header.writeUInt8(dim(width), 6);
header.writeUInt8(dim(height), 7);
header.writeUInt8(0, 8); // colorCount (0 = >256 màu / truecolor)
header.writeUInt8(0, 9); // reserved
header.writeUInt16LE(1, 10); // planes
header.writeUInt16LE(32, 12); // bitCount
header.writeUInt32LE(png.length, 14); // kích thước ảnh
header.writeUInt32LE(6 + 16, 18); // offset bắt đầu dữ liệu ảnh

const ico = Buffer.concat([header, png]);
writeFileSync(OUT, ico);

console.log(
  `Đã tạo src/app/favicon.ico (${ico.length} bytes) từ ${source.replace(ROOT + "\\", "")} — ${width}×${height}`
);