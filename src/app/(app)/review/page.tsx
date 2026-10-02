"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { RotateCcw, Sparkles } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import StateMessage from "@/components/ui/StateMessage";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { fetchDueReviews, type DueReviewsData } from "@/lib/api/reviewDue";
// Prompt/đáp án ôn tập do AI sinh có thể chứa công thức (đơn vị, định nghĩa)
// -> render qua SafeMath như các màn hình quiz/diagnostic, để không lộ
// raw \text{...}/\textsuperscript.
import SafeMath from "@/components/math/SafeMath";
// Bước "chọn môn để ôn" + gợi ý thông minh (yêu cầu §14–§17). Môn lấy từ
// registry `lib/subjects/engine.ts` (nguồn hệ thống, không hardcode ở đây);
// số liệu gợi ý đến từ `insights` của chính /api/review/due (đếm trên
// ReviewItem của user) — không có con số nào bịa.
import SubjectSwitcher from "@/components/subject/SubjectSwitcher";
import { SUBJECT_ENGINES } from "@/lib/subjects/engine";
// Style chọn môn + khối gợi ý ôn tập.
import "@/components/rewards/rewards.css";
import type { ApiResponse } from "@/types";
import type { ReviewInsights } from "@/lib/api/reviewDue";

// Shape review lấy từ lib/api/reviewDue — dùng CHUNG với dashboard nên
// chỉ có 1 nguồn định nghĩa, không mỗi trang tự khai một kiểu.

export default function ReviewPage() {
  const { t } = useLanguage();
  const router = useRouter();
  // Trạng thái session CLIENT-side quyết định KHI NÀO được gọi API
  // protected và khi nào cần quay về /login — xem effect bên dưới.
  const { status } = useSession();
  const [cards, setCards] = useState<DueReviewsData["reviews"]>([]);
  const [stats, setStats] = useState<DueReviewsData["stats"] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Môn đang lọc. `null` = ôn tất cả (mặc định) — và là lúc hiện gợi ý
  // "nên ôn môn nào" vì cần nhìn được số liệu toàn bộ môn.
  const [subject, setSubject] = useState<string | null>(null);
  // Gợi ý thông minh — chỉ có khi request gửi `?insights=true` (tức KHÔNG lọc
  // môn). Xem route /api/review/due để rõ vì sao server tự quyết định.
  const [insights, setInsights] = useState<ReviewInsights | null>(null);

  // `load` nhận `nextSubject` thay vì đọc state: gọi từ `handleSubjectChange`
  // cần tải lại NGAY với môn mới, không phải với môn cũ (state chưa kịp cập
  // nhật trong cùng 1 render).
  async function load(nextSubject: string | null = subject) {
    setError(null);
    setLoading(true);
    try {
      // fetchDueReviews khử trùng các request ĐANG BAY cùng URL: khi
      // React StrictMode (dev) gọi effect 2 lần, hoặc component remount
      // nhanh, chỉ còn ĐÚNG 1 request mạng tới /api/review/due — không
      // chạy lại chùm query Prisma trên ReviewItem một cách vô ích.
      // Sau khi request xong, lần gọi kế tiếp là request mới hoàn toàn
      // nên nút "Làm mới" vẫn trả dữ liệu tươi.
      const json = await fetchDueReviews(30, {
        subject: nextSubject ?? undefined,
        // Chỉ xin insights khi ôn tất cả — lọc môn rồi thì gợi ý về môn khác
        // là vô nghĩa (server cũng tự bỏ insights khi có `subject`).
        insights: nextSubject === null,
      });
      if (!json.success) throw new Error(json.error);
      setCards(json.data.reviews);
      setStats(json.data.stats);
      setInsights(json.data.insights ?? null);
      setIndex(0);
      setRevealed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("review.loadFail"));
    } finally {
      setLoading(false);
    }
  }

  function handleSubjectChange(next: string | null) {
    setSubject(next);
    void load(next);
  }

  // Điều kiện hoá theo session status — chống race auth:
  //   - "loading": CHƯA fetch (cookie/session chưa sẵn sàng — gọi API
  //     protected lúc này sẽ 401 oan) và CHƯA redirect (không kéo user
  //     ra /login khi session vẫn đang được khôi phục);
  //   - "authenticated": fetch dữ liệu review;
  //   - "unauthenticated": session hết hạn/không hợp lệ -> về /login.
  useEffect(() => {
    if (status === "authenticated") {
      load();
    } else if (status === "unauthenticated") {
      router.replace("/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function rate(rating: 1 | 2 | 3 | 4) {
    const card = cards[index];
    if (!card || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/review/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewItemId: card.id, rating }),
      });
      const json: ApiResponse<unknown> = await response.json();
      if (!json.success) throw new Error(json.error);
      setCards((previous) => previous.filter((item) => item.id !== card.id));
      setIndex((previous) => Math.min(previous, Math.max(0, cards.length - 2)));
      setRevealed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("review.submitFail"));
    } finally {
      setSubmitting(false);
    }
  }

  if (status !== "authenticated" || loading) {
    // Session chưa xác nhận xong (loading) hoặc đang chờ chuyển hướng
    // /login (unauthenticated): hiện loading, không render nội dung.
    return <StateMessage kind="loading" text={t("review.loading")} />;
  }
  if (error) return <StateMessage kind="error" text={error} />;
  const card = cards[index];

  return (
    <section className="review-page page-enter">
      <header className="review-header">
        <div className="workspace-eyebrow"><Sparkles size={14} /> {t("review.eyebrow")}</div>
        <h1>{t("review.title")}</h1>
        <p>{stats ? t("review.progress", { current: cards.length === 0 ? 0 : index + 1, total: cards.length }) : ""}</p>
      </header>

      {/* ---- CHỌN MÔN ĐỂ ÔN (yêu cầu §14) ----
          Môn lấy từ registry hệ thống, KHÔNG hỏi lại lớp/hồ sơ (đã có ở
          onboarding). Nút "Tất cả" để quay về ôn tổng hợp. */}
      <div className="review-subject-bar">
        <button
          type="button"
          className={`review-subject-chip${subject === null ? " is-active" : ""}`}
          aria-pressed={subject === null}
          onClick={() => handleSubjectChange(null)}
        >
          {t("review.allSubjects")}
        </button>
        <SubjectSwitcher
          selected={subject}
          subjects={SUBJECT_ENGINES}
          onSelect={handleSubjectChange}
          label={t("review.chooseSubject")}
        />
      </div>

      {/* ---- SMART REVIEW (yêu cầu §16–§17) ----
          Chỉ hiện khi đang ôn TẤT CẢ môn (subject === null). Mọi con số đến
          từ `insights` = đếm trên ReviewItem của user; chủ đề "hay sai" là
          những item có `lapses > 0`, tức đúng nơi SM-2 đã hạ lịch ôn. */}
      {subject === null && insights && insights.subjects.length > 0 && (
        <section className="review-insight" aria-label={t("review.suggestTitle")}>
          <div className="review-insight__head">
            <Sparkles size={14} aria-hidden="true" />
            <span>{t("review.suggestTitle")}</span>
          </div>
          <p className="review-insight__line">{t("review.suggestLine", { n: String(stats?.due ?? 0) })}</p>
          <div className="review-insight__chips">
            {insights.subjects.slice(0, 5).map((item) => (
              <button
                key={item.subject}
                type="button"
                className="review-insight__chip"
                onClick={() => handleSubjectChange(item.subject)}
              >
                {item.subject}
                <span className="review-insight__count">{item.due}</span>
              </button>
            ))}
          </div>
          {insights.weakTopics.length > 0 && (
            <p className="review-insight__weak">
              {t("review.weakLine", {
                topics: insights.weakTopics.map((w) => w.topic).join(", "),
              })}
            </p>
          )}
        </section>
      )}

      {subject !== null && (
        <p className="review-filter-note">
          {t("review.filteringBy", { subject })}
        </p>
      )}
      {!card ? (
        <EmptyState icon="↻" title={t("review.emptyTitle")} description={t("review.emptyDescription")} actionLabel={t("review.refresh")} onAction={load} />
      ) : (
        <div className="review-focus">
          <div className="review-meta"><span>{card.subject ?? t("review.subject")}</span><strong>{card.topic}</strong></div>
          <button className={`review-card ${revealed ? "review-card--revealed" : ""}`} onClick={() => setRevealed(true)} type="button">
            <span className="review-card-label">{revealed ? t("review.answer") : t("review.question")}</span>
            <span className="review-card-text">
              <SafeMath text={revealed ? card.answer ?? t("review.noAnswer") : card.prompt} />
            </span>
            {!revealed && <span className="review-card-hint"><RotateCcw size={15} /> {t("review.tapToReveal")}</span>}
          </button>
          {revealed && (
            <div className="review-ratings">
              <span>{t("review.howWasIt")}</span>
              <div>
                <button className="review-rating review-rating--again" onClick={() => rate(1)} disabled={submitting}>{t("review.again")}</button>
                <button className="review-rating review-rating--hard" onClick={() => rate(2)} disabled={submitting}>{t("review.hard")}</button>
                <button className="review-rating review-rating--good" onClick={() => rate(3)} disabled={submitting}>{t("review.good")}</button>
                <button className="review-rating review-rating--easy" onClick={() => rate(4)} disabled={submitting}>{t("review.easy")}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
