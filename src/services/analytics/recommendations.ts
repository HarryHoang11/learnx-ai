import type { FocusArea, RecommendedAction, SkillAnalyticsRow, WeeklyReport } from "./types";

export function buildSkillActions(subject: string, topic: string): RecommendedAction[] {
  const q = encodeURIComponent(`${subject} ${topic}`);
  const topicQ = encodeURIComponent(topic);
  return [
    { kind: "practice", href: `/practice?subject=${encodeURIComponent(subject)}&topic=${topicQ}`, subject, topic },
    { kind: "review", href: `/review?topic=${topicQ}`, subject, topic },
    { kind: "tutor", href: `/tutor?q=${q}`, subject, topic },
  ];
}

export function buildFocusAreas(
  skills: SkillAnalyticsRow[],
  mistakes: Array<{ subject: string; topic: string; mistakeCount: number; topQuestion?: string | null }>,
  currentRoadmapTopics: Set<string>,
  overdueDaysByKey: Map<string, number>
): FocusArea[] {
  const mistakeMap = new Map(mistakes.map((m) => [`${m.subject}::${m.topic}`, m]));

  const scored = skills.map((skill) => {
    const key = `${skill.subject}::${skill.topic}`;
    const reasons: string[] = [];
    let score = 0;
    score += (100 - skill.currentMastery) * 0.3;
    if (skill.recentAccuracy !== null) {
      score += (100 - skill.recentAccuracy) * 0.25;
      if (skill.recentAccuracy < 60) reasons.push("low_accuracy");
    }
    if (skill.trend === "declining") {
      score += 18;
      reasons.push("declining");
    }
    const mistakesCount = mistakeMap.get(key)?.mistakeCount ?? 0;
    if (mistakesCount > 0) {
      score += Math.min(20, mistakesCount * 3);
      reasons.push("repeated_mistakes");
    }
    if (skill.lastPracticedAt) {
      const days = Math.floor((Date.now() - new Date(skill.lastPracticedAt).getTime()) / 86_400_000);
      if (days >= 14) {
        score += 12;
        reasons.push("stale");
      }
    } else if (skill.attempts > 0) {
      score += 8;
      reasons.push("stale");
    }
    if (skill.reviewCount === 0 && skill.attempts >= 5) {
      score += 10;
      reasons.push("insufficient_review");
    }
    if (currentRoadmapTopics.has(key) || currentRoadmapTopics.has(skill.topic)) {
      score += 10;
      reasons.push("roadmap");
    }
    if (overdueDaysByKey.has(key)) {
      score += 8;
      reasons.push("overdue");
    }
    if (skill.currentMastery < 65) reasons.push("low_mastery");

    // Điểm yếu chính = câu sai NHIỀU NHẤT nếu có bằng chứng thật. Không
    // có MistakeLog thì dựng nhãn từ tín hiệu đã đo được — luôn nêu đúng
    // thứ ta biết, không bịa "lỗi khái niệm" mà dữ liệu không chứng minh.
    const topQuestion = mistakeMap.get(key)?.topQuestion ?? null;
    const mainIssue =
      topQuestion ??
      (skill.recentAccuracy !== null && skill.recentAccuracy < 60
        ? `Low accuracy (${skill.recentAccuracy}%)`
        : skill.trend === "declining"
          ? "Accuracy is trending down"
          : skill.reviewCount === 0 && skill.attempts >= 5
            ? "Practiced but never reviewed"
            : skill.currentMastery < 65
              ? "Low mastery"
              : skill.topic);

    return {
      skill,
      score,
      reasons,
      mainIssue,
      mistakesCount,
    };
  });

  return scored
    .filter((row) => row.reasons.length > 0 && (row.skill.isWeak || row.skill.trend === "declining" || row.mistakesCount >= 2))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((row) => ({
      subject: row.skill.subject,
      topic: row.skill.topic,
      mastery: row.skill.currentMastery,
      accuracy: row.skill.recentAccuracy ?? row.skill.accuracy,
      trend: row.skill.trend,
      reasons: row.reasons,
      mainIssue: row.mainIssue,
      actions: buildSkillActions(row.skill.subject, row.skill.topic),
    }));
}

export function buildWeeklyReport(input: {
  studyMinutes: number;
  exercises: number;
  accuracy: number | null;
  improvements: Array<{ subject: string; topic: string; points: number }>;
  focus: FocusArea[];
}): WeeklyReport {
  const focus = input.focus[0];
  const steps: RecommendedAction[] = focus
    ? focus.actions
    : [{ kind: "diagnostic", href: "/diagnostic" }, { kind: "practice", href: "/practice" }];

  return {
    studyMinutes: input.studyMinutes,
    exercises: input.exercises,
    accuracy: input.accuracy,
    skillsImproved: input.improvements.length,
    improved: input.improvements.slice(0, 4),
    focus: input.focus.slice(0, 3).map((f) => ({ subject: f.subject, topic: f.topic })),
    steps,
  };
}

export function topRecommendations(focus: FocusArea[], hasDiagnostic: boolean): RecommendedAction[] {
  if (focus[0]) return focus[0].actions;
  if (!hasDiagnostic) return [{ kind: "diagnostic", href: "/diagnostic" }, { kind: "practice", href: "/practice" }];
  return [
    { kind: "practice", href: "/practice" },
    { kind: "review", href: "/review" },
    { kind: "tutor", href: "/tutor" },
  ];
}
