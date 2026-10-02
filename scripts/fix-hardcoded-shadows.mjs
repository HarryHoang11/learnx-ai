// ================================================================
// Thay box-shadow hardcoded nền TỐI bằng token `--shadow-*`
// ================================================================
// VÌ SAO:
//   ~26 rule CSS viết thẳng `rgba(0, 0, 0, 0.xx)` trong `box-shadow`. Ở
//   light mode nền là TRẮNG, shadow đen đậm đó đọc như vết bẩn chứ không phải
//   "nổi lên" — đúng cảm giác "chìm vào nền" mà light mode hay gặp.
//
//   Token `--shadow-sm/md/lg` đã có sẵn và ĐÃ khai báo riêng cho light
//   (globals.css: `rgba(15,23,42,.06/.08/.1)` — nhạt + hơi xám xanh). Việc
//   duy nhất cần làm là cho các rule đó dùng token.
//
// AN TOÀN: chỉ thay trong `box-shadow`, KHÔNG đụng `background`, `border`
// hay màu chữ. `rgba(0,0,0,0)` bị bỏ qua — đó là overlay nền tối CỐ Ý
// (modal backdrop), không phải shadow.
//
//   node scripts/fix-hardcoded-shadows.mjs           # in ra sẽ đổi gì
//   node scripts/fix-hardcoded-shadows.mjs --write   # ghi file

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const WRITE = process.argv.includes("--write");

/** Ngưỡng alpha trong rgba(0,0,0,x) → token tương ứng. */
function tokenFor(alpha) {
  if (alpha <= 0.2) return "--shadow-sm";
  if (alpha <= 0.34) return "--shadow-md";
  return "--shadow-lg";
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk("src").filter((f) => f.endsWith(".css"));
let total = 0;

for (const file of files) {
  const src = readFileSync(file, "utf8");
  let changed = 0;

  const out = src.replace(/box-shadow:([^;]*);/g, (match, body) => {
    const m = body.match(/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)/);
    if (!m) return match;
    const alpha = Number(m[1]);
    // alpha 0 là overlay backdrop cố ý — không phải shadow.
    if (alpha === 0) return match;

    changed++;
    // Giữ nguyên giá trị cũ làm fallback phía sau token.
    return `box-shadow: var(${tokenFor(alpha)}, ${body.trim()});`;
  });

  if (changed > 0) {
    total += changed;
    console.log(`  ${file}: ${changed} rule`);
    if (WRITE) writeFileSync(file, out);
  }
}

console.log(
  total === 0
    ? "Không còn box-shadow hardcoded nền tối."
    : `\nTổng ${total} rule. ${WRITE ? "Đã ghi." : "Chạy lại với --write để ghi."}`
);