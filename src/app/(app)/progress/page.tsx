// ================================================================
// TRANG LEARNING ANALYTICS (/progress)
// ================================================================
// Mạch tư duy: đây là câu trả lời cho 5 câu hỏi của một học sinh:
//   1. Tôi đã học gì?            → Overview + Learning Activity
//   2. Tôi đang học tốt thế nào?  → Learning Score + Skill Profile
//   3. Tôi đã tiến bộ gì?         → Improvements + Before → Now
//   4. Tôi đang yếu ở đâu?       → Focus Areas + Common Mistakes
//   5. Nên làm gì tiếp theo?      → Recommended Actions
// Thứ tự section cố ý BẤM ĐẦU bằng "mình ở đâu" và KẾT THÚC bằng "làm gì
// tiếp" — người dùng không phải cuộn tìm mới thấy hành động.
//
// Toàn bộ số liệu do /api/analytics tính sẵn ở SERVER. Trang này KHÔNG tự
// tính con số nào, chỉ định dạng và trình bày — đó là cách bảo đảm số trên
// màn hình luôn khớp với số trong DB.
// ================================================================

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, TrendingDown, TrendingUp, Minus } from "lucide-react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import { BarChart, LineChart } from "@/components/analytics/AnalyticsChart";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ApiResponse } from "@/types";
import type { I18nKey } from "@/lib/i18n/dictionary";
import type { AnalyticsRangeId, LearningAnalyticsPayload } from "@/services/analytics/types";

// 5 khoảng đúng như spec. Key i18n map TƯỜNG MINH thay vì ghép chuỗi
// `analytics.range.${r}`: ghép động làm TypeScript không kiểm được key tồn tại,
// nên đổi tên trong dictionary sẽ hỏng lúc chạy chứ không báo lỗi lúc build.
const RANGES: Array<{ id: AnalyticsRangeId; labelKey: I18nKey }> = [
  { id: "7d", labelKey: "analytics.range.7d" },
  { id: "14d", labelKey: "analytics.range.14d" },
  { id: "30d", labelKey: "analytics.range.30d" },
  { id: "90d", labelKey: "analytics.range.90d" },
  { id: "all", labelKey: "analytics.range.all" },
];

type AnalyticsData = LearningAnalyticsPayload & {
  insight: LearningAnalyticsPayload["deterministicInsight"];
};

export default function ProgressPage() {
  const { t } = useLanguage();
  const [range, setRange] = useState<AnalyticsRangeId>("30d");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (nextRange: AnalyticsRangeId, filters: { subject: string; topic: string; difficulty: string }) => {
      setLoading(true);
      setError(null);
      try {
        // Chỉ gắn param khi có giá trị — "?subject=" rỗng vẫn được server
        // coi là không lọc, nhưng URL gọn hơn và dễ chia sẻ.
        const params = new URLSearchParams({ range: nextRange });
        if (filters.subject) params.set("subject", filters.subject);
        if (filters.topic) params.set("topic", filters.topic);
        if (filters.difficulty) params.set("difficulty", filters.difficulty);
        const res = await fetch(`/api/analytics?${params.toString()}`);
        const json = (await res.json()) as ApiResponse<AnalyticsData>;
        // ApiResponse là discriminated union: `error` chỉ tồn tại ở nhánh
        // success = false, nên phải thu hẹp trước khi đọc.
        if (!json.success) {
          setError(json.error);
          return;
        }
        setData(json.data);
      } catch {
        setError(t("common.connectionError"));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  const filters = { subject, topic, difficulty };
  useEffect(() => {
    void load(range, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, subject, topic, difficulty, load]);

  /** Định dạng phút -> "18h 42m". */
  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  const hasFilter = Boolean(subject || topic || difficulty);

  return (
    <section className="page-enter">
      <header className="analytics-header">
        <h2 className="page-title">{t("analytics.title")}</h2>
        <p className="analytics-header__sub">{t("analytics.subtitle")}</p>
      </header>

      {/* Bộ chọn khoảng thời gian luôn hiện, kể cả khi đang tải, để người
          dùng đổi khoảng mà không phải chờ. */}
      <div className="analytics-range" role="group" aria-label={t("analytics.rangeLabel")}>
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`analytics-range__btn${range === r.id ? " is-active" : ""}`}
            onClick={() => setRange(r.id)}
            aria-pressed={range === r.id}
          >
            {t(r.labelKey)}
          </button>
        ))}
      </div>

      {/* Bộ lọc — danh sách lấy từ DỮ LIỆU THẬT (filterOptions do server trả
          về), không hard-code môn. Chỉ hiện sau khi có dữ liệu để user mới
          không thấy 3 dropdown trống. */}
      {data && data.filterOptions.subjects.length > 0 && (
        <div className="analytics-filters">
          <label className="analytics-filter">
            <span>{t("analytics.filter.subject")}</span>
            {/* Đổi môn thì XOÁ luôn chủ đề đang chọn: danh sách topic được
                server thu hẹp theo môn, nên giữ topic cũ sẽ gửi một cặp
                (môn mới, chủ đề cũ) không tồn tại -> kết quả rỗng và dropdown
                hiện trống. Reset là hành vi dễ đoán nhất cho người dùng. */}
            <select
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                setTopic("");
              }}
            >
              <option value="">{t("analytics.filter.all")}</option>
              {data.filterOptions.subjects.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>

          {subject && data.filterOptions.topics.length > 0 && (
            <label className="analytics-filter">
              <span>{t("analytics.filter.topic")}</span>
              <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="">{t("analytics.filter.all")}</option>
                {data.filterOptions.topics.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          )}

          {data.filterOptions.difficulties.length > 1 && (
            <label className="analytics-filter">
              <span>{t("analytics.filter.difficulty")}</span>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="">{t("analytics.filter.all")}</option>
                {data.filterOptions.difficulties.map((d) => (
                  <option key={d} value={d}>{t(`analytics.difficulty.${d}` as I18nKey)}</option>
                ))}
              </select>
            </label>
          )}

          {hasFilter && (
            <button
              type="button"
              className="analytics-filters__clear"
              onClick={() => {
                setSubject("");
                setTopic("");
                setDifficulty("");
              }}
            >
              {t("analytics.filter.clear")}
            </button>
          )}
        </div>
      )}

      {hasFilter && data && (
        <p className="analytics-filter-note">
          {t("analytics.filter.active", { subject: subject || t("analytics.filter.all") })}
        </p>
      )}

      {loading && !data && (
        <div className="analytics-loading" aria-busy="true" aria-live="polite">
          <StateMessage kind="loading" text={t("analytics.loading")} />
        </div>
      )}

      {/* Lỗi KHÔNG xoá dữ liệu đang hiện: đổi khoảng lỗi thì người dùng vẫn
          thấy phần cũ thay vì màn hình trắng.
          Kèm nút "Thử lại": gọi lại đúng bộ lọc đang chọn. Trên mobile, lỗi
          mạng là chuyện thường ngày và bắt người dùng tự bấm tải lại trang là
          mất phần dữ liệu đang xem. */}
      {error && (
        <div className="analytics-error">
          <StateMessage
            kind="error"
            text={error}
            onRetry={() => void load(range, filters)}
            retryLabel={t("common.retry")}
          />
        </div>
      )}

      {data && <AnalyticsBody data={data} refreshing={loading} formatDuration={formatDuration} />}
    </section>
  );
}

/** Icon + mũi tên theo hướng thay đổi — KHÔNG dùng màu một mình (§36). */
function TrendIcon({ direction }: { direction: "up" | "down" | "flat" | "unknown" }) {
  if (direction === "up") return <TrendingUp size={14} aria-hidden="true" />;
  if (direction === "down") return <TrendingDown size={14} aria-hidden="true" />;
  return <Minus size={14} aria-hidden="true" />;
}

/**
 * Thẻ metric: giá trị + so sánh kỳ trước + tooltip giải thích CÁCH TÍNH.
 *
 * Phân biệt rõ `percent` (đổi % so với kỳ trước) và `pp` (điểm phần trăm —
 * chênh lệch của chính tỉ lệ). Trộn 2 khái niệm này là lỗi phổ biến nhất
 * trên dashboard học tập: "accuracy 71% -> 79%" là +8 ĐIỂM PHẦN TRĂM, không
 * phải "+11%".
 */
function MetricCard({
  label,
  value,
  previous,
  delta,
  kind,
  hint,
  previousLabel,
}: {
  label: string;
  value: string;
  previous: number | null;
  delta: number | null;
  kind: "percent" | "pp" | "none";
  hint: string;
  previousLabel: string;
}) {
  const { t } = useLanguage();
  const direction = delta === null ? "unknown" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";

  return (
    <div className="analytics-metric" title={hint}>
      <div className="analytics-metric__label">{label}</div>
      <div className="analytics-metric__value">{value}</div>
      {delta !== null && previous !== null ? (
        <div className={`analytics-metric__delta is-${direction}`}>
          <TrendIcon direction={direction} />
          <span>
            {delta > 0 ? "+" : ""}
            {delta}
            {kind === "pp" ? t("analytics.unit.pp") : t("analytics.unit.percent")}
          </span>
          <small>{previousLabel}</small>
        </div>
      ) : (
        <div className="analytics-metric__delta is-unknown">
          <TrendIcon direction="unknown" />
          <small>{t("analytics.noComparison")}</small>
        </div>
      )}
    </div>
  );
}

function AnalyticsBody({
  data,
  refreshing,
  formatDuration,
}: {
  data: AnalyticsData;
  refreshing: boolean;
  formatDuration: (minutes: number) => string;
}) {
  const { t } = useLanguage();
  const m = data.metrics;

  // --- EMPTY STATE (§26) ---
  // Không hiện "0% mastery / 0 Learning Score" cho user mới: những con số 0
  // đó không mang nghĩa gì và làm app trông như lỗi. Chỉ dẫn tới hành động.
  if (data.availability === "empty") {
    return (
      <Panel className="analytics-empty">
        <h3>{t("analytics.empty.title")}</h3>
        <p>{t("analytics.empty.description")}</p>
        <div className="analytics-empty__actions">
          <Link href="/diagnostic" className="btn-primary">
            {t("analytics.empty.diagnostic")}
          </Link>
          <Link href="/tutor" className="btn-secondary">
            {t("analytics.empty.start")}
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <div className={refreshing ? "analytics-body is-refreshing" : "analytics-body"}>
      {/* 1. TÔI ĐANG Ở ĐÂU --------------------------------------------- */}
      <section aria-labelledby="sec-overview">
        <h3 id="sec-overview" className="analytics-section__title">
          {t("analytics.section.overview")}
        </h3>
        <div className="analytics-metrics">
          <MetricCard
            label={t("analytics.metric.learningScore")}
            value={m.learningScore.current === null ? t("analytics.notEnough") : String(m.learningScore.current)}
            previous={m.learningScore.previous}
            delta={m.learningScore.delta}
            kind={m.learningScore.kind}
            hint={t("analytics.hint.learningScore")}
            previousLabel={t("analytics.vsPrevious")}
          />
          <MetricCard
            label={t("analytics.metric.studyTime")}
            value={formatDuration(data.overview.studyMinutes)}
            previous={m.studyTime.previous}
            delta={m.studyTime.delta}
            kind={m.studyTime.kind}
            hint={t("analytics.hint.studyTime")}
            previousLabel={t("analytics.vsPrevious")}
          />
          <MetricCard
            label={t("analytics.metric.exercises")}
            value={String(m.exercises.current)}
            previous={m.exercises.previous}
            delta={m.exercises.delta}
            kind={m.exercises.kind}
            hint={t("analytics.hint.exercises")}
            previousLabel={t("analytics.vsPrevious")}
          />
          <MetricCard
            label={t("analytics.metric.accuracy")}
            value={data.accuracy.overall === null ? t("analytics.notEnough") : `${data.accuracy.overall}%`}
            previous={data.accuracy.previous}
            delta={data.accuracy.deltaPp}
            kind="pp"
            hint={t("analytics.hint.accuracy")}
            previousLabel={t("analytics.vsPrevious")}
          />
          <MetricCard
            label={t("analytics.metric.skillsImproved")}
            value={String(m.skillsImproved.current)}
            previous={m.skillsImproved.previous}
            delta={m.skillsImproved.delta}
            kind={m.skillsImproved.kind}
            hint={t("analytics.hint.skillsImproved")}
            previousLabel={t("analytics.vsPrevious")}
          />
          <MetricCard
            label={t("analytics.metric.skillsMastered")}
            value={String(m.skillsMastered.current)}
            previous={m.skillsMastered.previous}
            delta={m.skillsMastered.delta}
            kind={m.skillsMastered.kind}
            hint={t("analytics.hint.skillsMastered")}
            previousLabel={t("analytics.vsPrevious")}
          />
        </div>
      </section>

      {/* 2. TÔI ĐÃ HỌC GÌ ----------------------------------------------- */}
      <section aria-labelledby="sec-activity">
        <h3 id="sec-activity" className="analytics-section__title">
          {t("analytics.section.activity")}
        </h3>
        <ActivitySection data={data} formatDuration={formatDuration} />
      </section>

      {/*
        2b. PHÂN BỔ THỜI GIAN THEO MÔN (§8).
        Đặt NGAY dưới biểu đồ thời gian học vì nó là câu trả lời tiếp nối:
        "học bao nhiêu" -> "học môn nào". Dùng BarChart ngang sẵn có thay vì
        donut: với 5-8 môn, thanh ngang dễ so sánh độ dài bằng mắt hơn là
        so sánh góc cung, và không cần thêm thư viện biểu đồ mới.
      */}
      {data.subjectTimeShare.length > 0 && (
        <section aria-labelledby="sec-time-share">
          <h3 id="sec-time-share" className="analytics-section__title">
            {t("analytics.section.timeShare")}
          </h3>
          <BarChart
            label={t("analytics.chart.timeShare")}
            description={t("analytics.chart.timeShareDesc")}
            data={data.subjectTimeShare.map((s) => ({
              label: s.subject,
              value: s.minutes,
              // Hiện CẢ thời lượng lẫn tỉ lệ: người dùng muốn biết "2 giờ"
              // nhiều hơn "43%" khi quyết định môn nào đáng ưu tiên.
              caption: ` · ${s.sharePercent}%`,
            }))}
            format={(v) => formatDuration(v)}
          />
        </section>
      )}

      {/*
        2c. KẾT QUẢ LUYỆN TẬP: ĐÚNG / SAI / CHƯA HOÀN THÀNH (§9).
        "Chưa hoàn thành" tách riêng khỏi "sai" vì đó là hai thông tin khác
        nhau — gộp vào sẽ khiến người học cảm thấy bị phạt vì việc bỏ dở.
      */}
      {(data.outcomes.answered > 0 || data.outcomes.incomplete > 0) && (
        <section aria-labelledby="sec-outcomes">
          <h3 id="sec-outcomes" className="analytics-section__title">
            {t("analytics.section.outcomes")}
          </h3>
          <OutcomePanel outcomes={data.outcomes} />
        </section>
      )}

      {/* 3. TÔI ĐANG HỌC TỐT THẾ NÀO ----------------------------------- */}
      <section aria-labelledby="sec-skills">
        <h3 id="sec-skills" className="analytics-section__title">
          {t("analytics.section.skills")}
        </h3>
        {data.skills.length === 0 ? (
          <Panel>
            <p className="analytics-muted">{t("analytics.lowData")}</p>
          </Panel>
        ) : (
          <BarChart
            label={t("analytics.chart.skills")}
            description={t("analytics.lowData")}
            data={data.skills.slice(0, 8).map((s) => ({
              label: s.topic,
              value: s.currentMastery,
              caption: s.change !== null && s.change !== 0 ? ` ${s.change > 0 ? "+" : ""}${s.change}` : undefined,
            }))}
            format={(v) => `${v}%`}
          />
        )}
      </section>

      {/* 4. TÔI ĐÃ TIẾN BỘ GÌ -------------------------------------------- */}
      <section aria-labelledby="sec-improved">
        <h3 id="sec-improved" className="analytics-section__title">
          {t("analytics.section.improvements")}
        </h3>
        {data.improvements.length === 0 ? (
          <Panel>
            <p className="analytics-muted">{t("analytics.noImprovement")}</p>
          </Panel>
        ) : (
          <div className="analytics-cards">
            {data.improvements.map((imp) => (
              <Panel key={`${imp.subject}-${imp.topic}`} className="analytics-card">
                <div className="analytics-card__head">
                  <span className="analytics-card__title">{imp.topic}</span>
                  <span className="analytics-card__delta is-up">
                    +{imp.points} {t("analytics.unit.pts")}
                  </span>
                </div>
                {/* EVIDENCE — chỉ hiện những thứ thực sự đo được. Không có
                    bằng chứng thì nói thẳng là không đủ dữ liệu, không bịa. */}
                {imp.evidence.enoughForWhy ? (
                  <ul className="analytics-evidence">
                    <li>{t("analytics.evidence.exercises", { n: imp.evidence.exercisesCompleted })}</li>
                    <li>{t("analytics.evidence.reviews", { n: imp.evidence.reviews })}</li>
                    {imp.evidence.accuracyBefore !== null && imp.evidence.accuracyAfter !== null && (
                      <li>
                        {t("analytics.evidence.accuracy", {
                          from: imp.evidence.accuracyBefore,
                          to: imp.evidence.accuracyAfter,
                        })}
                      </li>
                    )}
                  </ul>
                ) : (
                  <p className="analytics-muted">{t("analytics.evidence.notEnough")}</p>
                )}
              </Panel>
            ))}
          </div>
        )}
      </section>

      {/* 5. TÔI ĐANG YẾU Ở ĐÂU ------------------------------------------- */}
      <section aria-labelledby="sec-focus">
        <h3 id="sec-focus" className="analytics-section__title">
          {t("analytics.section.focus")}
        </h3>
        {data.focusAreas.length === 0 ? (
          <Panel>
            <p className="analytics-muted">
              {data.availability === "low" ? t("analytics.lowData") : t("analytics.noFocus")}
            </p>
          </Panel>
        ) : (
          <div className="analytics-cards">
            {data.focusAreas.map((f) => (
              <Panel key={`${f.subject}-${f.topic}`} className="analytics-card">
                <div className="analytics-card__head">
                  <span className="analytics-card__title">{f.topic}</span>
                  <span className="analytics-card__delta is-down">
                    {f.mastery}% {t("analytics.unit.mastery")}
                  </span>
                </div>
                <p className="analytics-card__issue">
                  {t("analytics.mainIssue")}: {f.mainIssue}
                </p>
                <ActionLinks actions={f.actions} />
              </Panel>
            ))}
          </div>
        )}

        {data.mistakes.length > 0 && (
          <>
            <h4 className="analytics-subsection__title">{t("analytics.section.mistakes")}</h4>
            <BarChart
              label={t("analytics.chart.mistakes")}
              data={data.mistakes.slice(0, 6).map((m) => ({
                label: m.topic,
                value: m.mistakeCount,
                caption: m.topQuestion ? ` · ${m.topQuestion}` : undefined,
              }))}
              format={(v) => `${v} ${t("analytics.unit.mistakes")}`}
            />
          </>
        )}
      </section>


      {/* 8b. PHÂN TÍCH THEO MÔN / ĐỘ KHÓ / CƠ CẤU HOẠT ĐỘNG --------- */}
      {data.subjects.length > 0 && (
        <section aria-labelledby="sec-subjects">
          <h3 id="sec-subjects" className="analytics-section__title">
            {t("analytics.section.subjects")}
          </h3>
          <BarChart
            label={t("analytics.chart.subjects")}
            data={data.subjects.slice(0, 6).map((s) => ({
              label: s.subject,
              value: s.accuracy ?? 0,
              caption: s.avgMastery !== null ? ` · ${t("analytics.unit.mastery")} ${s.avgMastery}%` : undefined,
            }))}
            format={(v) => `${v}%`}
          />

          {data.difficulties.length > 0 && (
            <>
              <h4 className="analytics-subsection__title">{t("analytics.section.difficulty")}</h4>
              <BarChart
                label={t("analytics.chart.difficulty")}
                data={data.difficulties.map((d) => ({
                  label: t(`analytics.difficulty.${d.difficulty}` as I18nKey),
                  value: d.accuracy ?? 0,
                  caption: ` · ${d.attempts} ${t("analytics.unit.attempts")}`,
                }))}
                format={(v) => `${v}%`}
              />
            </>
          )}
        </section>
      )}

      {data.activityMix.length > 0 && (
        <section aria-labelledby="sec-mix">
          <h3 id="sec-mix" className="analytics-section__title">
            {t("analytics.section.mix")}
          </h3>
          {/* Đọc từ LearningActivity — nguồn duy nhất cho các việc KHÔNG sinh
              Attempt (tạo mind map, upload tài liệu, hoàn thành bài học...). */}
          <BarChart
            label={t("analytics.chart.mix")}
            data={data.activityMix.slice(0, 6).map((a) => ({
              label: t(`analytics.activityType.${a.type}` as I18nKey) || a.type,
              value: a.count,
            }))}
            format={(v) => `${v}`}
          />
        </section>
      )}

      {/* 8c. SO VỚI VỚI CHẨN ĐOÁN ĐẦU TIÊN ----------------------------- */}
      {data.sinceAssessment.hasBaseline && data.sinceAssessment.rows.length > 0 && (
        <section aria-labelledby="sec-baseline">
          <h3 id="sec-baseline" className="analytics-section__title">
            {t("analytics.section.sinceAssessment")}
          </h3>
          <div className="analytics-baseline">
            {data.sinceAssessment.rows.map((r) => (
              <div key={`${r.subject}-${r.topic}`} className="analytics-baseline__row">
                <span className="analytics-baseline__topic">{r.topic}</span>
                <span className="analytics-baseline__values">
                  {r.baseline}% → {r.current}%
                </span>
                <span className={`analytics-baseline__delta ${r.changePp >= 0 ? "is-up" : "is-down"}`}>
                  {r.changePp >= 0 ? "+" : ""}
                  {r.changePp} {t("analytics.unit.pp").trim()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. TẠI SAO TÔI TIẾN BỘ ---------------------------------------- */}
      <section aria-labelledby="sec-insight">
        <h3 id="sec-insight" className="analytics-section__title">
          {t("analytics.section.insight")}
        </h3>
        <Panel className="analytics-card">
          {/* Gắn nhãn nguồn: người dùng nên biết đâu do máy tính, đâu do AI
              diễn giải. Câu của AI vẫn chỉ được phép dùng số đã có trong
              dữ liệu (đã kiểm ở server). */}
          <div className="analytics-insight__source">
            <Sparkles size={14} aria-hidden="true" />
            <span>{data.insight.source === "ai" ? t("analytics.source.ai") : t("analytics.source.data")}</span>
          </div>
          <p className="analytics-insight__summary">{data.insight.summary}</p>
          {data.insight.strengths.length > 0 && (
            <>
              <h4 className="analytics-subsection__title">{t("analytics.insight.strengths")}</h4>
              <ul className="analytics-evidence">
                {data.insight.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {data.insight.weaknesses.length > 0 && (
            <>
              <h4 className="analytics-subsection__title">{t("analytics.insight.weaknesses")}</h4>
              <ul className="analytics-evidence">
                {data.insight.weaknesses.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {/* Xu hướng tách riêng khỏi weaknesses: "đang yếu" và "đang tụt" là
              hai thông tin khác nhau, gộp chung sẽ gây hiểu nhầm. */}
          {data.insight.trends.length > 0 && (
            <>
              <h4 className="analytics-subsection__title">{t("analytics.insight.trends")}</h4>
              <ul className="analytics-evidence">
                {data.insight.trends.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {/* Cảnh báo chỉ hiện khi CÓ bằng chứng đo được; luôn dùng "có thể"
              chứ không khẳng định nguyên nhân. */}
          {data.insight.warning && (
            <div className="analytics-warning" role="note">
              <span className="analytics-warning__icon" aria-hidden="true">⚠️</span>
              <p>{data.insight.warning}</p>
            </div>
          )}
          <p className="analytics-insight__explanation">{data.insight.explanation}</p>
        </Panel>
      </section>

      {/* 7. TÔI NÊN LÀM GÌ TIẾP ---------------------------------------- */}
      <section aria-labelledby="sec-next">
        <h3 id="sec-next" className="analytics-section__title">
          {t("analytics.section.next")}
        </h3>
        <Panel className="analytics-card">
          <ActionLinks actions={data.recommendations} />
        </Panel>
      </section>

      {/* 8. HÀNH TRÌNH CỦA TÔI ------------------------------------------ */}
      {data.journey.length > 0 && (
        <section aria-labelledby="sec-journey">
          <h3 id="sec-journey" className="analytics-section__title">
            {t("analytics.section.journey")}
          </h3>
          <ol className="analytics-journey">
            {data.journey.map((month) => (
              <li key={month.monthKey} className="analytics-journey__item">
                <span className="analytics-journey__label">{month.label}</span>
                <ul>
                  {month.highlights.map((h, i) => (
                    <li key={`${h.subject}-${h.topic}-${i}`}>
                      {h.topic}: {h.from}% → {h.to}% ({h.to - h.from > 0 ? "+" : ""}
                      {h.to - h.from})
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

/**
 * Kết quả luyện tập: Đúng / Sai / Chưa hoàn thành (§9).
 *
 * Thanh phân bổ đơn (stacked bar) thay vì 3 con số rời: người dùng nhìn
 * thấy TỈ LỆ ngay — "sai 8/120" đọc chậm hơn một thanh đỏ 7%. Số tuyệt đối
 * vẫn hiện bên dưới để không mất thông tin.
 *
 * Màu bám đúng design system và phân biệt được cả khi mất màu: mỗi mảng có
 * nhãn chữ riêng, không chỉ dựa vào màu (§36).
 */
function OutcomePanel({ outcomes }: { outcomes: AnalyticsData["outcomes"] }) {
  const { t } = useLanguage();
  const { correct, incorrect, incomplete } = outcomes;

  // Mẫu số của thanh = cả 3 nhóm, vì "chưa hoàn thành" cũng là một lượt người
  // dùng đã bắt đầu. Bỏ nó ra sẽ khiến thanh luôn đầy dù không lượt nào sai.
  const total = correct + incorrect + incomplete;

  const rows: Array<{ key: string; label: string; value: number; className: string }> = [
    { key: "correct", label: t("analytics.outcome.correct"), value: correct, className: "is-correct" },
    { key: "incorrect", label: t("analytics.outcome.incorrect"), value: incorrect, className: "is-incorrect" },
    { key: "incomplete", label: t("analytics.outcome.incomplete"), value: incomplete, className: "is-incomplete" },
  ];

  return (
    <Panel>
      <div
        className="analytics-outcome-bar"
        role="img"
        aria-label={rows.map((r) => `${r.label}: ${r.value}`).join(", ")}
      >
        {rows.map(
          (r) =>
            r.value > 0 && (
              <div
                key={r.key}
                className={`analytics-outcome-bar__seg ${r.className}`}
                style={{ width: `${(r.value / total) * 100}%` }}
              />
            )
        )}
      </div>

      <ul className="analytics-outcome-legend">
        {rows.map((r) => (
          <li key={r.key} className={`analytics-outcome-legend__item ${r.className}`}>
            <span className="analytics-outcome-legend__dot" aria-hidden="true" />
            <span className="analytics-outcome-legend__label">{r.label}</span>
            <span className="analytics-outcome-legend__value">{r.value}</span>
          </li>
        ))}
      </ul>

      <p className="analytics-muted" style={{ marginTop: 10, marginBottom: 0 }}>
        {outcomes.accuracy !== null
          ? t("analytics.outcome.summary", { accuracy: outcomes.accuracy, answered: outcomes.answered })
          : t("analytics.outcome.noAccuracy")}
      </p>
    </Panel>
  );
}

/** Nhóm nút hành động — mỗi nút dẫn tới feature THẬT của LearnX. */
function ActionLinks({ actions }: { actions: AnalyticsData["recommendations"] }) {
  const { t } = useLanguage();
  if (actions.length === 0) return null;
  return (
    <div className="analytics-actions">
      {actions.map((a) => (
        <Link key={`${a.kind}-${a.href}`} href={a.href} className="btn-secondary analytics-actions__btn">
          {t(`analytics.action.${a.kind}`)}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

/** Biểu đồ hoạt động học tập + chọn metric. */
function ActivitySection({
  data,
  formatDuration,
}: {
  data: AnalyticsData;
  formatDuration: (minutes: number) => string;
}) {
  const { t } = useLanguage();
  const [metric, setMetric] = useState<"studyMinutes" | "exercises" | "reviews" | "xp">("studyMinutes");

  const points = data.activity.map((p) => ({
    day: p.day,
    value: p[metric] === 0 ? null : p[metric],
  }));

  // Nhãn trục Y đổi theo metric; "studyTime" dùng chung cho cả thời gian
  // học và "minutes" nên map riêng thay vì ghép key động.
  const axisKey: I18nKey =
    metric === "studyMinutes"
      ? "analytics.activity.studyTime"
      : metric === "exercises"
        ? "analytics.activity.exercises"
        : metric === "reviews"
          ? "analytics.activity.reviews"
          : "analytics.activity.xp";

  const format =
    metric === "studyMinutes"
      ? (v: number) => formatDuration(v)
      : metric === "xp"
        ? (v: number) => `${v} XP`
        : (v: number) => `${v} ${t(metric === "exercises" ? "analytics.unit.exercises" : "analytics.unit.reviews")}`;

  const metrics = [
    { id: "studyMinutes" as const, label: t("analytics.activity.studyTime") },
    { id: "exercises" as const, label: t("analytics.activity.exercises") },
    { id: "reviews" as const, label: t("analytics.activity.reviews") },
    { id: "xp" as const, label: t("analytics.activity.xp") },
  ];

  return (
    <Panel>
      <div className="analytics-metric-switch" role="group" aria-label={t("analytics.activity.label")}>
        {metrics.map((mm) => (
          <button
            key={mm.id}
            type="button"
            className={`analytics-metric-switch__btn${metric === mm.id ? " is-active" : ""}`}
            onClick={() => setMetric(mm.id)}
            aria-pressed={metric === mm.id}
          >
            {mm.label}
          </button>
        ))}
      </div>
      <LineChart points={points} label={t(axisKey)} format={format} description={t("analytics.lowData")} />
    </Panel>
  );
}
