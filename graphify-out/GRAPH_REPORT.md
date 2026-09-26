# Graph Report - learnx-ai  (2026-09-27)

## Corpus Check
- 456 files · ~291,113 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 36 file(s) not represented in the graph (top: .xml 10, .css 8, (none) 4)

## Summary
- 2463 nodes · 6028 edges · 162 communities (113 shown, 49 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 106 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9588e08d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- router.ts
- session.ts
- getCurrentUserId
- engine.ts
- ProfileReady.tsx
- useLanguage
- MobileBottomNav.tsx
- generate-android-icons.mjs
- Panel.tsx
- options.ts
- LearningOnboarding.tsx
- react
- MarkdownLite.tsx
- LearnX AI
- learning-analytics.service.ts
- export.ts
- dashboard/page.tsx
- package.json
- diagnostic.service.ts
- LanguageProvider.tsx
- capacitor.ts
- index.ts
- calendar.service.ts
- roadmap.service.ts
- resource.service.ts
- useToast
- dependencies
- learning-activity.service.ts
- auth.ts
- insights.ts
- friendship.service.ts
- What You Must Do When Invoked
- extractText.ts
- calendar/page.tsx
- mindmap/page.tsx
- MindMapPageInner
- state.ts
- summary/download/route.ts
- MindMapExportModal.tsx
- personalization.service.ts
- spaced-repetition.service.ts
- community/page.tsx
- assessment.service.ts
- workspace/page.tsx
- quiz.service.ts
- documents/DocumentCard.tsx
- prompts.ts
- upload/route.ts
- ApiResponse
- onboarding/route.ts
- compilerOptions
- Supabase
- Module map
- app/layout.tsx
- next
- getLearningAnalytics
- Changelog
- scripts
- vector.ts
- skill-math.ts
- Changelog
- Writing Guidelines for Postgres References
- socratic-tutor.service.ts
- next-action/route.ts
- learning-session.service.ts
- [id]/resources/route.ts
- CommunityPageInner
- useBackButtonToClose
- Nhóm model
- profile/page.tsx
- contribution.service.ts
- devDependencies
- mistakes/route.ts
- friends/page.tsx
- analytics.test.ts
- MOBILE
- resources/page.tsx
- layout.test.ts
- score.ts
- learning-agent.service.ts
- ExampleInstrumentedTest.java
- verify-setup-layout.mjs
- leaderboard.service.ts
- onboarding/__tests__/route.test.ts
- practice/page.tsx
- achievement.service.ts
- duplicate-detection.service.ts
- Section Definitions
- WorkspacePage
- document.service.ts
- graphify reference: extra exports and benchmark
- AppDownloadBubble.tsx
- 2026-09-26 — Onboarding + Brand + Analytics + Multi-subject
- DATA FLOW
- ONBOARDING
- CommunityUploadPage
- outcomes.ts
- WELCOME.md
- next.config.js
- seed/subjects.ts
- calendar/[id]/route.ts
- LibraryPage
- graphify reference: query, path, explain
- Supabase Postgres Best Practices
- AI SYSTEM
- RoadmapPage
- dbUpload.ts
- next-auth.d.ts
- LearnX AI — Architecture Memory
- gradlew
- graphify reference: add a URL and watch a folder
- graphify reference: commit hook and native CLAUDE.md integration
- graphify reference: incremental update and cluster-only
- next-env.d.ts
- context/route.ts
- MainActivity.java
- CLAUDE.md
- graphify reference: GitHub clone and cross-repo merge
- graphify reference: transcribe video and audio
- .eslintrc.json
- verify-analytics-sql.mjs
- .claude/CLAUDE.md
- extraction-spec.md
- advanced-full-text-search.md
- advanced-jsonb-indexing.md
- conn-idle-timeout.md
- conn-limits.md
- conn-pooling.md
- conn-prepared-statements.md
- data-batch-inserts.md
- data-n-plus-one.md
- data-pagination.md
- data-upsert.md
- lock-advisory.md
- lock-deadlock-prevention.md
- lock-short-transactions.md
- lock-skip-locked.md
- monitor-explain-analyze.md
- monitor-pg-stat-statements.md
- monitor-vacuum-analyze.md
- query-composite-indexes.md
- query-covering-indexes.md
- query-index-types.md
- query-missing-indexes.md
- query-partial-indexes.md
- schema-constraints.md
- schema-data-types.md
- schema-foreign-key-indexes.md
- schema-lowercase-identifiers.md
- schema-partitioning.md
- schema-primary-keys.md
- security-privileges.md
- security-rls-basics.md
- security-rls-performance.md
- _template.md

## God Nodes (most connected - your core abstractions)
1. `getCurrentUserId()` - 216 edges
2. `unauthorizedResponse()` - 215 edges
3. `useLanguage()` - 144 edges
4. `next` - 136 edges
5. `ApiResponse` - 133 edges
6. `react` - 75 edges
7. `prisma` - 60 edges
8. `getLearningAnalytics()` - 53 edges
9. `MindMapPageInner()` - 36 edges
10. `vitest` - 30 edges

## Surprising Connections (you probably didn't know these)
- `[Cleanup] Xoá 15 file dead code + 4 thư mục rỗng` --references--> `MarkdownLite()`  [INFERRED]
  docs/architecture/CHANGELOG.md → src/components/documents/MarkdownLite.tsx
- `Technology Stack` --references--> `MarkdownLite()`  [INFERRED]
  README.md → src/components/documents/MarkdownLite.tsx
- `📚 Document Learning` --references--> `SummaryDrawer()`  [INFERRED]
  README.md → src/components/documents/SummaryDrawer.tsx
- `Không horizontal overflow` --references--> `SubjectSwitcher()`  [INFERRED]
  docs/architecture/MOBILE.md → src/components/subject/SubjectSwitcher.tsx
- `Test` --references--> `AIOverloadedError`  [INFERRED]
  docs/architecture/AI_SYSTEM.md → src/lib/ai/types.ts

## Import Cycles
- None detected.

## Communities (162 total, 49 thin omitted)

### Community 0 - "router.ts"
Cohesion: 0.07
Nodes (46): Files, vitest, deepseekProvider, classifyError(), geminiProvider, groqProvider, DEFAULT_GROQ_CHAT_MODEL, GROQ_MODELS (+38 more)

### Community 1 - "session.ts"
Cohesion: 0.06
Nodes (37): RFC-5987, @prisma/client, DATABASE_INFRA_ERROR_CODES, runtime, GET(), POST(), GET(), DocumentDetail (+29 more)

### Community 2 - "getCurrentUserId"
Cohesion: 0.09
Nodes (34): POST(), GET(), POST(), GET(), PATCH(), runtime, GET(), GET() (+26 more)

### Community 3 - "engine.ts"
Cohesion: 0.09
Nodes (40): [Subjects] Tạo Subject Engine — nền tảng đa môn, Chính sách mở rộng: `withSubject()`, Cấu trúc registry, Design system: KHÔNG tô màu theo môn, Files, Luồng sử dụng, SUBJECTS, Test (+32 more)

### Community 4 - "ProfileReady.tsx"
Cohesion: 0.08
Nodes (33): lucide-react, src_app_onboarding_onboarding, ProfileReady(), leaveTo(), ProfileReadyProps, SetupPageInner(), save(), metadata (+25 more)

### Community 5 - "useLanguage"
Cohesion: 0.06
Nodes (35): LeaderboardPage(), DiagnosticPage(), ActionLinks(), ActivitySection(), AnalyticsBody(), AnalyticsData, MetricCard(), OutcomePanel() (+27 more)

### Community 6 - "MobileBottomNav.tsx"
Cohesion: 0.07
Nodes (33): AUTH, Env, Files, Flow, JWT mirror, Middleware: `src/proxy.ts`, Protected routes, Quy tắc vàng: KHÔNG tin `userId` từ client (+25 more)

### Community 7 - "generate-android-icons.mjs"
Cohesion: 0.05
Nodes (31): ref_node_fs, ref_node_path, ref_node_url, ref_node_zlib, localProps, problems, ROOT, tips (+23 more)

### Community 8 - "Panel.tsx"
Cohesion: 0.08
Nodes (25): ContributorProfilePage(), ALLOWED_TYPES, DIFFICULTY_OPTIONS, LANGUAGE_OPTIONS, REPORT_REASONS, VISIBILITY_OPTIONS, CompletionActivity, Phase (+17 more)

### Community 9 - "options.ts"
Cohesion: 0.08
Nodes (40): 2026-09-26 (trước đó) — Onboarding bug fix, [Onboarding] `cleanString` gộp 3 trạng thái vào `undefined`, Validate field — `readTextField` (QUAN TRỌNG), AI_PREFERENCE_VALUES, CAREER_FIELD_VALUES, CAREER_STATUS_VALUES, EDUCATION_STAGE_VALUES, FIELD_VALUES (+32 more)

### Community 10 - "LearningOnboarding.tsx"
Cohesion: 0.08
Nodes (34): 3. Khảo sát 5 phase — câu hỏi động theo nhóm, draftFromProfile(), draftToPayload(), EMPTY_DRAFT, LearningOnboarding(), goSkip(), toggle(), AI_PREFERENCES (+26 more)

### Community 11 - "react"
Cohesion: 0.08
Nodes (23): next-auth, react, inputStyle, LoginPage(), inputStyle, ChangePasswordPanelProps, AuthCard(), OAuthButtons() (+15 more)

### Community 12 - "MarkdownLite.tsx"
Cohesion: 0.08
Nodes (28): react-dom, AttachedResource, DisplayMessage, extractResourceQuery(), HINT_LABELS, TutorLoadingFallback(), TutorPageInner(), sendMessage() (+20 more)

### Community 13 - "LearnX AI"
Cohesion: 0.05
Nodes (36): 10. Khác biệt đã biết (chưa xử lý, có lý do), 1. `/api/auth/*` trả 500, app hiện "Server Problem" / `ClientFetchError`, 2. API 500 kèm `The table public.X does not exist` (bảng chưa được tạo), 3. API 500 khác kèm lỗi Prisma / "too many connections" / P1001, 4. `prisma generate` báo EPERM trên Windows, 5. AI trả 503 / "tất cả AI provider đều không khả dụng", 6. `operator does not exist: vector <-> vector` hoặc tìm kiếm tài liệu ra kết quả sai, 7. Upload tài liệu báo `[PDF_PARSE_FAILED]` / `[PDF_NO_TEXT_LAYER]` (+28 more)

### Community 14 - "learning-analytics.service.ts"
Cohesion: 0.09
Nodes (34): DayCountRow, DIFFICULTY_ORDER, DiffRow, MonthSkillRow, SkillAttemptRow, buildFocusAreas(), buildSkillActions(), buildWeeklyReport() (+26 more)

### Community 15 - "export.ts"
Cohesion: 0.11
Nodes (33): EXPORT_FORMATS, ExportFormatOption, renderDescriptionSVG(), renderLabelSVG(), renderMathSVG(), renderNodeSVG(), wrapDescription(), wrapNodeLabel() (+25 more)

### Community 16 - "dashboard/page.tsx"
Cohesion: 0.10
Nodes (26): ProgressResponse, HomePage(), ProgressData, ProgressResponse, reasonLabel(), ReviewDueResponse, StreakResponse, XPHistoryItem (+18 more)

### Community 17 - "package.json"
Cohesion: 0.06
Nodes (29): config, name, private, version, @capacitor/android, @capacitor/browser, @capacitor/cli, @capacitor/core (+21 more)

### Community 18 - "diagnostic.service.ts"
Cohesion: 0.13
Nodes (28): difficultyToNumber(), normalizeAnswer(), POST(), resultToJson(), POST(), pickNextDifficulty(), createDiagnosticSession(), DiagnosticAnswer (+20 more)

### Community 19 - "LanguageProvider.tsx"
Cohesion: 0.11
Nodes (25): i18n, i18n, CommunityDocumentCardProps, CommunityDocumentDetail(), CommunityDocumentDetailProps, TRUST_COLORS, TRUST_KEYS, REASON_VALUES (+17 more)

### Community 20 - "capacitor.ts"
Cohesion: 0.13
Nodes (21): @capacitor/app, @capacitor/network, @capacitor/splash-screen, @capacitor/status-bar, NativeLifecycle(), NetworkWatcher(), applyStatusBar(), BackHandler (+13 more)

### Community 21 - "index.ts"
Cohesion: 0.11
Nodes (23): POST(), POST(), POST(), GET(), POST(), GET(), POST(), VALID_VISIBILITIES (+15 more)

### Community 22 - "calendar.service.ts"
Cohesion: 0.16
Nodes (23): GET(), toLocalDateStr(), GET(), GET(), generateDailyChallenge(), getDailyChallenge(), getDaySessions(), getLearningDaysForMonth() (+15 more)

### Community 23 - "roadmap.service.ts"
Cohesion: 0.12
Nodes (24): GET(), POST(), GET(), DELETE(), GET(), PATCH(), VALID_STATUSES, GET() (+16 more)

### Community 24 - "resource.service.ts"
Cohesion: 0.11
Nodes (24): POST(), RouteParams, POST(), RouteParams, GET(), RouteParams, POST(), RouteParams (+16 more)

### Community 25 - "useToast"
Cohesion: 0.09
Nodes (25): DocumentDetailPage(), getCurrentUserId(), loadDocument(), DiagnosticPageInner(), answer(), loadResult(), AccountMenu(), ChangePasswordPanel() (+17 more)

### Community 26 - "dependencies"
Cohesion: 0.07
Nodes (29): dependencies, @auth/prisma-adapter, bcryptjs, @capacitor/app, @capacitor/browser, @capacitor/core, @capacitor/keyboard, @capacitor/network (+21 more)

### Community 27 - "learning-activity.service.ts"
Cohesion: 0.12
Nodes (26): ActivityType, BASE_XP, calculateLevel(), calculateLXP(), calculateXP(), COMPLETION_BONUS, DIFFICULTY_MULTIPLIER, getLXPForActivity() (+18 more)

### Community 28 - "auth.ts"
Cohesion: 0.09
Nodes (24): @auth/prisma-adapter, bcryptjs, ref_node_crypto, configGuardResponse(), GET(), POST(), mockGetCurrentUserId, mockUserFindUnique (+16 more)

### Community 29 - "insights.ts"
Cohesion: 0.14
Nodes (21): main(), ok(), prisma, GET(), GET(), GET(), ALLOWED_DIFFICULTIES, clean() (+13 more)

### Community 30 - "friendship.service.ts"
Cohesion: 0.12
Nodes (21): GET(), DELETE(), GET(), RouteParams, POST(), POST(), GET(), GET() (+13 more)

### Community 31 - "What You Must Do When Invoked"
Cohesion: 0.07
Nodes (26): For /graphify add and --watch, For /graphify query, For the commit hook and native CLAUDE.md integration, For --update and --cluster-only, /graphify, Honesty Rules, Interpreter guard for subcommands, Part A - Structural extraction for code files (+18 more)

### Community 32 - "extractText.ts"
Cohesion: 0.14
Nodes (19): DocumentProcessingError, attemptOcrPdfText(), classifyPdfFailure(), extractDocxText(), ExtractionResult, extractPdfPages(), extractPdfPagesViaPdfJs(), extractPdfPagesViaPdfParse() (+11 more)

### Community 33 - "calendar/page.tsx"
Cohesion: 0.13
Nodes (21): addDays(), CalendarDayDto, CalendarPage(), goToToday(), load(), shift(), CreateSessionForm(), DayView() (+13 more)

### Community 34 - "mindmap/page.tsx"
Cohesion: 0.12
Nodes (22): MindEdge, MindMapData, MindMapPage(), MindMapRecord, MindNode, TYPE_COLORS, MOBILE_QUERY, useIsMobile() (+14 more)

### Community 35 - "MindMapPageInner"
Cohesion: 0.12
Nodes (20): MindMapPageInner(), addChild(), beginPinch(), deleteSelected(), fitCanvas(), handleCanvasPointerDown(), handleCanvasPointerMove(), handleNodePointerDown() (+12 more)

### Community 36 - "state.ts"
Cohesion: 0.13
Nodes (23): [Onboarding] Onboarding thành 5 phase + gate mềm, Gate mềm (`src/proxy.ts` + `state.ts`), State machine, 4. State machine, 5. Nguồn sự thật & các quy tắc điều hướng, 7. Chỉ số đo lường, Bảng điều hướng (không bao giờ tự mâu thuẫn), hasProfileSignal() (+15 more)

### Community 37 - "summary/download/route.ts"
Cohesion: 0.10
Nodes (22): docx, ref_fs, ref_path, pdfkit, FONT_BOLD, FONT_BOLD_ITALIC, FONT_DIR, FONT_ITALIC (+14 more)

### Community 38 - "MindMapExportModal.tsx"
Cohesion: 0.16
Nodes (24): Mind Map Export, FORMAT_META, FormatMeta, MindMapExportModal(), handleExport(), MindMapExportModalProps, createMindMapExportPayload(), downloadBlob() (+16 more)

### Community 39 - "personalization.service.ts"
Cohesion: 0.16
Nodes (22): Draft, LearningGoalDraft, LearningProfile, buildLearningContext(), labelFor(), LABELS, LEARNING_STYLE_HINT, LearningContext (+14 more)

### Community 40 - "spaced-repetition.service.ts"
Cohesion: 0.12
Nodes (17): ApplyMasteryResult, applyMasteryToPlan(), monthLabel(), updateMastery(), normalizeAnswer(), submitExerciseAttempt(), syncRoadmapAfterMastery(), calculateNextReview() (+9 more)

### Community 41 - "community/page.tsx"
Cohesion: 0.11
Nodes (17): CommunityLoadingFallback(), DIFF_KEYS, SORT_KEYS, TRUST_KEYS, ContributorLeaderboard(), ContributorLeaderboardProps, MEDALS, PERIOD_ICONS (+9 more)

### Community 42 - "assessment.service.ts"
Cohesion: 0.15
Nodes (17): GET(), POST(), GET(), GET(), GET(), AttemptStatRow, computeStreakDays(), GET() (+9 more)

### Community 43 - "workspace/page.tsx"
Cohesion: 0.10
Nodes (16): ReviewCard, ReviewPage(), ReviewResponse, FlashcardItem, QuizResult, SessionSummary, WeakConcept, WorkspaceAnswer (+8 more)

### Community 44 - "quiz.service.ts"
Cohesion: 0.22
Nodes (17): CompletionActivity, POST(), POST(), POST(), readGradeLevel(), DIFFICULTIES, generateQuizQuestion(), normalizeGeneratedQuestion() (+9 more)

### Community 45 - "documents/DocumentCard.tsx"
Cohesion: 0.14
Nodes (14): DocumentCard(), DocumentCardProps, FailedCause(), Format, FORMATS, plainPreviewText(), StatusLine(), DocumentDetailModal() (+6 more)

### Community 46 - "prompts.ts"
Cohesion: 0.18
Nodes (17): Prompt, Subject-aware (từ 2026-09-26), buildAgentPlannerPrompt(), buildDiagnosticPrompt(), buildDocumentQualityPrompt(), buildDocumentSummaryPrompt(), buildMindMapPrompt(), buildQuestionGenPrompt() (+9 more)

### Community 47 - "upload/route.ts"
Cohesion: 0.19
Nodes (16): POST(), ALLOWED_DIFFICULTIES, cleanOptionalText(), guessMimeType(), inferFileType(), POST(), describeDocumentError(), DOCUMENT_ERROR_SPECS (+8 more)

### Community 48 - "ApiResponse"
Cohesion: 0.16
Nodes (14): GET(), RouteParams, POST(), RouteParams, GET(), POST(), createExercise(), CreateExerciseParams (+6 more)

### Community 49 - "onboarding/route.ts"
Cohesion: 0.22
Nodes (16): ACTIONS, GET(), PATCH(), computeProfileCompletion(), isProfileComplete(), nextStatusForAction(), normalizeOnboardingStatus(), profileCompletionPercent() (+8 more)

### Community 50 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 51 - "Supabase"
Cohesion: 0.11
Nodes (15): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Debugging, Making and Committing Schema Changes (+7 more)

### Community 52 - "Module map"
Cohesion: 0.11
Nodes (18): AI System, Analytics / Progress, App / Routing, Bản đồ tổng quan, Bảng tra nhanh: "sửa cái gì → mở file nào", CODEBASE MAP, Community, Documents / Library / Mind Map / Resources (+10 more)

### Community 53 - "app/layout.tsx"
Cohesion: 0.14
Nodes (14): katex, src_app_globals, inter, metadata, spaceGrotesk, viewport, NativeShell(), SessionProviderWrapper() (+6 more)

### Community 54 - "next"
Cohesion: 0.18
Nodes (9): next, POST(), HINT_LABELS, POST(), POST(), POST(), POST(), src_lib_ai_router_aioverloadederror (+1 more)

### Community 55 - "getLearningAnalytics"
Cohesion: 0.14
Nodes (18): addDays(), availability(), buildJourney(), dayKeyFromSql(), difficultySql(), getLearningAnalytics(), n(), pickTopicFilters() (+10 more)

### Community 56 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 57 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, build, db:generate, db:migrate, db:push, db:studio, dev, lint (+9 more)

### Community 58 - "vector.ts"
Cohesion: 0.21
Nodes (15): @google/generative-ai, src_lib_ai_gemini_aioverloadederror, callWithRetry(), client, isRetryableStatus(), MODEL_NAME, sleep(), EMBEDDING_DIMENSIONS (+7 more)

### Community 59 - "skill-math.ts"
Cohesion: 0.13
Nodes (16): buildCorrelation(), metric(), directionFromDelta(), enoughEvidence(), IMPROVEMENT_POINTS, isMastered(), isWeakSkill(), MASTERED_THRESHOLD (+8 more)

### Community 60 - "Changelog"
Cohesion: 0.12
Nodes (15): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), Bug Fixes, Bug Fixes, Bug Fixes (+7 more)

### Community 61 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 62 - "socratic-tutor.service.ts"
Cohesion: 0.20
Nodes (14): ref_crypto, buildSocraticPrompt(), generateText(), createTutorSession(), evaluateUserAnswer(), evaluationSourceId(), extractConcepts(), getNextHint() (+6 more)

### Community 63 - "next-action/route.ts"
Cohesion: 0.22
Nodes (15): ActionType, buildActionsFromRules(), buildContext(), enrichWithAI(), GET(), NextAction, NextActionContext, GET() (+7 more)

### Community 64 - "learning-session.service.ts"
Cohesion: 0.27
Nodes (11): GET(), POST(), RouteParams, POST(), completeLearningSession(), getActiveLearningSession(), LearningSessionRow, LearningSessionSummary (+3 more)

### Community 65 - "[id]/resources/route.ts"
Cohesion: 0.25
Nodes (12): GET(), RouteParams, DELETE(), GET(), POST(), RouteParams, assertOwnGoal(), linkRoadmapItem() (+4 more)

### Community 66 - "CommunityPageInner"
Cohesion: 0.15
Nodes (4): CommunityPageInner(), handleLbSubjectChange(), handleLeaderboardPeriodChange(), loadLeaderboard()

### Community 67 - "useBackButtonToClose"
Cohesion: 0.20
Nodes (8): BottomSheet(), BottomSheetProps, Drawer(), DrawerProps, Modal(), ModalProps, onNativeBackButton(), useBackButtonToClose()

### Community 68 - "Nhóm model"
Cohesion: 0.15
Nodes (14): Roadmap, AI / hội thoại, Bảo mật, DATABASE, Gamification, Học tập lõi, Index đáng chú ý, Migration (+6 more)

### Community 69 - "profile/page.tsx"
Cohesion: 0.21
Nodes (9): PasswordStatus, ProfilePage(), StreakResponse, EditProfileModal(), EditProfileModalProps, PhotoKind, ProfileHeader(), ProfileHeaderProps (+1 more)

### Community 70 - "contribution.service.ts"
Cohesion: 0.26
Nodes (12): applyPenalty(), awardContributionPoints(), calculateLevelFromCP(), ContributionConfig, DEFAULT_CONTRIBUTION_CONFIG, getContributorProfile(), getCurrentLevelThreshold(), getLeaderboard() (+4 more)

### Community 71 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, @capacitor/android, @capacitor/cli, eslint, eslint-config-next, prisma, @types/bcryptjs, @types/node (+5 more)

### Community 72 - "mistakes/route.ts"
Cohesion: 0.31
Nodes (8): GET(), groupIntoWeakConcepts(), MistakeLogRow, WeakConcept, getRecentMistakes(), getWeakConcepts(), RecentMistake, src_services_mistake_analysis_service_weakconcept

### Community 73 - "friends/page.tsx"
Cohesion: 0.19
Nodes (10): FriendProfile, FriendsData, FriendsPage(), load(), postJSON(), removeFriendship(), FriendUser, RelationEntry (+2 more)

### Community 74 - "analytics.test.ts"
Cohesion: 0.24
Nodes (11): addUtcDays(), AnalyticsRangeId, AnalyticsWindow, enumerateDayKeys(), fillDailySeries(), parseAnalyticsRange(), RANGE_DAYS, resolveAnalyticsWindow() (+3 more)

### Community 75 - "MOBILE"
Cohesion: 0.17
Nodes (12): App download, Bottom navigation, Brand trên mobile, Build APK, Cần kiểm bằng mắt, Cột nút nổi: `.floating-actions`, Không horizontal overflow, MOBILE (+4 more)

### Community 76 - "resources/page.tsx"
Cohesion: 0.18
Nodes (9): CreateResourceForm(), DIFF_KEYS, ListData, Resource, ResourcesPage(), load(), submitRate(), SORT_KEYS (+1 more)

### Community 77 - "layout.test.ts"
Cohesion: 0.23
Nodes (10): MindMapNode, getEdgePath(), LEVEL_GAP, PositionedNode, TANGENTIAL_GAP, boxOf(), centerOf(), distanceFromRoot() (+2 more)

### Community 78 - "score.ts"
Cohesion: 0.27
Nodes (11): clamp100(), composeLearningScore(), computeConsistencyScore(), computeGoalScore(), computeImprovementScore(), computePracticeScore(), computeReviewScore(), computeSkillScore() (+3 more)

### Community 79 - "learning-agent.service.ts"
Cohesion: 0.23
Nodes (8): recordLearningActivity(), AgentPlanInput, AgentTaskInput, checkPhaseProgression(), completePlan(), DailyPlan, mapTaskTypeToActivity(), updateTaskStatus()

### Community 80 - "ExampleInstrumentedTest.java"
Cohesion: 0.27
Nodes (7): ExampleInstrumentedTest, ExampleUnitTest, androidx.test.ext.junit.runners.AndroidJUnit4, assert, instrumentationregistry, org.junit.runner.RunWith, org.junit.Test

### Community 81 - "verify-setup-layout.mjs"
Cohesion: 0.25
Nodes (7): ref_node_child_process, ref_node_timers, authenticate(), Cdp, getJson(), main(), VIEWPORTS

### Community 82 - "leaderboard.service.ts"
Cohesion: 0.36
Nodes (9): GET(), clampLimit(), getFriendsXpLeaderboard(), getGlobalXpLeaderboard(), getMyGlobalRank(), getSubjectMasteryLeaderboard(), publicSelect, SubjectLeaderboardEntry (+1 more)

### Community 83 - "onboarding/__tests__/route.test.ts"
Cohesion: 0.18
Nodes (6): emptyDraftPayload, mockGetCurrentUserId, mockTransaction, mockUserFindUnique, mockUserUpdate, mockUserUpdateMany

### Community 84 - "practice/page.tsx"
Cohesion: 0.18
Nodes (7): CreateExerciseForm(), DIFF_KEYS, ExerciseItem, inputStyle, ListData, PracticePage(), SubjectSwitcher()

### Community 85 - "achievement.service.ts"
Cohesion: 0.27
Nodes (10): ACHIEVEMENT_DEFINITIONS, AchievementCondition, AchievementDefinition, checkAndUnlockAchievements(), evaluateCondition(), getAchievementId(), getOrCreateAchievement(), getUserStats() (+2 more)

### Community 86 - "duplicate-detection.service.ts"
Cohesion: 0.27
Nodes (8): processDocument(), calculateTextSimilarity(), checkSemanticDuplicate(), detectDuplicateCommunityDocument(), detectDuplicatePersonalDocument(), DuplicateCheckResult, markAsDuplicate(), scanForDuplicates()

### Community 87 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 90 - "document.service.ts"
Cohesion: 0.33
Nodes (9): buildFlashcardsPrompt(), buildStudyGuidePrompt(), DocumentCitation, FlashcardItem, generateFlashcards(), generateStudyGuide(), getSourceTextForArtifact(), normalizeFlashcards() (+1 more)

### Community 91 - "graphify reference: extra exports and benchmark"
Cohesion: 0.22
Nodes (8): graphify reference: extra exports and benchmark, Step 6b - Wiki (only if --wiki flag), Step 7 - Neo4j export (only if --neo4j or --neo4j-push flag), Step 7a - FalkorDB export (only if --falkordb or --falkordb-push flag), Step 7b - SVG export (only if --svg flag), Step 7c - GraphML export (only if --graphml flag), Step 7d - MCP server (only if --mcp flag), Step 8 - Token reduction benchmark (only if total_words > 5000)

### Community 92 - "AppDownloadBubble.tsx"
Cohesion: 0.31
Nodes (6): src_components_app_download_app_download_bubble, AppDownloadBubble(), AndroidAppInfo, DEFAULT_ANDROID_APP, getAndroidApp(), publicEnv()

### Community 93 - "2026-09-26 — Onboarding + Brand + Analytics + Multi-subject"
Cohesion: 0.25
Nodes (8): 2026-09-26 — Dọn dead code (audit PROVE BEFORE DELETE), 2026-09-26 — Onboarding + Brand + Analytics + Multi-subject, [Analytics] Bổ sung 2 biểu đồ còn thiếu, ARCHITECTURE CHANGELOG, [Brand] Logo + app download thành hệ thống dùng chung, [Cleanup] Xoá 15 file dead code + 4 thư mục rỗng, Mẫu thêm thay đổi, [Onboarding] Sửa lỗi vòng lặp khi bấm "Bắt đầu học theo lộ trình"

### Community 94 - "DATA FLOW"
Cohesion: 0.25
Nodes (8): 1. Luồng vào app (lần đầu), 2. Luồng học (vòng lặp chính), 3. Luồng AI, 4. Luồng tài liệu (RAG), 5. Luồng phân quyền (quan trọng), 6. Luồng môn học (multi-subject), 7. Bảng "ai đọc/ghi model nào", DATA FLOW

### Community 95 - "ONBOARDING"
Cohesion: 0.25
Nodes (8): 5 phase, API, BẪY: nút rời khỏi màn hồ sơ, Hàm thuần quan trọng, i18n, Offline / draft, ONBOARDING, Test

### Community 97 - "outcomes.ts"
Cohesion: 0.32
Nodes (7): buildOutcomeBreakdown(), buildSubjectTimeShare(), num(), OutcomeRow, SubjectTimeRow, OutcomeBreakdown, SubjectTimeShare

### Community 98 - "WELCOME.md"
Cohesion: 0.29
Nodes (6): 1. Triết lý: Personalize, rồi hãy dive in, 2. Luong, 2. Luồng, 6. API, 8. Quick Setup (`/setup`), Returning user

### Community 99 - "next.config.js"
Cohesion: 0.29
Nodes (4): nextConfig, OPTIONAL_ENV, RECOMMENDED_PRODUCTION_ENV, REQUIRED_PRODUCTION_ENV

### Community 100 - "seed/subjects.ts"
Cohesion: 0.33
Nodes (6): DEFAULT_SUBJECTS, main(), prisma, SeedSubject, seedSubjects(), SeedTopic

### Community 101 - "calendar/[id]/route.ts"
Cohesion: 0.38
Nodes (6): DELETE(), PATCH(), RouteParams, deleteStudySession(), updateStudySession(), StudySessionStatus

### Community 102 - "LibraryPage"
Cohesion: 0.52
Nodes (5): LibraryPage(), ensurePolling(), handleRetry(), handleUpload(), loadDocs()

### Community 103 - "graphify reference: query, path, explain"
Cohesion: 0.33
Nodes (5): For /graphify explain, For /graphify path, graphify reference: query, path, explain, Step 0 — Constrained query expansion (REQUIRED before traversal), Step 1 — Traversal

### Community 104 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 105 - "AI SYSTEM"
Cohesion: 0.33
Nodes (6): AI SYSTEM, Module dùng AI, Nguyên tắc: không bịa ngữ cảnh, RAG, Test, Thứ tự provider

### Community 106 - "RoadmapPage"
Cohesion: 0.60
Nodes (6): RoadmapPage(), handleConfirmDelete(), handleCreate(), handleMarkCompleted(), handleReactivate(), loadGoals()

### Community 107 - "dbUpload.ts"
Cohesion: 0.40
Nodes (4): ALLOWED_MIME_TO_EXT, InvalidImageError, PreparedImage, prepareUploadedImage()

### Community 108 - "next-auth.d.ts"
Cohesion: 0.40
Nodes (4): Authentication, Identity, next-auth, Session

### Community 109 - "LearnX AI — Architecture Memory"
Cohesion: 0.40
Nodes (5): Cách dùng, Danh mục, Kiểm chứng chuẩn, LearnX AI — Architecture Memory, Quy ước khi đọc source

### Community 110 - "gradlew"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 111 - "graphify reference: add a URL and watch a folder"
Cohesion: 0.50
Nodes (3): For /graphify add, For --watch, graphify reference: add a URL and watch a folder

### Community 112 - "graphify reference: commit hook and native CLAUDE.md integration"
Cohesion: 0.50
Nodes (3): For git commit hook, For native CLAUDE.md integration, graphify reference: commit hook and native CLAUDE.md integration

### Community 113 - "graphify reference: incremental update and cluster-only"
Cohesion: 0.50
Nodes (3): For --cluster-only, For --update (incremental re-extraction), graphify reference: incremental update and cluster-only

### Community 114 - "next-env.d.ts"
Cohesion: 0.50
Nodes (3): NOTE: This file should not be edited, next_types_root_params_d, next_types_routes_d

### Community 115 - "context/route.ts"
Cohesion: 0.83
Nodes (3): GET(), TutorContextResponse, listTutorSources()

## Knowledge Gaps
- **721 isolated node(s):** `extends`, `next/core-web-vitals`, `config`, `nextConfig`, `REQUIRED_PRODUCTION_ENV` (+716 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 968 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useLanguage()` connect `useLanguage` to `engine.ts`, `ProfileReady.tsx`, `MobileBottomNav.tsx`, `Panel.tsx`, `LearningOnboarding.tsx`, `react`, `MarkdownLite.tsx`, `dashboard/page.tsx`, `LanguageProvider.tsx`, `capacitor.ts`, `useToast`, `calendar/page.tsx`, `mindmap/page.tsx`, `MindMapPageInner`, `MindMapExportModal.tsx`, `community/page.tsx`, `workspace/page.tsx`, `documents/DocumentCard.tsx`, `CommunityPageInner`, `profile/page.tsx`, `friends/page.tsx`, `MOBILE`, `resources/page.tsx`, `practice/page.tsx`, `WorkspacePage`, `AppDownloadBubble.tsx`, `LibraryPage`, `RoadmapPage`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Why does `next` connect `next` to `session.ts`, `getCurrentUserId`, `ProfileReady.tsx`, `useLanguage`, `MobileBottomNav.tsx`, `Panel.tsx`, `LearningOnboarding.tsx`, `react`, `MarkdownLite.tsx`, `dashboard/page.tsx`, `package.json`, `diagnostic.service.ts`, `index.ts`, `calendar.service.ts`, `roadmap.service.ts`, `resource.service.ts`, `auth.ts`, `insights.ts`, `friendship.service.ts`, `calendar/page.tsx`, `mindmap/page.tsx`, `state.ts`, `summary/download/route.ts`, `community/page.tsx`, `assessment.service.ts`, `workspace/page.tsx`, `quiz.service.ts`, `documents/DocumentCard.tsx`, `upload/route.ts`, `ApiResponse`, `onboarding/route.ts`, `app/layout.tsx`, `next-action/route.ts`, `learning-session.service.ts`, `[id]/resources/route.ts`, `profile/page.tsx`, `mistakes/route.ts`, `leaderboard.service.ts`, `calendar/[id]/route.ts`, `context/route.ts`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `ProfileReady.tsx`, `useLanguage`, `MobileBottomNav.tsx`, `Panel.tsx`, `LearningOnboarding.tsx`, `MarkdownLite.tsx`, `dashboard/page.tsx`, `package.json`, `LanguageProvider.tsx`, `capacitor.ts`, `useToast`, `calendar/page.tsx`, `mindmap/page.tsx`, `MindMapExportModal.tsx`, `community/page.tsx`, `workspace/page.tsx`, `documents/DocumentCard.tsx`, `app/layout.tsx`, `useBackButtonToClose`, `profile/page.tsx`, `friends/page.tsx`, `resources/page.tsx`, `practice/page.tsx`, `AppDownloadBubble.tsx`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `useLanguage()` (e.g. with `i18n` and `i18n`) actually correct?**
  _`useLanguage()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `extends`, `next/core-web-vitals`, `config` to the rest of the system?**
  _721 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `router.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._
- **Should `session.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06487434248977206 - nodes in this community are weakly interconnected._