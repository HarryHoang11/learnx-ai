// ================================================================
// LEARNING ONBOARDING — khảo sát học tập 5 phase, mỗi bước MỘT câu hỏi
// ================================================================
//
// Mạch tư duy sản phẩm:
//   - KHÔNG phải form 20 field. Mỗi màn hình hỏi MỘT câu.
//   - Câu HỎI ĐỔI THEO NHÓM NGƯỜI DÙNG: sinh viên được hỏi ngành, người
//     đi làm được hỏi nghề, học sinh được hỏi lớp + khối, người tự học được
//     hỏi chủ đề. Danh sách bước suy ra từ `stepsForStage()` — 1 nguồn duy
//     nhất dùng chung với thanh tiến trình (lib/onboarding/steps.ts).
//   - Mọi bước đều BỎ QUA được, và bỏ qua KHÔNG mất dữ liệu đã trả lời.
//   - Lưu sau TỪNG bước để refresh / đóng tab không mất công sức.
//   - Không bao giờ ép: bỏ qua toàn bộ vẫn vào được app, Dashboard hiện
//     banner ưu tiên (không chặn) — xem docs/WELCOME.md §1.
//
// CHỐNG GỬI TRÙNG — 3 lớp:
//   1) `savingRef` chặn ngay ở tick đầu tiên (setState chậm hơn 1 render, và
//      React Strict Mode chạy effect 2 lần ở dev).
//   2) Nút disabled + hiện "Đang lưu..." trong lúc request bay.
//   3) Server upsert theo `source = "onboarding"` nên gọi lại 2 lần cũng
//      không tạo bản ghi trùng.
//
// OFFLINE: nếu mạng lỗi, câu trả lời VẪN ở trong state và ta NÓI THẲNG là
// chưa lưu vào tài khoản — không giả vờ đã lưu.
// ================================================================

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Check,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Loader2,
  ClipboardCheck,
} from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { sendOnboardingAction, fetchOnboardingState } from "@/lib/onboarding/client";
// Dùng CHUNG hằng "Khác" với Diagnostic/Library/Roadmap — hardcode chuỗi ở đây
// là cách chắc chắn nhất để lệch giá trị khi ai đó đổi danh sách môn.
import { CUSTOM_SUBJECT_VALUE } from "@/lib/constants/subjects";
import type { LearningGoalDraft, LearningProfile } from "@/lib/onboarding/profile";
import {
  CAREER_FIELDS,
  CAREER_STATUSES,
  EDUCATION_STAGES,
  GOAL_CATEGORIES,
  AI_PREFERENCES,
  LEARNING_PREFERENCES,
  STUDY_TIMES,
  STUDY_TIME_PREFERENCES,
  SUBJECT_GROUPS,
  TRACKS,
  fieldOptionsForStage,
  futureOptionsForStage,
  gradeOptionsFor,
  intentsForStage,
} from "@/lib/onboarding/options";
import {
  PHASES,
  firstIncompleteStep,
  phaseIndexOfStep,
  phaseOfStep,
  stepsForStage,
  type StepId,
} from "@/lib/onboarding/steps";
import ProfileReady from "./ProfileReady";
import "./onboarding.css";

/** Khoá lưu cục bộ — phục vụ refresh/đóng tab, KHÔNG phải nguồn sự thật. */
const DRAFT_KEY = "learnx-onboarding-draft";

/** State của luồng. Mỗi field khớp 1 phần của LearningProfile. */
interface Draft {
  educationStage: string;
  grade: string;
  track: string;
  field: string;
  topics: string;
  intents: string[];
  goalCategory: string;
  futureGoal: string;
  goals: LearningGoalDraft[];
  subjects: string[];
  otherSubject: string;
  careerStatus: string;
  careerFields: string[];
  studyTime: string;
  studyTimePreference: string;
  aiPreferences: string[];
  learningPreferences: string[];
}

const EMPTY_DRAFT: Draft = {
  educationStage: "",
  grade: "",
  track: "",
  field: "",
  topics: "",
  intents: [],
  goalCategory: "",
  futureGoal: "",
  goals: [],
  subjects: [],
  otherSubject: "",
  careerStatus: "",
  careerFields: [],
  studyTime: "",
  studyTimePreference: "",
  aiPreferences: [],
  learningPreferences: [],
};

/** Profile đã lưu -> Draft, để user quay lại thấy đúng thứ họ đã chọn. */
function draftFromProfile(profile: LearningProfile | null): Draft {
  if (!profile) return { ...EMPTY_DRAFT };
  return {
    educationStage: profile.educationStage ?? "",
    grade: profile.grade ?? "",
    track: profile.track ?? "",
    field: profile.field ?? "",
    topics: profile.topics ?? "",
    intents: profile.intents ?? [],
    goalCategory: profile.goalCategory ?? "",
    futureGoal: profile.futureGoal ?? "",
    goals: profile.goals ?? [],
    subjects: profile.subjects ?? [],
    otherSubject: profile.otherSubject ?? "",
    careerStatus: profile.careerStatus ?? "",
    careerFields: profile.careerFields ?? [],
    studyTime: profile.studyTime ?? "",
    studyTimePreference: profile.studyTimePreference ?? "",
    aiPreferences: profile.aiPreferences ?? [],
    learningPreferences: profile.learningPreferences ?? [],
  };
}

/**
 * Draft -> payload PATCH.
 *
 * PHÂN CHIA 2 KIỂU GỬI (xem `readTextField` ở lib/onboarding/profile.ts):
 *   - `|| undefined` cho field ENUM: chưa chọn -> không gửi key, server giữ
 *     nguyên giá trị đang có. Đây là hành vi mong muốn cho enum.
 *   - giữ nguyên (kể cả `""`) cho field VĂN BẢN TỰ DO: `""` là tín hiệu
 *     "người dùng đã xoá ô" để server XOÁ field khỏi profile. Nếu đổi sang
 *     `|| undefined` thì server không bao giờ thấy tín hiệu xoá và giá trị cũ
 *     sẽ mãi mãi còn trong DB.
 */
function draftToPayload(draft: Draft): LearningProfile {
  return {
    version: 1,
    educationStage: draft.educationStage || undefined,
    grade: draft.grade || undefined,
    track: draft.track || undefined,
    // Văn bản tự do -> gửi cả "" để báo "xoá".
    field: draft.field,
    topics: draft.topics,
    otherSubject: draft.subjects.includes(CUSTOM_SUBJECT_VALUE) ? draft.otherSubject : "",
    intents: draft.intents,
    goalCategory: draft.goalCategory || undefined,
    futureGoal: draft.futureGoal,
    goals: draft.goals,
    subjects: draft.subjects,
    careerStatus: draft.careerStatus || undefined,
    careerFields: draft.careerFields,
    studyTime: draft.studyTime || undefined,
    studyTimePreference: draft.studyTimePreference || undefined,
    aiPreferences: draft.aiPreferences,
    learningPreferences: draft.learningPreferences,
  };
}

/** Bật/tắt 1 giá trị trong danh sách chọn nhiều. */
function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function LearningOnboarding() {
  const router = useRouter();
  const { t } = useLanguage();
  const { data: session, status: sessionStatus } = useSession();

  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [offline, setOffline] = useState(false);
  const [done, setDone] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Ref chặn request trùng — chặn NGAY trong cùng tick, không phụ thuộc
  // setState (xem giải thích ở đầu file).
  const savingRef = useRef(false);
  // Bước xa nhất đã đi qua, để dot bấm được và "Quay lại" không cần lịch sử.
  const furthestStepRef = useRef(0);

  /**
   * Danh sách bước SUY RA TỪ GIAI ĐOẠN, không phải hằng số.
   *
   * Đây là thay đổi lớn nhất của luồng: học sinh thấy 8 bước, sinh viên 8 bước
   * nhưng khác nội dung giữa chừng, người tự học 7 bước. `stepsForStage` là
   * nguồn duy nhất — UI ở đây và thanh tiến trình ở Dashboard cùng đọc nó.
   */
  const steps = useMemo(() => stepsForStage(draft.educationStage), [draft.educationStage]);
  const step: StepId = steps[Math.min(stepIndex, steps.length - 1)];
  const total = steps.length;
  const phase = phaseOfStep(step);
  const phaseIndex = phaseIndexOfStep(step);

  /**
   * Bước `diagnostic` là hành động (làm / bỏ qua), không phải câu hỏi: nút
   * "Tiếp tục" bị ẩn và thay bằng 2 lựa chọn rõ ràng, tránh bấm nhầm rồi bị
   * đẩy qua mà không hiểu chuyện gì vừa xảy ra.
   */
  const isDiagnosticStep = step === "diagnostic";

  // ---- Nạp hồ sơ sẵn có (nếu user quay lại từ Dashboard/Account) ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // ĐỢI session: gọi API khi chưa xác thực sẽ trả 401 và báo lỗi giả.
      if (sessionStatus !== "authenticated") return;
      const state = await fetchOnboardingState();
      if (cancelled) return;
      if (state?.learningProfile) {
        const restored = draftFromProfile(state.learningProfile);
        setDraft(restored);
        // Dừng ngay tại bước đầu tiên còn THIẾU dữ liệu thay vì bắt user
        // làm lại từ đầu những gì họ đã trả lời. `stepsForStage` dùng đúng
        // giai đoạn đã khôi phục nên chỉ số trả về luôn hợp lệ.
        setStepIndex(firstIncompleteStep(stepsForStage(restored.educationStage), restored));
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // Chỉ chạy khi session đã xác thực — không phụ thuộc `session` (object
    // này đổi identity mỗi lần refresh, gây fetch lặp).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus]);

  // ---- Lưu bản nháp cục bộ (phục vụ refresh/đóng tab) ----
  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // Private mode / hết quota: mất nháp cục bộ nhưng KHÔNG được làm hỏng
      // luồng — server vẫn là nguồn sự thật.
    }
  }, [draft, loaded]);

  // ---- Theo dõi online/offline ----
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  /** Gửi hồ sơ lên server. Trả false nếu thất bại (để giữ nguyên state). */
  const persist = useCallback(async (next: Draft, isLastStep: boolean): Promise<boolean> => {
    if (savingRef.current) return true;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOffline(true);
      return false;
    }

    savingRef.current = true;
    setSaving(true);
    setError(false);
    try {
      const ok = await sendOnboardingAction("save_learning_profile", draftToPayload(next), isLastStep);
      if (ok === null) {
        setError(true);
        return false;
      }
      return true;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, []);

  // Có mạng lại + đang lỗi -> tự thử lưu phần đang chờ (không cần bấm lại).
  useEffect(() => {
    if (offline || !error || !loaded) return;
    void persist(draft, false);
  }, [offline, error, draft, loaded, persist]);

  /**
   * Chốt khảo sát: ghi mốc `surveyDecidedAt` (server tự sinh) để Dashboard
   * tắt banner ưu tiên.
   *
   * CỐ Ý KHÔNG điều hướng ở đây: màn Profile Ready phải hiện TRƯỚC khi vào
   * app — đó là lý do tồn tại của màn đó (người dùng cần thấy hồ sơ của mình
   * trước khi bắt đầu học).
   */
  const decideSurvey = useCallback(async () => {
    await sendOnboardingAction("complete_survey");
  }, []);

  function goNext() {
    const isLast = stepIndex >= total - 1;
    void (async () => {
      const ok = await persist(draft, isLast);
      // KHÔNG chuyển bước khi lưu hỏng: chuyển đi sẽ khiến user tưởng đã lưu
      // rồi mất dữ liệu khi refresh. Giữ nguyên bước + hiện lỗi + "Thử lại".
      if (!ok) return;
      if (isLast) {
        await decideSurvey();
        setDone(true);
        return;
      }
      furthestStepRef.current = Math.max(furthestStepRef.current, stepIndex + 1);
      setStepIndex((i) => Math.min(total - 1, i + 1));
    })();
  }

  /**
   * Bỏ qua bước hiện tại: KHÔNG xoá dữ liệu, chỉ sang bước kế tiếp.
   *
   * Ở bước cuối, "bỏ qua" vẫn dẫn tới MÀN HỒ SƠ (không nhảy thẳng Dashboard):
   * nhảy thẳng sẽ bỏ qua đúng thứ màn đó sinh ra là — người dùng không bao
   * giờ thấy hồ sơ mà chính họ vừa trả lời.
   */
  function goSkip() {
    const isLast = stepIndex >= total - 1;
    void (async () => {
      const ok = await persist(draft, isLast);
      if (!ok) return;
      if (isLast) {
        // Đánh dấu đã bỏ qua: Dashboard tắt banner, nhưng KHÔNG chặn gì.
        await sendOnboardingAction("skip_onboarding");
        await decideSurvey();
        setDone(true);
        return;
      }
      setStepIndex((i) => Math.min(total - 1, i + 1));
    })();
  }

  /**
   * Đi tới /diagnostic nhưng GIỮ nguyên trạng thái khảo sát (chưa chốt).
   *
   * LƯU Ý KIẾN TRÚC: `/diagnostic` nằm trong LEARNING_GATE_PATHS, nên bước này
   * CHỈ chạy được vì proxy miễn đúng lối vào `?from=onboarding`
   * (`isOnboardingDiagnosticEntry` trong lib/onboarding/state.ts). Nếu bỏ query
   * đó, nút "Bắt đầu kiểm tra" sẽ bị kéo về /onboarding và trông như không phản
   * hồi. Không "sửa" bằng cách gọi `complete_survey` ở đây — phase 05 vẫn phải
   * diễn ra sau khi làm bài.
   */
  function goDiagnostic() {
    void (async () => {
      const ok = await persist(draft, false);
      if (!ok) return;
      // `?from=onboarding` để trang diagnostic biết quay lại đâu sau khi làm
      // xong, và tự chọn môn từ hồ sơ vừa trả lời.
      router.push("/diagnostic?from=onboarding");
    })();
  }

  function goBack() {
    setError(false);
    setStepIndex((i) => Math.max(0, i - 1));
  }

  /** Bấm dot: chỉ về bước ĐÃ ĐI QUA, không nhảy tới bước chưa tới. */
  function jumpTo(index: number) {
    if (index > furthestStepRef.current) return;
    setError(false);
    setStepIndex(index);
  }

  // ---- Loading / chưa đăng nhập ----
  if (sessionStatus === "loading" || (sessionStatus === "authenticated" && !loaded)) {
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

  // Session không sẵn sàng -> KHÔNG gọi API, chỉ đưa về login (yêu cầu §15).
  if (sessionStatus !== "authenticated" || !session?.user) {
    return (
      <main className="onb-screen">
        <div className="onb-glow" aria-hidden="true" />
        <div className="onb-card onb-done">
          <p className="onb-done-title">{t("onboarding.title")}</p>
          <p className="onb-done-desc">{t("common.connectionError")}</p>
          <div className="onb-done-actions">
            <button type="button" className="onb-btn onb-primary" onClick={() => router.push("/login")}>
              {t("common.retry")}
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---- Phase 05: màn hồ sơ sẵn sàng ----
  // Dữ liệu ở màn này đọc từ API thật (profile + skill map + roadmap), KHÔNG
  // bịa: thiếu gì hiện "chưa cập nhật". Xem ProfileReady.tsx.
  if (done) {
    return <ProfileReady onEditAnswers={() => setDone(false)} />;
  }

  // ---- Render 1 nhóm lựa chọn ----
  // `mode` quyết định hình: "multi" (checkbox) hay "single" (radio). Tách
  // hàm con để cả 5 bước chọn-nhiều dùng chung đúng 1 cách chạm, đúng 1
  // kiểu focus — tránh mỗi bước tự viết lại rồi lệch nhau.
  const OptionGrid = ({
    options,
    selected,
    onToggle,
    mode = "multi",
    disabled,
  }: {
    options: ReadonlyArray<{ value: string; labelKey: Parameters<typeof t>[0] }>;
    selected: string[];
    onToggle: (value: string) => void;
    mode?: "multi" | "single";
    disabled?: boolean;
  }) => (
    <div className={`onb-options${mode === "single" ? " onb-options--single" : ""}`}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            className={`onb-option${isSelected ? " is-selected" : ""}`}
            onClick={() => onToggle(option.value)}
            aria-pressed={isSelected}
            disabled={disabled}
          >
            {mode === "multi" ? (
              <span className={`onb-check${isSelected ? " is-on" : ""}`} aria-hidden="true">
                <Check size={12} strokeWidth={3} />
              </span>
            ) : (
              <span className="onb-radio" aria-hidden="true" />
            )}
            <span>{t(option.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <main className="onb-screen">
      <div className="onb-glow" aria-hidden="true" />

      <div className="onb-card">
        <div className="onb-eyebrow">{t("onboarding.eyebrow")}</div>
        <h1 className="onb-title">{t("onboarding.title")}</h1>
        <p className="onb-subtitle">{t("onboarding.subtitleDynamic")}</p>

        {/* Thanh tiến trình theo PHASE (5 phần) chứ không phải theo từng câu.
            Dot = 5 phase, luôn cùng số lượng bất kể người dùng thuộc nhóm nào
            -> không có hiệu ứng "bảng tiến trình bị ngắn lung tung khi đổi nhóm".
            Số câu cụ thể hiện ở nhãn phía dưới ("Câu 3/8"). */}
        <div className="onb-progress">
          <div className="onb-phases" role="tablist" aria-label={t("onboarding.eyebrow")}>
            {PHASES.filter((p) => p.id !== "ready").map((p) => {
              const isCurrent = p.index === phaseIndex;
              const isDone = p.index < phaseIndex;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={isCurrent}
                  aria-label={t(p.labelKey as Parameters<typeof t>[0])}
                  className={`onb-phase${isCurrent ? " is-current" : isDone ? " is-done" : ""}`}
                  onClick={() => jumpTo(steps.findIndex((s) => phaseIndexOfStep(s) === p.index))}
                  // Chỉ về được phase ĐÃ ĐI QUA — không nhảy cóc tới cuối.
                  disabled={p.index > phaseIndex}
                >
                  <span className="onb-phase__index" aria-hidden="true">
                    {p.index}
                  </span>
                  <span className="onb-phase__label">{t(p.labelKey as Parameters<typeof t>[0])}</span>
                </button>
              );
            })}
          </div>
          <span className="onb-step-label">
            {t("onboarding.step", { current: stepIndex + 1, total })}
          </span>
        </div>

        {/* key=stepIndex: ép remount mỗi bước để animation chuyển cảnh chạy
            lại. Nhờ vậy không cần state "đang animate" phức tạp. */}
        <div className="onb-body onb-body--animating" key={stepIndex}>
          {step === "stage" && (
            <div>
              <h2 className="onb-question">{t("onboarding.q.stage")}</h2>
              <p className="onb-question-hint">{t("onboarding.q.stageHint")}</p>
              <OptionGrid
                options={EDUCATION_STAGES}
                selected={[draft.educationStage]}
                mode="single"
                disabled={saving}
                onToggle={(value) => {
                  setDraft((d) => ({
                    ...d,
                    educationStage: d.educationStage === value ? "" : value,
                    // Đổi giai đoạn làm lớp/định hướng/ngành cũ KHÔNG còn ý nghĩa
                    // -> xoá luôn để không lưu dữ liệu vô nghĩa (data
                    // minimization). Đây cũng là lý do bước tiếp theo phải
                    // tính lại từ `stepsForStage` chứ không phải danh sách cứng.
                    grade: "",
                    track: "",
                    field: "",
                    topics: "",
                    futureGoal: "",
                  }));
                  // Người dùng có thể đang ở bước cho giai đoạn CŨ; danh sách
                  // bước vừa đổi nên phải kẹp chỉ số — nếu không sẽ render
                  // nhầm step của nhóm khác.
                  setStepIndex((i) => Math.min(i, 0));
                }}
              />
            </div>
          )}

          {/* Bước chỉ hiện với THCS/THPT: "lớp mấy" với người đã đi làm là hỏi
              vô nghĩa. Danh sách bước trong `stepsForStage` đã lọc sẵn. */}
          {step === "grade" && (
            <div>
              <h2 className="onb-question">{t("onboarding.q.grade")}</h2>
              <OptionGrid
                options={gradeOptionsFor(draft.educationStage)}
                selected={[draft.grade]}
                mode="single"
                disabled={saving}
                onToggle={(value) =>
                  setDraft((d) => ({ ...d, grade: d.grade === value ? "" : value }))
                }
              />
            </div>
          )}

          {step === "track" && (
            <div>
              <h2 className="onb-question">{t("onboarding.q.track")}</h2>
              <p className="onb-question-hint">{t("onboarding.q.trackHint")}</p>
              <OptionGrid
                options={TRACKS}
                selected={[draft.track]}
                mode="single"
                disabled={saving}
                onToggle={(value) =>
                  setDraft((d) => ({ ...d, track: d.track === value ? "" : value }))
                }
              />
            </div>
          )}

          {/* Ngành học (sv) / nghề nghiệp (đi làm): gợi ý + ô tự gõ. */}
          {step === "field" && (
            <div>
              <h2 className="onb-question">
                {draft.educationStage === "WORKING"
                  ? t("onboarding.q.fieldJob")
                  : t("onboarding.q.fieldMajor")}
              </h2>
              <p className="onb-question-hint">{t("onboarding.q.fieldHint")}</p>
              <OptionGrid
                options={fieldOptionsForStage(draft.educationStage)}
                selected={[draft.field]}
                mode="single"
                disabled={saving}
                onToggle={(value) => setDraft((d) => ({ ...d, field: value }))}
              />
              {/* Ô tự do LUÔN hiện: "Đại học Bách Khoa" là câu trả lời thật mà
                  danh sách gợi ý không bao giờ chứa được. */}
              <div className="onb-field" style={{ marginTop: 16 }}>
                <label className="onb-field-label" htmlFor="onb-field-custom">
                  {t("onboarding.q.fieldOther")}
                </label>
                <input
                  id="onb-field-custom"
                  className="onb-input"
                  value={draft.field}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, field: e.target.value.slice(0, 120) }))
                  }
                  maxLength={120}
                />
              </div>
            </div>
          )}

          {/* Người tự học: không có "lớp/ngành", nên câu hỏi là CHỦ ĐỀ. */}
          {step === "topics" && (
            <div>
              <h2 className="onb-question">{t("onboarding.q.topics")}</h2>
              <p className="onb-question-hint">{t("onboarding.q.topicsHint")}</p>
              <div className="onb-field">
                <label className="onb-field-label" htmlFor="onb-topics">
                  {t("onboarding.q.topics")}
                </label>
                <input
                  id="onb-topics"
                  className="onb-input"
                  value={draft.topics}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, topics: e.target.value.slice(0, 200) }))
                  }
                  maxLength={200}
                />
              </div>
            </div>
          )}

          {step === "intent" && (
            <div>
              <h2 className="onb-question">{t("onboarding.q.intent")}</h2>
              <p className="onb-question-hint">{t("onboarding.q.intentHint")}</p>
              {/* Danh sách đổi theo nhóm: học sinh không thấy "Đạt chứng chỉ",
                  người đi làm không thấy "Thi THPT". */}
              <OptionGrid
                options={intentsForStage(draft.educationStage)}
                selected={draft.intents}
                disabled={saving}
                onToggle={(value) => setDraft((d) => ({ ...d, intents: toggle(d.intents, value) }))}
              />
            </div>
          )}

          {step === "goal" && (
            <div>
              <h2 className="onb-question">{t("onboarding.q.goal")}</h2>
              <p className="onb-question-hint">{t("onboarding.q.intentHint")}</p>
              <OptionGrid
                options={GOAL_CATEGORIES}
                selected={[draft.goalCategory]}
                mode="single"
                disabled={saving}
                onToggle={(value) =>
                  setDraft((d) => ({ ...d, goalCategory: d.goalCategory === value ? "" : value }))
                }
              />

              {/* Ô nhập mục tiêu cụ thể. Rỗng vẫn hợp lệ — nhóm mục tiêu phía
                  trên đã đủ để AI cá nhân hoá. */}
              <div className="onb-field" style={{ marginTop: 18 }}>
                <label className="onb-field-label" htmlFor="onb-goal-title">
                  {t("onboarding.q.goalDetail")}
                </label>
                <input
                  id="onb-goal-title"
                  className="onb-input"
                  value={draft.goals[0]?.title ?? ""}
                  onChange={(e) => {
                    const title = e.target.value;
                    setDraft((d) => {
                      const rest = d.goals.slice(1);
                      // Giữ chỗ ô trống ở vị trí 0 để không nhảy layout khi
                      // xoá ký tự, nhưng không tạo goal rỗng trong payload.
                      return { ...d, goals: title ? [{ ...(d.goals[0] ?? {}), title }, ...rest] : rest };
                    });
                  }}
                  placeholder={t("onboarding.q.goalDetailHint")}
                  maxLength={200}
                />

                {draft.goals[0] && (
                  <div className="onb-field" style={{ marginTop: 12 }}>
                    <label className="onb-field-label" htmlFor="onb-goal-target">
                      {t("onboarding.q.goalTarget")}
                    </label>
                    <input
                      id="onb-goal-target"
                      className="onb-input"
                      value={draft.goals[0].target ?? ""}
                      onChange={(e) => {
                        const target = e.target.value;
                        setDraft((d) => ({
                          ...d,
                          goals: d.goals.map((g, i) => (i === 0 ? { ...g, target } : g)),
                        }));
                      }}
                      placeholder={t("onboarding.q.goalTargetPlaceholder")}
                      maxLength={200}
                    />
                  </div>
                )}
              </div>

              {/* Thêm nhiều mục tiêu: server giới hạn 8 và dedupe theo title. */}
              <button
                type="button"
                className="onb-goal-add"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    goals: [...d.goals, { title: "", category: d.goalCategory || undefined }],
                  }))
                }
                disabled={saving || draft.goals.length >= 8}
              >
                <Plus size={14} aria-hidden="true" /> {t("onboarding.goal.add")}
              </button>

              {draft.goals.slice(1).map((goal, index) => (
                <div className="onb-field" key={index} style={{ marginTop: 8 }}>
                  <div className="onb-goal-row">
                    <input
                      className="onb-input"
                      value={goal.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        setDraft((d) => ({
                          ...d,
                          goals: d.goals.map((g, i) => (i === index + 1 ? { ...g, title } : g)),
                        }));
                      }}
                      placeholder={t("onboarding.q.goalDetailHint")}
                      maxLength={200}
                      aria-label={t("onboarding.q.goalDetail")}
                    />
                    <button
                      type="button"
                      className="onb-goal-remove"
                      onClick={() =>
                        setDraft((d) => ({ ...d, goals: d.goals.filter((_, i) => i !== index + 1) }))
                      }
                      aria-label={t("onboarding.goal.remove")}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Định hướng tương lai — thứ quyết định lộ trình kéo về hướng
                  nào. "Chưa quyết" là lựa chọn hợp lệ, đứng ngang hàng. */}
              <div className="onb-group" style={{ marginTop: 20 }}>
                <div className="onb-group-label">{t("onboarding.q.futureGoal")}</div>
                <p className="onb-field-hint" style={{ marginTop: 0, marginBottom: 8 }}>
                  {t("onboarding.q.futureGoalHint")}
                </p>
                <OptionGrid
                  options={futureOptionsForStage(draft.educationStage)}
                  selected={[draft.futureGoal]}
                  mode="single"
                  disabled={saving}
                  onToggle={(value) =>
                    setDraft((d) => ({ ...d, futureGoal: d.futureGoal === value ? "" : value }))
                  }
                />
              </div>
            </div>
          )}

          {step === "subjects" && (
            <div>
              <h2 className="onb-question">{t("onboarding.q.subjects")}</h2>
              <p className="onb-question-hint">{t("onboarding.q.subjectsHint")}</p>
              {/* Nhóm môn lấy từ lib/onboarding/options.ts (tập con của
                  lib/constants/subjects) để tên môn luôn khớp Diagnostic/
                  Library/Roadmap — không hardcode lần thứ hai ở đây. */}
              {SUBJECT_GROUPS.map((group) => (
                <div className="onb-group" key={group.id}>
                  <div className="onb-group-label">{t(group.labelKey)}</div>
                  <OptionGrid
                    options={group.options}
                    selected={draft.subjects}
                    disabled={saving}
                    onToggle={(value) => setDraft((d) => ({ ...d, subjects: toggle(d.subjects, value) }))}
                  />
                </div>
              ))}

              {draft.subjects.includes(CUSTOM_SUBJECT_VALUE) && (
                <div className="onb-field" style={{ marginTop: 14 }}>
                  <label className="onb-field-label" htmlFor="onb-other-subject">
                    {t("onboarding.q.otherSubject")}
                  </label>
                  <input
                    id="onb-other-subject"
                    className="onb-input"
                    value={draft.otherSubject}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, otherSubject: e.target.value.slice(0, 120) }))
                    }
                    maxLength={120}
                  />
                </div>
              )}
            </div>
          )}

          {step === "career" && (
            <div>
              <h2 className="onb-question">{t("onboarding.q.career")}</h2>
              <p className="onb-question-hint">{t("onboarding.q.careerHint")}</p>

              {/* Mức độ chắc chắn hỏi TRƯỚC danh sách nghề. Nếu hỏi ngược, user
                  "chưa biết" sẽ bị ép chọn 1 nghề — đúng thứ mục §7 cấm. */}
              <OptionGrid
                options={CAREER_STATUSES}
                selected={[draft.careerStatus]}
                mode="single"
                disabled={saving}
                onToggle={(value) =>
                  setDraft((d) => ({ ...d, careerStatus: d.careerStatus === value ? "" : value }))
                }
              />

              {/* Chỉ hỏi tiếp danh sách nghề khi user thực sự đang cân nhắc —
                  "chưa biết"/"đang khám phá" thì hỏi thêm là vô nghĩa. */}
              {draft.careerStatus && draft.careerStatus !== "UNDECIDED" && (
                <div className="onb-group">
                  <div className="onb-group-label">{t("onboarding.q.career")}</div>
                  <OptionGrid
                    options={CAREER_FIELDS}
                    selected={draft.careerFields}
                    disabled={saving}
                    onToggle={(value) =>
                      setDraft((d) => ({ ...d, careerFields: toggle(d.careerFields, value) }))
                    }
                  />
                </div>
              )}
            </div>
          )}

          {step === "time" && (
            <div>
              <h2 className="onb-question">{t("onboarding.q.studyTime")}</h2>
              <OptionGrid
                options={STUDY_TIMES}
                selected={[draft.studyTime]}
                mode="single"
                disabled={saving}
                onToggle={(value) =>
                  setDraft((d) => ({ ...d, studyTime: d.studyTime === value ? "" : value }))
                }
              />
              <div className="onb-group">
                <div className="onb-group-label">{t("onboarding.q.studyTimePref")}</div>
                <OptionGrid
                  options={STUDY_TIME_PREFERENCES}
                  selected={[draft.studyTimePreference]}
                  mode="single"
                  disabled={saving}
                  onToggle={(value) =>
                    setDraft((d) => ({
                      ...d,
                      studyTimePreference: d.studyTimePreference === value ? "" : value,
                    }))
                  }
                />
              </div>
            </div>
          )}

          {step === "ai" && (
            <div>
              <h2 className="onb-question">{t("onboarding.q.aiPreferences")}</h2>
              <p className="onb-question-hint">{t("onboarding.q.aiPreferencesHint")}</p>
              <OptionGrid
                options={AI_PREFERENCES}
                selected={draft.aiPreferences}
                disabled={saving}
                onToggle={(value) =>
                  setDraft((d) => ({ ...d, aiPreferences: toggle(d.aiPreferences, value) }))
                }
              />

              {/* Cách học là PREFERENCE, không phải nhãn kiểu học cố định — UI
                  nói rõ điều đó để user không hiểu nhầm là bị dán nhãn. */}
              <div className="onb-group">
                <div className="onb-group-label">{t("onboarding.q.learningPreference")}</div>
                <p className="onb-field-hint" style={{ marginTop: 0, marginBottom: 8 }}>
                  {t("onboarding.q.learningPreferenceHint")}
                </p>
                <OptionGrid
                  options={LEARNING_PREFERENCES}
                  selected={draft.learningPreferences}
                  disabled={saving}
                  onToggle={(value) =>
                    setDraft((d) => ({
                      ...d,
                      learningPreferences: toggle(d.learningPreferences, value),
                    }))
                  }
                />
              </div>
            </div>
          )}

          {/*
            Phase 04 — Kiểm tra năng lực.
            Đây là HÀNH ĐỘNG chứ không phải câu hỏi, nên nội dung màn nằm ở
            thân card và nút điều hướng do footer xử lý (isDiagnosticStep).
            Nói rõ trước "mất bao lâu" và "làm sau được" — người dùng sợ bị
            hứa hẹn 10 phút rồi bị kéo vào 40 câu thì sẽ bỏ cả luồng.
          */}
          {step === "diagnostic" && (
            <div className="onb-diag">
              <div className="onb-diag__icon" aria-hidden="true">
                <ClipboardCheck size={26} />
              </div>
              <h2 className="onb-question">{t("onboarding.diag.title")}</h2>
              <p className="onb-question-hint">{t("onboarding.diag.desc")}</p>
              <div className="onb-diag__note">{t("onboarding.diag.why")}</div>
              <p className="onb-field-hint" style={{ marginTop: 12 }}>
                {t("onboarding.diag.laterHint")}
              </p>
            </div>
          )}
        </div>

        {/* Lỗi + offline: nói thẳng sự thật, không giả vờ đã lưu (§29). */}
        {error && (
          <div className="onb-notice onb-notice--error" role="alert">
            <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div>{t("onboarding.saveFail")}</div>
              <button type="button" className="onb-retry" onClick={goNext} disabled={saving}>
                {saving ? t("onboarding.saving") : t("onboarding.retry")}
              </button>
            </div>
          </div>
        )}

        {offline && !error && (
          <div className="onb-notice onb-notice--offline" role="status">
            <AlertTriangle size={15} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{t("onboarding.offline")}</span>
          </div>
        )}

        <div className="onb-actions">
          <button type="button" className="onb-btn onb-ghost" onClick={goBack} disabled={stepIndex === 0 || saving}>
            <ArrowLeft size={15} aria-hidden="true" />
            {t("onboarding.back")}
          </button>

          {/*
            Bước kiểm tra năng lực có BỘ NÚT RIÊNG: "Bắt đầu kiểm tra" và
            "Làm sau". Không dùng chung nút "Tiếp tục" vì bấm nhầm "Tiếp tục"
            ở đây sẽ bỏ qua kiểm tra mà người dùng còn tưởng đã làm — đúng
            loại lỗi "hành động không mong muốn" mà §29 yêu cầu tránh.
          */}
          {isDiagnosticStep ? (
            <>
              <button
                type="button"
                className="onb-btn onb-primary"
                onClick={goDiagnostic}
                disabled={saving}
                aria-busy={saving}
              >
                {t("onboarding.diag.cta")}
                <ArrowRight size={15} aria-hidden="true" />
              </button>
              <button type="button" className="onb-btn onb-ghost" onClick={goNext} disabled={saving}>
                {t("onboarding.diag.later")}
              </button>
            </>
          ) : (
            <>
              {/* Bỏ qua luôn khả dụng — KHÔNG disable theo bước. */}
              <button type="button" className="onb-btn onb-ghost" onClick={goSkip} disabled={saving}>
                {t("onboarding.skip")}
              </button>

              <button
                type="button"
                className="onb-btn onb-primary"
                onClick={goNext}
                disabled={saving}
                aria-busy={saving}
              >
                {saving ? t("onboarding.saving") : t("onboarding.next")}
                {!saving && <ArrowRight size={15} aria-hidden="true" />}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
