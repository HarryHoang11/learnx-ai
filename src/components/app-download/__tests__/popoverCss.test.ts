// ================================================================
// TEST CHỐNG TÁI PHÁT: thiết kế popover tải app phải áp ở MỌI viewport
// ================================================================
//
// Vì sao cần file này: bug thật đã xảy ra (người dùng gửi ảnh) mà typecheck,
// lint và build đều SẠCH — vì CSS vẫn hợp lệ. Một dấu đóng ngoặc bị thiếu khiến
// TOÀN BỘ khối `.app-bubble-popover` bị nuốt vào trong
// `@media (max-width: 880px), (hover: none)`. Trên desktop (>880px, có hover)
// popover mất sạch style và người dùng thấy:
//   - nút đóng thành <button> mặc định của trình duyệt -> Ô VUÔNG TRẮNG chứa ×;
//   - link "Tải ứng dụng" mang màu link mặc định #0000EE -> xanh sẫm, khó đọc;
//   - icon điện thoại thành <svg> trần 16px, dính mép trên;
//   - dòng "Android · v1.0.0" mất padding của thẻ nên chạm mép dưới;
//   - popover thành flex item bị co, chữ tràn ra ngoài và chạy vào nút nổi.
// Test này đọc thẳng file CSS (không cần jsdom, không cần browser) nên chặn
// đúng lỗi đó ngay ở `npm test`.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CSS_PATH = "src/components/app-download/app-download-bubble.css";

/** Nội dung CSS đã xoá comment — comment có thể chứa ngoặc làm sai phép đếm. */
function readCss(): string {
  return readFileSync(resolve(process.cwd(), CSS_PATH), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Thân rule (các dòng `property: value`), tìm theo selector chính xác. */
function ruleBody(css: string, selector: string): string[] {
  const start = css.indexOf(`${selector} {`);
  expect(start, `không tìm thấy rule ${selector}`).toBeGreaterThan(-1);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css
    .slice(open + 1, close)
    .split(";")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Độ sâu ngoặc tại một vị trí: 0 = cấp cao nhất, >0 = đang nằm trong @media. */
function depthAt(css: string, index: number): number {
  let depth = 0;
  for (let i = 0; i < index; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
  }
  return depth;
}

/** Độ sâu của rule khớp selector (dùng `last` cho rule lồng trong @media). */
function ruleDepth(css: string, selector: string, last = false): number {
  const index = last ? css.lastIndexOf(`${selector} {`) : css.indexOf(`${selector} {`);
  expect(index, `không tìm thấy rule ${selector}`).toBeGreaterThan(-1);
  return depthAt(css, index);
}

/** Rule hợp thành giao diện popover — thiếu style ở BẤT KỲ rule nào cũng là lỗi. */
const POPOVER_RULES = [
  ".app-bubble-popover",
  ".app-bubble-popover__head",
  ".app-bubble-popover__icon",
  ".app-bubble-popover__title",
  ".app-bubble-popover__close",
  ".app-bubble-popover__close:hover",
  ".app-bubble-popover__close:focus-visible",
  ".app-bubble-popover__desc",
  ".app-bubble-popover__cta",
  ".app-bubble-popover__cta:hover",
  ".app-bubble-popover__cta:active",
  ".app-bubble-popover__cta:focus-visible",
  ".app-bubble-popover__meta",
];

describe("app download popover — style phải áp ở MỌI viewport", () => {
  const css = readCss();

  it("mọi rule của popover nằm ở cấp cao nhất, KHÔNG bị nuốt vào @media", () => {
    for (const selector of POPOVER_RULES) {
      expect(ruleDepth(css, selector), `${selector} đang nằm trong @media`).toBe(0);
    }
  });

  it("phép đếm ngoặc thực sự bắt được rule lồng trong @media (chống test rỗng)", () => {
    // `.app-bubble__tip` xuất hiện 2 lần: rule gốc (cấp 0) và bản ghi đè trong
    // @media (ẩn tooltip trên mobile) — bản CUỐI phải báo depth 1. Nếu không,
    // thuật toán đếm đã hỏng và test phía trên vô nghĩa.
    expect(ruleDepth(css, ".app-bubble__tip")).toBe(0);
    expect(ruleDepth(css, ".app-bubble__tip", true)).toBe(1);
  });

  it("popover là thẻ có viền/nền thật, không phải text trần", () => {
    const body = ruleBody(css, ".app-bubble-popover").join(";");
    // Nền token + viền + bo góc: đây là "card" người dùng nhìn thấy.
    expect(body).toMatch(/background:\s*var\(--[a-z-]+\)/);
    expect(body).toContain("border: 1px solid var(--border)");
    expect(body).toMatch(/border-radius:\s*\d+px/);
    // Padding dương ở cả 4 phía: padding-bottom = 0 thì dòng
    // "Android · v1.0.0" dán vào mép dưới (lỗi đã gặp).
    expect(body).toMatch(/padding:\s*14px/);
  });

  it("popover nằm ngoài luồng (absolute) — không thể bị nút nổi khác đè lên chữ", () => {
    const body = ruleBody(css, ".app-bubble-popover").join(";");
    // `.app-bubble-root` là flex row: bỏ `position: absolute` là popover bị co
    // lại trong khi chữ không co được -> chữ tràn ra và đè vào nút điện thoại.
    expect(body).toContain("position: absolute");
    expect(body).not.toMatch(/overflow:\s*hidden/);
  });

  it("bề rộng luôn nằm trong viewport (không horizontal scroll ở 360px)", () => {
    const body = ruleBody(css, ".app-bubble-popover").join(";");
    expect(body).toContain("width: min(320px, calc(100vw - 32px))");
  });

  it("nút đóng là button đã được style, không rơi về mặc định trình duyệt", () => {
    const body = ruleBody(css, ".app-bubble-popover__close").join(";");
    // Thiếu 2 dòng này -> browser vẽ ô vuông TRẮNG mặc định quanh dấu ×.
    expect(body).toContain("border: none");
    expect(body).toMatch(/background:\s*transparent/);
    // Vùng chạm tối thiểu 28px (đủ để bấm trên mobile).
    expect(body).toMatch(/width:\s*28px/);
    expect(body).toMatch(/height:\s*28px/);
    expect(body).toContain("flex: none");
  });

  it("icon điện thoại là ô vuông căn giữa, không bị ép co", () => {
    const body = ruleBody(css, ".app-bubble-popover__icon").join(";");
    expect(body).toContain("align-items: center");
    expect(body).toContain("justify-content: center");
    expect(body).toContain("flex: none");
    expect(body).toMatch(/width:\s*28px/);
  });

  it("nhãn CTA dùng token thiết kế, không hard-code màu", () => {
    const body = ruleBody(css, ".app-bubble-popover__cta").join(";");
    expect(body).toContain("color: var(--on-accent)");
    // Không hex trần cho màu chữ: lần trước chữ rơi về #0000EE của trình duyệt.
    expect(body).not.toMatch(/color:\s*#[0-9a-fA-F]{3,8}/);
    // Vùng chạm >= 44px theo chuẩn mobile của LearnX.
    expect(body).toMatch(/min-height:\s*44px/);
  });

  it("meta cách mép dưới bằng padding, không bằng hack dịch chuyển", () => {
    const body = ruleBody(css, ".app-bubble-popover__meta").join(";");
    expect(body).toContain("color: var(--text-dim)");
    expect(body).not.toMatch(/translate[XY]?\(/);
    expect(body).not.toMatch(/margin(-bottom)?:\s*-/);
  });
});
