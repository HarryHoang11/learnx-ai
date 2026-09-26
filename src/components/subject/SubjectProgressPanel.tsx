// ================================================================
// <SubjectProgressPanel /> — Dashboard: học môn nào, mạnh/yếu gì, làm gì tiếp
// ================================================================
//
// Đây là phần trả lời trực tiếp câu hỏi của người học khi mở LearnX: "hôm nay
// học gì?". Nó KHÔNG query thêm — nhận `skillMap` mà Dashboard đã fetch từ
// GET /api/progress, nên không phát sinh request thứ hai cho cùng 1 dữ liệu.
//
// NGUYÊN TẮC KHÔNG BỊA (yêu cầu §34): không có skillMap -> hiện empty state
// kèm lối vào học, TUYỆT ĐỐI không hiện "0%" (người dùng tưởng hệ thống đã
// đánh giá họ nhưng thực ra chưa có dữ liệu).
// ================================================================

"use client";

import Panel from "@/components/ui/Panel";
import { useLanguage } from "@/components/providers/LanguageProvider";
import {
  SUBJECT_WEAK_THRESHOLD,
  pickFocusSubject,
  pickWeakestTopic,
  summarizeBySubject,
  type SkillPoint,
} from "@/lib/subjects/progress";
import "./subject-progress.css";

interface SubjectProgressPanelProps {
  skillMap: SkillPoint[];
}

export default function SubjectProgressPanel({ skillMap }: SubjectProgressPanelProps) {
  const { t } = useLanguage();
  const subjects = summarizeBySubject(skillMap);
  const focus = pickFocusSubject(subjects);
  const weakest = focus ? pickWeakestTopic(focus.subject, skillMap) : null;

  // CHƯA CÓ DỮ LIỆU: dẫn tới bước đầu tiên thay vì hiện số 0.
  if (subjects.length === 0) {
    return (
      <Panel style={{ marginBottom: 16 }}>
        <h3 className="subject-progress__title">{t("subjectProgress.title")}</h3>
        <p className="subject-progress__empty">{t("subjectProgress.empty")}</p>
        <div className="subject-progress__empty-actions">
          <a className="btn-primary" href="/practice" style={{ fontSize: 13 }}>
            {t("subjectProgress.ctaPractice")}
          </a>
          <a className="btn-secondary" href="/diagnostic" style={{ fontSize: 13 }}>
            {t("subjectProgress.ctaDiagnostic")}
          </a>
        </div>
      </Panel>
    );
  }

  return (
    <Panel style={{ marginBottom: 16 }}>
      <h3 className="subject-progress__title">{t("subjectProgress.title")}</h3>

      {/* ---- 1 môn nên học tiếp ---- */}
      {focus && (
        <div className="subject-progress__focus">
          <div className="subject-progress__focus-head">
            <span aria-hidden="true">{focus.icon}</span>
            <span className="subject-progress__focus-subject">{focus.subject}</span>
            <span className="subject-progress__badge">{focus.masteryPercent}%</span>
          </div>
          {/* role=progressbar thay vì <progress>: <progress> không kiểm soát
              được màu theo theme và không cho gắn nhãn cho trình đọc màn hình. */}
          <div
            className="subject-progress__bar"
            role="progressbar"
            aria-valuenow={focus.masteryPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("subjectProgress.masteryLabel", { subject: focus.subject })}
          >
            <span style={{ width: `${focus.masteryPercent}%` }} />
          </div>
          {focus.strongestTopic && (
            <p className="subject-progress__note">
              {t("subjectProgress.strongest", { topic: focus.strongestTopic })}
            </p>
          )}
        </div>
      )}

      {/* ---- Chủ đề cần cải thiện ---- */}
      {weakest ? (
        <div className="subject-progress__weak">
          <div className="subject-progress__weak-head">
            <span aria-hidden="true">🎯</span>
            <span>{t("subjectProgress.weakTitle")}</span>
            <span className="subject-progress__badge is-weak">{weakest.masteryPercent}%</span>
          </div>
          <p className="subject-progress__weak-topic">{weakest.topic}</p>
          <p className="subject-progress__note">
            {t("subjectProgress.weakReason", { threshold: SUBJECT_WEAK_THRESHOLD })}
          </p>
          <div className="subject-progress__weak-actions">
            {/* CTA trỏ tới feature THẬT, không phải nút trang trí (§12). */}
            <a
              className="btn-primary"
              style={{ fontSize: 13 }}
              href={`/practice?subject=${encodeURIComponent(weakest.subject)}&topic=${encodeURIComponent(weakest.topic)}`}
            >
              {t("subjectProgress.ctaPractice")}
            </a>
            <a
              className="btn-secondary"
              style={{ fontSize: 13 }}
              href={`/tutor?q=${encodeURIComponent(`${weakest.subject} ${weakest.topic}`)}`}
            >
              {t("subjectProgress.ctaTutor")}
            </a>
          </div>
        </div>
      ) : (
        focus && <p className="subject-progress__note">{t("subjectProgress.allGood")}</p>
      )}

      {/* ---- Tổng quan các môn đang học ---- */}
      <ul className="subject-progress__list">
        {subjects.map((subject) => (
          <li key={subject.subject} className="subject-progress__item">
            <a
              className="subject-progress__link"
              href={`/progress?subject=${encodeURIComponent(subject.subject)}`}
            >
              <span className="subject-progress__item-icon" aria-hidden="true">
                {subject.icon}
              </span>
              <span className="subject-progress__item-name">{subject.subject}</span>
              <span className="subject-progress__item-meta">
                {t("subjectProgress.topicCount", { n: subject.topicCount })}
              </span>
              <span className="subject-progress__item-pct">{subject.masteryPercent}%</span>
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}