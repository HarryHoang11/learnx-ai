// Kiểm tra `.form-input` / `.form-textarea` / `.form-select` có bị ghi đè bởi
// inline style hay không.
//
// VÌ SAO CẦN: project có nhiều component vẫn dùng
// `style={{ padding: …, fontSize: 14 }}` NGAY CẠNH class dùng chung. Inline
// style thắng mọi rule thường của stylesheet, nên nếu ai đó khai báo
// `height`/`line-height` ở `.form-input` thì những ô đó sẽ KHÔNG nhận — và
// ngay trong trang đang sửa thì lệch, ở trang khác thì không. Script này giữ
// cho "dùng chung" đúng nghĩa đúng màn hình, thay vì chỉ đúng 1 chỗ.
//
//   node scripts/check-form-inline.mjs
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SHARED = ["form-input", "form-textarea", "form-select"];

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]
  );
}

/** Thuộc tính inline sẽ phá vỡ việc dùng class dùng chung. */
const CLOBBERING = [
  "height",
  "lineHeight",
  "minHeight",
  "padding",
  "paddingTop",
  "paddingBottom",
  "fontSize",
  "borderRadius",
  "fontFamily",
];

// Quét `src/` và mọi thư mục truyền qua argv (dùng để tự kiểm chứng bằng
// fixture: `node scripts/check-form-inline.mjs scripts`).
const roots = process.argv.slice(2);
if (roots.length === 0) roots.push("src");

const problems = [];

const files = roots.flatMap((r) =>
  readdirSync(r, { withFileTypes: true }).length ? walk(r) : [r]
);

for (const file of files.filter((f) => f.endsWith(".tsx"))) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    const m = line.match(/className="([^"]*)"/);
    if (!m) return;
    const classes = m[1].split(/\s+/);
    const shared = classes.filter((c) => SHARED.includes(c));
    if (shared.length === 0) return;

    // Chỉ nhìn TRONG phần tử đang mở: từ `className` tới khoảng trắng + `/>`
    // hoặc `>`. Quét cả 12 dòng sau sẽ dính nhầm style của phần tử kế tiếp
    // (ví dụ `<p style>` ngay dưới `<textarea>`), tạo báo động giả.
    const tail = [line.slice(line.indexOf(m[0]) + m[0].length)];
    for (let j = i + 1; j < Math.min(i + 20, lines.length); j++) {
      const next = lines[j];
      tail.push(next);
      // Kết thúc thẻ: `/>` tự đóng, hoặc `>` đóng thẻ mở.
      if (/\/>\s*$/.test(next) || />\s*$/.test(next)) break;
    }
    const window = tail.join(" ");

    // `style={{ ... }}` có thể chứa `}` bên trong object, nên cắt tại `}}`
    // đóng cuối thay vì regex `[^}]*`.
    const start = window.indexOf("style={{");
    if (start === -1) return;
    const styleBody = window.slice(start, window.indexOf("}}", start));

    const hit = CLOBBERING.filter((prop) => styleBody.includes(prop));
    if (hit.length) {
      problems.push(
        `${file}:${i + 1}  .${shared.join(".")} bị inline style ghi đè: ${hit.join(", ")}`
      );
    }
  });
}

if (problems.length) {
  console.error(
    "\nClass form dùng chung đang bị inline style ghi đè (chỉ đúng ở 1 chỗ):"
  );
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}

console.log("OK — không có inline style nào ghi đè class form dùng chung.");