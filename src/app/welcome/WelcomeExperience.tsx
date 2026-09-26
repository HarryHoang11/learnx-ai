"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  FileText,
  Sparkles,
  Network,
  Activity,
  Compass,
  Bot,
  Target,
  Repeat,
  Award,
  ArrowRight,
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Brain,
  Clock,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { sendOnboardingAction } from "@/lib/onboarding/client";
import AppDownloadBlock from "@/components/mobile/AppDownloadBlock";
import LearnXLogo from "@/components/brand/LearnXLogo";
import type { ApiResponse, GoalWithRoadmap, SkillMasteryPoint } from "@/types";
import "./welcome.css";

const TOTAL_PHASES = 6;

// Thời lượng hiển thị tự động cho từng giai đoạn (mili-giây)
const PHASE_DURATIONS: Record<number, number> = {
  1: 2800, // Phase 1: Welcome & Name
  2: 2800, // Phase 2: Brand & Purpose
  3: 4000, // Phase 3: Core Learning Loop
  4: 3600, // Phase 4: Personalization & Skills
  5: 3200, // Phase 5: Inspiring Quote
  6: 0,    // Phase 6: Final CTA (dừng lại đợi user bấm)
};

export default function WelcomeExperience() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReplay = searchParams ? searchParams.get("replay") === "true" : false;
  const { data: session, update } = useSession();
  const { t, lang, setLang } = useLanguage();

  const [phase, setPhase] = useState(1);
  const [isPlaying, setIsPlaying] = useState(true);
  const [activeLoopNode, setActiveLoopNode] = useState(0);

  // Dữ liệu người dùng thật
  const [userName, setUserName] = useState<string>("");
  const [skills, setSkills] = useState<SkillMasteryPoint[]>([]);
  const [activeGoalTitle, setActiveGoalTitle] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Tải dữ liệu người dùng thật (profile, progress, roadmaps)
  useEffect(() => {
    // Ưu tiên session name nếu đã có
    if (session?.user?.name) {
      setUserName(session.user.name);
    }

    // Tải profile chi tiết
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: ApiResponse<{ name: string | null; nickname: string | null }> | null) => {
        if (json?.success && json.data) {
          const display = json.data.nickname || json.data.name || session?.user?.name || "";
          if (display) setUserName(display);
        }
      })
      .catch(() => {});

    // Tải năng lực thật từ /api/progress
    fetch("/api/progress")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: ApiResponse<{ skillMap: SkillMasteryPoint[] }> | null) => {
        if (json?.success && json.data?.skillMap) {
          setSkills(json.data.skillMap);
        }
      })
      .catch(() => {});

    // Tải lộ trình/mục tiêu đang học từ /api/roadmaps
    fetch("/api/roadmaps")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: ApiResponse<GoalWithRoadmap[]> | null) => {
        if (json?.success && Array.isArray(json.data)) {
          const active = json.data.find((g) => g.status === "ACTIVE");
          if (active) {
            setActiveGoalTitle(active.title);
          }
        }
      })
      .catch(() => {});
  }, [session]);

  // 2. Kết thúc trải nghiệm.
  //
  // LUỒNG MỚI: Welcome -> /onboarding (khảo sát) -> kiểm tra năng lực ->
  // hồ sơ + lộ trình -> Dashboard. Xem docs/WELCOME.md.
  //
  // GHI TRẠNG THÁI TRƯỚC, KHÔNG ĐỂ HỎI GÌ THÊM: `finish` luôn đánh dấu "đã
  // xem Welcome" trước khi điều hướng, nên kể cả API lỗi người dùng vẫn
  // không bị kéo về /welcome lần nữa. Chốt 1 lần gọi cho `finish` — nguyên
  // nhân gốc PATCH /api/onboarding bị gọi nhiều lần cho 1 thao tác.
  const finishingRef = useRef(false);
  // Trạng thái hiển thị: giữ nút ở trạng thái "đang xử lý" trong lúc chờ
  // PATCH + làm mới JWT. `finish` giờ có await nên bấm nút cần vài trăm ms
  // mới điều hướng — không có biến này người dùng tưởng nút chết.
  const [finishing, setFinishing] = useState(false);

  const finish = useCallback(
    async (destination: string) => {
      // CHỐT GỌN 1 LẦN.
      //
      // `finish` có 6 nơi gọi (nút Skip, 2 CTA, phím Escape, phím Enter, nút
      // mũi tên) và nó KHÔNG await request. Bấm đúp, hoặc Enter rồi bấm chuột,
      // hoặc giữ phím khiến `keydown` lặp — mỗi lần đều tạo một PATCH riêng,
      // vì `router.push` cuối hàm chưa kịp tháo component.
      //
      // Dùng ref chứ không dùng state: cần chặn ngay ở lần gọi thứ hai, mà
      // setState chỉ có hiệu lực sau lần render kế tiếp — vẫn đủ để lọt vài
      // request thừa. Ref chặn tức thì ngay trong cùng 1 tick.
      if (finishingRef.current) return;
      finishingRef.current = true;
      setFinishing(true);

      // Ghi trạng thái onboarding rồi LÀM MỚI JWT — phải AWAIT trước khi
      // điều hướng. Đây là nguyên nhân gốc khiến CTA "bấm không phản ứng".
      //
      // Mạch lỗi: proxy.ts quyết định có ép về /welcome dựa trên
      // `onboardingStatus` nằm trong JWT (cố tình không query DB mỗi request).
      // `update()` cũ được gọi bằng `void` nên chưa kịp ghi cookie mới, còn
      // `router.push()` chạy ngay -> request /dashboard vẫn mang JWT cũ
      // status=NEW -> proxy redirect ngược về /welcome. Người dùng bấm nút,
      // thấy màn hình đứng yên.
      //
      // Thứ tự bắt buộc: PATCH -> await update() -> router.push().
      const state = await sendOnboardingAction("complete_welcome");
      if (state && session?.user) {
        try {
          // PHẢI bọc trong `{ user: ... }`.
          //
          // Lỗi này là nguyên nhân gốc khiến CTA không hoạt động: call site
          // trong app/profile/page.tsx (đổi avatar) truyền
          // `updateSession({ user: { image } })`, và callback `jwt` trong
          // auth.ts đọc `session?.user?.onboardingStatus` / `session?.user?.image`
          // — tức là ĐỌC Ở TẦNG `user`.
          //
          // Ở đây trước đây là `update({ ...session.user, onboardingStatus })`
          // — dữ liệu nằm ở TẦNG NHIỀU, nên `session.user` là undefined,
          // nhánh merge trong jwt KHÔNG chạy, token vẫn giữ status=NEW, và
          // proxy lại đẩy người dùng về /welcome. Dạng `{ user: {...} }`
          // mới khớp với callback và với convention sẵn có trong project.
          await update({ user: { ...session.user, onboardingStatus: state.status } });
        } catch (err) {
          // Không nuốt lỗi — ghi lại để còn dấu vết. Vẫn điều hướng: kẹt ở
          // /welcome còn tệ hơn là mất trạng thái onboarding.
          console.error("[welcome] Không làm mới được session sau onboarding:", err);
        }
      }
      router.push(destination);
    },
    [router, session, update]
  );

  // 3. Tiến trình tự động qua các phase
  useEffect(() => {
    if (!isPlaying) return;

    const duration = PHASE_DURATIONS[phase] || 0;
    if (duration <= 0) return; // Dừng lại ở phase cuối

    timerRef.current = setTimeout(() => {
      setPhase((prev) => {
        if (prev < TOTAL_PHASES) return prev + 1;
        setIsPlaying(false);
        return prev;
      });
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, isPlaying]);

  // 4. Chu kỳ sáng node của Learning Loop (Phase 3)
  useEffect(() => {
    if (phase !== 3) return;
    const interval = setInterval(() => {
      setActiveLoopNode((prev) => (prev + 1) % 9);
    }, 450);
    return () => clearInterval(interval);
  }, [phase]);

  // 5. Điều hướng bằng bàn phím (Space, ArrowLeft, ArrowRight, Escape, Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        e.preventDefault();
        // ESC = bỏ qua phần giới thiệu -> vào thẳng khảo sát. Đây là lối
        // THOÁT: khảo sát bỏ qua được ở mọi bước, nên ESC không nghẽn ai.
        void finish("/onboarding");
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        setIsPlaying((v) => !v);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPhase((prev) => Math.min(TOTAL_PHASES, prev + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPhase((prev) => Math.max(1, prev - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (phase === TOTAL_PHASES) {
          // Enter ở phase cuối kích hoạt hành động CHÍNH — nhất quán với
          // nút được focus.
          void finish("/onboarding");
        } else {
          setPhase((prev) => Math.min(TOTAL_PHASES, prev + 1));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [phase, finish]);

  // 6. Hiệu ứng hạt vi mô phát sáng nền (Canvas nhẹ 60fps)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const numParticles = 26;
    const particles = Array.from({ length: numParticles }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.5 + 0.5,
      speedX: (Math.random() - 0.5) * 0.35,
      speedY: (Math.random() - 0.5) * 0.35,
      color: Math.random() > 0.4 ? "rgba(119, 117, 255," : "rgba(69, 217, 233,",
      alpha: Math.random() * 0.5 + 0.2,
      phase: Math.random() * Math.PI * 2,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.phase += 0.02;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const currentAlpha = p.alpha + Math.sin(p.phase) * 0.15;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${Math.max(0.05, currentAlpha)})`;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Danh sách các node trong Core Learning Loop
  const loopNodes = [
    {
      id: "doc",
      title: t("welcome.loop.document"),
      desc: t("welcome.loop.documentDesc"),
      icon: FileText,
      index: "01",
    },
    {
      id: "summary",
      title: t("welcome.loop.summary"),
      desc: t("welcome.loop.summaryDesc"),
      icon: Sparkles,
      index: "02",
    },
    {
      id: "mindmap",
      title: t("welcome.loop.mindmap"),
      desc: t("welcome.loop.mindmapDesc"),
      icon: Network,
      index: "03",
    },
    {
      id: "diagnostic",
      title: t("welcome.loop.diagnostic"),
      desc: t("welcome.loop.diagnosticDesc"),
      icon: Activity,
      index: "04",
    },
    {
      id: "roadmap",
      title: t("welcome.loop.roadmap"),
      desc: t("welcome.loop.roadmapDesc"),
      icon: Compass,
      index: "05",
    },
    {
      id: "tutor",
      title: t("welcome.loop.tutor"),
      desc: t("welcome.loop.tutorDesc"),
      icon: Bot,
      index: "06",
    },
    {
      id: "practice",
      title: t("welcome.loop.practice"),
      desc: t("welcome.loop.practiceDesc"),
      icon: Target,
      index: "07",
    },
    {
      id: "review",
      title: t("welcome.loop.review"),
      desc: t("welcome.loop.reviewDesc"),
      icon: Repeat,
      index: "08",
    },
    {
      id: "mastery",
      title: t("welcome.loop.mastery"),
      desc: t("welcome.loop.masteryDesc"),
      icon: Award,
      index: "09",
    },
  ];

  const displayName = userName || session?.user?.name || "Huy Hoàng";

  return (
    <div className="welcome-screen">
      {/* Các lớp khí quyển background */}
      <div className="welcome-grid" />
      <div className="welcome-glow-cyan" />
      <div className="welcome-glow-indigo" />
      <div className="welcome-light-beam" />
      <canvas ref={canvasRef} className="welcome-particles-canvas" />

      {/* Thanh Header phía trên */}
      <header className="welcome-topbar">
        <div className="welcome-brand">
          <div className="welcome-brand-badge">
            <Sparkles size={16} />
          </div>
          <span>LearnX AI</span>
        </div>

        <div className="welcome-top-actions">
          <button
            type="button"
            className="welcome-lang-btn"
            onClick={() => setLang(lang === "vi" ? "en" : "vi")}
            aria-label="Toggle language"
            title="Đổi ngôn ngữ / Switch language"
          >
            {lang === "vi" ? "EN" : "VI"}
          </button>

          <button
            type="button"
            className="welcome-skip-btn"
            onClick={() => void finish("/dashboard")}
            aria-label={t("welcome.skip")}
          >
            <span>{t("welcome.skip")}</span>
          </button>
        </div>
      </header>

      {/* Sân khấu nội dung chính giữa */}
      <main className="welcome-stage">
        {/* ================================================================
            PHASE 1: CHÀO ĐÓN VÀ TÊN NGƯỜI DÙNG
            ================================================================ */}
        {phase === 1 && (
          <div className="welcome-phase-wrapper" key="phase-1">
            <div className="welcome-eyebrow">
              <span className="welcome-pulse-dot" />
              <span>{isReplay ? t("welcome.replay") : "LEARNX AI SPACE"}</span>
            </div>

            <div className="welcome-phase1-title">{t("welcome.back")}</div>

            <h1 className="welcome-user-name">{displayName}</h1>

            <p className="welcome-phase1-sub">{t("welcome.journeyStarts")}</p>
          </div>
        )}

        {/* ================================================================
            PHASE 2: BIỂU TƯỢNG VÀ SỨ MỆNH LEARNX AI
            ================================================================ */}
        {phase === 2 && (
          <div className="welcome-phase-wrapper" key="phase-2">
            <div className="welcome-logo-halo-container">
              <div className="welcome-logo-halo" />
              <div className="welcome-logo-ring" />
              {/* Logo chính thức — cùng asset với sidebar/auth/favicon. Hiệu ứng
                  halo + ring của wrapper giữ nguyên nên vẫn "thở" nhẹ. */}
              <div className="welcome-logo-core">
                <LearnXLogo variant="icon" size="lg" />
              </div>
            </div>

            <h2 className="welcome-headline">{t("welcome.headline")}</h2>

            <p className="welcome-subtitle">{t("welcome.subtitle")}</p>
          </div>
        )}

        {/* ================================================================
            PHASE 3: CORE LEARNING LOOP (CHU TRÌNH HỆ THỐNG)
            ================================================================ */}
        {phase === 3 && (
          <div className="welcome-phase-wrapper" key="phase-3">
            <div className="welcome-loop-container">
              <div className="welcome-loop-header">
                <div className="welcome-eyebrow">
                  <span className="welcome-pulse-dot" />
                  <span>{t("welcome.loop.badge")}</span>
                </div>
                <h3 className="welcome-headline" style={{ fontSize: "clamp(24px, 3.8vw, 36px)", marginBottom: 8 }}>
                  {t("welcome.loop.title")}
                </h3>
                <p className="welcome-subtitle" style={{ fontSize: 14 }}>
                  {t("welcome.loop.subtitle")}
                </p>
              </div>

              <div className="welcome-loop-grid">
                {loopNodes.map((node, idx) => {
                  const Icon = node.icon;
                  const isActive = activeLoopNode === idx;
                  return (
                    <div
                      key={node.id}
                      className={`welcome-loop-card ${isActive ? "active" : ""}`}
                      onMouseEnter={() => setActiveLoopNode(idx)}
                    >
                      <div className="welcome-loop-card-top">
                        <div className="welcome-loop-icon-box">
                          <Icon size={18} />
                        </div>
                        <span className="welcome-loop-index">{node.index}</span>
                      </div>
                      <div className="welcome-loop-card-title">{node.title}</div>
                      <div className="welcome-loop-card-desc">{node.desc}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            PHASE 4: TÍNH CÁ NHÂN HÓA THÍCH ỨNG & PROFILE THẬT
            ================================================================ */}
        {phase === 4 && (
          <div className="welcome-phase-wrapper" key="phase-4">
            <div className="welcome-personalization-container">
              <div className="welcome-eyebrow">
                <span className="welcome-pulse-dot" />
                <span>{t("welcome.personalization.eyebrow")}</span>
              </div>

              <h3 className="welcome-headline" style={{ fontSize: "clamp(24px, 3.8vw, 36px)", marginBottom: 8 }}>
                {t("welcome.personalization.title")}
              </h3>
              <p
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#45d9e9",
                  marginBottom: 26,
                }}
              >
                {t("welcome.personalization.subtitle")}
              </p>

              {/* 4 Trụ cột cá nhân hóa */}
              <div className="welcome-pillars-grid">
                <div className="welcome-pillar-chip">
                  <span className="welcome-pillar-icon">
                    <Target size={20} color="#45d9e9" />
                  </span>
                  <span>{t("welcome.personalization.goals")}</span>
                </div>
                <div className="welcome-pillar-chip">
                  <span className="welcome-pillar-icon">
                    <Brain size={20} color="#7775ff" />
                  </span>
                  <span>{t("welcome.personalization.knowledge")}</span>
                </div>
                <div className="welcome-pillar-chip">
                  <span className="welcome-pillar-icon">
                    <Clock size={20} color="#f5c76a" />
                  </span>
                  <span>{t("welcome.personalization.pace")}</span>
                </div>
                <div className="welcome-pillar-chip">
                  <span className="welcome-pillar-icon">
                    <TrendingUp size={20} color="#65d6a3" />
                  </span>
                  <span>{t("welcome.personalization.progress")}</span>
                </div>
              </div>

              {/* Thẻ biểu diễn hồ sơ năng lực thật hoặc Empty state trang nhã */}
              <div className="welcome-profile-card">
                <div className="welcome-profile-header">
                  <span className="welcome-profile-title">{t("welcome.personalization.profileTitle")}</span>
                  <span className="welcome-profile-status">
                    <CheckCircle2 size={13} />
                    <span>Live Adaptive Engine</span>
                  </span>
                </div>

                {skills.length > 0 ? (
                  <div>
                    {skills.slice(0, 3).map((item) => (
                      <div key={`${item.subject}-${item.topic}`} className="welcome-skill-row">
                        <div className="welcome-skill-labels">
                          <span style={{ color: "#f5f7ff" }}>{item.topic || item.subject}</span>
                          <span style={{ color: "#94a0b8", fontFamily: "var(--font-code)" }}>
                            {item.masteryPercent}%
                          </span>
                        </div>
                        <div className="welcome-skill-track">
                          <div className="welcome-skill-fill" style={{ width: `${item.masteryPercent}%` }} />
                        </div>
                      </div>
                    ))}

                    <div className="welcome-focus-badge">
                      <Compass size={15} style={{ color: "#45d9e9" }} />
                      <span>
                        <strong>{t("welcome.personalization.currentFocus")}:</strong>{" "}
                        {activeGoalTitle || "Lộ trình trọng tâm"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="welcome-empty-state">
                    <div className="welcome-empty-icon">
                      <Compass size={24} />
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#f5f7ff", marginBottom: 6 }}>
                      {t("welcome.personalization.empty")}
                    </div>
                    <p style={{ fontSize: 13, color: "#94a0b8", maxWidth: 440, lineHeight: 1.5 }}>
                      {t("welcome.personalization.emptyAction")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            PHASE 5: CÂU TRUYỀN CẢM HỨNG (EDITORIAL TYPOGRAPHY)
            ================================================================ */}
        {phase === 5 && (
          <div className="welcome-phase-wrapper" key="phase-5">
            <div className="welcome-quote-container">
              <div className="welcome-quote-mark" aria-hidden="true">
                “
              </div>

              <blockquote className="welcome-quote-main">{t("welcome.quote.text")}</blockquote>

              <div className="welcome-quote-secondary">
                <span>{t("welcome.quote.sub")}</span>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            PHASE 6: CTA CUỐI CÙNG — ƯU TIÊN CÁ NHÂN HOÁ
            ================================================================
            Luồng mới: Welcome xong -> /onboarding (khảo sát 5 phase) -> kiểm
            tra năng lực -> hồ sơ + lộ trình -> Dashboard.

            Vì sao KHÔNG còn nút "Khám phá LearnX AI -> /dashboard" ở đây:
            người dùng mới chưa có hồ sơ thì mọi tính năng cá nhân hoá (AI
            gia sư, đề xuất bài, roadmap) đều rơi về mức trung bình chung —
            họ sẽ không bao giờ biết sản phẩm tốt ở đâu. Đây là lý do sản
            phẩm đổi triết lý: "Personalize, rồi hãy dive in".

            NHƯNG không phải nghẽn cứng: bước cuối vẫn có lối ở lại web, và
            proxy chỉ nhắc (không chặn) Dashboard — xem docs/WELCOME.md §1. */}
        {phase === 6 && (
          <div className="welcome-phase-wrapper" key="phase-6">
            <div className="welcome-cta-container">
              <div className="welcome-eyebrow">
                <span className="welcome-pulse-dot" />
                <span>EXPERIENCE READY</span>
              </div>

              <h2 className="welcome-cta-title">{t("welcome.cta.ready")}</h2>

              <p className="welcome-cta-desc">{t("welcome.cta.subtitle")}</p>

              <div className="welcome-cta-actions">
                <button
                  type="button"
                  className="welcome-cta-primary"
                  onClick={() => void finish("/onboarding")}
                  disabled={finishing}
                  aria-busy={finishing}
                  autoFocus
                >
                  <span>{t("welcome.cta.onboarding")}</span>
                  <ArrowRight size={18} />
                </button>
              </div>

              {/* Gợi ý nhỏ: nói thẳng khảo sát mất bao lâu và có bỏ qua được
                  không. Người dùng sợ bị "bắc" thì sẽ thoát ngay — nói trước
                  là cách duy nhất khiến họ ở lại đủ lâu để trả lời. */}
              <p className="welcome-cta-hint">{t("welcome.cta.hint")}</p>

              {/* Khối tải app Android — đặt DƯỚI CTA chính. Luôn kèm
                  "Tiếp tục trên web" để không ai bị ép rời web. */}
              <AppDownloadBlock onContinueWeb={() => void finish("/onboarding")} />
            </div>
          </div>
        )}
      </main>

      {/* Thanh điều khiển dock phía dưới */}
      <footer className="welcome-bottom-dock">
        <div className="welcome-dock-panel">
          {/* Nút lùi */}
          <button
            type="button"
            className="welcome-dock-btn"
            onClick={() => setPhase((p) => Math.max(1, p - 1))}
            disabled={phase === 1}
            aria-label={t("welcome.nav.prev")}
            title={t("welcome.nav.prev")}
            style={{ opacity: phase === 1 ? 0.4 : 1 }}
          >
            <ArrowLeft size={16} />
          </button>

          {/* Nút Play / Pause */}
          <button
            type="button"
            className="welcome-dock-btn"
            onClick={() => setIsPlaying((v) => !v)}
            aria-label={isPlaying ? t("welcome.nav.pause") : t("welcome.nav.play")}
            title={isPlaying ? t("welcome.nav.pause") : t("welcome.nav.play")}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>

          {/* Dãy dot hiển thị các Phase */}
          <div className="welcome-phase-dots" role="tablist" aria-label="Welcome timeline">
            {Array.from({ length: TOTAL_PHASES }, (_, i) => i + 1).map((step) => (
              <button
                key={step}
                type="button"
                className={`welcome-phase-dot ${phase === step ? "active" : ""}`}
                onClick={() => {
                  setPhase(step);
                  setIsPlaying(step < TOTAL_PHASES);
                }}
                role="tab"
                aria-selected={phase === step}
                aria-label={t("welcome.nav.phase", { current: step, total: TOTAL_PHASES })}
              />
            ))}
          </div>

          {/* Bộ đếm giai đoạn */}
          <span className="welcome-phase-counter">
            {phase} / {TOTAL_PHASES}
          </span>

          {/* Nút tới */}
          <button
            type="button"
            className="welcome-dock-btn"
            onClick={() => {
              if (phase === TOTAL_PHASES) {
                void finish("/dashboard");
              } else {
                setPhase((p) => Math.min(TOTAL_PHASES, p + 1));
              }
            }}
            aria-label={t("welcome.nav.next")}
            title={t("welcome.nav.next")}
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </footer>
    </div>
  );
}
