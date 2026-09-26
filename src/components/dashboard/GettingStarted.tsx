// ================================================================
// <GettingStarted /> — Dashboard rút gọn cho user MỚI (Explore Mode)
// ================================================================
// Mạch tư duy (nguyên tắc cốt lõi của LearnX AI):
//   "Explore before you configure" + "Time to First Meaningful Learning".
//
// Dashboard đầy đủ của returning user tối ưu cho VIỆC ĐANG LÀM (tiến độ,
// streak, XP, lịch ôn tập) — nhưng với user mới, những thứ đó đều là 0 và
// trông như app bị hỏng. Thay vào đó họ cần 1 câu hỏi duy nhất và 4 lối
// vào ngắn để thử sản phẩm NGAY.
//
// Vì sao không hỏi gì ở đây: setup là tuỳ chọn và đã có /setup. Dashboard
// chỉ nói "muốn học gì?" rồi đưa thẳng sang Tutor — người dùng nhận ra
// giá trị sản phẩm trước khi phải cấu hình bất cứ thứ gì.
// ================================================================

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Brain, Route, Upload } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { sendOnboardingAction } from "@/lib/onboarding/client";

export default function GettingStarted() {
  const router = useRouter();
  const { t } = useLanguage();
  const [ask, setAsk] = useState("");

  /**
   * Gửi câu hỏi sang AI Tutor.
   *
   * Đánh dấu "đã có phiên học đầu tiên" ngay khi user bắt đầu — đây là
   * mốc đo Time to First Meaningful Learning Experience, và nó được set ở
   * đây vì hành động "bắt đầu hỏi bài" CHÍNH LÀ khoảnh khắc học đầu tiên.
   * Fire-and-forget: không được để 1 request mạng chặn user vào Tutor.
   */
  function start(question?: string) {
    const q = (question ?? ask).trim();
    void sendOnboardingAction("mark_first_session");
    router.push(q ? `/tutor?q=${encodeURIComponent(q)}` : "/tutor");
  }

  // 4 lối vào, đúng bằng "Try something" — KHÔNG phải 10 card tính năng.
  const entries = [
    { icon: BookOpen, label: t("gettingStarted.entry.topic"), hint: t("gettingStarted.entry.topicHint"), to: "/diagnostic" },
    { icon: Upload, label: t("gettingStarted.entry.upload"), hint: t("gettingStarted.entry.uploadHint"), to: "/library" },
    { icon: Brain, label: t("gettingStarted.entry.tutor"), hint: t("gettingStarted.entry.tutorHint"), action: () => start() },
    { icon: Route, label: t("gettingStarted.entry.path"), hint: t("gettingStarted.entry.pathHint"), to: "/roadmap" },
  ];

  return (
    <div className="getting-started">
      <div className="getting-started__eyebrow">{t("gettingStarted.eyebrow")}</div>
      <h2 className="getting-started__title">{t("gettingStarted.title")}</h2>

      {/* Ô nhập câu hỏi — hành động CHÍNH duy nhất trên màn hình này. */}
      <div className="getting-started__ask">
        <input
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && start()}
          placeholder={t("gettingStarted.askPlaceholder")}
          aria-label={t("gettingStarted.askAria")}
          enterKeyHint="send"
        />
        <button type="button" className="btn-primary" onClick={() => start()}>
          {t("gettingStarted.start")}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="getting-started__entriesTitle">{t("gettingStarted.exploreTitle")}</div>
      <div className="getting-started__entries">
        {entries.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.label}
              type="button"
              className="getting-started__entry"
              onClick={() => (entry.action ? entry.action() : router.push(entry.to!))}
            >
              <span className="getting-started__entryIcon" aria-hidden="true">
                <Icon size={17} />
              </span>
              <span className="getting-started__entryText">
                <strong>{entry.label}</strong>
                <small>{entry.hint}</small>
              </span>
            </button>
          );
        })}
      </div>

      {/* Gợi ý cá nhân hoá: 1 dòng + 1 nút nhỏ. KHÔNG phải modal, KHÔNG
          chặn, KHÔNG lặp lại — nguyên tắc "personalization là nâng cấp,
          không phải yêu cầu". */}
      <div className="getting-started__personalize">
        <p>{t("gettingStarted.personalize")}</p>
        <button type="button" className="btn-secondary" onClick={() => router.push("/setup?from=session")}>
          {t("gettingStarted.personalizeCta")}
        </button>
      </div>
    </div>
  );
}
