export type DataAvailability = "empty" | "low" | "ready";
export type SkillTrend = "improving" | "stable" | "declining" | "insufficient";
export type ComparisonKind = "percent" | "pp" | "none";

export interface MetricComparison {
  current: number;
  previous: number | null;
  delta: number | null;
  kind: ComparisonKind;
  direction: "up" | "down" | "flat" | "unknown";
}

export interface LearningScoreBreakdown {
  consistency: number | null;
  practice: number | null;
  skill: number | null;
  review: number | null;
  goal: number | null;
  improvement: number | null;
}

export interface LearningScoreResult {
  score: number | null;
  lowConfidence: boolean;
  usedComponents: Array<keyof LearningScoreBreakdown>;
  breakdown: LearningScoreBreakdown;
}

export interface DailyActivityPoint {
  day: string;
  studyMinutes: number;
  exercises: number;
  reviews: number;
  tutorSessions: number;
  attempts: number;
  correct: number;
  xp: number;
}

export interface SkillAnalyticsRow {
  subject: string;
  topic: string;
  currentMastery: number;
  previousMastery: number | null;
  change: number | null;
  attempts: number;
  attemptsInRange: number;
  accuracy: number | null;
  recentAccuracy: number | null;
  reviewCount: number;
  lastPracticedAt: string | null;
  trend: SkillTrend;
  isWeak: boolean;
  isMastered: boolean;
  evidence: SkillEvidence;
}

export interface SkillEvidence {
  exercisesCompleted: number;
  reviews: number;
  tutorSessions: number;
  accuracyBefore: number | null;
  accuracyAfter: number | null;
  enoughForWhy: boolean;
}

export interface ImprovementCard {
  subject: string;
  topic: string;
  points: number;
  evidence: SkillEvidence;
}

export interface FocusArea {
  subject: string;
  topic: string;
  mastery: number;
  accuracy: number | null;
  trend: SkillTrend;
  reasons: string[];
  mainIssue: string;
  actions: RecommendedAction[];
}

export interface CommonMistake {
  subject: string;
  topic: string;
  mistakeCount: number;
  /**
   * Câu hỏi bị sai NHIỀU NHẤT trong nhóm (không phải câu sai mới nhất).
   *
   * Đây là bằng chứng THẬT cho "main issue" — LearnX KHÔNG có cột `concept`
   * trong MistakeLog nên không được tự gắn nhãn "conceptual error"; nói
   * "bạn sai câu này 5 lần" thì trung thực và hành động hơn.
   */
  topQuestion: string | null;
}

export interface AccuracyBreakdown {
  overall: number | null;
  previous: number | null;
  deltaPp: number | null;
  recent: number | null;
  bySubject: Array<{ subject: string; accuracy: number; attempts: number }>;
  bySkill: Array<{ subject: string; topic: string; accuracy: number; attempts: number }>;
  byDifficulty: Array<{ difficulty: string; accuracy: number; attempts: number }>;
  overTime: Array<{ day: string; accuracy: number | null; attempts: number }>;
}

export interface StudyTimeStats {
  totalMinutes: number;
  averageSessionMinutes: number | null;
  sessionsPerWeek: number | null;
  activeDays: number;
  longestSessionMinutes: number | null;
  preferredHour: number | null;
  preferredLabel: string | null;
}

export interface CorrelationResult {
  sampleDays: number;
  r: number | null;
  direction: "positive" | "negative" | "none" | "insufficient";
}

export interface JourneyMonth {
  monthKey: string;
  label: string;
  highlights: Array<{
    subject: string;
    topic: string;
    from: number;
    to: number;
  }>;
}

export interface BeforeNow {
  subject: string;
  topic: string;
  before: number;
  now: number;
  points: number;
  whatChanged: SkillEvidence;
}

export interface GoalProgressCard {
  id: string;
  title: string;
  progressPercent: number;
  remainingPercent: number | null;
  completed: string[];
  remaining: string[];
  currentFocus: string | null;
}

export interface RoadmapAnalytics {
  progressPercent: number;
  completed: number;
  total: number;
  overdue: number;
  currentFocus: string | null;
}

export interface WeeklyReport {
  studyMinutes: number;
  exercises: number;
  accuracy: number | null;
  skillsImproved: number;
  improved: Array<{ subject: string; topic: string; points: number }>;
  focus: Array<{ subject: string; topic: string }>;
  steps: RecommendedAction[];
}

export interface RecommendedAction {
  kind: "review" | "practice" | "tutor" | "diagnostic" | "roadmap";
  href: string;
  subject?: string;
  topic?: string;
}

/**
 * Bộ lọc của analytics.
 *
 * Tất cả đều TUỲ CHỌN và đều lấy từ query string. Không có giá trị = không
 * lọc (xem toàn bộ). Giá trị rỗng cũng = không lọc, để "?subject=" không làm
 * hỏng trang.
 */
export interface AnalyticsFilters {
  /** Tên môn đúng như lưu trong Attempt/LearningProgress (vd "Toán"). */
  subject?: string;
  topic?: string;
  /** easy | medium | hard — khớp cột `difficulty` của Attempt. */
  difficulty?: string;
}

/** Số môn/topic/difficulty thực sự CÓ dữ liệu — dùng để dựng dropdown filter. */
export interface AnalyticsFilterOptions {
  subjects: string[];
  topics: string[];
  difficulties: string[];
}

/** Phân tích theo môn — §4 "Subject analytics". */
export interface SubjectAnalyticsRow {
  subject: string;
  attempts: number;
  correct: number;
  accuracy: number | null;
  studyMinutes: number;
  /** Số phiên học (LearningSession) có subject này. */
  sessions: number;
  avgMastery: number | null;
  isWeak: boolean;
}

/** Phân tích theo chủ đề — §4 "Topic analytics". */
export interface TopicAnalyticsRow {
  subject: string;
  topic: string;
  attempts: number;
  accuracy: number | null;
  recentAccuracy: number | null;
  mastery: number | null;
  lastPracticedAt: string | null;
  trend: SkillTrend;
}

/** Phân tích theo độ khó — §4 "Difficulty analytics". */
export interface DifficultyAnalyticsRow {
  difficulty: string;
  attempts: number;
  correct: number;
  accuracy: number | null;
}

/**
 * Cơ cấu hoạt động — đếm theo `LearningActivity.type`.
 *
 * Đây là lý do analytics cần đọc bảng `LearningActivity`: các hoạt động KHÔNG
 * sinh Attempt (tạo mind map, upload tài liệu, hoàn thành bài học trong
 * roadmap) chỉ tồn tại ở đây. Không đọc nó thì dashboard bỏ sót toàn bộ những
 * việc user làm ngoài luyện tập.
 */
export interface ActivityMixRow {
  type: string;
  count: number;
  xp: number;
}

/**
 * Phân bổ THỜI GIAN học theo môn — "Bạn dành thời gian cho môn nào?".
 *
 * Nguồn: `LearningSession` — cùng bảng và CÙNG công thức thời gian mà
 * `StudyTimeStats` đang dùng (`completedAt - startedAt`, COALESCE về
 * `startedAt` khi phiên bị bỏ dở). Cố tình không tạo nguồn thứ hai: nếu
 * phân bổ mà tổng thời gian lệch với KPI thời gian học thì người dùng mất
 * niềm tin vào cả trang.
 *
 * `sharePercent` là phần trăm của TỔNG thời gian trong khoảng, làm tròn 1 chữ
 * số để tổng các phần trăm đọc được tròn mà vẫn cộng đúng 100.
 */
export interface SubjectTimeShare {
  subject: string;
  minutes: number;
  sharePercent: number;
  sessions: number;
}

/**
 * Kết quả luyện tập trong khoảng: Đúng / Sai / Chưa hoàn thành.
 *
 * ĐỊNH NGHĨA (không tự bịa, mỗi cái đo được từ 1 bảng):
 * - `correct`   — số câu trả lời đúng, gộp `Attempt` (trắc nghiệm/diagnostic)
 *                 + `ExerciseAttempt` (bài tập tự do).
 * - `incorrect` — câu sai, cùng 2 nguồn trên.
 * - `incomplete`— phiên học BỎ DỞ: đã trả lời ít nhất 1 câu nhưng chưa
 *                 `completedAt`. Không tính là "sai" vì người học chưa có
 *                 câu trả lời — gộp vào "sai" sẽ phủ nhận nỗ lực của họ.
 */
export interface OutcomeBreakdown {
  correct: number;
  incorrect: number;
  incomplete: number;
  /** Tổng số lượt đã đánh giá (correct + incorrect) — mẫu số cho accuracy. */
  answered: number;
  /** Tỉ lệ đúng trên số lượt đã đánh giá, null khi chưa có lượt nào. */
  accuracy: number | null;
}

/** So sánh với lần chẩn đoán ĐẦU TIÊN — §15. */
export interface SinceAssessmentRow {
  subject: string;
  topic: string;
  baseline: number;
  current: number;
  changePp: number;
}

/** Kết quả trả về khi người dùng chưa làm chẩn đoán nào. */
export interface SinceAssessment {
  hasBaseline: boolean;
  baselineDate: string | null;
  rows: SinceAssessmentRow[];
}

export interface DeterministicInsight {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  /** Nhận xét về XU HƯỚNG (tăng/giảm/đi ngang) — tách khỏi weaknesses vì
   *  "đang giảm" và "đang yếu" là 2 thông tin khác nhau. */
  trends: string[];
  /** Cảnh báo hành vi có rủi ro, vd làm nhiều bài nhưng ít ôn lại lỗi. */
  warning: string | null;
  explanation: string;
  recommendations: string[];
  source: "deterministic" | "ai";
}

export interface AchievementHighlight {
  code: string;
  title: string;
  description: string;
  icon: string | null;
  unlockedAt: string;
}

export interface OverviewTotals {
  studyMinutes: number;
  activeDays: number;
  completedExercises: number;
  completedReviews: number;
  completedRoadmapItems: number;
  tutorSessions: number;
  documentsStudied: number;
  currentStreak: number;
  longestStreak: number;
  xpEarned: number;
  lxpEarned: number;
  masteredSkills: number;
  improvingSkills: number;
  weakSkills: number;
}

export interface LearningAnalyticsPayload {
  range: AnalyticsRangeId;
  /** Bộ lọc đang áp dụng (echo lại để client biết chắc server đã lọc gì). */
  filters: AnalyticsFilters;
  /** Lựa chọn có sẵn để dựng dropdown filter — lấy từ dữ liệu thật. */
  filterOptions: AnalyticsFilterOptions;
  availability: DataAvailability;
  overview: OverviewTotals;
  metrics: {
    learningScore: MetricComparison & { lowConfidence: boolean; breakdown: LearningScoreBreakdown };
    studyTime: MetricComparison;
    exercises: MetricComparison;
    accuracy: MetricComparison;
    skillsImproved: MetricComparison;
    skillsMastered: MetricComparison;
  };
  activity: DailyActivityPoint[];
  skills: SkillAnalyticsRow[];
  improvements: ImprovementCard[];
  focusAreas: FocusArea[];
  mistakes: CommonMistake[];
  accuracy: AccuracyBreakdown;
  studyTime: StudyTimeStats;
  correlation: CorrelationResult;
  journey: JourneyMonth[];
  beforeNow: BeforeNow[];
  goals: GoalProgressCard[];
  roadmap: RoadmapAnalytics | null;
  weekly: WeeklyReport;
  achievements: AchievementHighlight[];
  recommendations: RecommendedAction[];
  deterministicInsight: DeterministicInsight;
  skillMap: Array<{ subject: string; topic: string; masteryPercent: number; isWeak: boolean }>;
  totalAttempts: number;
  accuracyPercent: number;
  streakDays: number;
  /** Phân tích theo môn — §4. */
  subjects: SubjectAnalyticsRow[];
  /** Phân tích theo chủ đề — §4. */
  topics: TopicAnalyticsRow[];
  /** Phân tích theo độ khó — §4. */
  difficulties: DifficultyAnalyticsRow[];
  /** Cơ cấu hoạt động theo LearningActivity.type. */
  activityMix: ActivityMixRow[];
  /** So sánh với chẩn đoán đầu tiên — §15. */
  sinceAssessment: SinceAssessment;
  /** Phân bổ thời gian học theo môn — "Bạn dành thời gian cho môn nào?" */
  subjectTimeShare: SubjectTimeShare[];
  /** Đúng / Sai / Chưa hoàn thành trong khoảng đang xem. */
  outcomes: OutcomeBreakdown;
}

export type AnalyticsRangeId = import("./range").AnalyticsRangeId;
