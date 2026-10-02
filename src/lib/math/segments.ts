export interface MathSegment {
  type: "text" | "math";
  content: string;
  display: boolean;
}

// AI thường trả `\"\\\\(...\\\\)\"` (double-escape do JSON/Python string)
// thay vì `\\(...\\)`. Chuẩn hoá TRƯỚC khi tách — đây là lớp normalize
// dữ liệu đầu vào, KHÔNG phải .replace() vá từng công thức: mọi rule tách
// phía dưới giữ nguyên, các consumer (MarkdownLite/SafeMath/Mind Map export) hưởng chung.
function normalizeLatexEscapes(input: string): string {
  return input.replace(/\\\\([()[\]])/g, "\\$1");
}

// AI đôi khi quên tag đóng display math (vd mở `\\[` nhưng hết chuỗi chưa
// có `\\]`). Vá tag đóng còn thiếu ở CUỐI input — 1 lần duy nhất — để không
// có công thức nào rơi về text thường chỉ vì thiếu delimiter.
function closeUnclosedDisplayMath(input: string): string {
  const openDoubleDollar = (input.match(/\$\$/g) ?? []).length % 2 === 1;
  if (openDoubleDollar) return `${input}$$`;
  const openBrackets = (input.match(/\\\[/g) ?? []).length;
  const closeBrackets = (input.match(/\\\]/g) ?? []).length;
  if (openBrackets > closeBrackets) return `${input}\\]`;
  return input;
}

// ---------------------------------------------------------------------
// CHUẨN HOÁ LỆNH LATEX (dùng cho CẢ vùng math lẫn fragment trần)
// ---------------------------------------------------------------------
// Vì sao cần: KaTeX KHÔNG hỗ trợ `\textsuperscript` (đã kiểm chứng — báo
// "Undefined control sequence") và với `throwOnError:false` lỗi đó bị vẽ
// thành CHỮ ĐỎ. Mô hình hay sinh ra dạng này khi muốn viết mũ (`<sup>`/
// `\textsuperscript`) vì quen với HTML. Ở đây chuyển về cú pháp mà KaTeX
// hiểu: `x\textsuperscript{2}` -> `x^{2}`.
//
// Ngoài ra `\text{...}` là TEXT MODE: bên trong không hợp lệ có `^`/`_`
// hay lệnh khác. Khi nội dung `\text{}` chứa toán, đổi wrapper thành
// `\mathrm{...}` (math mode, chữ thẳng như unit) rồi mới quy đổi mũ/chỉ
// số — `\text{(m/s\textsuperscript{2})}` -> `\mathrm{(m/s^{2})}`.
// `\text{m/s}` (đơn vị thuần, KHÔNG mũ) giữ nguyên để không đổi cách
// hiển thị công thức đang chạy tốt.
export function normalizeMathLatex(input: string): string {
  const withMathrm = input.replace(
    /\\text\{((?:[^{}]|\{[^{}]*\})*)\}/g,
    (match, inner: string) => (/\\[a-zA-Z]|\^|_\{?/.test(inner) ? `\\mathrm{${inner}}` : match)
  );
  return withMathrm
    .replace(/\\textsuperscript\{([^{}]*)\}/g, "^{$1}")
    .replace(/\\textsubscript\{([^{}]*)\}/g, "_{$1}")
    .replace(/\\textsuperscript\s*([0-9A-Za-z])/g, "^{$1}")
    .replace(/\\textsubscript\s*([0-9A-Za-z])/g, "_{$1}");
}

/**
 * Gộp `\\` thừa trước lệnh LaTeX / space-macro.
 *
 * CHỈ dùng ở vùng TEXT (ngoài delimiter) hoặc khi cứu công thức đã lỗi —
 * vùng math bình thường GIỮ NGUYÊN `\\` vì đó là ngắt dòng hợp lệ của
 * matrix/cases. Không đụng `\\n`, `\\t`... (escape của text thường).
 */
export function collapseDoubleBackslash(input: string): string {
  return input.replace(/\\\\(?=[A-Za-z;,:!{}()[\]])/g, "\\");
}

// ---------------------------------------------------------------------
// WHITELIST LỆNH LATEX — chỉ lệnh nằm trong danh sách mới được coi là
// toán khi quét fragment TRẦN (ngoài delimiter). Nhờ vậy đường dẫn file
// kiểu `C:\Users` hay escape text (`\n`) KHÔNG bao giờ bị bọc nhầm vào
// công thức. Danh sách đóng = hẹp có kiểm soát; thêm mắt xăng cũng phải
// thêm test tương ứng.
const LATEX_COMMANDS = new Set([
  // text / style
  "text", "textrm", "textbf", "textit", "texttt", "textnormal",
  "mathrm", "mathbf", "mathit", "mathsf", "mathcal", "mathbb", "boldsymbol", "operatorname",
  // phân số, căn, nhị phân
  "frac", "dfrac", "tfrac", "binom", "dbinom", "sqrt",
  "cdot", "times", "div", "pm", "mp", "ast", "star", "circ", "bullet", "oplus", "otimes",
  // quan hệ
  "le", "leq", "ge", "geq", "ne", "neq", "approx", "equiv", "sim", "simeq", "propto",
  "ll", "gg", "subset", "supset", "subseteq", "supseteq", "cup", "cap", "in", "notin", "ni",
  "forall", "exists", "nexists", "neg", "lnot",
  // toán tử, tổng, tích phân
  "sum", "prod", "coprod", "int", "iint", "iiint", "oint", "lim", "limsup", "liminf",
  "max", "min", "sup", "inf", "det", "dim", "ker", "deg", "gcd", "ln", "log", "exp",
  "sin", "cos", "tan", "cot", "sec", "csc", "arcsin", "arccos", "arctan", "sinh", "cosh", "tanh",
  // ma trận, ngoặc lớn
  "left", "right", "begin", "end", "pmatrix", "bmatrix", "vmatrix", "Vmatrix", "Bmatrix",
  "matrix", "cases", "aligned", "array", "substack",
  // dấu trên/dưới
  "vec", "hat", "bar", "dot", "ddot", "tilde", "overline", "underline", "overbrace",
  "underbrace", "stackrel", "overset", "underset", "widetilde", "widehat",
  // khoảng trắng, chấm
  "ldots", "cdots", "vdots", "ddots", "dots", "quad", "qquad", "space", "hspace", "vspace",
  "thinspace", "medspace", "thickspace", "negthinspace", "lspace", "rspace", "colon",
  // hạ nhãn
  "partial", "nabla", "infty", "aleph", "to", "iff", "therefore", "because", "degree",
  // chữ Hy Lạp (LaTeX phân biệt hoa/thường — giữ nguyên case)
  "alpha", "beta", "gamma", "delta", "epsilon", "varepsilon", "zeta", "eta", "theta", "vartheta",
  "iota", "kappa", "lambda", "mu", "nu", "xi", "omicron", "rho", "varrho", "sigma", "varsigma",
  "tau", "upsilon", "phi", "varphi", "chi", "psi", "omega",
  "Gamma", "Delta", "Theta", "Lambda", "Xi", "Pi", "Sigma", "Upsilon", "Phi", "Psi", "Omega",
  // mũ/chỉ số kiểu HTML — có trong whitelist để nhận diện rồi chuyển đổi
  "textsuperscript", "textsubscript",
]);

const SPACING_MACROS = new Set([";", ",", "!", ":"]);

function isLatinLetter(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z");
}

// Đọc 1 lệnh tại vị trí `i` (text[i] === "\\"). Trả vị trí SAU lệnh nếu là
// lệnh toán hợp lệ, null nếu không phải (lệnh lạ / escape thường).
function readLatexCommand(text: string, i: number): number | null {
  const next = text[i + 1];
  if (next === undefined) return null;
  if (SPACING_MACROS.has(next)) return i + 2;
  if (!isLatinLetter(next)) return null;
  let j = i + 1;
  while (j < text.length && isLatinLetter(text[j])) j += 1;
  return LATEX_COMMANDS.has(text.slice(i + 1, j)) ? j : null;
}

// Đọc nhóm `{...}` cân bằng (chịu 1 cấp lồng). Trả -1 nếu không cân bằng.
function readBraceGroup(text: string, i: number): number {
  let depth = 0;
  for (let j = i; j < text.length; j += 1) {
    if (text[j] === "{") depth += 1;
    else if (text[j] === "}") {
      depth -= 1;
      if (depth === 0) return j + 1;
    }
  }
  return -1;
}

// Ký tự có thể nằm trong công thức. Ký tự >= 128 (tiếng Việt có dấu,
// emoji) là ranh giới: dừng run để không nuốt chữ văn xuôi vào math mode.
const MATH_CHAR = /[\sA-Za-z0-9.,;:()[\]{}+\-*/^_=|<>]/;

// Quét từ `start` để tìm độ dài của 1 fragment công thức.
// Trả -1 nếu không có lệnh toán nào (không phải công thức).
function scanFormulaRun(text: string, start: number): number {
  let i = start;
  let commands = 0;
  let closedGroup = false;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\") {
      const after = readLatexCommand(text, i);
      if (after === null) break;
      commands += 1;
      i = after;
      continue;
    }
    if (ch === "{") {
      const end = readBraceGroup(text, i);
      if (end < 0) break;
      closedGroup = true;
      i = end;
      continue;
    }
    // Sau khi đã đóng nhóm `{}`, chữ cái đơn lẻ KHÔNG được nuốt — đó là
    // chữ văn xuôi phía sau công thức (vd "…\text{(m/s^2)} nhé").
    if (isLatinLetter(ch)) {
      if (closedGroup) break;
      i += 1;
      continue;
    }
    if (ch === "}") break;
    if (MATH_CHAR.test(ch)) {
      i += 1;
      continue;
    }
    break;
  }
  if (commands === 0) return -1;
  // Bỏ khoảng trắng/dấu câu thừa ở cuối run (không nuốt vào công thức).
  while (i > start && /[\s.,;:!?]/.test(text[i - 1])) i -= 1;
  return i;
}

/**
 * Bọc fragment LaTeX TRẦN (AI hay quên delimiter, vd đáp án
 * `\; \text{(m/s\textsuperscript{2})}`) thành math để KaTeX render.
 *
 * Nguyên tắc an toàn:
 *  - Có markdown markup (`` ` ``, `*`) → KHÔNG đụng: để MarkdownLite xử lý
 *    code span/italic trước, không được biến code thành công thức.
 *  - Chỉ coi là toán khi gặp lệnh trong WHITELIST (bảo vệ đường dẫn file).
 *  - Dừng run ở ký tự có dấu (tiếng Việt) → phần chữ văn xuôi giữ nguyên
 *    là text, không bị kéo vào math mode (italic/lệch).
 *  - Không tìm thấy run nào → trả về NGUYÊN input để không đổi hành vi của
 *    mọi nội dung không liên quan.
 */
export function expandBareLatex(text: string): MathSegment[] {
  const asText: MathSegment = { type: "text", content: text, display: false };
  if (!text.includes("\\")) return [asText];
  if (/[`*]/.test(text)) return [asText];

  const cleaned = normalizeMathLatex(collapseDoubleBackslash(text));
  const segments: MathSegment[] = [];
  let cursor = 0; // vị trí đã emit trong `cleaned`
  let i = 0;
  while (i < cleaned.length) {
    if (cleaned[i] !== "\\") {
      i += 1;
      continue;
    }
    const end = scanFormulaRun(cleaned, i);
    if (end <= i) {
      i += 1;
      continue;
    }
    if (i > cursor) segments.push({ type: "text", content: cleaned.slice(cursor, i), display: false });
    segments.push({ type: "math", content: cleaned.slice(i, end), display: false });
    cursor = end;
    i = end;
  }
  if (segments.length === 0) return [{ type: "text", content: cleaned, display: false }];
  if (cursor < cleaned.length) {
    segments.push({ type: "text", content: cleaned.slice(cursor), display: false });
  }
  return segments;
}

/** Cứu công thức ĐÃ LỖI: dùng khi KaTeX parse fail (xem lib/math/render.ts). */
export function repairLatex(latex: string): string {
  return collapseDoubleBackslash(normalizeMathLatex(latex));
}

/**
 * Tách text thành text/math theo delimiters. Hàm thuần túy dùng chung cho UI,
 * Markdown và exporter để mọi nơi nhận diện công thức theo cùng một quy tắc.
 */
export function splitMathSegments(input: string): MathSegment[] {
  const normalized = closeUnclosedDisplayMath(normalizeLatexEscapes(input));
  const pattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;
  const segments: MathSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(normalized)) !== null) {
    if (match.index > lastIndex) {
      pushTextSegments(segments, normalized.slice(lastIndex, match.index));
    }
    const raw = match[0];
    let latex = "";
    let display = false;

    if (raw.startsWith("$$")) {
      latex = raw.slice(2, -2);
      display = true;
    } else if (raw.startsWith("\\[")) {
      latex = raw.slice(2, -2);
      display = true;
    } else if (raw.startsWith("\\(")) {
      latex = raw.slice(2, -2);
      display = false;
    } else {
      const inner = raw.slice(1, -1);
      const trimmed = inner.trim();
      const hasLetter = /[A-Za-zα-ωΑ-Ω]/.test(inner);
      const hasMathSymbol = /[\\^_{}=+\-*/|<>∫∑∏√∞∂∆∇∈∉≤≥≠≈±×÷·]/.test(inner);
      const textualPunctuation = /[.,:;?!]/.test(inner);
      const currencyLike = !hasLetter && !hasMathSymbol;
      if (trimmed !== "" && (hasMathSymbol || (hasLetter && (!textualPunctuation || /[=<>+\-*/^_{}\\]/.test(inner))))) {
        latex = inner;
      } else if (!currencyLike && trimmed !== "" && hasLetter && !/\s/.test(trimmed)) {
        latex = inner;
      } else {
        segments.push({ type: "text", content: raw, display: false });
        lastIndex = match.index + raw.length;
        continue;
      }
    }

    segments.push({ type: "math", content: normalizeMathLatex(latex.trim()), display });
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < normalized.length) {
    pushTextSegments(segments, normalized.slice(lastIndex));
  }
  return segments;
}

// Vùng text (ngoài delimiter) đi qua lớp bọc fragment LaTeX trần để AI quên
// delimiter vẫn hiện công thức đẹp thay vì lộ raw \text{...}.
function pushTextSegments(segments: MathSegment[], text: string) {
  for (const seg of expandBareLatex(text)) segments.push(seg);
}
