// ================================================================
// <OnboardingBanner /> — lời mời hoàn thiện hồ sơ (KHÔNG chặn)
// ================================================================
//
// Mạch tư duy: sản phẩm chuyển sang "Personalize, rồi hãy dive in" — người
// dùng mới cần biết LearnX hiểu họ trước khi dùng hết tính năng. Nhưng BẤT
// KỲ nào được biến thành rào cản:
//   - Dashboard VẪN vào được bình thường (xem docs/WELCOME.md §1).
//   - Chỉ khi bấm "Tiếp tục khảo sát" thì mới sang /onboarding.
//   - Nút "Bỏ qua" tự ẩn banner vĩnh viễn (ghi mốc surveyDecidedAt).
//
// Banner chỉ hiện khi HỒ SƠ CÒN THIẾU. Điều kiện nằm ở hàm thuần
// `needsLearningProfile()` (lib/onboarding/state.ts) để proxy và UI cùng
// hiểu "cần hồ sơ" theo MỘT tiêu chí — không lệch nhau.
// ================================================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { sendOnboardingAction } from "@/lib/onboarding/client";
import { needsLearningProfile, type OnboardingState } from "@/lib/onboarding/state";
import { surveyProgress } from "@/lib/onboarding/steps";

export default function OnboardingBanner({ onboarding }: { onboarding: OnboardingState | null }) {
  const router = useRouter();
  const { t } = useLanguage();
  // Ẩn ngay khi bấm "Bỏ qua" — không chờ server trả lời, vì người dùng đã
  // bấm thì phải thấy ngay là đã bỏ qua (cảm giác "nút chết" rất khó chịu).
  const [dismissed, setDismissed] = useState(false);

  // Chưa có state -> chưa biết, không hiện gì cả (tránh nhấp nháy lúc load).
  if (!onboarding || dismissed) return null;
  if (!needsLearningProfile(onboarding)) return null;

  const progress = surveyProgress(onboarding.learningProfile ?? {});

  async function skip() {
    setDismissed(true);
    // Lỗi ở đây không chặn gì: người dùng đã chọn bỏ qua, và lần tải trang
    // sau `getOnboardingState()` sẽ lấy lại mốc đã lưu (hoặc chưa).
    await sendOnboardingAction("complete_survey");
  }

  return (
    <div className="learning-profile-card" style={{ marginBottom: 16 }}>
      <div className="learning-profile-card__text">
        <div className="learning-profile-card__title">
          <Sparkles size={15} aria-hidden="true" style={{ marginRight: 6, verticalAlign: "-2px" }} />
          {t("dashboard.profile.title")}
        </div>
        <div className="learning-profile-card__desc">
          {t("dashboard.profile.partialDesc")}
        </div>
        {/* Tiến trình thật, tính trên ĐÚNG danh sách bước của nhóm người dùng
            (surveyProgress) — không phải "3/9" cố định khiến người đã học
            xong tưởng còn thiếu. */}
        <div className="bar-track" style={{ marginTop: 8, marginBottom: 10 }}>
          <div
            className="bar-fill"
            style={{ width: `${Math.min(100, Math.max(progress.percent, 4))}%` }}
          />
        </div>
        <div style={{ fontSize: 12, color: "var(--text-dim)" }}>
          {t("onboarding.ready.goalsCount", { n: `${progress.answered}/${progress.total}` })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => void skip()}
          aria-label={t("onboarding.skip")}
          title={t("onboarding.skip")}
          style={{ paddingInline: 10 }}
        >
          <X size={15} aria-hidden="true" />
        </button>
        <button type="button" className="btn-primary" onClick={() => router.push("/onboarding")}>
          {t("dashboard.profile.cta")}
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}