// ================================================================
// <ProfileReady /> — Phase 05: HỒ SƠ HỌC TẬP ĐÃ SẴN SÀNG
// ================================================================
//
// Mạch tư duy: sau khi khảo sát + kiểm tra năng lực, người dùng cần THẤY
// kết quả trước khi bắt đầu học. Đây là màn "tôi vừa nói gì với LearnX và
// LearnX hiểu tôi thế nào" — thiếu màn này thì người dùng bấm Tiếp tục rồi
// biến mất, không bao giờ thấy hồ sơ mình vừa làm công sức xây.
//
// NGUYÊN TẮC: KHÔNG BỊA DỮ LIỆU.
//   - Hồ sơ học tập: GET /api/onboarding (chính là thứ vừa trả lời).
//   - Năng lực:      GET /api/progress -> skillMap (chỉ có sau khi làm bài).
//   - Lộ trình:      GET /api/roadmaps; nếu chưa có thì GỢI Ý tạo (không tự
//                    tạo — tạo roadmap tốn AI và user phải bấm xác nhận).
//   Thiếu gì hiện "chưa cập nhật" + nút dẫn tới nơi lấy dữ liệu đó.
// ================================================================

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, ClipboardCheck, Loader2, Target } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import AppDownloadBlock from "@/components/mobile/AppDownloadBlock";
import SkillBar from "@/components/ui/SkillBar";
import { fetchOnboardingState, sendOnboardingAction } from "@/lib/onboarding/client";
import type { LearningProfile, OnboardingState } from "@/lib/onboarding/state";
import {
  CAREER_STATUSES,
  EDUCATION_STAGES,
  FUTURE_GOALS,
  GOAL_CATEGORIES,
  STUDY_TIMES,
  TRACKS,
  gradeOptionsFor,
  type OnboardingOption,
} from "@/lib/onboarding/options";
import type { I18nKey } from "@/lib/i18n/dictionary";
import type { ApiResponse, GoalWithRoadmap, SkillMasteryPoint } from "@/types";
import "./onboarding.css";

interface ProfileReadyProps {
  /** Quay lại sửa câu trả lời (không tải lại trang). */
  onEditAnswers: () => void;
}

interface ProgressData {
  skillMap: SkillMasteryPoint[];
}

export default function ProfileReady({ onEditAnswers }: ProfileReadyProps) {
  const router = useRouter();
  const { t } = useLanguage();

  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [roadmaps, setRoadmaps] = useState<GoalWithRoadmap[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  /**
   * Đang rời màn hồ sơ. Dùng cho 2 việc: disable + xoay icon (phản hồi rõ ràng
   * khi mạng chậm) và chặn double-click (bấm 2 lần chỉ bắn 1 request).
   */
  const [leaving, setLeaving] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * 3 API gọi SONG SONG: chúng không phụ thuộc nhau và cùng phục vụ màn hiển
   * thị. Gọi tuần tự sẽ thêm round-trip cho từng cái mà không đổi kết quả.
   *
   * Mỗi fetch nuốt lỗi riêng: thiếu skillMap không được làm hỏng cả màn —
   * phần còn lại vẫn hiển thị bình thường.
   */
  const load = useCallback(async () => {
    setLoading(true);
    const [state, progressRes, roadmapRes] = await Promise.all([
      fetchOnboardingState(),
      fetch("/api/progress")
        .then((r) => (r.ok ? (r.json() as Promise<ApiResponse<ProgressData>>) : null))
        .catch(() => null),
      fetch("/api/roadmaps")
        .then((r) => (r.ok ? (r.json() as Promise<ApiResponse<GoalWithRoadmap[]>>) : null))
        .catch(() => null),
    ]);

    setOnboarding(state);
    setProgress(progressRes?.success ? progressRes.data : null);
    setRoadmaps(roadmapRes?.success ? roadmapRes.data : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Tạo lộ trình gợi ý.
   *
   * API cần `goalId`; nếu người dùng bỏ qua bước mục tiêu thì không có goal
   * để sinh lộ trình. Lúc đó báo lỗi ngay thay vì gọi API với id rỗng (sẽ 400
   * với thông báo không liên quan gì tới nguyên nhân thật).
   */
  async function createRoadmap() {
    const goalId = roadmaps?.[0]?.id;
    if (!goalId) {
      setCreateError(true);
      return;
    }
    setCreating(true);
    setCreateError(false);
    try {
      const res = await fetch("/api/roadmap/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId }),
      });
      if (!res.ok) {
        setCreateError(true);
        return;
      }
      // Tải lại để hiện plan vừa sinh — tên và chủ đề lấy từ response thật.
      await load();
    } finally {
      setCreating(false);
    }
  }

  /**
   * Ghi nhận "đã chốt khảo sát" rồi mới rời màn hồ sơ.
   *
   * BUG ĐÃ SỬA — VÒNG LẶP khi bấm "Bắt đầu học theo lộ trình":
   *   Nút đó trước đây gọi thẳng `router.push("/roadmap")`, KHÔNG ghi mốc
   *   `surveyDecidedAt`. Mà `/roadmap` lại nằm trong LEARNING_GATE_PATHS và
   *   `needsLearningProfile()` trả true khi user chưa chốt khảo sát + hồ sơ < 80%
   *   + chưa có dữ liệu học. Kết quả: bấm nút -> proxy kéo về /onboarding -> thấy
   *   đúng màn này -> bấm lại -> vòng lặp, KHÔNG BAO GIỜ ra khỏi được.
   *   Gọi `complete_survey` TRƯỚC khi điều hướng là cách sửa tận gốc: cờ tắt
   *   thì gate không kéo ngược nữa.
   *
   * VÌ SAO vẫn điều hướng kể cả khi API lỗi: người dùng đã xem xong hồ sơ, giữ
   * họ ở đây vì 1 request lỗi thì tệ hơn. Bấm lại lần sau sẽ ghi lại.
   */
  async function leaveTo(path: string) {
    // Chặn double-click: bấm 2 lần chỉ bắn 1 request (nút cũ không có chốt này).
    if (leaving) return;
    setLeaving(true);

    await sendOnboardingAction("complete_survey");
    router.push(path);
  }


  if (loading) {
    return (
      <main className="onb-screen">
        <div className="onb-glow" aria-hidden="true" />
        <div className="onb-card onb-done">
          <Loader2 size={26} aria-hidden="true" />
          <p className="onb-done-desc" style={{ marginTop: 12, marginBottom: 0 }}>
            {t("common.loading")}
          </p>
        </div>
      </main>
    );
  }

  const profile: LearningProfile | null = onboarding?.learningProfile ?? null;
  const skillMap = progress?.skillMap ?? [];
  const firstRoadmap = roadmaps?.[0] ?? null;
  const isStudent =
    !profile?.educationStage ||
    profile.educationStage === "THCS" ||
    profile.educationStage === "THPT";

  /**
   * option -> nhãn đã dịch. Giá trị nằm trong danh sách thì lấy `labelKey` rồi
   * `t()`; không có trong danh sách (người dùng gõ tay, hoặc dữ liệu từ phiên
   * bản khác) thì giữ nguyên chuỗi — hiện nguyên trạng tốt hơn hiện sai nhãn.
   */
  function opt(options: readonly OnboardingOption[], value: string | undefined): string | null {
    if (!value) return null;
    const found = options.find((o) => o.value === value);
    return found ? t(found.labelKey as I18nKey) : value;
  }

  /** Các dòng hiển thị hồ sơ — dựng qua `opt` để chỉ có 1 chỗ gọi `t`. */
  const rows: Array<{ label: string; value: string | null }> = [
    { label: t("profile.lp.stage"), value: opt(EDUCATION_STAGES, profile?.educationStage) },
    {
      label: t("onboarding.q.grade"),
      value: isStudent ? opt(gradeOptionsFor(profile?.educationStage), profile?.grade) : null,
    },
    { label: t("onboarding.q.track"), value: isStudent ? opt(TRACKS, profile?.track) : null },
    {
      label: t(
        profile?.educationStage === "WORKING" ? "onboarding.q.fieldJob" : "onboarding.q.fieldMajor"
      ),
      value: profile?.field ?? null,
    },
    { label: t("onboarding.q.topics"), value: profile?.topics ?? null },
    { label: t("onboarding.q.goal"), value: opt(GOAL_CATEGORIES, profile?.goalCategory) },
    { label: t("onboarding.q.futureGoal"), value: opt(FUTURE_GOALS, profile?.futureGoal) },
    { label: t("onboarding.q.studyTime"), value: opt(STUDY_TIMES, profile?.studyTime) },
    {
      label: t("onboarding.q.career"),
      value: isStudent ? opt(CAREER_STATUSES, profile?.careerStatus) : null,
    },
  ];

  return (
    <main className="onb-screen">
      <div className="onb-glow" aria-hidden="true" />

      <div className="onb-card">
        <div className="onb-eyebrow">{t("onboarding.phase.ready")}</div>
        <h1 className="onb-title">{t("onboarding.ready.title")}</h1>
        <p className="onb-subtitle">{t("onboarding.ready.desc")}</p>

        {/* ---- Hồ sơ học tập ---- */}
        <section className="onb-section">
          <h2 className="onb-section__title">{t("onboarding.ready.sectionProfile")}</h2>
          <dl className="onb-profile-grid">
            {rows.map((row) => (
              <div className="onb-profile-row" key={row.label}>
                <dt>{row.label}</dt>
                <dd className={row.value ? undefined : "is-empty"}>
                  {row.value || t("onboarding.ready.notSet")}
                </dd>
              </div>
            ))}
            {profile?.subjects?.length ? (
              <div className="onb-profile-row">
                <dt>{t("onboarding.q.subjects")}</dt>
                <dd>{profile.subjects.join(", ")}</dd>
              </div>
            ) : null}
          </dl>
          <button type="button" className="onb-link-btn" onClick={onEditAnswers}>
            {t("onboarding.ready.backToSurvey")}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </section>

        {/* ---- Năng lực ---- */}
        <section className="onb-section">
          <h2 className="onb-section__title">{t("onboarding.ready.sectionSkill")}</h2>
          {skillMap.length === 0 ? (
            // Rỗng là TRẠNG THÁI HỢP LỆ (chưa làm bài), không phải lỗi — nói rõ
            // và đưa nút đi làm thay vì hiện danh sách trống.
            <div className="onb-empty">
              <p>{t("onboarding.ready.skillEmpty")}</p>
              <button
                type="button"
                className="onb-btn onb-ghost"
                onClick={() => router.push("/diagnostic?from=onboarding")}
              >
                <ClipboardCheck size={15} aria-hidden="true" />
                {t("onboarding.ready.skillEmptyCta")}
              </button>
            </div>
          ) : (
            <>
              <p className="onb-field-hint" style={{ marginTop: 0 }}>
                {t("onboarding.ready.diagnosticDone")}
              </p>
              <div className="onb-skill-list">
                {skillMap.slice(0, 6).map((point) => (
                  <SkillBar
                    key={`${point.subject}-${point.topic}`}
                    // SkillBar nhận 1 chuỗi hiển thị; ghép môn + chủ đề để
                    // người dùng nhận ra đúng dòng mình vừa làm.
                    name={point.subject ? `${point.subject} · ${point.topic}` : point.topic}
                    percent={point.masteryPercent}
                    isWeak={point.isWeak}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {/* ---- Lộ trình ---- */}
        <section className="onb-section">
          <h2 className="onb-section__title">{t("onboarding.ready.sectionRoadmap")}</h2>
          {firstRoadmap ? (
            <div className="onb-roadmap">
              <div className="onb-roadmap__head">
                <Target size={16} aria-hidden="true" />
                <span className="onb-roadmap__title">{firstRoadmap.title}</span>
              </div>
              {/* Chủ đề lấy từ plan thật (Roadmap.months) — không bịa danh sách. */}
              {firstRoadmap.plan?.[0]?.topics?.length ? (
                <ul className="onb-roadmap__topics">
                  {firstRoadmap.plan[0].topics.slice(0, 3).map((topic, i) => (
                    <li key={`${topic.name ?? i}`}>{topic.name ?? ""}</li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                className="onb-btn onb-primary"
                onClick={() => void leaveTo("/roadmap")}
                disabled={leaving}
                aria-busy={leaving}
              >
                {leaving ? (
                  <Loader2 size={15} aria-hidden="true" data-leaving="true" />
                ) : (
                  <ArrowRight size={15} aria-hidden="true" />
                )}
                {t("onboarding.ready.roadmapCta")}
              </button>
            </div>
          ) : (
            <div className="onb-empty">
              <p>{t("onboarding.ready.roadmapEmpty")}</p>
              {createError && (
                <div className="onb-notice onb-notice--error" role="alert">
                  <AlertTriangle size={15} aria-hidden="true" />
                  <span>{t("common.connectionError")}</span>
                </div>
              )}
              <button
                type="button"
                className="onb-btn onb-primary"
                onClick={() => void createRoadmap()}
                disabled={creating}
                aria-busy={creating}
              >
                {creating ? (
                  <>
                    <Loader2 size={15} aria-hidden="true" />
                    {t("onboarding.ready.roadmapCreating")}
                  </>
                ) : (
                  t("onboarding.ready.roadmapCreate")
                )}
              </button>
            </div>
          )}
        </section>

        <div className="onb-actions onb-actions--stack">
          <button
            type="button"
            className="onb-btn onb-primary"
            onClick={() => void leaveTo("/dashboard")}
            disabled={leaving}
            aria-busy={leaving}
          >
            {leaving ? (
              <Loader2 size={15} aria-hidden="true" data-leaving="true" />
            ) : (
              <ArrowRight size={15} aria-hidden="true" />
            )}
            {t("onboarding.ready.dashboard")}
          </button>
        </div>

        {/* Khối tải app — DÙNG CHUNG component với Welcome (1 nguồn CSS/JSX).
            `onContinueWeb` dùng CHUNG handler `leaveTo` để nút "Tiếp tục trên web"
            cũng chốt khảo sát giống nút trên — trước đây nó đi thẳng /dashboard mà
            không chốt, nên quay lại màn này là banner "Hoàn thiện hồ sơ" hiện lại. */}
        <div className="onb-appdl">
          <AppDownloadBlock variant="full" onContinueWeb={() => void leaveTo("/dashboard")} />
        </div>
      </div>
    </main>
  );
}
