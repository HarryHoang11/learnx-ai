// ================================================================
// TRANG QUICK SETUP — cá nhân hoá TUỲ CHỌN, ngắn và luôn bỏ qua được
// ================================================================
// Mạch tư duy (nguyên tắc sản phẩm LearnX AI):
//   "Explore before you configure" — trang này KHÔNG phải nơi chặn người
//   dùng, mà là một lời mời. Vì vậy:
//     - KHÔNG bắt buộc điền gì: bấm "Bỏ qua" ở mọi bước đều thoát được.
//     - Chỉ hỏi điều CÓ GIÁ TRỊ NGAY: mục tiêu, môn học, trình độ.
//       Cố ý KHÔNG hỏi "bạn là người học thị giác không?" — đó là dữ liệu
//       suy đoán; LearnX nên quan sát hành vi thật rồi mới hỏi xác nhận.
//     - Bước "trình độ" có nút bỏ qua riêng, vì hầu hết người mới không
//       biết trình độ của mình.
//
// Dùng chung component với lời mời sau phiên học đầu tiên (và từ
// Dashboard): cùng 1 trang, chỉ khác câu chữ mở đầu. Không tạo form
// onboarding riêng cho từng nơi.
// ================================================================

"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import Panel from "@/components/ui/Panel";
import StateMessage from "@/components/ui/StateMessage";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useSession } from "next-auth/react";
import { SUBJECTS } from "@/lib/constants/subjects";
import { sendOnboardingAction } from "@/lib/onboarding/client";
import type { ApiResponse } from "@/types";

type Step = 1 | 2 | 3;

/**
 * Next.js BẮT BUỘC mọi component gọi useSearchParams() phải nằm trong
 * <Suspense>, nếu không lúc `next build` sẽ lỗi "missing-suspense-with-csr-
 * bailout" và build fail. Đây là cùng pattern trang Tutor đang dùng.
 */
export default function SetupPage() {
  // useLanguage gọi ở component ngoài vì fallback <Suspense> cần text;
  // component trong vẫn gọi lại (hook rất rẻ, và 2 chỗ dùng độc lập).
  const { t } = useLanguage();
  return (
    <Suspense fallback={<StateMessage kind="loading" text={t("common.loading")} />}>
      <SetupPageInner />
    </Suspense>
  );
}

function SetupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const { data: session, update } = useSession();

  // Mở từ "Personalize my learning" sau phiên học đầu tiên thì lời mời khác:
  // "Bạn đã thử rồi, muốn AI hiểu bạn hơn không?" — dễ đồng ý hơn là bị bắt
  // điền form ngay từ đầu.
  const afterSession = searchParams?.get("from") === "session";

  const [step, setStep] = useState<Step>(1);
  const [goal, setGoal] = useState("");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [level, setLevel] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Nạp sẵn những gì user đã chọn trước đó để quay lại chỉnh không bị mất.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/onboarding");
        if (!res.ok) return;
        const json = (await res.json()) as ApiResponse<{
          learningProfile: { goal?: string; subjects?: string[]; level?: string } | null;
        }>;
        if (cancelled || !json.success || !json.data?.learningProfile) return;
        setGoal(json.data.learningProfile.goal ?? "");
        setSubjects(json.data.learningProfile.subjects ?? []);
        setLevel(json.data.learningProfile.level ?? "");
      } catch {
        // Không nạp được thì để form trống — vẫn submit được.
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const GOALS = useMemo(
    () => [
      { value: "school", label: t("setup.goal.school") },
      { value: "university", label: t("setup.goal.university") },
      { value: "exam", label: t("setup.goal.exam") },
      { value: "competition", label: t("setup.goal.competition") },
      { value: "career", label: t("setup.goal.career") },
      { value: "research", label: t("setup.goal.research") },
      { value: "curiosity", label: t("setup.goal.curiosity") },
      { value: "other", label: t("setup.goal.other") },
    ],
    [t]
  );

  const LEVELS = useMemo(
    () => [
      { value: "beginner", label: t("setup.level.beginner") },
      { value: "intermediate", label: t("setup.level.intermediate") },
      { value: "advanced", label: t("setup.level.advanced") },
      { value: "unsure", label: t("setup.level.unsure") },
    ],
    [t]
  );

  function toggleSubject(value: string) {
    setSubjects((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]));
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    // `goal` ở Quick Setup là NHÃN HIỂN THỊ ("Trường", "Kỳ thi"...), còn giá
    // trị lưu trong DB phải là mã enum để lọc/thống kê được — vì vậy gửi qua
    // `goalCategory` (server sẽ validate, giá trị lạ bị loại an toàn).
    const state = await sendOnboardingAction("complete_setup", {
      version: 1,
      goalCategory: goal || undefined,
      subjects,
      level: level || undefined,
    });
    // Làm mới JWT để proxy biết user đã cá nhân hoá (không kéo về Welcome).
    //
    // Phải AWAIT trước khi điều hướng — cùng lý do như `finish()` ở
    // WelcomeExperience: proxy quyết định ép về /welcome dựa trên
    // `onboardingStatus` trong JWT. Gọi `update()` kiểu void rồi push ngay
    // thì /dashboard vẫn mang JWT cũ status=NEW và bị đẩy ngược về /welcome
    // — người dùng điền xong form lại bị quay về trang giới thiệu.
    if (state && session?.user) {
      try {
        // Bọc trong `{ user: ... }` — cùng lý do và cùng convention với
        // app/profile/page.tsx (`updateSession({ user: { image } })`).
        // Callback `jwt` trong auth.ts đọc `session?.user?.onboardingStatus`;
        // truyền dữ liệu ở tầng ngoài sẽ khiến nhánh merge bị bỏ qua, token
        // giữ status=NEW và proxy đẩy ngược về /welcome.
        await update({ user: { ...session.user, onboardingStatus: state.status } });
      } catch (err) {
        // Không nuốt lỗi — ghi lại để còn dấu vết. Vẫn điều hướng để
        // người dùng không bị kẹt ở /setup.
        console.error("[setup] Không làm mới được session sau khi lưu:", err);
      }
    }
    setSaving(false);
    router.push("/dashboard");
  }

  /** Bỏ qua: KHÔNG ghi gì, đi thẳng vào app. */
  function skip() {
    router.push("/dashboard");
  }

  return (
    <section className="page-enter setup-page">
      <div className="setup-head">
        <div className="setup-eyebrow">
          <Sparkles size={14} aria-hidden="true" />
          <span>{afterSession ? t("setup.eyebrow.session") : t("setup.eyebrow")}</span>
        </div>
        <h2 className="page-title" style={{ marginBottom: 6 }}>
          {afterSession ? t("setup.title.session") : t("setup.title")}
        </h2>
        <p className="setup-sub">{t("setup.subtitle")}</p>
      </div>

      <div className="setup-progress" aria-hidden="true">
        {[1, 2, 3].map((s) => (
          <span key={s} className={`setup-progress__dot${s <= step ? " is-active" : ""}`} />
        ))}
      </div>

      {!loaded ? (
        <StateMessage kind="loading" text={t("common.loading")} />
      ) : (
        <Panel style={{ marginBottom: 16 }}>
          {step === 1 && (
            <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
              <legend className="setup-step-title">{t("setup.step1.title")}</legend>
              <p className="setup-step-sub">{t("setup.step1.sub")}</p>
              <div className="setup-options">
                {GOALS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    className={`setup-option${goal === g.value ? " is-selected" : ""}`}
                    onClick={() => setGoal(goal === g.value ? "" : g.value)}
                    aria-pressed={goal === g.value}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
              <legend className="setup-step-title">{t("setup.step2.title")}</legend>
              <p className="setup-step-sub">{t("setup.step2.sub")}</p>
              <div className="setup-options">
                {/* Dùng chung danh sách môn với Library/Diagnostic
                    (lib/constants/subjects) để tên môn luôn khớp với phần
                    còn lại của app. */}
                {SUBJECTS.map((s) => {
                  const selected = subjects.includes(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      className={`setup-option${selected ? " is-selected" : ""}`}
                      onClick={() => toggleSubject(s.value)}
                      aria-pressed={selected}
                    >
                      {selected && <Check size={14} aria-hidden="true" />}
                      {t(s.labelKey)}
                    </button>
                  );
                })}
              </div>
              <p className="setup-step-note">{t("setup.step2.note")}</p>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
              <legend className="setup-step-title">{t("setup.step3.title")}</legend>
              <p className="setup-step-sub">{t("setup.step3.sub")}</p>
              <div className="setup-options">
                {LEVELS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    className={`setup-option${level === l.value ? " is-selected" : ""}`}
                    onClick={() => setLevel(level === l.value ? "" : l.value)}
                    aria-pressed={level === l.value}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <p className="setup-step-note">{t("setup.step3.note")}</p>
            </fieldset>
          )}

          <div className="setup-actions">
            <button type="button" className="btn-secondary" onClick={skip} disabled={saving}>
              {t("setup.skip")}
            </button>
            <div style={{ display: "flex", gap: 8 }}>
              {step > 1 && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setStep((s) => (s - 1) as Step)}
                  disabled={saving}
                >
                  {t("setup.back")}
                </button>
              )}
              {step < 3 ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setStep((s) => (s + 1) as Step)}
                >
                  {t("setup.next")}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={save} disabled={saving}>
                  {saving ? t("common.loading") : t("setup.finish")}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </Panel>
      )}

      <p className="setup-footnote">{t("setup.footnote")}</p>
    </section>
  );
}

