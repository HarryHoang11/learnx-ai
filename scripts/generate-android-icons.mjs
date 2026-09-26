#!/usr/bin/env node
// ================================================================
// Sinh icon launcher PNG cho LearnX AI (Android < API 26)
// ================================================================
// VÌ SAO CẦN SCRIPT NÀY
// Từ Android 8.0 (API 26) app dùng ADAPTIVE ICON (XML + vector drawable) —
// xem res/mipmap-anydpi-v26/ic_launcher.xml. Nhưng minSdk là 23, nên máy
// Android 6/7 vẫn đọc PNG trong res/mipmap-*/. Capacitor sinh sẵn bộ PNG đó
// nhưng là LOGO CAPACITOR — không được dùng cho LearnX. Không có sẵn
// ImageMagick/sharp nên script tự vẽ và tự ghi PNG bằng zlib của Node.
//
// CÁCH DÙNG
//   node scripts/generate-android-icons.mjs
// Chạy lại chỉ cần khi đổi thiết kế icon; icon adaptive không cần script.
// ================================================================

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RES = join(ROOT, "android", "app", "src", "main", "res");

// Mật độ chuẩn Android: icon 48dp -> px theo hệ số từng mật độ.
const DENSITIES = [
  ["mipmap-mdpi", 48],
  ["mipmap-hdpi", 72],
  ["mipmap-xhdpi", 96],
  ["mipmap-xxhdpi", 144],
  ["mipmap-xxxhdpi", 192],
];

// Palette lấy đúng từ brand mark web (public/brand/learnx-mark.svg): gradient
// thân X đi từ indigo sang cyan. Trước đây dùng #7775ff; nay lấy đúng tông
// điểm-giữa #6E7FE4 -> #45D9E9 để PNG (API 23-25) khớp vector drawable
// (API 26+). Lệch màu ở đây là icon "đổi sắc" giữa 2 nhóm máy.
const GRAD_START = [0x6e, 0x7f, 0xe4];
const GRAD_END = [0x45, 0xd9, 0xe9];
const FG = [0xff, 0xff, 0xff];

/** Nội suy màu gradient theo t (0..1). */
function gradient(t) {
  return [
    Math.round(GRAD_START[0] + (GRAD_END[0] - GRAD_START[0]) * t),
    Math.round(GRAD_START[1] + (GRAD_END[1] - GRAD_START[1]) * t),
    Math.round(GRAD_START[2] + (GRAD_END[2] - GRAD_START[2]) * t),
  ];
}

/**
 * Chữ "X" (1 polygon) vẽ theo toạ độ chuẩn 108x108 — KHỚP với vector drawable
 * res/drawable/ic_launcher_foreground.xml, để icon PNG và icon vector trùng nhau.
 */
const X_POLY = [
  [41, 39], [48.5, 39], [54, 48], [59.5, 39], [67, 39], [57.5, 53],
  [67, 67], [59.5, 67], [54, 58.5], [48.5, 67], [41, 67], [50.5, 53],
];

/**
 * Mũi tên trắng + sparkle — CÙNG toạ độ với
 * res/drawable/ic_launcher_foreground.xml.
 *
 * Bắt buộc hai nơi phải khớp nhau: PNG này dùng cho Android 6/7 (API 23-25),
 * vector drawable dùng từ Android 8 trở lên. Lệch một toạ độ là icon đổi
 * hình dạng giữa hai nhóm máy — thứ mà người dùng sẽ nhận ra ngay khi
 * so sánh cùng app trên 2 thiết bị.
 */
const ARROW_POLY = [
  [43, 61], [55, 49], [47, 47], [61, 33], [60, 47], [64, 45],
];

const SPARKLE_POLY = [
  [74, 68], [77, 73], [82, 76], [77, 79], [74, 84], [71, 79], [66, 76], [71, 73],
];

/** Kiểm tra điểm có nằm trong đa giác không (ray-casting). */
function insidePolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Vẽ 1 icon: nền bo tròn gradient + chữ X trắng.
 * @param {number} size cạnh (px)
 * @param {boolean} round bo tròn tròn trọn (ic_launcher_round.png)
 */
function renderIcon(size, round) {
  const px = Buffer.alloc(size * size * 4);
  const s = size / 108; // quy đổi toạ độ 108 -> size
  const radius = round ? size / 2 : size * 0.22;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const dx = x + 0.5;
      const dy = y + 0.5;

      // Bo góc: ngoài bán kính -> để trong suốt (nền launcher lộ ra).
      const cx = round ? size / 2 : Math.min(Math.max(dx, radius), size - radius);
      const cy = round ? size / 2 : Math.min(Math.max(dy, radius), size - radius);
      if (Math.hypot(dx - cx, dy - cy) > radius) continue;

      if (insidePolygon(dx / s, dy / s, X_POLY)) {
        // Thân X lấy gradient indigo -> cyan như bản vector, không phải trắng
        // phẳng: icon phẳng trông như icon hệ thống, mất nhận diện LearnX.
        const gx = Math.min(1, Math.max(0, (dx / s - 41) / (67 - 41)));
        const gy = Math.min(1, Math.max(0, (dy / s - 39) / (67 - 39)));
        const c = gradient(Math.min(1, (gx + gy) / 2));
        px[i] = c[0];
        px[i + 1] = c[1];
        px[i + 2] = c[2];
        px[i + 3] = 255;
        continue;
      }

      // Mũi tên + sparkle vẽ SAU X để luôn nằm trên, giống thứ tự lớp
      // trong vector drawable.
      if (insidePolygon(dx / s, dy / s, SPARKLE_POLY)) {
        px[i] = FG[0];
        px[i + 1] = FG[1];
        px[i + 2] = FG[2];
        px[i + 3] = 230; // fillAlpha 0.9, khớp vector
        continue;
      }
      if (insidePolygon(dx / s, dy / s, ARROW_POLY)) {
        px[i] = FG[0];
        px[i + 1] = FG[1];
        px[i + 2] = FG[2];
        px[i + 3] = 255;
        continue;
      }

      const c = gradient(Math.min(1, Math.max(0, (dx + dy) / (2 * size))));
      px[i] = c[0];
      px[i + 1] = c[1];
      px[i + 2] = c[2];
      px[i + 3] = 255;
    }
  }
  return px;
}

// --- PNG writer (không phụ thuộc thư viện ngoài) ---

/** CRC32 — bắt buộc cho mọi chunk PNG. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Gói dữ liệu thành chunk PNG: length + type + data + CRC. */
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}

/** Đóng gói buffer RGBA thành file PNG hoàn chỉnh. */
function encodePng(pixels, size) {
  // Mỗi hàng dữ liệu PNG bắt đầu bằng byte filter (0 = None).
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y += 1) {
    pixels.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type 6 = RGBA
  // [10] compression, [11] filter, [12] interleave đều 0 (Buffer.alloc đã zero)

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // signature
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --- Chạy ---
let written = 0;
for (const [dir, size] of DENSITIES) {
  const target = join(RES, dir);
  mkdirSync(target, { recursive: true });
  for (const [name, round] of [
    ["ic_launcher.png", false],
    ["ic_launcher_round.png", true],
  ]) {
    writeFileSync(join(target, name), encodePng(renderIcon(size, round), size));
    written += 1;
  }
}
console.log(`[icons] Đã sinh ${written} file icon LearnX AI trong android/app/src/main/res/`);

