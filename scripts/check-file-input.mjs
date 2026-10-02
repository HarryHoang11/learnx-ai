// Kiểm tra "double-trigger" file picker: `<label>` bọc `<input type="file">`
// VÀ có `onClick` gọi `.click()` → 1 cú bấm mở dialog 2 lần, lần 2 mất
// user activation ⇒ Chrome báo
// "File chooser dialog can only be shown with a user activation".
//
//   node scripts/check-file-input.mjs
//
// Ghi kèm: file picker KHÔNG được gọi từ useEffect / setTimeout / callback
// bất đồng bộ — phải nằm trực tiếp trong event của người dùng.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
  );
}

// Quét `src/` và mọi thư mục truyền vào qua argv (dùng để tự kiểm chứng
// bằng fixture: `node scripts/check-file-input.mjs scripts`).
const roots = process.argv.slice(2);
if (roots.length === 0) roots.push("src");

const files = roots
  .flatMap((r) => (readdirSync(r, { withFileTypes: true }).length ? walk(r) : [r]))
  .filter((f) => f.endsWith(".tsx"));
const problems = [];

/** Ngữ cảnh (trước/sau) quanh 1 vị trí, đủ rộng để thấy phần tử bao. */
const CONTEXT = 1200;

for (const file of files) {
  const src = readFileSync(file, "utf8");

  for (const m of src.matchAll(/type=["']file["']/g)) {
    const start = m.index ?? 0;
    const from = Math.max(0, start - CONTEXT);
    const window = src.slice(from, start + CONTEXT);

    // 1. Có `<label>` bao quanh input không? Nếu có mà vùng đó cũng gọi
    //    `.click()` thì bấm 1 lần sẽ kích hoạt input 2 lần.
    const labelOpen = window.lastIndexOf("<label");
    const inputInLabel = labelOpen > -1 && !window.slice(labelOpen, start).includes("</label>");

    if (inputInLabel && /\.click\(\)/.test(window.slice(labelOpen))) {
      problems.push(
        `${file}: <label> bao <input type="file"> LẠI có onClick gọi .click()\n` +
          `    => 1 cú bấm mở dialog 2 lần, lần 2 mất user activation.`
      );
      continue;
    }

    // 2. `.click()` cho input nằm trong useEffect / setTimeout / callback
    //    bất đồng bộ? Đó là nguồn gốc phổ biến nhất của lỗi này.
    const clickAt = window.lastIndexOf(".click()");
    if (clickAt > -1) {
      const before = window.slice(Math.max(0, clickAt - 400), clickAt);
      if (/useEffect\(|setTimeout\(|setInterval\(|\.then\(|await /.test(before)) {
        problems.push(
          `${file}: .click() trước <input type="file"> nằm trong useEffect/` +
            `setTimeout/callback bất đồng bộ — mất user activation.`
        );
      }
    }
  }
}

if (problems.length) {
  console.error("\nFile picker không an toàn:");
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}

console.log("OK — mọi <input type=\"file\"> mở từ user gesture, không double-trigger.");
