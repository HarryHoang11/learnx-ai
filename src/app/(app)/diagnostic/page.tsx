// ================================================================
// Diagnostic page — multi-subject support
// ================================================================
// Trước đây hardcode subject="Toán". Bây giờ hiển thị màn hình chọn
// môn học trước khi bắt đầu kiểm tra năng lực — dựa trên danh sách
// môn hợc có sẵn trong hệ thống (từ dictionary).
// ================================================================

"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Panel from "@/components/ui/Panel";
import SkillBar from "@/components/ui/SkillBar";
import StateMessage from "@/components/ui/StateMessage";
import { useToast } from "@/components/ui/Toast";
import SafeMath from "@/components/math/SafeMath";
import { Sparkles } from "lucide-react";
import "@/app/onboarding/onboarding.css";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { SUBJECTS, CUSTOM_SUBJECT_VALUE } from "@/lib/constants/subjects";
// Nhãn lớp dùng CHUNG key của onboarding (onboarding.grade.*) để cùng 1 cách
// gọi cho cả 2 nơi — không tạo bảng nhãn lớp thứ hai trong app.
import type { I18nKey } from "@/lib/i18n/dictionary";
// `readApi` + `TransportError` dùng chung cho mọi trang (tách từ chính file
// này) — xem lib/api/readApi.ts để biết vì sao không dùng res.json() thẳng.
import { readApi, TransportError } from "@/lib/api/readApi";
import type { ApiResponse, PublicQuestion, SkillMasteryPoint } from "@/types";

type Phase = "subject_select" | "loading" | "in_progress" | "finished" | "error";

interface CompletionActivity {
  recorded: boolean;
  alreadyRecorded?: boolean;
  xpEarned: number;
  streak: { current: number; longest: number };
}

interface SubjectStatus {
  subject: string;
  completed: boolean;
  completedAt: Date | null;
  lastMastery: number;
}

const AVAILABLE_SUBJECTS = SUBJECTS;

/**
 * Timeout cho POST /api/assessment/start.
 *
 * Con số này phải LỚN HƠN tổng thời gian server có thể mất: AI router thử
 * lần lượt Gemini (12s) -> Groq (8s) -> DeepSeek (12s) -> OpenRouter (12s),
 * mỗi provider retry tối đa 2 lần -> worst case ~1 phút. Timeout ở client
 * chỉ để chặn trường hợp request treo vô hạn (mạng treo, server không trả
 * response), KHÔNG cắt ngắn một lần gọi AI hợp lệ.
 */
const START_TIMEOUT_MS = 75_000;

/** Timeout cho POST /api/assessment/answer (cũng gọi AI sinh câu kế tiếp). */
const ANSWER_TIMEOUT_MS = 45_000;

/**
 * Bọc trong <Suspense>: `useSearchParams` bắt buộc phải nằm trong Suspense khi
 * render tĩnh (Next.js chặn build nếu thiếu). Cùng pattern với trang /setup.
 */
export default function DiagnosticPage() {
  const { t } = useLanguage();
  return (
    <Suspense fallback={<StateMessage kind="loading" text={t("common.loading")} />}>
      <DiagnosticPageInner />
    </Suspense>
  );
}

function DiagnosticPageInner() {
  const { t } = useLanguage();
  const { push } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Đến từ bước "Kiểm tra năng lực" của onboarding. Cờ này quyết định:
  //   1) sau khi làm xong, CTA quay về màn HỒ SƠ thay vì Dashboard — đi đúng
  //      luồng Profile -> Roadmap -> Dashboard, không tự nhảy về giữa chừng;
  //   2) có nút "quay lại khảo sát" trên màn chọn môn.
  const fromOnboarding = searchParams?.get("from") === "onboarding";
  const [phase, setPhase] = useState<Phase>("subject_select");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [customSubject, setCustomSubject] = useState<string>("");
  const [subjectStatus, setSubjectStatus] = useState<Map<string, SubjectStatus>>(new Map());
  // Môn được gợi ý theo hồ sơ học tập (§19). Rổng = user chưa có
  // hồ sơ đủ d῅ng, UI hiển thị đầy đệ môn như cũ.
  const [suggested, setSuggested] = useState<string[]>([]);
  // LỚP ĐANG KIỂM TRA (§4 + §12): `availableGrades` lấy từ server theo cấp
  // học trong hồ sơ (không hardcode ở frontend); `selectedGrade` mặc định
  // bằng lớp hiện tại của học sinh. Gửi lên server để lưu vào bài kiểm
  // tra — KHÔNG ghi đè currentGrade trong hồ sơ.
  const [availableGrades, setAvailableGrades] = useState<string[]>([]);
  const [currentGrade, setCurrentGrade] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [answerWasCorrect, setAnswerWasCorrect] = useState<boolean | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [profile, setProfile] = useState<SkillMasteryPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<CompletionActivity | null>(null);
  // Đang gọi POST /api/assessment/start. Dùng để phản hồi NGAY trên nút
  // ("Đang chuẩn bị...") thay vì thay cả trang — layout không nhảy.
  const [starting, setStarting] = useState(false);
  // Chặn double-click NGAY trong cùng tick: `starting` chỉ đổi sau render nên
  // một mình nó không đủ (cùng lý do đã ghi ở LearningOnboarding.savingRef).
  const startingRef = useRef(false);
  // Bước vừa lỗi — quyết định nút "Thử lại" gọi lại ĐÚNG việc gì.
  const [failedStep, setFailedStep] = useState<"start" | "answer" | "result" | null>(null);

  // Dùng CUSTOM_SUBJECT_VALUE thay vì chuỗi "Khác" viết tay: trước đây hai
  // chỗ này trùng giá trị, nếu hằng số đổi thì select hiện "Khác" còn logic
  // lại không nhận ra -> effectiveSubject rỗng -> nút "Bắt đầu kiểm tra"
  // disabled mà không giải thích được.
  const effectiveSubject = selectedSubject === CUSTOM_SUBJECT_VALUE ? customSubject : selectedSubject;

  useEffect(() => {
    // Endpoint này CHỈ để gợi ý môn + hiện badge "đã kiểm tra" — lỗi ở đây
    // không được chặn việc làm bài. Nhưng nuốt im lặng thì khi hỏng ta mất
    // dấu vết, nên vẫn log ra console (chỉ 1 dòng, không spam).
    fetch("/api/diagnostic/status")
      .then((res) => readApi<{
        history: SubjectStatus[];
        suggestedSubjects: string[];
        educationStage: string | null;
        grade: string | null;
        availableGrades: string[];
      }>(res, "GET /api/diagnostic/status"))
      .then(
        (json) => {
          if (!json.success) {
            console.error("[diagnostic] /api/diagnostic/status thất bại:", json.error);
            return;
          }
          const map = new Map<string, SubjectStatus>();
          json.data.history.forEach((s) => map.set(s.subject, s));
          setSubjectStatus(map);
          const fromProfile = json.data.suggestedSubjects ?? [];
          setSuggested(fromProfile);
          // Lớp kiểm tra mặc định = lớp hiện tại trong hồ sơ (server xác
          // nhận). Danh sách lớp hợp lệ đến từ server theo cấp đã khai.
          const grades = json.data.availableGrades ?? [];
          setAvailableGrades(grades);
          setCurrentGrade(json.data.grade ?? null);
          setSelectedGrade((prev) => prev || json.data.grade || grades[0] || "");
          // Từ onboarding: TỰ CHỌN MÔN ĐẦU TIÊN theo hồ sơ. Đây là điểm nối
          // khảo sát -> kiểm tra: người dùng vừa nói "tôi học Toán và Vật lý"
          // thì không bắt họ chọn lại từ đầu.
          // CHỈ chọn hộ nếu môn nằm trong danh sách hợp lệ — môn gõ tay nằm
          // ngoài danh sách sẽ không hiện trong <select>.
          const firstKnown = fromProfile.find((s) =>
            AVAILABLE_SUBJECTS.some((a) => a.value === s)
          );
          if (firstKnown) setSelectedSubject(firstKnown);
        }
      )
      .catch((err) => console.error("[diagnostic] không tải được trạng thái kiểm tra:", err))
      .finally(() => setLoadingStatus(false));
  }, []);

  async function start() {
    // ---- VALIDATION (chặn trước khi gọi API) ----
    // effectiveSubject rỗng khi user chưa chọn môn, hoặc chọn "Khác" mà
    // chưa gõ tên. Nút đã disabled trong trường hợp này, nhưng guard ở đây
    // vẫn cần: đây là ranh giới dữ liệu, không phải chi tiết UI.
    const subject = effectiveSubject.trim();
    if (!subject) {
      push("error", t("diagnostic.subjectRequired"));
      return;
    }

    // ---- CHỐNG DOUBLE-CLICK ----
    // `startingRef` chặn ở CÙNG TICK trước khi React render lại, nên 5
    // click liên tiếp chỉ tạo 1 Assessment. Chỉ dựa vào `starting` state
    // là KHÔNG đủ: các click trong cùng một tick đều thấy `starting ===
    // false` (state chưa kịp commit) -> sinh nhiều bản ghi trùng.
    if (startingRef.current) return;
    startingRef.current = true;

    setStarting(true);
    setError(null);
    setCompletion(null);
    setFailedStep("start");
    // CỐ Ý KHÔNG setPhase("loading"): nếu thay cả trang bằng
    // StateMessage thì user mất nút, thấy màn trắng không rõ còn sống
    // hay không, và không có gì để bấm "Thử lại". Giữ nguyên layout +
    // chỉ đổi trạng thái NÚT -> phản hồi tức thời, có spinner, có retry.

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), START_TIMEOUT_MS);
    try {
      const res = await fetch("/api/assessment/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, grade: selectedGrade || undefined }),
        signal: controller.signal,
      });

      // 401 = session hết hạn / user bị đăng xuất. Phải nói rõ chứ không
      // im lặng — nếu chỉ show lỗi chung, user bấm "Thử lại" hoài vô ích.
      if (res.status === 401) {
        push("error", t("diagnostic.sessionExpired"));
        router.push("/login");
        return;
      }

      const json = await readApi<{ assessmentId: string; question: PublicQuestion }>(
        res,
        "POST /api/assessment/start"
      );
      if (!json.success) throw new Error(json.error);

      setAssessmentId(json.data.assessmentId);
      setQuestion(json.data.question);
      setAnsweredCount(0);
      setSelected(null);
      setAnswerWasCorrect(null);
      setPhase("in_progress");
    } catch (err) {
      // Abort do timeout của chính ta -> thông báo riêng, nói rõ nguyên nhân
      // thay vì "Failed to fetch" (AbortError không cho biết là do hết giờ).
      if (controller.signal.aborted) {
        console.error("[diagnostic] start() hết thời gian chờ sau", START_TIMEOUT_MS, "ms");
        setError(t("diagnostic.startTimeout"));
      } else if (err instanceof TransportError) {
        setError(t("diagnostic.startFail"));
      } else {
        console.error("[diagnostic] start() lỗi:", err);
        setError(err instanceof Error ? err.message : t("diagnostic.startFail"));
      }
      setPhase("error");
    } finally {
      clearTimeout(timer);
      startingRef.current = false;
      setStarting(false);
    }
  }

  async function answer(index: number) {
    if (!question || !assessmentId || selected !== null) return;
    setSelected(index);
    setError(null);
    setFailedStep("answer");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANSWER_TIMEOUT_MS);
    try {
      const res = await fetch("/api/assessment/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessmentId, questionId: question.id, selectedIndex: index }),
        signal: controller.signal,
      });

      if (res.status === 401) {
        push("error", t("diagnostic.sessionExpired"));
        router.push("/login");
        return;
      }

      const json = await readApi<
        { done: true; activity?: CompletionActivity } | { done: false; isCorrect: boolean; nextQuestion: PublicQuestion }
      >(res, "POST /api/assessment/answer");
      if (!json.success) throw new Error(json.error);

      setAnsweredCount((c) => c + 1);
      if (!json.data.done) setAnswerWasCorrect(json.data.isCorrect);
      if (json.data.done && json.data.activity) {
        setCompletion(json.data.activity);
      }

      // Chừa 700ms cho user thấy đáp án đúng/sai trước khi chuyển câu.
      // `timer` đã clear ở finally nên callback này không bị rò rỉ.
      setTimeout(async () => {
        if (json.data.done) {
          await loadResult();
        } else {
          setQuestion(json.data.nextQuestion);
          setSelected(null);
          setAnswerWasCorrect(null);
        }
      }, 700);
    } catch (err) {
      if (controller.signal.aborted) {
        console.error("[diagnostic] answer() hết thời gian chờ sau", ANSWER_TIMEOUT_MS, "ms");
        setError(t("diagnostic.answerTimeout"));
      } else if (err instanceof TransportError) {
        setError(t("diagnostic.answerFail"));
      } else {
        console.error("[diagnostic] answer() lỗi:", err);
        setError(err instanceof Error ? err.message : t("diagnostic.answerFail"));
      }
      // Mở lại lựa chọn: user phải bấm lại được, không bị kẹt ở câu đã
      // chọn nhưng không chấm được.
      setSelected(null);
      setPhase("error");
    } finally {
      clearTimeout(timer);
    }
  }

  async function loadResult() {
    setPhase("loading");
    setFailedStep("result");
    try {
      const res = await fetch(`/api/assessment/result?subject=${encodeURIComponent(effectiveSubject)}`);
      if (res.status === 401) {
        push("error", t("diagnostic.sessionExpired"));
        router.push("/login");
        return;
      }
      const json = await readApi<{ profile: SkillMasteryPoint[]; weakTopics: string[] }>(
        res,
        "GET /api/assessment/result"
      );
      if (!json.success) throw new Error(json.error);
      setProfile(json.data.profile);
      setPhase("finished");
    } catch (err) {
      console.error("[diagnostic] loadResult() lỗi:", err);
      setError(err instanceof Error ? err.message : t("diagnostic.resultFail"));
      setPhase("error");
    }
  }

  /**
   * Nút "Thử lại" — gọi lại ĐÚNG bước đã lỗi, không phải luôn gọi lại
   * `start()` (làm mất tiến độ 15 câu đã làm nếu lỗi xảy ra ở bước sau).
   */
  function retry() {
    setError(null);
    if (failedStep === "answer" && question) {
      // Không tự động gửi lại đáp án: user chọn lại là quyết định của họ.
      setPhase("in_progress");
      return;
    }
    if (failedStep === "result") {
      void loadResult();
      return;
    }
    void start();
  }

  return (
    <section style={{ maxWidth: 640, margin: "0 auto" }}>
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>{t("diagnostic.title")}</h2>
      <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginBottom: 22 }}>
        {t("diagnostic.subtitle")}
      </p>

      {phase === "subject_select" && (
        <>
          <Panel style={{ marginBottom: 20, padding: "16px 18px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>{t("diagnostic.chooseSubject")}</div>

            {/* Gợi ý môn theo hồ sơ: bấm tách 1 chềp để môn được
                đánh giá nhất, nhưng vẫn là CHỈ định — user chọn
                được bao nhiêu cũng được (yêu cầu §1, §19). */}
            {suggested.length > 0 && (
              <div className="onb-group" style={{ marginBottom: 12 }}>
                <div className="onb-group-label">{t("onboarding.diagnostic.suggested")}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {suggested.map((subject) => (
                    <button
                      key={subject}
                      type="button"
                      className="onb-option"
                      style={{ minHeight: 36, padding: "6px 12px", fontSize: 13 }}
                      onClick={() => {
                        setSelectedSubject(subject);
                        if (subject !== CUSTOM_SUBJECT_VALUE) setCustomSubject("");
                      }}
                    >
                      <Sparkles size={13} aria-hidden="true" />
                      <span>{subject}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <select
              value={selectedSubject}
              onChange={(e) => {
                setSelectedSubject(e.target.value);
                if (e.target.value !== CUSTOM_SUBJECT_VALUE) setCustomSubject("");
              }}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 10,
                background: "var(--panel-strong)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                fontSize: 15,
                marginBottom: 14,
              }}
            >
              <option value="">{t("diagnostic.chooseSubject")}</option>
              {AVAILABLE_SUBJECTS.map((s) => {
                const status = subjectStatus.get(s.value);
                const badge = status?.completed
                  ? ` ✓ ${t("diagnostic.alreadyTested")}`
                  : status
                  ? ` ${t("diagnostic.previousResult", { n: status.lastMastery })}`
                  : "";
                return (
                  <option key={s.value} value={s.value}>
                    {t(s.labelKey)}{badge}
                  </option>
                );
              })}
              <option value={CUSTOM_SUBJECT_VALUE}>{CUSTOM_SUBJECT_VALUE}</option>
            </select>
            {selectedSubject === CUSTOM_SUBJECT_VALUE && (
              <input
                type="text"
                value={customSubject}
                onChange={(e) => setCustomSubject(e.target.value)}
                placeholder={t("diagnostic.customSubject")}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: "var(--panel-strong)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: 14,
                  marginBottom: 14,
                }}
              />
            )}
            {/*
              Bộ chọn LỚP KIỂM TRA (§4). Danh sách lớp do SERVER trả về theo
              cấp học trong hồ sơ — frontend KHÔNG hardcode 10/11/12. Hồ sơ
              chưa khai cấp thì `availableGrades` rỗng => ẩn khối này, hành vi
              cũ giữ nguyên. Chọn lớp khác lớp hiện tại KHÔNG sửa lớp hiện tại
              trong hồ sơ (server lưu riêng vào bài kiểm tra).
            */}
            {availableGrades.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                  {t("diagnostic.chooseGrade")}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {availableGrades.map((grade) => (
                    <button
                      key={grade}
                      type="button"
                      className="onb-option"
                      aria-pressed={selectedGrade === grade}
                      style={{
                        minHeight: 36,
                        padding: "6px 14px",
                        fontSize: 13,
                        borderColor: selectedGrade === grade ? "var(--cyan)" : undefined,
                        color: selectedGrade === grade ? "var(--cyan)" : undefined,
                      }}
                      onClick={() => setSelectedGrade(grade)}
                    >
                      {t(`onboarding.grade.${grade}` as I18nKey)}
                    </button>
                  ))}
                </div>
                {currentGrade && selectedGrade === currentGrade && (
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 6 }}>
                    {t("diagnostic.gradeCurrentHint")}
                  </div>
                )}
              </div>
            )}
            {loadingStatus && (
              <div style={{ fontSize: 12.5, color: "var(--text-dim)" }}>{t("diagnostic.loadingStatus")}</div>
            )}
          </Panel>
          <Panel style={{ textAlign: "center", padding: 40 }}>
            <p style={{ color: "var(--text-dim)", marginBottom: 20 }}>{t("diagnostic.intro")}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
              {/* Lối quay lại khảo sát — luôn có, vì bước kiểm tra năng lực là
                  MỘT PHẦN của onboarding, không phải ngõ cụt. */}
              {fromOnboarding && (
                <button className="btn-secondary" onClick={() => router.push("/onboarding")}>
                  {t("onboarding.back")}
                </button>
              )}
              <button
                className={starting ? "btn-primary btn-with-spinner" : "btn-primary"}
                onClick={start}
                disabled={starting || !effectiveSubject.trim()}
                aria-busy={starting}
              >
                {starting ? (
                  <>
                    {/* spinner-dot dùng chung với DocumentCard — không
                        thêm animation mới, và kích thước nhỏ nên nút không
                        nhảy dòng khi đổi sang trạng thái loading. */}
                    <span className="spinner-dot" aria-hidden="true" />
                    <span>{t("diagnostic.preparing")}</span>
                  </>
                ) : (
                  t("diagnostic.start")
                )}
              </button>
            </div>
            {/* Chỉ hiện khi đang chờ: giải thích vì sao phải đợi (AI đang
                soạn câu hỏi) để user không tưởng nút bị treo. */}
            {starting && (
              <p style={{ color: "var(--text-dim)", fontSize: 12.5, marginTop: 12 }}>
                {t("diagnostic.preparingHint")}
              </p>
            )}
          </Panel>
        </>
      )}

      {phase === "loading" && <StateMessage kind="loading" text={t("diagnostic.loading")} />}
      {phase === "error" && error && (
        <div style={{ textAlign: "center" }}>
          <StateMessage kind="error" text={error} />
          {/* Luôn có lối ra khỏi trạng thái lỗi: bấm lại đúng bước đã
              hỏng, hoặc quay về màn chọn môn. Không để user kẹt ở đây
              với một dòng chữ đỏ. */}
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={retry} disabled={starting}>
              {starting ? t("diagnostic.preparing") : t("common.retry")}
            </button>
            {failedStep === "start" && (
              <button
                className="btn-secondary"
                onClick={() => {
                  setError(null);
                  setFailedStep(null);
                  setPhase("subject_select");
                }}
              >
                {t("diagnostic.chooseOther")}
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "in_progress" && question && (
        <>
          <ProgressDots done={answeredCount} total={15} />
          <Panel style={{ padding: "26px 26px" }}>
            <span
              style={{
                fontSize: 11.5,
                padding: "3px 9px",
                borderRadius: "var(--radius-pill)",
                display: "inline-block",
                marginBottom: 14,
                background:
                  question.difficulty === "easy"
                    ? "var(--cyan-soft)"
                    : question.difficulty === "medium"
                    ? "var(--indigo-soft)"
                    : "var(--amber-soft)",
                color:
                  question.difficulty === "easy"
                    ? "var(--cyan)"
                    : question.difficulty === "medium"
                    ? "var(--indigo)"
                    : "var(--amber)",
              }}
            >
              {question.difficulty === "easy" ? t("diagnostic.easy") : question.difficulty === "medium" ? t("diagnostic.medium") : t("diagnostic.hard")}
            </span>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, lineHeight: 1.6 }}>
              <SafeMath text={question.text} />
            </div>

            {question.options.map((opt, i) => {
              const isSelected = selected === i;
              let border = "var(--border)";
              let bg = "var(--panel-strong)";
              if (selected !== null) {
                if (isSelected && answerWasCorrect) {
                  border = "var(--cyan)";
                  bg = "var(--cyan-soft)";
                } else if (isSelected) {
                  border = "var(--rose)";
                  bg = "rgba(239,106,125,0.14)";
                }
              }
              return (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  disabled={selected !== null}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "13px 16px",
                    marginBottom: 9,
                    background: bg,
                    border: `1px solid ${border}`,
                    borderRadius: 11,
                    color: "var(--text)",
                    fontSize: 14,
                    cursor: selected !== null ? "default" : "pointer",
                  }}
                >
                  <SafeMath text={opt} />
                </button>
              );
            })}
          </Panel>
        </>
      )}

      {phase === "finished" && (
        <div>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, marginBottom: 6 }}>{t("diagnostic.doneTitle")}</h2>
            <p style={{ color: "var(--text-dim)", fontSize: 14 }}>{t("diagnostic.doneSubtitle")}</p>
          </div>
          {completion && (
            <Panel style={{ marginBottom: 16, textAlign: "center" }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{t("diagnostic.completed")}</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", fontSize: 13.5 }}>
                {completion.recorded && (
                  <span style={{ color: "var(--cyan)", fontWeight: 700 }}>
                    {t("diagnostic.xpLine", { n: completion.xpEarned })}
                  </span>
                )}
                <span style={{ color: "var(--text-dim)" }}>
                  {t("diagnostic.streakLine", { n: completion.streak.current })}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginTop: 6 }}>
                {completion.recorded ? t("diagnostic.activityRecorded") : t("diagnostic.activityRepeat")}
              </div>
            </Panel>
          )}
          <Panel style={{ padding: 30 }}>
            {profile.length === 0 ? (
              <p style={{ color: "var(--text-dim)" }}>{t("diagnostic.noProfile")}</p>
            ) : (
              <div>
                <div style={{ fontSize: 12.5, color: "var(--text-dim)", marginBottom: 10 }}>
                  {t("diagnostic.subjectTested", { subject: selectedSubject })}
                </div>
                {profile.map((s) => (
                  <SkillBar key={`${s.subject}-${s.topic}`} name={`${s.subject} · ${s.topic}`} percent={s.masteryPercent} isWeak={s.isWeak} />
                ))}
              </div>
            )}
            {/*
              CTA cuối tùy nơi đến:
              - Từ onboarding: quay về màn HỒ SƠ để xem "Năng lực hiện tại"
                vừa được cập nhật + lộ trình gợi ý. Đi đúng luồng
                Profile -> Roadmap -> Dashboard.
              - Vào trực tiếp từ menu: xem lộ trình như cũ.
            */}
            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "center",
                flexWrap: "wrap",
                marginTop: 20,
              }}
            >
              <button
                className={fromOnboarding ? "btn-secondary" : "btn-primary"}
                onClick={() => router.push(fromOnboarding ? "/onboarding" : "/roadmap")}
              >
                {fromOnboarding ? t("onboarding.ready.title") : t("diagnostic.viewRoadmap")}
              </button>
              {fromOnboarding && (
                <button className="btn-primary" onClick={() => router.push("/roadmap")}>
                  {t("diagnostic.viewRoadmap")}
                </button>
              )}
            </div>
          </Panel>
        </div>
      )}
    </section>
  );
}

function ProgressDots({ done, total }: { done: number; total: number }) {
  return (
    <div style={{ display: "flex", gap: 5, marginBottom: 22 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 5,
            flex: 1,
            borderRadius: "var(--radius-pill)",
            background: i < done ? "var(--cyan)" : i === done ? "var(--indigo)" : "var(--track-bg)",
          }}
        />
      ))}
    </div>
  );
}
