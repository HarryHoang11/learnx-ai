# CODEBASE MAP

Stack: **Next.js 16 (App Router) · React 19 · Prisma 5 · PostgreSQL + pgvector ·
NextAuth v5 · Capacitor 7 (Android) · CSS thuần + CSS variables (không Tailwind)**

## Bản đồ tổng quan

```
      ┌──────────────┐
      │ /login       │
      │ /register    │
      └──────┬───────┘
             ↓
      ┌──────────────┐
      │ /welcome     │  user NEW → bắt buộc xem 1 lần
      └──────┬───────┘
             ↓
      ┌──────────────┐
      │ /onboarding  │  5 phase — bỏ qua được, nhưng phải qua 1 lần
      └──────┬───────┘
             ↓
   ┌─────────┴──────────┐
   ↓                    ↓
┌───────────┐    ┌────────────────┐
│ (app)/*   │    │ ProfileReady   │ ← phase 05
│ 16 route  │    └────────────────┘
└─────┬─────┘
      │  AppShell: Sidebar + FloatingActions
      ↓
┌─────────────────────────────────────┐
│  CORE LEARNING ENGINE               │
│  quiz · exercise · SM-2 review      │
│  mastery · analytics · tutor        │
└─────────────────────────────────────┘
```

---

## Module map

### App / Routing
- **Files**: `src/app/layout.tsx` (root, metadata + providers) · `src/app/(app)/` (16
  route có Sidebar) · `src/proxy.ts` (middleware — **không** ở `src/app/`).
- **API**: — · **Model**: —
- **Phụ thuộc**: `src/components/layout/AppShell.tsx` bọc mọi route `(app)`.

### Authentication
- **Files**: `src/auth.ts` (config + `jwt()` mirror) · `src/app/api/auth/**` ·
  `src/lib/auth/` · `src/components/auth/AuthCard.tsx`.
- **API**: `/api/auth/*` · **Model**: `User`, `Account`, `Session`,
  `VerificationToken`.
- **Phụ thuộc**: mọi module có nhận diện user → [AUTH.md](./AUTH.md).

### Onboarding
- **Mục đích**: thu thập learning profile 5 phase → cá nhân hoá toàn app.
- **Files**:
  - `src/lib/onboarding/steps.ts` — **nguồn sự thật** danh sách step theo nhóm
  - `src/lib/onboarding/options.ts` — catalogue lựa chọn + `i18nKey`
  - `src/lib/onboarding/profile.ts` — sanitize / merge hồ sơ
  - `src/lib/onboarding/state.ts` — state machine + gate
  - `src/lib/onboarding/client.ts` — fetch helper
  - `src/app/onboarding/LearningOnboarding.tsx` — engine 5 phase
  - `src/app/onboarding/ProfileReady.tsx` — phase 05
- **API**: `GET|PATCH /api/onboarding` · **Model**: `User.learningProfile` (JSON),
  `User.onboardingStatus`, `LearningGoal`.
- → [ONBOARDING.md](./ONBOARDING.md) · [docs/WELCOME.md](../WELCOME.md)

### Learning Profile
- **Files**: `src/lib/personalization/context.ts` (`buildLearningContext`,
  `readGradeLevel`) · `src/components/account/LearningProfilePanel.tsx`.
- **Model**: `User.learningProfile` — cột `Json?`, mở rộng shape **không cần
  migration**.

### Subject Engine
- **Mục đích**: hành vi riêng từng môn trên nền 1 core engine.
- **Files**: `src/lib/subjects/engine.ts` (registry 9 môn) · `progress.ts` (gom
  tiến bộ theo môn) · `src/lib/constants/subjects.ts` (danh sách môn cho UI) ·
  `src/components/subject/SubjectSwitcher.tsx` · `SubjectProgressPanel.tsx`.
- → [SUBJECTS.md](./SUBJECTS.md)

### AI System
- **Files**: `src/lib/ai/router.ts` (`generateText`/`generateJSON`) ·
  `src/lib/ai/prompts.ts` (toàn bộ prompt) · `src/lib/ai/providers/*`.
- **Model**: `AIRequestLog`, `TutorSession`, `Conversation`.
- → [AI_SYSTEM.md](./AI_SYSTEM.md)

### Quiz / Diagnostic / Skill Profile
- **Files**: `src/services/quiz.service.ts` · `src/services/assessment.service.ts`
  (**`updateMastery` + `pickNextDifficulty` — nguồn DUY NHẤT cho mastery & độ khó**) ·
  `src/services/diagnostic.service.ts`.
- **API**: `/api/quiz/*`, `/api/assessment/*`, `/api/diagnostic/*`, `/api/progress`.
- **Model**: `Assessment`, `Attempt`, `QuizQuestionCache`, `MistakeLog`,
  `LearningProgress`.

### Practice
- **Files**: `src/services/exercise.service.ts` · `src/app/(app)/practice/page.tsx` ·
  `src/components/exercise/ExerciseSolver.tsx`.
- **API**: `/api/exercises`, `/api/exercises/[id]/attempt` · **Model**: `Exercise`,
  `ExerciseAttempt`.

### Review / Spaced Repetition
- **Files**: `src/services/spaced-repetition.service.ts` — **thuật toán SM-2 duy nhất**.
- **API**: `/api/review/*` · **Model**: `ReviewItem`, `ReviewAttempt`.

### Roadmap
- **Files**: `src/services/roadmap.service.ts` · `roadmap-resource.service.ts` ·
  `src/app/(app)/roadmap/page.tsx`.
- **API**: `/api/roadmap`, `/api/roadmap/generate`, `/api/roadmaps` ·
  **Model**: `LearningGoal`, `Roadmap`, `RoadmapResource`, `LearningAgentPlan`,
  `LearningAgentTask`.

### Tutor
- **Files**: `src/services/tutor.service.ts` · `socratic-tutor.service.ts` ·
  `tutor-context.service.ts` · `src/components/tutor/FloatingAIButton.tsx`.
- **API**: `/api/tutor/*` · **Model**: `TutorSession`, `Conversation`.

### Analytics / Progress
- **Mục đích**: thống kê học tập + insight + gợi ý hành động tiếp theo.
- **Files**: `src/services/analytics/learning-analytics.service.ts` (SQL thật) ·
  `recommendations.ts` (chấm điểm yếu) · `insights.ts` · `outcomes.ts` (hàm thuần) ·
  `src/app/(app)/progress/page.tsx` (trang **Study Analytics**).
- **API**: `/api/analytics`, `/api/analytics/insights`, `/api/progress`.
- **Quy tắc**: aggregate **server-side** bằng `$queryRaw`; UI không query DB.

### Documents / Library / Mind Map / Resources
- **Files**: `src/services/document.service.ts` · `community-document.service.ts` ·
  `src/lib/documents/` · `src/lib/embeddings/` · `src/lib/mindmap/` ·
  `src/components/documents/` · `src/components/mindmap/`.
- **API**: `/api/documents/*`, `/api/mindmap/*`, `/api/library/*`, `/api/resources/*`.
- **Model**: `Document`, `DocumentChunk` (vector 768), `MindMap`, `LearningArtifact`,
  `LearningResource`, `CommunityDocument`.

### Gamification
- **Files**: `src/lib/constants/xp.ts` (công thức level) ·
  `src/components/ui/LevelProgressBar.tsx`.
- **API**: `/api/streak`, `/api/xp/history` · **Model**: `XPTransaction`,
  `PointTransaction`, `Streak`, `LearningDay`, `Achievement`, `UserAchievement`,
  `DailyChallenge`, `Reward`, `UserReward`.

### Community
- **API**: `/api/friends`, `/api/leaderboard/*`, `/api/community/*` · **Model**:
  `Friendship`, `ContributorProfile`, `ContributionEvent`, `ContributionLeaderboard`,
  `DocumentRating`, `DocumentVote`, `DocumentReport`, `DocumentQuality`, `DocumentSave`.

### Mobile / APK
- **Files**: `capacitor.config.ts` · `android/` ·
  `src/components/mobile/AppDownloadBlock.tsx` ·
  `src/components/app-download/AppDownloadBubble.tsx` ·
  `src/components/layout/FloatingActions.tsx` · `src/config/app.ts` (URL APK) ·
  `src/app/manifest.ts` (PWA).
- → [MOBILE.md](./MOBILE.md)

### i18n
- **Files**: `src/lib/i18n/dictionary.ts` (~420 key × 2 ngôn ngữ) ·
  `src/components/providers/LanguageProvider.tsx` (`useLanguage()` → `t(key)`).
- **Quy ước**: key dạng `module.sub.key`, trong object `as const` để `I18nKey` là
  union type. Thêm text → thêm key **cả 2 ngôn ngữ**.

---

## Bảng tra nhanh: "sửa cái gì → mở file nào"

| Muốn sửa | Mở file |
|---|---|
| Câu hỏi AI sinh ra | `src/lib/ai/prompts.ts` |
| Chọn provider / fallback | `src/lib/ai/router.ts` |
| Công thức mastery | `src/services/assessment.service.ts` (KHÔNG sửa chỗ khác) |
| Thuật toán ôn tập | `src/services/spaced-repetition.service.ts` |
| Bước khảo sát / thứ tự phase | `src/lib/onboarding/steps.ts` |
| Lựa chọn trong khảo sát | `src/lib/onboarding/options.ts` |
| Validate + merge hồ sơ | `src/lib/onboarding/profile.ts` |
| Chặn/cho qua trang | `src/proxy.ts` + `src/lib/onboarding/state.ts` |
| Hành vi riêng của môn | `src/lib/subjects/engine.ts` |
| Màu / spacing / theme | `src/app/globals.css` (token ở `:root`) |
| Text hiển thị | `src/lib/i18n/dictionary.ts` |
| Nút nổi góc phải | `src/components/layout/FloatingActions.tsx` |
| Link tải APK | `src/config/app.ts` |
| Lấy user hiện tại | `src/lib/auth/session.ts` → `getCurrentUserId()` |
| Model DB | `prisma/schema.prisma` |