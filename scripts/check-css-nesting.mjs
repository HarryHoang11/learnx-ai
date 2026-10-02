// Kiểm tra cấu trúc CSS: phát hiện rule bị "nuốt" (thiếu `}`) — selector
// ngoài ý muốn bị nest vào rule trước, khiến style KHÔNG áp dụng trong DOM.
//
//   node scripts/check-css-nesting.mjs
//
// Dùng khi: thêm/sửa CSS theo miền chức năng (rewards.css, auth.css, ...).
import postcss from "postcss";
import { readFileSync } from "node:fs";

const FILES = [
  "src/components/rewards/rewards.css",
  "src/components/auth/auth.css",
  "src/app/globals.css",
  "src/app/welcome/welcome.css",
];

/** Rule chứa ≥2 rule con KHÔNG phải keyframes/at-rule => đáng ngờ bị nest sai. */
const SUSPICIOUS_CHILD_MIN = 2;

let failed = false;

for (const file of FILES) {
  const root = postcss.parse(readFileSync(file, "utf8"));
  const problems = [];

  root.walkRules((rule) => {
    if (!rule.nodes) return;
    const childRules = rule.nodes.filter((n) => n.type === "rule");
    // Keyframes (`from`/`to`/`50%`) là nesting hợp lệ.
    const isKeyframe = /^(from|to|\d+%)$/.test(rule.selector.trim());
    if (isKeyframe) return;
    if (childRules.length >= SUSPICIOUS_CHILD_MIN) {
      problems.push(
        `  dòng ${rule.source.start.line}-${rule.source.end.line}: ` +
          `"${rule.selector}" chứa ${childRules.length} rule con ` +
          `(vd "${childRules[0].selector}") — có phải thiếu "}"?`,
      );
    }
  });

  if (problems.length) {
    failed = true;
    console.error(`\n${file}`);
    problems.forEach((p) => console.error(p));
  }
}

if (failed) {
  console.error(
    "\nCSS có rule bị nest sai. Rule này KHÔNG khớp DOM thật nên style " +
      "không áp dụng (thường thấy: nền trắng, font mặc định, text dính liền).\n" +
      "Sửa bằng cách thêm `}` đóng rule trước đó.",
  );
  process.exit(1);
}

console.log(`OK — ${FILES.length} file CSS, không có rule bị nest sai.`);
