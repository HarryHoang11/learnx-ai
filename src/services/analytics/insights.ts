import type {
  DataAvailability,
  DeterministicInsight,
  LearningAnalyticsPayload,
  RecommendedAction,
} from "./types";

export function buildDeterministicInsight(data: Pick<
  LearningAnalyticsPayload,
  "availability" | "metrics" | "improvements" | "focusAreas" | "accuracy" | "overview" | "skills" | "mistakes"
>): DeterministicInsight {
  if (data.availability === "empty") {
    return {
      summary: "Complete your first diagnostic or practice session to start seeing personalized learning analytics.",
      strengths: [],
      weaknesses: [],
      trends: [],
      warning: null,
      explanation: "There is not enough learning activity yet to describe how you are progressing.",
      recommendations: ["Take a diagnostic to map your skills.", "Start a practice session on your roadmap."],
      source: "deterministic",
    };
  }

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const trends: string[] = [];
  const acc = data.accuracy.overall;
  const accDelta = data.accuracy.deltaPp;

  if (acc !== null) {
    if (accDelta !== null && accDelta > 0) {
      strengths.push(`Your accuracy increased by ${accDelta} percentage points compared with the previous period.`);
    } else {
      strengths.push(`Your overall practice accuracy is ${acc}%.`);
    }
  }
  if (data.improvements[0]) {
    const top = data.improvements[0];
    strengths.push(`${top.topic} improved by ${top.points} points.`);
  }
  if (data.overview.improvingSkills > 0) {
    strengths.push(`${data.overview.improvingSkills} skill${data.overview.improvingSkills === 1 ? "" : "s"} are trending upward.`);
  }

  if (data.focusAreas[0]) {
    const f = data.focusAreas[0];
    weaknesses.push(`${f.topic} is currently a focus area (mastery ${f.mastery}%).`);
  }

  // --- Xu hướng: TÁCH KHỎI weaknesses ---
  // "Đang yếu" và "đang đi xuống" là 2 thông tin khác nhau: một môn có thể
  // vẫn ở mức trung bình nhưng đang tụt. Gộp chung sẽ làm người dùng tưởng
  // có vấn đề năng lực khi thực ra chỉ là chậm lại.
  const declining = data.skills.filter((s) => s.trend === "declining");
  const improving = data.skills.filter((s) => s.trend === "improving");
  if (improving.length > 0) {
    trends.push(`${improving.length} skill${improving.length === 1 ? " is" : "s are"} moving up: ${improving.slice(0, 3).map((s) => s.topic).join(", ")}.`);
  }
  if (declining.length > 0) {
    trends.push(`${declining.length} skill${declining.length === 1 ? " is" : "s are"} trending down: ${declining.slice(0, 3).map((s) => s.topic).join(", ")}.`);
  }
  if (improving.length === 0 && declining.length === 0 && data.skills.length > 0) {
    trends.push("Your skills are holding steady — no clear upward or downward movement yet.");
  }
  if (accDelta !== null && accDelta < 0) {
    trends.push(`Accuracy dropped ${Math.abs(accDelta)} percentage points versus the previous period.`);
  }

  // --- Cảnh báo hành vi có rủi ro ---
  // Chỉ cảnh báo khi có BẰNG CHỨNG đo được, và luôn nói đây là "có thể"
  // chứ không khẳng định nguyên nhân (dữ liệu không chứng minh được).
  let warning: string | null = null;
  const heavyPractitionerLowReview =
    data.overview.completedExercises >= 10 && data.overview.completedReviews <= 1;
  if (heavyPractitionerLowReview) {
    warning =
      "You have completed many exercises but very few reviews. Mistakes you never revisit are likely to come back — review is what moves them out of long-term memory.";
  } else if (data.mistakes.length >= 3 && data.overview.completedReviews === 0) {
    warning = `You have ${data.mistakes[0].mistakeCount} logged mistakes in ${data.mistakes[0].topic} and no review sessions yet, so those mistakes may still be unresolved.`;
  } else if (data.overview.studyMinutes > 0 && data.overview.completedExercises === 0 && data.overview.completedReviews === 0) {
    warning = "You have logged study time but no completed exercises or reviews, so progress cannot be measured yet.";
  }

  const summaryParts: string[] = [];
  if (data.metrics.learningScore.current > 0) {
    summaryParts.push(`Learning Score ${data.metrics.learningScore.current}/100.`);
  }
  if (acc !== null) summaryParts.push(`Accuracy ${acc}%.`);
  if (data.improvements[0]) {
    summaryParts.push(`Biggest gain: ${data.improvements[0].topic} +${data.improvements[0].points}.`);
  } else if (data.availability === "low") {
    summaryParts.push("Your learning profile is still developing.");
  }

  const recs = data.focusAreas[0]
    ? [`Practice ${data.focusAreas[0].topic}.`, `Review ${data.focusAreas[0].topic}.`, "Ask Tutor if it is still unclear."]
    : ["Keep a consistent study streak.", "Take a diagnostic to uncover gaps."];

  return {
    summary: summaryParts.join(" ") || "Keep practicing so LearnX can describe your progress.",
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 3),
    trends: trends.slice(0, 3),
    warning,
    explanation:
      accDelta !== null && accDelta !== 0
        ? `Your accuracy changed by ${accDelta} percentage points versus the previous period. Correlation with study time is reported separately and does not imply causation.`
        : "These notes only use counts and mastery already computed from your attempts, reviews, and sessions.",
    recommendations: recs,
    source: "deterministic",
  };
}

export function actionHref(action: RecommendedAction): string {
  return action.href;
}

// ================================================================
// AI INSIGHT LAYER
// ================================================================
// Mạch tư duy: AI KHÔNG được tự tính toán. Toàn bộ số liệu đã được
// learning-analytics.service tính sẵn bằng SQL; ở đây chỉ đưa một
// payload CẤU TRÚC cho AI diễn giải lại bằng ngôn ngữ tự nhiên.
//
// Ba ràng buộc (theo yêu cầu "AI không được invent numbers"):
//   1. Prompt liệt kê TẤT CẢ con số được phép dùng, yêu cầu mọi câu khẳng
//      định phải kèm số từ danh sách đó.
//   2. findInventedNumbers() chặn output vừa parse được nhưng chứa số
//      không nằm trong payload -> coi như thất bại, fallback deterministic.
//   3. Lỗi AI (hết provider, timeout, JSON hỏng) -> trả null, caller dùng
//      deterministic. Trang KHÔNG BAO GIỜ crash vì AI.
//
// Dùng chung AI Router sẵn có (Gemini -> Groq -> DeepSeek -> OpenRouter);
// không tạo provider mới cho tính năng này.

/** Số liệu tối thiểu đủ để AI viết insight có căn cứ. */
export interface AiInsightInput {
  availability: DataAvailability;
  learningScore: number | null;
  accuracy: number | null;
  accuracyDeltaPp: number | null;
  studyMinutes: number;
  exercises: number;
  activeDays: number;
  improved: Array<{ topic: string; points: number }>;
  focus: Array<{ topic: string; mastery: number; accuracy: number | null; mainIssue: string }>;
}

const INSIGHT_SYSTEM_PROMPT = `You are the learning analyst inside LearnX AI, an education app.

You will receive a JSON snapshot of ONE student's real, already-computed learning analytics.

STRICT RULES:
1. Never invent, estimate, or extrapolate any number. Every figure you mention MUST
   appear verbatim in the provided JSON. Do not convert units or recompute.
2. If evidence is missing, say so explicitly instead of guessing.
3. Do not mention other students, averages, benchmarks, or class rankings.
4. Keep the tone encouraging and specific, never alarming or preachy.
5. Reply with JSON only, no markdown fences.

Required JSON shape:
{
  "summary": "1-2 sentences describing where this learner stands now.",
  "strengths": ["1 short evidence-backed strength"],
  "weaknesses": ["1 short evidence-backed gap"],
  "trends": ["1 short observation about direction of change over time"],
  "warning": "One behavioural risk, or null if the data shows no meaningful risk. Never invent a risk.",
  "explanation": "2-3 sentences connecting evidence to WHY progress happened or stalled. Only cite causes the data supports.",
  "recommendations": ["2-4 concrete next steps, each naming the skill it targets"]
}`;

export function buildAiInsightInput(data: LearningAnalyticsPayload): AiInsightInput {
  return {
    availability: data.availability,
    learningScore: data.metrics.learningScore.current,
    accuracy: data.accuracy.overall,
    accuracyDeltaPp: data.accuracy.deltaPp,
    studyMinutes: data.overview.studyMinutes,
    exercises: data.overview.completedExercises,
    activeDays: data.overview.activeDays,
    improved: data.improvements.slice(0, 3).map((i) => ({ topic: i.topic, points: i.points })),
    focus: data.focusAreas.slice(0, 3).map((f) => ({
      topic: f.topic,
      mastery: f.mastery,
      accuracy: f.accuracy,
      mainIssue: f.mainIssue,
    })),
  };
}

/**
 * Tìm mọi con số trong output AI KHÔNG có trong dữ liệu gốc.
 *
 * Đây là hàng rào chống bịa số. Không có nó thì chỉ cần prompt lệch một chút
 * là AI có thể viết "accuracy 87%" trong khi dữ liệu là 62% — và người dùng
 * tin ngay, vì đó là con số duy nhất họ thấy.
 *
 * Cho phép sai số làm tròn <= 0.5 (AI có thể làm tròn 79.5 thành 80).
 */
export function findInventedNumbers(text: string, allowed: number[]): number[] {
  const allowedSet = new Set(allowed.map((v) => Math.round(v * 10) / 10));
  const found = new Set<number>();
  for (const match of text.matchAll(/\d+(?:\.\d+)?/g)) {
    const value = Number(match[0]);
    if (!Number.isFinite(value)) continue;
    const rounded = Math.round(value * 10) / 10;
    if (allowedSet.has(rounded)) continue;
    if ([...allowedSet].some((a) => Math.abs(a - rounded) <= 0.5)) continue;
    found.add(value);
  }
  return [...found];
}

/** Danh sách số AI được phép nhắc tới. */
function allowedNumbers(input: AiInsightInput): number[] {
  const values: number[] = [0, 100];
  if (input.learningScore !== null) values.push(input.learningScore);
  if (input.accuracy !== null) values.push(input.accuracy);
  if (input.accuracyDeltaPp !== null) values.push(Math.abs(input.accuracyDeltaPp));
  values.push(input.studyMinutes, input.exercises, input.activeDays);
  for (const i of input.improved) values.push(i.points);
  for (const f of input.focus) {
    values.push(f.mastery);
    if (f.accuracy !== null) values.push(f.accuracy);
  }
  return values;
}

/**
 * Gọi AI để diễn giải. Trả `null` khi bất kỳ bước nào thất bại — caller
 * luôn có sẵn deterministic insight để hiển thị.
 */
export async function buildAiInsight(
  data: LearningAnalyticsPayload
): Promise<DeterministicInsight | null> {
  // Không đáng gọi AI khi user chưa đủ dữ liệu: kết quả chắc chắn là
  // "chưa đủ dữ liệu" mà lại tốn thời gian và tiền.
  if (data.availability !== "ready") return null;

  const input = buildAiInsightInput(data);
  try {
    // Dynamic import: giữ AI Router (và provider của nó) ngoài bundle khi
    // người dùng chưa mở phần AI insight.
    const { generateJSON } = await import("@/lib/ai/router");

    const insight = await generateJSON<Omit<DeterministicInsight, "source">>(
      {
        systemPrompt: INSIGHT_SYSTEM_PROMPT,
        userPrompt: `Here is the student's analytics snapshot:\n${JSON.stringify(input, null, 2)}`,
        jsonMode: true,
      },
      // Theo convention của project (xem tutor-context.service): validate
      // THROW khi shape sai — điều đó kích hoạt fallback sang provider kế
      // tiếp trong router. Trả null sẽ bị router coi là kết quả hợp lệ.
      (value): Omit<DeterministicInsight, "source"> => {
        if (!value || typeof value !== "object") throw new Error("AI insight: không phải object.");
        const v = value as Record<string, unknown>;
        const strings = ["summary", "explanation"];
        const lists = ["strengths", "weaknesses", "trends", "recommendations"];
        if (!strings.every((k) => typeof v[k] === "string" && (v[k] as string).trim().length > 0)) {
          throw new Error("AI insight: thiếu summary/explanation.");
        }
        if (!lists.every((k) => Array.isArray(v[k]) && (v[k] as unknown[]).every((s) => typeof s === "string"))) {
          throw new Error("AI insight: strengths/weaknesses/trends/recommendations sai kiểu.");
        }
        // `warning` là nullable: thiếu hẳn cũng được vì không phải lúc nào
        // cũng có cảnh báo. Sai kiểu (vd số) mới là lỗi.
        if (v.warning !== null && v.warning !== undefined && typeof v.warning !== "string") {
          throw new Error("AI insight: warning phải là chuỗi hoặc null.");
        }
        return {
          summary: v.summary as string,
          strengths: v.strengths as string[],
          weaknesses: v.weaknesses as string[],
          trends: v.trends as string[],
          warning: typeof v.warning === "string" ? v.warning : null,
          explanation: v.explanation as string,
          recommendations: v.recommendations as string[],
        };
      }
    );

    // Hàng rào cuối: nếu AI mệnh đềa số không có trong dữ liệu thì coi như
    // thất bại. Hiển thị sai số còn tệ hơn là không có AI.
    const allText = [
      insight.summary,
      insight.explanation,
      insight.warning ?? "",
      ...insight.strengths,
      ...insight.weaknesses,
      ...insight.trends,
      ...insight.recommendations,
    ].join(" ");
    const invented = findInventedNumbers(allText, allowedNumbers(input));
    if (invented.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`[analytics] AI insight chứa số không có trong dữ liệu: ${invented.join(", ")} — bỏ qua.`);
      return null;
    }

    return { ...insight, source: "ai" };
  } catch {
    // Hết provider / timeout / JSON hỏng -> deterministic hiển thị bình thường.
    return null;
  }
}

