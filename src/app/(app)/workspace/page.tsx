"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, ClipboardCheck, FileText, Layers, MessageCircle, Network, Play, RotateCcw, Route, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import MarkdownLite from "@/components/documents/MarkdownLite";
import SummaryDrawer from "@/components/documents/SummaryDrawer";
import { plainPreviewText } from "@/components/documents/DocumentCard";
import EmptyState from "@/components/ui/EmptyState";
import StateMessage from "@/components/ui/StateMessage";
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { ApiResponse, GoalWithRoadmap } from "@/types";

type WorkspaceDocument = {
  id: string;
  fileName: string;
  fileType: string;
  status: string;
  summary: string | null;
  subject: string | null;
  topic: string | null;
  difficulty: string | null;
  description: string | null;
  updatedAt: string;
};

type WorkspaceAnswer = {
  answer: string;
  citations: Array<{ chunkIndex: number; pageNumber: number | null; excerpt: string }>;
};

type WorkspaceQuiz = {
  id: string;
  text: string;
  options: string[];
  subject: string;
  topic: string;
  difficulty: string;
};

type QuizResult = {
  isCorrect: boolean;
  correctIndex: number;
  correctAnswer: string;
  explanation: string | null;
};

type WeakConcept = {
  subject: string;
  topic: string;
  mistakeCount: number;
  lastMistakeAt: string;
  exampleQuestion: string;
  exampleExplanation: string | null;
  sourceDocumentId: string | null;
};

type FlashcardItem = { front: string; back: string };

type SessionSummary = {
  id: string;
  subject: string;
  topic: string;
  status: "active" | "completed";
  startedAt: string;
  completedAt: string | null;
  masteryBeforePercent: number | null;
  masteryAfterPercent: number | null;
  questionsAnswered: number;
  correctAnswers: number;
  xpEarned: number;
  learningGoalId: string | null;
  sourceDocumentId: string | null;
};

export default function WorkspacePage() {
  const { t } = useLanguage();
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [goals, setGoals] = useState<GoalWithRoadmap[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<WorkspaceAnswer | null>(null);
  const [studyGuide, setStudyGuide] = useState<string | null>(null);
  const [guideCached, setGuideCached] = useState(false);
  const [guideUpdatedAt, setGuideUpdatedAt] = useState<string | null>(null);
  const [generatingGuide, setGeneratingGuide] = useState(false);
  const [flashcards, setFlashcards] = useState<FlashcardItem[] | null>(null);
  const [flashcardsCached, setFlashcardsCached] = useState(false);
  const [flashcardsUpdatedAt, setFlashcardsUpdatedAt] = useState<string | null>(null);
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [flashcardRevealed, setFlashcardRevealed] = useState(false);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<WorkspaceQuiz | null>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [weakConcepts, setWeakConcepts] = useState<WeakConcept[]>([]);
  const [mistakesLoading, setMistakesLoading] = useState(true);
  const [targetedTopic, setTargetedTopic] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<SessionSummary | null>(null);
  const [lastSessionSummary, setLastSessionSummary] = useState<SessionSummary | null>(null);
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Drawer đọc tóm tắt đầy đủ: Workspace chỉ hiện preview 1–3 dòng để
  // gọn, nội dung Markdown/LaTeX dài nằm sau nút "Xem tóm tắt".
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/documents").then((res) => res.json() as Promise<ApiResponse<WorkspaceDocument[]>>),
      fetch("/api/roadmaps").then((res) => res.json() as Promise<ApiResponse<GoalWithRoadmap[]>>),
    ])
      .then(([documentsResponse, goalsResponse]) => {
        if (!documentsResponse.success) throw new Error(documentsResponse.error);
        setDocuments(documentsResponse.data);
        if (goalsResponse.success) setGoals(goalsResponse.data);
        const firstReady = documentsResponse.data.find((document) => document.status === "ready");
        setSelectedId(firstReady?.id ?? documentsResponse.data[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t("common.connectionError")))
      .finally(() => setLoading(false));

    fetch("/api/practice/mistakes")
      .then((res) => res.json() as Promise<ApiResponse<{ weakConcepts: WeakConcept[] }>>)
      .then((json) => { if (json.success) setWeakConcepts(json.data.weakConcepts); })
      .catch(() => { /* Không chặn workspace nếu phần mistakes lỗi — best-effort. */ })
      .finally(() => setMistakesLoading(false));

    fetch("/api/learning-session/active")
      .then((res) => res.json() as Promise<ApiResponse<SessionSummary | null>>)
      .then((json) => { if (json.success) setActiveSession(json.data); })
      .catch(() => { /* best-effort — không có session dang dở cũng không sao. */ });
  }, [t]);

  const selected = useMemo(
    () => documents.find((document) => document.id === selectedId) ?? null,
    [documents, selectedId]
  );
  const activeGoal = goals.find((goal) => goal.status === "ACTIVE") ?? goals[0] ?? null;
  const readyCount = documents.filter((document) => document.status === "ready").length;

  async function askSource() {
    const trimmed = question.trim();
    if (!selected || !trimmed || asking) return;
    setAsking(true);
    setAnswer(null);
    try {
      const response = await fetch("/api/documents/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: selected.id, action: "ask", question: trimmed }),
      });
      const json: ApiResponse<WorkspaceAnswer> = await response.json();
      if (!json.success) throw new Error(json.error);
      setAnswer(json.data);
    } catch (err) {
      setAnswer({ answer: err instanceof Error ? err.message : t("workspace.askFail"), citations: [] });
    } finally {
      setAsking(false);
    }
  }

  async function startSession() {
    if (!selected || sessionBusy || activeSession) return;
    const subject = selected.subject ?? selected.fileName;
    const topic = selected.topic ?? selected.fileName;
    setSessionBusy(true);
    setSessionError(null);
    setLastSessionSummary(null);
    try {
      const response = await fetch("/api/learning-session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          topic,
          sourceDocumentId: selected.id,
          learningGoalId: activeGoal?.id,
        }),
      });
      const json: ApiResponse<SessionSummary> = await response.json();
      if (!json.success) throw new Error(json.error);
      setActiveSession(json.data);
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : t("workspace.sessionFail"));
    } finally {
      setSessionBusy(false);
    }
  }

  async function completeSession() {
    if (!activeSession || sessionBusy) return;
    setSessionBusy(true);
    setSessionError(null);
    try {
      const response = await fetch(`/api/learning-session/${activeSession.id}/complete`, { method: "POST" });
      const json: ApiResponse<SessionSummary> = await response.json();
      if (!json.success) throw new Error(json.error);
      setLastSessionSummary(json.data);
      setActiveSession(null);
    } catch (err) {
      setSessionError(err instanceof Error ? err.message : t("workspace.sessionFail"));
    } finally {
      setSessionBusy(false);
    }
  }

  async function createFlashcards(forceRegenerate = false) {
    if (!selected || generatingFlashcards) return;
    setGeneratingFlashcards(true);
    setFlashcardsError(null);
    try {
      const response = await fetch("/api/documents/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: selected.id, forceRegenerate }),
      });
      const json: ApiResponse<{ cards: FlashcardItem[]; cached: boolean; updatedAt: string }> = await response.json();
      if (!json.success) throw new Error(json.error);
      setFlashcards(json.data.cards);
      setFlashcardsCached(json.data.cached);
      setFlashcardsUpdatedAt(json.data.updatedAt);
      setFlashcardIndex(0);
      setFlashcardRevealed(false);
    } catch (err) {
      setFlashcardsError(err instanceof Error ? err.message : t("workspace.flashcardsFail"));
    } finally {
      setGeneratingFlashcards(false);
    }
  }

  function nextFlashcard() {
    if (!flashcards) return;
    setFlashcardIndex((i) => Math.min(i + 1, flashcards.length - 1));
    setFlashcardRevealed(false);
  }

  function prevFlashcard() {
    setFlashcardIndex((i) => Math.max(i - 1, 0));
    setFlashcardRevealed(false);
  }

  async function createStudyGuide(forceRegenerate = false) {
    if (!selected || generatingGuide) return;
    setGeneratingGuide(true);
    try {
      const response = await fetch("/api/documents/study-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: selected.id, difficulty: "intermediate", forceRegenerate }),
      });
      const json: ApiResponse<{ guide: string; cached: boolean; updatedAt: string }> = await response.json();
      if (!json.success) throw new Error(json.error);
      setStudyGuide(json.data.guide);
      setGuideCached(json.data.cached);
      setGuideUpdatedAt(json.data.updatedAt);
    } catch (err) {
      setStudyGuide(err instanceof Error ? err.message : t("workspace.guideFail"));
      setGuideCached(false);
      setGuideUpdatedAt(null);
    } finally {
      setGeneratingGuide(false);
    }
  }

  // `override` cho phép nút "Luyện tập lại" ở panel Common Mistakes
  // sinh câu hỏi đúng subject/topic (và nguồn, nếu đa số lỗi tới từ
  // cùng 1 tài liệu) thay vì luôn dùng nguồn đang chọn ở source rail.
  async function createQuizQuestion(override?: { subject: string; topic: string; sourceDocumentId?: string | null }) {
    if (generatingQuiz) return;
    if (!override && (!selected || selected.status !== "ready")) return;
    setGeneratingQuiz(true);
    setSelectedOption(null);
    setQuizResult(null);
    setTargetedTopic(override ? override.topic : null);
    try {
      const response = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: override?.subject ?? selected?.subject ?? "General",
          topic: override?.topic ?? selected?.topic ?? selected?.fileName,
          difficulty: "medium",
          sourceDocumentId: override ? override.sourceDocumentId ?? undefined : selected?.id,
        }),
      });
      const json: ApiResponse<WorkspaceQuiz> = await response.json();
      if (!json.success) throw new Error(json.error);
      setQuiz(json.data);
    } catch (err) {
      setQuiz({ id: "error", text: err instanceof Error ? err.message : t("workspace.quizFail"), options: [], subject: "", topic: "", difficulty: "" });
    } finally {
      setGeneratingQuiz(false);
    }
  }

  async function submitQuizAnswer() {
    if (!quiz || quiz.id === "error" || selectedOption === null || submittingAnswer || quizResult) return;
    setSubmittingAnswer(true);
    try {
      const response = await fetch("/api/quiz/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: quiz.id, selectedIndex: selectedOption }),
      });
      const json: ApiResponse<QuizResult> = await response.json();
      if (!json.success) throw new Error(json.error);
      setQuizResult(json.data);
      // Nếu vừa luyện tập từ 1 weak concept, làm mới danh sách mistakes
      // để phản ánh ngay nếu trả lời đúng (dữ liệu tự cập nhật, không
      // cần user tự reload trang để thấy tiến bộ).
      if (targetedTopic) {
        fetch("/api/practice/mistakes")
          .then((res) => res.json() as Promise<ApiResponse<{ weakConcepts: WeakConcept[] }>>)
          .then((refreshed) => { if (refreshed.success) setWeakConcepts(refreshed.data.weakConcepts); })
          .catch(() => {});
      }
    } catch (err) {
      setQuizResult({ isCorrect: false, correctIndex: -1, correctAnswer: "", explanation: err instanceof Error ? err.message : t("workspace.quizFail") });
    } finally {
      setSubmittingAnswer(false);
    }
  }

  if (loading) return <StateMessage kind="loading" text={t("workspace.loading")} />;
  if (error) return <StateMessage kind="error" text={error} />;

  return (
    <section className="workspace-page page-enter">
      <header className="workspace-header">
        <div>
          <div className="workspace-eyebrow"><Sparkles size={14} /> {t("workspace.eyebrow")}</div>
          <h1>{activeGoal?.title ?? t("workspace.defaultTitle")}</h1>
          <p>{activeGoal?.targetOutcome ?? t("workspace.subtitle")}</p>
        </div>
        <div className="workspace-header-actions">
          <span className="workspace-status"><span /> {readyCount} {t("workspace.sourcesReady")}</span>
          <Link className="btn-secondary" href="/roadmap"><Route size={15} /> {t("workspace.openRoadmap")}</Link>
        </div>
      </header>

      {documents.length > 0 && (
        <div className="workspace-session-bar">
          {lastSessionSummary && (
            <div className="workspace-session-summary">
              <div className="workspace-session-summary-head">
                <strong>{t("workspace.sessionSummaryTitle")}</strong>
                <button className="workspace-session-dismiss" onClick={() => setLastSessionSummary(null)} aria-label={t("workspace.dismiss")}>×</button>
              </div>
              <p>{lastSessionSummary.subject} — {lastSessionSummary.topic}</p>
              <div className="workspace-session-stats">
                <span>{t("workspace.sessionQuestions")}: <strong>{lastSessionSummary.correctAnswers}/{lastSessionSummary.questionsAnswered}</strong></span>
                <span>{t("workspace.sessionXp")}: <strong>+{lastSessionSummary.xpEarned}</strong></span>
                {lastSessionSummary.masteryBeforePercent !== null && lastSessionSummary.masteryAfterPercent !== null && (
                  <span>{t("workspace.sessionMastery")}: <strong>{lastSessionSummary.masteryBeforePercent}% → {lastSessionSummary.masteryAfterPercent}%</strong></span>
                )}
              </div>
            </div>
          )}
          {activeSession ? (
            <div className="workspace-session-active">
              <span className="workspace-session-dot" />
              <span>{t("workspace.sessionActive")}: <strong>{activeSession.subject} — {activeSession.topic}</strong></span>
              <button className="btn-primary" onClick={completeSession} disabled={sessionBusy}>
                {sessionBusy ? t("workspace.sessionCompleting") : t("workspace.sessionComplete")}
              </button>
            </div>
          ) : (
            <button className="btn-secondary" onClick={startSession} disabled={sessionBusy || !selected || selected.status !== "ready"}>
              <Play size={15} /> {sessionBusy ? t("workspace.sessionStarting") : t("workspace.sessionStart")}
            </button>
          )}
          {sessionError && <p className="workspace-session-error">{sessionError}</p>}
        </div>
      )}

      {documents.length === 0 ? (
        <EmptyState
          icon="◈"
          title={t("workspace.emptyTitle")}
          description={t("workspace.emptyDescription")}
          actionLabel={t("workspace.addSource")}
          onAction={() => { window.location.href = "/library"; }}
        />
      ) : (
        <div className="workspace-grid">
          <aside className="workspace-sources" aria-label={t("workspace.sourcesAria")}>
            <div className="workspace-section-heading">
              <div><span>{t("workspace.sourcesLabel")}</span><strong>{documents.length}</strong></div>
              <Link href="/library" aria-label={t("workspace.addSource")}><FileText size={16} /></Link>
            </div>
            <div className="workspace-source-list">
              {documents.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  className={`workspace-source ${selected?.id === document.id ? "workspace-source--selected" : ""}`}
                  onClick={() => {
                    setSelectedId(document.id);
                    setShowSummary(false);
                    setAnswer(null);
                    setStudyGuide(null);
                    setGuideCached(false);
                    setGuideUpdatedAt(null);
                    setFlashcards(null);
                    setFlashcardsCached(false);
                    setFlashcardsUpdatedAt(null);
                    setFlashcardIndex(0);
                    setFlashcardRevealed(false);
                    setFlashcardsError(null);
                    setQuiz(null);
                    setSelectedOption(null);
                    setQuizResult(null);
                    setTargetedTopic(null);
                  }}
                >
                  <span className="workspace-source-icon"><FileText size={17} /></span>
                  <span className="workspace-source-copy">
                    <strong>{document.fileName}</strong>
                    <small>{document.subject ?? t("workspace.unassigned")} · {document.status}</small>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <main className="workspace-main">
            {!selected ? (
              <div className="workspace-placeholder">{t("workspace.selectSource")}</div>
            ) : (
              <>
                <div className="workspace-context-row">
                  <div>
                    <span className="workspace-kicker">{selected.subject ?? t("workspace.source")}</span>
                    <h2>{selected.fileName}</h2>
                    <p>{selected.topic ?? selected.description ?? t("workspace.noTopic")}</p>
                  </div>
                  <span className={`workspace-processing workspace-processing--${selected.status}`}>{selected.status}</span>
                </div>

                <div className="workspace-artifact-strip">
                  <Link href={`/mindmap?sourceDocumentId=${selected.id}`}><Network size={16} /> {t("workspace.mindMap")}</Link>
                  <Link href={`/tutor?topic=${encodeURIComponent(selected.topic ?? selected.subject ?? selected.fileName)}`}><MessageCircle size={16} /> {t("workspace.tutor")}</Link>
                  <Link href={`/practice?topic=${encodeURIComponent(selected.topic ?? "")}`}><Play size={16} /> {t("workspace.practice")}</Link>
                  <Link href="/review"><RotateCcw size={16} /> {t("nav.review")}</Link>
                  <button className="workspace-inline-action" onClick={() => createQuizQuestion()} disabled={generatingQuiz || selected.status !== "ready"}><ClipboardCheck size={16} /> {generatingQuiz ? t("workspace.generatingQuiz") : t("workspace.quiz")}</button>
                  <button className="workspace-inline-action" onClick={() => createFlashcards(false)} disabled={generatingFlashcards || selected.status !== "ready"}><Layers size={16} /> {generatingFlashcards ? t("workspace.generatingFlashcards") : t("workspace.flashcards")}</button>
                </div>

                {flashcardsError && <p className="workspace-session-error">{flashcardsError}</p>}

                {flashcards && flashcards.length > 0 && (
                  <div className="workspace-flashcards">
                    <div className="workspace-reading-heading">
                      <span>{t("workspace.flashcards")} ({flashcardIndex + 1}/{flashcards.length})</span>
                      <button className="btn-secondary" onClick={() => createFlashcards(true)} disabled={generatingFlashcards} title={t("workspace.guideRegenerate")}>
                        <RotateCcw size={14} /> {t("workspace.guideRegenerate")}
                      </button>
                    </div>
                    {flashcardsCached && flashcardsUpdatedAt && (
                      <p className="workspace-guide-cached-note">{t("workspace.guideCachedNote")} {new Date(flashcardsUpdatedAt).toLocaleString()}</p>
                    )}
                    <button
                      type="button"
                      className={`review-card ${flashcardRevealed ? "review-card--revealed" : ""}`}
                      onClick={() => setFlashcardRevealed(true)}
                    >
                      <span className="review-card-label">{flashcardRevealed ? t("workspace.flashcardBack") : t("workspace.flashcardFront")}</span>
                      <span className="review-card-text">{flashcardRevealed ? flashcards[flashcardIndex].back : flashcards[flashcardIndex].front}</span>
                      {!flashcardRevealed && <span className="review-card-hint"><RotateCcw size={15} /> {t("review.tapToReveal")}</span>}
                    </button>
                    <div className="workspace-flashcards-nav">
                      <button className="btn-secondary" onClick={prevFlashcard} disabled={flashcardIndex === 0}>← {t("workspace.flashcardPrev")}</button>
                      <button className="btn-secondary" onClick={nextFlashcard} disabled={flashcardIndex === flashcards.length - 1}>{t("workspace.flashcardNext")} →</button>
                    </div>
                  </div>
                )}

                <article className="workspace-reading-panel">
                  <div className="workspace-reading-heading"><span>{studyGuide ? t("workspace.guideLabel") : t("workspace.summaryLabel")}</span><span>{selected.fileType.toUpperCase()}</span></div>
                  <div className="workspace-reading-actions">
                    <button className="btn-secondary" onClick={() => setStudyGuide(null)}>{t("workspace.summaryLabel")}</button>
                    <button className="btn-secondary" onClick={() => createStudyGuide(false)} disabled={generatingGuide || selected.status !== "ready"}>{generatingGuide ? t("workspace.generatingGuide") : t("workspace.studyGuide")}</button>
                    {studyGuide && (
                      <button className="btn-secondary" onClick={() => createStudyGuide(true)} disabled={generatingGuide} title={t("workspace.guideRegenerate")}>
                        <RotateCcw size={14} /> {t("workspace.guideRegenerate")}
                      </button>
                    )}
                  </div>
                  {studyGuide && guideCached && guideUpdatedAt && (
                    <p className="workspace-guide-cached-note">
                      {t("workspace.guideCachedNote")} {new Date(guideUpdatedAt).toLocaleString()}
                    </p>
                  )}
                  {studyGuide ? (
                    <MarkdownLite content={studyGuide} />
                  ) : selected.summary ? (
                    <>
                      <p className="workspace-muted">{plainPreviewText(selected.summary)}</p>
                      <div style={{ marginTop: 10 }}>
                        <button type="button" className="btn-secondary" onClick={() => setShowSummary(true)}>
                          <BookOpen size={14} /> {t("doc.viewSummary")}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="workspace-muted">{t("workspace.noSummary")}</p>
                  )}
                  {quiz && (
                    <div className="workspace-quiz">
                      <div className="workspace-reading-heading"><span>{targetedTopic ? `${t("workspace.targetedPractice")}: ${targetedTopic}` : t("workspace.quiz")}</span><span>{quiz.difficulty}</span></div>
                      {quiz.id === "error" ? (
                        <p className="workspace-muted">{quiz.text}</p>
                      ) : (
                        <>
                          <p>{quiz.text}</p>
                          {quiz.options.map((option, optionIndex) => {
                            const isSelected = selectedOption === optionIndex;
                            const isRevealedCorrect = quizResult && optionIndex === quizResult.correctIndex;
                            const isRevealedWrong = quizResult && isSelected && !quizResult.isCorrect;
                            return (
                              <button
                                key={`${quiz.id}-${optionIndex}`}
                                type="button"
                                className={`workspace-quiz-option workspace-quiz-option--interactive ${isSelected ? "workspace-quiz-option--selected" : ""} ${isRevealedCorrect ? "workspace-quiz-option--correct" : ""} ${isRevealedWrong ? "workspace-quiz-option--wrong" : ""}`}
                                disabled={!!quizResult}
                                onClick={() => setSelectedOption(optionIndex)}
                              >
                                {String.fromCharCode(65 + optionIndex)}. {option}
                              </button>
                            );
                          })}
                          {!quizResult ? (
                            <button className="btn-primary" style={{ marginTop: 10 }} disabled={selectedOption === null || submittingAnswer} onClick={submitQuizAnswer}>
                              {submittingAnswer ? t("workspace.submittingAnswer") : t("workspace.submitAnswer")}
                            </button>
                          ) : (
                            <div className={`workspace-quiz-result ${quizResult.isCorrect ? "workspace-quiz-result--correct" : "workspace-quiz-result--wrong"}`}>
                              <strong>{quizResult.isCorrect ? t("workspace.quizCorrect") : t("workspace.quizIncorrect")}</strong>
                              {!quizResult.isCorrect && quizResult.correctAnswer && (
                                <p>{t("workspace.quizCorrectAnswerLabel")}: {quizResult.correctAnswer}</p>
                              )}
                              {quizResult.explanation && (
                                <p><em>{t("workspace.quizExplanationLabel")}:</em> {quizResult.explanation}</p>
                              )}
                              <button className="btn-secondary" style={{ marginTop: 8 }} onClick={() => createQuizQuestion(targetedTopic ? { subject: quiz.subject, topic: quiz.topic } : undefined)}>
                                {t("workspace.quizNextQuestion")}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </article>
              </>
            )}
          </main>

          <aside className="workspace-ai-panel">
            <div className="workspace-ai-heading"><MessageCircle size={17} /><div><strong>{t("workspace.askTitle")}</strong><span>{selected?.fileName ?? t("workspace.noSource")}</span></div></div>
            <p className="workspace-ai-intro">{t("workspace.askIntro")}</p>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") askSource(); }}
              placeholder={t("workspace.askPlaceholder")}
              disabled={!selected || selected.status !== "ready" || asking}
            />
            <button className="btn-primary workspace-ask-button" onClick={askSource} disabled={!selected || selected.status !== "ready" || !question.trim() || asking}>
              <Send size={15} /> {asking ? t("workspace.asking") : t("workspace.ask")}
            </button>
            {answer && (
              <div className="workspace-answer">
                <span>{t("workspace.answerLabel")}</span>
                <p>{answer.answer}</p>
                {answer.citations.length > 0 && (
                  <div className="workspace-citations">
                    <strong>{t("workspace.sourcesLabel")}</strong>
                    {answer.citations.map((citation) => (
                      <div key={`${citation.chunkIndex}-${citation.pageNumber ?? "na"}`} className="workspace-citation">
                        <span>{citation.pageNumber ? `Page ${citation.pageNumber}` : `Chunk ${citation.chunkIndex + 1}`}</span>
                        <small>{citation.excerpt}</small>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      )}

      {!mistakesLoading && weakConcepts.length > 0 && (
        <section className="workspace-mistakes-panel">
          <div className="workspace-section-heading">
            <div><span>{t("workspace.mistakesTitle")}</span><strong>{weakConcepts.length}</strong></div>
          </div>
          <div className="workspace-mistakes-list">
            {weakConcepts.map((concept) => (
              <div key={`${concept.subject}-${concept.topic}`} className="workspace-mistake-card">
                <div className="workspace-mistake-head">
                  <strong>{concept.topic}</strong>
                  <span>{concept.subject} · {concept.mistakeCount} {t("workspace.mistakeCount")}</span>
                </div>
                <p className="workspace-mistake-example">{concept.exampleQuestion}</p>
                {concept.exampleExplanation && <p className="workspace-mistake-explanation">{concept.exampleExplanation}</p>}
                <button
                  className="btn-secondary"
                  disabled={generatingQuiz}
                  onClick={() => createQuizQuestion({ subject: concept.subject, topic: concept.topic, sourceDocumentId: concept.sourceDocumentId })}
                >
                  {generatingQuiz && targetedTopic === concept.topic ? t("workspace.generatingTargeted") : t("workspace.targetedPractice")}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {showSummary && selected?.summary && (
        <SummaryDrawer
          documentId={selected.id}
          fileName={selected.fileName}
          summary={selected.summary}
          onClose={() => setShowSummary(false)}
        />
      )}
    </section>
  );
}
