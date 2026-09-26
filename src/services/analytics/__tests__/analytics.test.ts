// Unit test cho toán phân tích học tập: công thức Learning Score, phân loại
// trend, delta (phần trăm vs điểm %) và hàng rào chống AI bịa số.
//
// Đây là phần quyết định "số trên màn hình có đáng tin không" — sai ở đây
// thì mọi insight phía dưới đều sai theo. Test thuần, không cần DB.
import { describe, expect, it } from "vitest";
import {
  composeLearningScore,
  computeConsistencyScore,
  computePracticeScore,
  computeReviewScore,
} from "../score";
import { findInventedNumbers } from "../insights";
import {
  isMastered,
  isWeakSkill,
  masteryFromCounts,
  pearsonCorrelation,
  pointDelta,
  relativeDelta,
  skillTrend,
} from "../skill-math";
import { enumerateDayKeys, fillDailySeries, parseAnalyticsRange, resolveAnalyticsWindow } from "../range";
import { parseAnalyticsFilters, toAttemptWhere } from "../filters";
import { buildDeterministicInsight } from "../insights";
import { buildOutcomeBreakdown, buildSubjectTimeShare } from "../outcomes";
import type { LearningAnalyticsPayload } from "../types";

// ---- Phân bổ thời gian theo môn (§8) ----
describe("buildSubjectTimeShare", () => {
  it("tỉ lệ tính trên tổng của chính các dòng, cộng lại đủ 100%", () => {
    const rows = [
      { subject: "Toán", minutes: 100, sessions: 3 },
      { subject: "Tin học", minutes: 60, sessions: 2 },
      { subject: "Vật lý", minutes: 40, sessions: 1 },
    ];
    const share = buildSubjectTimeShare(rows);
    expect(share.map((s) => s.sharePercent)).toEqual([50, 30, 20]);
    // Tổng = 100% là điều người dùng kiểm tra đầu tiên khi thấy biểu đồ
    // phân bổ — lệch là tin mất niềm tin vào cả trang.
    const total = share.reduce((sum, s) => sum + s.sharePercent, 0);
    expect(Math.round(total)).toBe(100);
  });

  it("giữ 1 chữ số thập phân để không mất thông tin", () => {
    const share = buildSubjectTimeShare([
      { subject: "A", minutes: 1, sessions: 1 },
      { subject: "B", minutes: 1, sessions: 1 },
      { subject: "C", minutes: 1, sessions: 1 },
    ]);
    // 1/3 = 33.33% -> làm tròn 33.3 (không phải 33 để 3 món cộng lại còn 99).
    expect(share[0].sharePercent).toBe(33.3);
  });

  it("mẫu số là tổng CÁC DÒNG, không phải tổng thời gian của KPI", () => {
    // Nếu lấy nhầm tổng của KPI (giả sử 400 phút trong khi chỉ 200 phút có
    // môn) thì các cột sẽ cộng lên 50% — con số sai mà rất khó phát hiện.
    const share = buildSubjectTimeShare([
      { subject: "Toán", minutes: 200, sessions: 4 },
    ]);
    expect(share[0].sharePercent).toBe(100);
  });

  it("không chia cho 0 khi mọi phút đều bằng 0", () => {
    const share = buildSubjectTimeShare([{ subject: "Toán", minutes: 0, sessions: 0 }]);
    expect(share[0].sharePercent).toBe(0);
    expect(Number.isNaN(share[0].sharePercent)).toBe(false);
  });

  it("chống dữ liệu rác: null/NaN/số âm không làm hỏng cả bảng", () => {
    const share = buildSubjectTimeShare([
      { subject: "A", minutes: Number.NaN, sessions: 1 },
      { subject: "B", minutes: -50, sessions: 1 },
      { subject: "C", minutes: 100, sessions: 1 },
    ]);
    expect(share.every((s) => s.minutes >= 0)).toBe(true);
    expect(share.find((s) => s.subject === "C")?.sharePercent).toBe(100);
  });

  it("mảng rỗng -> không vỡ", () => {
    expect(buildSubjectTimeShare([])).toEqual([]);
  });
});

// ---- Kết quả đúng / sai / chưa hoàn thành (§9) ----
describe("buildOutcomeBreakdown", () => {
  it("accuracy = đúng / (đúng + sai), làm tròn", () => {
    const out = buildOutcomeBreakdown([{ correct: 7, incorrect: 3 }], 0);
    expect(out).toMatchObject({ correct: 7, incorrect: 3, answered: 10, accuracy: 70 });
  });

  it("chưa có lượt nào -> accuracy null, KHÔNG phải 0", () => {
    // 0% cho người chưa làm bài là một tuyên bố sai; null khiến UI hiện
    // "chưa đủ dữ liệu".
    const out = buildOutcomeBreakdown([{ correct: 0, incorrect: 0 }], 0);
    expect(out.accuracy).toBeNull();
    expect(out.answered).toBe(0);
  });

  it("SQL trả mảng rỗng vẫn không vỡ", () => {
    const out = buildOutcomeBreakdown([], 0);
    expect(out).toMatchObject({ correct: 0, incorrect: 0, incomplete: 0, accuracy: null });
  });

  it("'chưa hoàn thành' KHÔNG nằm trong mẫu số accuracy", () => {
    // Người học bỏ dở 5 phiên nhưng câu đã làm đều đúng: bỏ 5 vào mẫu số sẽ
    // báo accuracy 63% — thành lỗi vì họ chưa có câu sai nào.
    const out = buildOutcomeBreakdown([{ correct: 10, incorrect: 0 }], 5);
    expect(out.accuracy).toBe(100);
    expect(out.incomplete).toBe(5);
    expect(out.answered).toBe(10);
  });

  it("tổng 3 nhóm bằng tổng thanh phân bổ trên UI", () => {
    const out = buildOutcomeBreakdown([{ correct: 8, incorrect: 2 }], 3);
    expect(out.correct + out.incorrect + out.incomplete).toBe(13);
  });
});

describe("parseAnalyticsRange", () => {
  it("chấp nhận 5 range hợp lệ", () => {
    // "6m" đã bị thay bằng "14d" — cửa sổ so sánh luôn cần kỳ trước BẰNG
    // ĐỘ DÀI kỳ hiện tại, nên "6 tháng" (kỳ trước 6 tháng) tốn gấp đôi
    // truy vấn mà không thêm thông tin nào so với 90 ngày.
    for (const r of ["7d", "14d", "30d", "90d", "all"]) {
      expect(parseAnalyticsRange(r)).toBe(r);
    }
  });

  it("range lạ/null rơi về 30d thay vì lỗi", () => {
    expect(parseAnalyticsRange("6m")).toBe("30d");
    expect(parseAnalyticsRange("abc")).toBe("30d");
    expect(parseAnalyticsRange(null)).toBe("30d");
    expect(parseAnalyticsRange(undefined)).toBe("30d");
  });
});

describe("resolveAnalyticsWindow", () => {
  const now = new Date("2026-03-15T12:00:00Z");

  it("kỳ trước ĐÚNG bằng độ dài kỳ hiện tại", () => {
    const w = resolveAnalyticsWindow("30d", now);
    const currentDays = (w.end.getTime() - w.start.getTime()) / 86_400_000;
    const previousDays = (w.previousEnd!.getTime() - w.previousStart!.getTime()) / 86_400_000;
    expect(currentDays).toBe(previousDays);
  });

  it("'all' KHÔNG có kỳ trước — tránh so sánh giả", () => {
    const w = resolveAnalyticsWindow("all", now);
    expect(w.previousStart).toBeNull();
    expect(w.previousEnd).toBeNull();
  });
});

describe("enumerateDayKeys / fillDailySeries", () => {
  it("giữ ĐỦ ngày kể cả ngày không có hoạt động", () => {
    // Bỏ ngày rỗng sẽ khiến biểu đồ "nén" lại và nhìn như user học liên
    // tục — sai hoàn toàn với dữ liệu thật.
    const days = enumerateDayKeys(new Date("2026-03-01T00:00:00Z"), new Date("2026-03-08T00:00:00Z"));
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-03-01");
    expect(days[6]).toBe("2026-03-07");
  });

  it("điền 0 cho ngày thiếu thay vì bỏ hẳn", () => {
    const days = ["2026-03-01", "2026-03-02", "2026-03-03"];
    const filled = fillDailySeries(days, [{ day: "2026-03-02", n: 5 }], { n: 0 });
    expect(filled).toEqual([
      { day: "2026-03-01", n: 0 },
      { day: "2026-03-02", n: 5 },
      { day: "2026-03-03", n: 0 },
    ]);
  });
});

describe("learning score", () => {
  it("KHÔNG có thành phần nào dùng được -> score null (không bịa 0)", () => {
    // Cho user mới score = 0 sẽ khiến họ tưởng mình học tệ.
    const result = composeLearningScore({
      consistency: null, practice: null, skill: null,
      review: null, goal: null, improvement: null,
    });
    expect(result.score).toBeNull();
    expect(result.lowConfidence).toBe(true);
  });

  it("chỉ vài thành phần có dữ liệu vẫn ra score, nhưng lowConfidence", () => {
    const result = composeLearningScore({
      consistency: 80, practice: 60, skill: null,
      review: null, goal: null, improvement: null,
    });
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeGreaterThanOrEqual(0);
    expect(result.score!).toBeLessThanOrEqual(100);
    expect(result.lowConfidence).toBe(true);
  });

  it("đủ thành phần -> lowConfidence = false", () => {
    const result = composeLearningScore({
      consistency: 80, practice: 70, skill: 60,
      review: 50, goal: 90, improvement: 65,
    });
    expect(result.lowConfidence).toBe(false);
    // 69.3 làm tròn 69. Test ghim đúng con số để đổi trọng số vô tình
    // sẽ bị bắt, thay vì chỉ so "trong khoảng 0..100".
    expect(result.score).toBe(69);
  });

  it("thiếu dữ liệu KHÔNG bị coi như 0 — điểm phải CAO hơn, không thấp hơn", () => {
    // Đây là bất biến quan trọng nhất: user chưa đặt mục tiêu (goal =
    // null) không được bị trừ điểm như thể họ có 0% tiến độ mục tiêu.
    const withZeroGoal = composeLearningScore({
      consistency: 80, practice: 70, skill: 60,
      review: 50, goal: 0, improvement: 65,
    });
    const withoutGoal = composeLearningScore({
      consistency: 80, practice: 70, skill: 60,
      review: 50, goal: null, improvement: 65,
    });
    expect(withoutGoal.score!).toBeGreaterThan(withZeroGoal.score!);
    // Và trọng số được chuẩn hoá lại theo các thành phần thực sự có.
    expect(withoutGoal.usedComponents).not.toContain("goal");
  });

  it("score luôn nằm trong 0..100", () => {
    const best = composeLearningScore({
      consistency: 100, practice: 100, skill: 100,
      review: 100, goal: 100, improvement: 100,
    });
    expect(best.score).toBe(100);
  });
});

describe("computeConsistencyScore", () => {
  it("0 ngày học -> 0", () => {
    expect(computeConsistencyScore(0, 30)).toBe(0);
  });

  it("học nhiều hơn mức kỳ vọng -> 100 (kẹp trần)", () => {
    expect(computeConsistencyScore(30, 30)).toBe(100);
  });
});

describe("computePracticeScore", () => {
  it("không có bài nào -> null (không phải 0)", () => {
    expect(computePracticeScore(80, 0, 20)).toBeNull();
    expect(computePracticeScore(null, 5, 20)).toBeNull();
  });

  it("ít bài nhưng đúng vẫn được chấn điểm (lượng nhỏ chỉ giảm nhẹ)", () => {
    const few = computePracticeScore(90, 3, 20)!;
    const many = computePracticeScore(90, 20, 20)!;
    expect(few).toBeGreaterThan(0);
    expect(few).toBeLessThan(many);
  });
});

describe("computeReviewScore", () => {
  it("không có review nào -> null", () => {
    expect(computeReviewScore(0, 0, 30)).toBeNull();
  });

  it("có review -> 0..100", () => {
    const score = computeReviewScore(5, 10, 30)!;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("mastery & trend", () => {
  it("mastery = correct/total, null khi chưa làm bài nào", () => {
    expect(masteryFromCounts(0, 0)).toBeNull();
    expect(masteryFromCounts(8, 10)).toBe(80);
  });

  it("thành thạo cần ĐỦ số bài, không chỉ điểm cao", () => {
    // 100% nhưng chỉ 2 bài thì chưa thể kết luận là thành thạo.
    expect(isMastered(100, 2)).toBe(false);
    expect(isMastered(85, 10)).toBe(true);
  });

  it("yếu khi mastery thấp", () => {
    expect(isWeakSkill(30)).toBe(true);
    expect(isWeakSkill(85)).toBe(false);
  });

  it("chưa đủ dữ liệu -> 'insufficient', không đoán bừa", () => {
    expect(skillTrend(30, 1)).toBe("insufficient");
    expect(skillTrend(30, 10)).toBe("improving");
    expect(skillTrend(-20, 10)).toBe("declining");
    expect(skillTrend(1, 10)).toBe("stable");
  });
});

describe("delta: phần trăm vs điểm phần trăm", () => {
  it("pointDelta = chênh lệch của chính tỉ lệ", () => {
    expect(pointDelta(79, 71)).toBe(8);
    expect(pointDelta(50, 50)).toBe(0);
  });

  it("relativeDelta = đổi % so với gốc", () => {
    expect(relativeDelta(110, 100)).toBe(10);
    expect(relativeDelta(100, 0)).toBeNull();
  });
});

describe("pearsonCorrelation", () => {
  // Dùng >= 8 cặp: code CỐ Ý trả null cho mẫu nhỏ hơn 8, vì tương quan
  // tính trên vài điểm gần như vô nghĩa và rất dễ gây hiểu nhầm.
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const ys = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20];

  it("dữ liệu hoàn hảo đồng biến -> 1", () => {
    expect(pearsonCorrelation(xs, ys)).toBeCloseTo(1, 5);
  });

  it("nghịch biến -> -1", () => {
    expect(pearsonCorrelation(xs, ys.map((y) => -y))).toBeCloseTo(-1, 5);
  });

  it("mẫu NHỎ hơn 8 -> null, KHÔNG bịa tương quan", () => {
    expect(pearsonCorrelation([1, 2, 3], [2, 4, 6])).toBeNull();
  });

  it("một dãy hằng số -> null (không có phương sai)", () => {
    expect(pearsonCorrelation([1, 1, 1, 1, 1, 1, 1, 1, 1, 1], ys)).toBeNull();
  });

  it("độ dài 2 dãy lệch nhau -> null", () => {
    expect(pearsonCorrelation(xs, [1, 2])).toBeNull();
  });
});

describe("findInventedNumbers (hàng rào chống AI bịa số)", () => {
  it("số có thật trong dữ liệu -> không bị chặn", () => {
    expect(findInventedNumbers("Accuracy is 79% and score 62.", [79, 62])).toEqual([]);
  });

  it("số BỊA -> bị phát hiện", () => {
    const invented = findInventedNumbers("Accuracy is 87%.", [79, 62]);
    expect(invented).toContain(87);
  });

  it("cho phép sai số làm tròn nhỏ", () => {
    // 79.5 -> 80 là làm tròn hợp lệ, không phải bịa số.
    expect(findInventedNumbers("Accuracy 79.5%.", [80])).toEqual([]);
  });
});

describe("parseAnalyticsFilters", () => {
  it("đọc subject/topic/difficulty từ query string", () => {
    // Để URLSearchParams tự encode thay vì viết %XX tay — viết tay dễ sai
    // byte và sinh ra test "pass" với chuỗi không tồn tại trong DB.
    const p = new URLSearchParams({ subject: "Toán", topic: "Phép Luân", difficulty: "hard" });
    expect(parseAnalyticsFilters(p)).toEqual({ subject: "Toán", topic: "Phép Luân", difficulty: "hard" });
  });

  it("giá trị rỗng = KHÔNG lọc, không phải lọc theo chuỗi rỗng", () => {
    // "?subject=" là cách client cũ gửi khi bỏ chọn; đưa thẳng xuống SQL sẽ
    // ra 0 kết quả và trang trắng thay vì hiện toàn bộ số liệu.
    const p = new URLSearchParams("subject=&topic=%20%20&difficulty=");
    expect(parseAnalyticsFilters(p)).toEqual({ subject: undefined, topic: undefined, difficulty: undefined });
  });

  it("difficulty lạ bị LOẠI, không sinh 'môn ma quỷ' trong dropdown", () => {
    expect(parseAnalyticsFilters(new URLSearchParams("difficulty=IMPOSSIBLE")).difficulty).toBeUndefined();
  });

  it("cắt chuỗi quá dài (URL bẩn không được làm query nặng)", () => {
    const filters = parseAnalyticsFilters(new URLSearchParams(`subject=${"x".repeat(500)}`));
    expect(filters.subject).toHaveLength(64);
  });

  it("null/undefined -> không lọc", () => {
    expect(parseAnalyticsFilters(null)).toEqual({});
    expect(parseAnalyticsFilters(undefined)).toEqual({});
  });
});

describe("toAttemptWhere", () => {
  it("bỏ qua điều kiện không lọc, luôn khoá theo userId", () => {
    expect(toAttemptWhere("u1", {})).toEqual({ userId: "u1" });
  });

  it("chỉ thêm field thực sự được lọc", () => {
    const where = toAttemptWhere("u1", { subject: "Toán" });
    expect(where).toEqual({ userId: "u1", subject: "Toán" });
    expect(where).not.toHaveProperty("topic");
    expect(where).not.toHaveProperty("difficulty");
  });

  it("gộp với cửa sổ thời gian", () => {
    const gte = new Date("2026-01-01T00:00:00Z");
    const lt = new Date("2026-02-01T00:00:00Z");
    expect(toAttemptWhere("u1", { difficulty: "easy" }, { gte, lt })).toEqual({
      userId: "u1", difficulty: "easy", createdAt: { gte, lt },
    });
  });
});

describe("buildDeterministicInsight", () => {
  type InsightInput = Parameters<typeof buildDeterministicInsight>[0];
  const zeroMetric = { current: 0, previous: null, delta: null, kind: "none" as const, direction: "unknown" as const };
  const base: InsightInput = {
    availability: "ready",
    metrics: {
      learningScore: { ...zeroMetric, lowConfidence: true, breakdown: { consistency: null, practice: null, skill: null, review: null, goal: null, improvement: null } },
      studyTime: zeroMetric, exercises: zeroMetric, accuracy: zeroMetric,
      skillsImproved: zeroMetric, skillsMastered: zeroMetric,
    },
    improvements: [],
    focusAreas: [],
    accuracy: { overall: 70, previous: null, deltaPp: null, recent: null, bySubject: [], bySkill: [], byDifficulty: [], overTime: [] },
    overview: {
      studyMinutes: 0, activeDays: 0, completedExercises: 0, completedReviews: 0,
      completedRoadmapItems: 0, tutorSessions: 0, documentsStudied: 0, currentStreak: 0,
      longestStreak: 0, xpEarned: 0, lxpEarned: 0, masteredSkills: 0, improvingSkills: 0, weakSkills: 0,
    },
    skills: [],
    mistakes: [],
  };

  const skill = (topic: string, trend: string) =>
    ({
      subject: "Toán", topic, currentMastery: 70, previousMastery: 50, change: 20,
      attempts: 5, attemptsInRange: 2, accuracy: 70, recentAccuracy: 70, reviewCount: 0,
      lastPracticedAt: null, trend, isWeak: false, isMastered: false,
      evidence: { exercisesCompleted: 2, reviews: 0, tutorSessions: 0, accuracyBefore: null, accuracyAfter: null, enoughForWhy: false },
    }) as unknown as LearningAnalyticsPayload["skills"][number];

  it("user mới: KHÔNG bịa 0%, nói thẳng là chưa đủ dữ liệu", () => {
    const insight = buildDeterministicInsight({ ...base, availability: "empty" });
    expect(insight.weaknesses).toEqual([]);
    expect(insight.trends).toEqual([]);
    expect(insight.warning).toBeNull();
    expect(insight.recommendations.length).toBeGreaterThan(0);
  });

  it("trend 'tụt' nằm ở trends, KHÔNG nằm ở weaknesses", () => {
    // Tách bạch là cố ý: môn 70% nhưng đang giảm KHÔNG phải bị gắn nhãn
    // "yếu" — người học sẽ hiểu nhầm là thiếu năng lực.
    const insight = buildDeterministicInsight({ ...base, skills: [skill("Đạo hàm", "declining")] });
    expect(insight.weaknesses).toEqual([]);
    expect(insight.trends.join(" ")).toContain("trending down");
  });

  it("cảnh báo khi làm nhiều bài mà không ôn lại lỗi", () => {
    const insight = buildDeterministicInsight({
      ...base,
      overview: { ...base.overview, completedExercises: 40, completedReviews: 0 },
      mistakes: [{ subject: "Toán", topic: "Phép Luân", mistakeCount: 6, topQuestion: "2x + 3 = 7" }],
    });
    expect(insight.warning).not.toBeNull();
    expect(insight.warning!.toLowerCase()).toContain("review");
  });

  it("KHÔNG cảnh báo khi người dùng ôn tập đều — tránh báo động giả", () => {
    const insight = buildDeterministicInsight({
      ...base,
      overview: { ...base.overview, completedExercises: 40, completedReviews: 12 },
    });
    expect(insight.warning).toBeNull();
  });

  it("nguồn luôn là 'deterministic' — client gắn nhãn được", () => {
    expect(buildDeterministicInsight(base).source).toBe("deterministic");
  });
});
