// ================================================================
// <LearningProfilePanel /> — mục "Hồ sơ học tập" trong Account
// ================================================================
//
// Mạch tư duy (yêu cầu §22): hồ sơ học tập phải CHỈNH SỬA ĐƯỢC từ Account.
// Panel này chỉ ĐỌC + hiển thị + 1 nút "Chỉnh sửa" dẫn tới /onboarding —
// CỐ Ý không viết lại 1 form ở đây. Lý do: onboarding đã là nơi duy nhất ghi
// hồ sơ, có validate sẵn ở server. Nếu có 2 form, user sửa ở Account nhưng
// các trường ở onboarding vẫn cũ — trạng thái lệch rất khó hiểu.
//
// Ô "chưa biết nghề" hiển thị ĐÚNG như nó là — một lựa chọn hợp lệ — chứ
// không biến thành dấu "—" trông như thiếu dữ liệu hay lỗi.
// ================================================================

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { fetchOnboardingState } from "@/lib/onboarding/client";
import type { OnboardingState } from "@/lib/onboarding/state";
import type { LearningProfile } from "@/lib/onboarding/profile";
import { labelFor } from "@/lib/personalization/context";
import {
  AI_PREFERENCES,
  CAREER_FIELDS,
  CAREER_STATUSES,
  EDUCATION_STAGES,
  GOAL_CATEGORIES,
  INTENTS,
  LEARNING_PREFERENCES,
  STUDY_TIMES,
  STUDY_TIME_PREFERENCES,
  TRACKS,
  gradeOptionsFor,
} from "@/lib/onboarding/options";

/** Nhãn của 1 option onboarding (có sẵn trong dictionary), dùng khi cần t(). */
function findOptionLabel(
  options: ReadonlyArray<{ value: string; labelKey: Parameters<ReturnType<typeof useLanguage>["t"]>[0] }>,
  value: string | null | undefined,
  t: ReturnType<typeof useLanguage>["t"]
): string {
  if (!value) return "—";
  const match = options.find((o) => o.value === value);
  return match ? t(match.labelKey) : value;
}

export default function LearningProfilePanel() {
  const { t } = useLanguage();
  const router = useRouter();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOnboardingState()
      .then(setState)
      .catch(() => setError(t("common.connectionError")))
      .finally(() => setLoading(false));
  }, [t]);

  if (loading) return <StateMessage kind="loading" text={t("common.loading")} />;
  if (error) return <StateMessage kind="error" text={error} />;

  const profile: LearningProfile | null = state?.learningProfile ?? null;
  const percent = state?.profileCompletion ?? 0;
  const notSet = t("profile.lp.notSet");
  const list = (values: string[] | undefined, options: typeof EDUCATION_STAGES) =>
    values?.length ? values.map((v) => findOptionLabel(options, v, t)).join(", ") : notSet;

  return (
    <Panel style={{ marginTop: 16 }}>
      <div className="profile-info-header" style={{ marginBottom: 14 }}>
        <div>
          <h2 style={{ fontSize: 17, marginBottom: 2 }}>{t("profile.learningProfile")}</h2>
          <p style={{ color: "var(--text-dim)", fontSize: 13 }}>
            {t("profile.learningProfileDesc", { n: percent })}
          </p>
        </div>
        {/* Sửa = quay lại onboarding ở đúng bước đang thiếu (xem
            firstIncompleteStep trong LearningOnboarding). */}
        <button type="button" className="btn-secondary" onClick={() => router.push("/onboarding")}>
          <Pencil size={14} aria-hidden="true" />
          {t("profile.learningProfileEdit")}
        </button>
      </div>

      <dl className="lp-grid">
        <div className="lp-row">
          <dt>{t("profile.lp.stage")}</dt>
          <dd>
            {profile?.educationStage
              ? `${findOptionLabel(EDUCATION_STAGES, profile.educationStage, t)}${
                  profile.grade ? ` · ${findOptionLabel(gradeOptions(profile.educationStage), profile.grade, t)}` : ""
                }${profile.track ? ` · ${findOptionLabel(TRACKS, profile.track, t)}` : ""}`
              : notSet}
          </dd>
        </div>

        <div className="lp-row">
          <dt>{t("profile.lp.intent")}</dt>
          <dd>{list(profile?.intents, INTENTS)}</dd>
        </div>

        <div className="lp-row">
          <dt>{t("profile.lp.goal")}</dt>
          <dd>
            {profile?.goalCategory ? findOptionLabel(GOAL_CATEGORIES, profile.goalCategory, t) : notSet}
            {profile?.goals?.length ? ` — ${profile.goals.map((g) => g.title).join("; ")}` : ""}
          </dd>
        </div>

        <div className="lp-row">
          <dt>{t("profile.lp.subjects")}</dt>
          <dd>
            {profile?.subjects?.length
              ? [...profile.subjects, ...(profile.otherSubject ? [profile.otherSubject] : [])].join(", ")
              : notSet}
          </dd>
        </div>

        <div className="lp-row">
          <dt>{t("profile.lp.career")}</dt>
          <dd>
            {profile?.careerStatus
              ? `${findOptionLabel(CAREER_STATUSES, profile.careerStatus, t)}${
                  profile.careerFields?.length
                    ? ` — ${profile.careerFields.map((v) => findOptionLabel(CAREER_FIELDS, v, t)).join(", ")}`
                    : ""
                }`
              : notSet}
          </dd>
        </div>

        <div className="lp-row">
          <dt>{t("profile.lp.studyTime")}</dt>
          <dd>
            {profile?.studyTime
              ? `${findOptionLabel(STUDY_TIMES, profile.studyTime, t)}${
                  profile.studyTimePreference
                    ? ` · ${findOptionLabel(STUDY_TIME_PREFERENCES, profile.studyTimePreference, t)}`
                    : ""
                }`
              : notSet}
          </dd>
        </div>

        <div className="lp-row">
          <dt>{t("profile.lp.ai")}</dt>
          <dd>{list(profile?.aiPreferences, AI_PREFERENCES)}</dd>
        </div>

        <div className="lp-row">
          <dt>{t("profile.lp.learnPref")}</dt>
          <dd>{list(profile?.learningPreferences, LEARNING_PREFERENCES)}</dd>
        </div>
      </dl>

      <p className="lp-footnote">{t("profile.learningProfileFootnote")}</p>
    </Panel>
  );
}

/** Danh sách lớp hợp lệ của 1 giai đoạn (dùng chung với onboarding). */
function gradeOptions(stage: string | undefined) {
  return gradeOptionsFor(stage);
}

