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
      segments.push({ type: "text", content: normalized.slice(lastIndex, match.index), display: false });
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

    segments.push({ type: "math", content: latex.trim(), display });
    lastIndex = match.index + raw.length;
  }

  if (lastIndex < normalized.length) {
    segments.push({ type: "text", content: normalized.slice(lastIndex), display: false });
  }
  return segments;
}
