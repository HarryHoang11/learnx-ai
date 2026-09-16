"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import StateMessage from "@/components/ui/StateMessage";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ApiResponse } from "@/types";

type ReviewCard = {
  id: string;
  topic: string;
  concept?: string;
  subject?: string;
  prompt: string;
  answer?: string;
  repetitions: number;
  nextReviewAt?: string;
};

type ReviewResponse = {
  reviews: ReviewCard[];
  stats: { due: number; overdue: number; upcoming: number; total: number };
};

export default function ReviewPage() {
  const { t } = useLanguage();
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [stats, setStats] = useState<ReviewResponse["stats"] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch("/api/review/due?limit=30");
      const json: ApiResponse<ReviewResponse> = await response.json();
      if (!json.success) throw new Error(json.error);
      setCards(json.data.reviews);
      setStats(json.data.stats);
      setIndex(0);
      setRevealed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("review.loadFail"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // The initial review load intentionally runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (loading) return <StateMessage kind="loading" text={t("review.loading")} />;
  if (error) return <StateMessage kind="error" text={error} />;
  const card = cards[index];

  return (
    <section className="review-page page-enter">
      <header className="review-header">
        <div className="workspace-eyebrow"><Sparkles size={14} /> {t("review.eyebrow")}</div>
        <h1>{t("review.title")}</h1>
        <p>{stats ? t("review.progress", { current: cards.length === 0 ? 0 : index + 1, total: cards.length }) : ""}</p>
      </header>
      {!card ? (
        <EmptyState icon="↻" title={t("review.emptyTitle")} description={t("review.emptyDescription")} actionLabel={t("review.refresh")} onAction={load} />
      ) : (
        <div className="review-focus">
          <div className="review-meta"><span>{card.subject ?? t("review.subject")}</span><strong>{card.topic}</strong></div>
          <button className={`review-card ${revealed ? "review-card--revealed" : ""}`} onClick={() => setRevealed(true)} type="button">
            <span className="review-card-label">{revealed ? t("review.answer") : t("review.question")}</span>
            <span className="review-card-text">{revealed ? card.answer ?? t("review.noAnswer") : card.prompt}</span>
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
