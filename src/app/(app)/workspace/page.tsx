"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardCheck, FileText, MessageCircle, Network, Play, RotateCcw, Route, Send, Sparkles } from "lucide-react";
import Link from "next/link";
import MarkdownLite from "@/components/documents/MarkdownLite";
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

export default function WorkspacePage() {
  const { t } = useLanguage();
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]);
  const [goals, setGoals] = useState<GoalWithRoadmap[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<WorkspaceAnswer | null>(null);
  const [studyGuide, setStudyGuide] = useState<string | null>(null);
  const [generatingGuide, setGeneratingGuide] = useState(false);
  const [quiz, setQuiz] = useState<WorkspaceQuiz | null>(null);
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function createStudyGuide() {
    if (!selected || generatingGuide) return;
    setGeneratingGuide(true);
    try {
      const response = await fetch("/api/documents/study-guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: selected.id, difficulty: "intermediate" }),
      });
      const json: ApiResponse<{ guide: string }> = await response.json();
      if (!json.success) throw new Error(json.error);
      setStudyGuide(json.data.guide);
    } catch (err) {
      setStudyGuide(err instanceof Error ? err.message : t("workspace.guideFail"));
    } finally {
      setGeneratingGuide(false);
    }
  }

  async function createQuizQuestion() {
    if (!selected || selected.status !== "ready" || generatingQuiz) return;
    setGeneratingQuiz(true);
    try {
      const response = await fetch("/api/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: selected.subject ?? "General",
          topic: selected.topic ?? selected.fileName,
          difficulty: "medium",
          sourceDocumentId: selected.id,
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
                  onClick={() => { setSelectedId(document.id); setAnswer(null); }}
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
                  <button className="workspace-inline-action" onClick={createQuizQuestion} disabled={generatingQuiz || selected.status !== "ready"}><ClipboardCheck size={16} /> {generatingQuiz ? t("workspace.generatingQuiz") : t("workspace.quiz")}</button>
                </div>

                <article className="workspace-reading-panel">
                  <div className="workspace-reading-heading"><span>{studyGuide ? t("workspace.guideLabel") : t("workspace.summaryLabel")}</span><span>{selected.fileType.toUpperCase()}</span></div>
                  <div className="workspace-reading-actions">
                    <button className="btn-secondary" onClick={() => setStudyGuide(null)}>{t("workspace.summaryLabel")}</button>
                    <button className="btn-secondary" onClick={createStudyGuide} disabled={generatingGuide || selected.status !== "ready"}>{generatingGuide ? t("workspace.generatingGuide") : t("workspace.studyGuide")}</button>
                  </div>
                  {studyGuide ? <MarkdownLite content={studyGuide} /> : selected.summary ? <MarkdownLite content={selected.summary} /> : <p className="workspace-muted">{t("workspace.noSummary")}</p>}
                  {quiz && (
                    <div className="workspace-quiz">
                      <div className="workspace-reading-heading"><span>{t("workspace.quiz")}</span><span>{quiz.difficulty}</span></div>
                      <p>{quiz.text}</p>
                      {quiz.options.map((option, optionIndex) => <div className="workspace-quiz-option" key={`${quiz.id}-${optionIndex}`}>{String.fromCharCode(65 + optionIndex)}. {option}</div>)}
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
    </section>
  );
}
