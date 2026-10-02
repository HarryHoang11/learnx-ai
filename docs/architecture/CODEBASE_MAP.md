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
- **Files**: `src/app/layout.tsx` (root, metadata + providers) · `src/app/(app)/` (**22**
  route có Sidebar) · `src/proxy.ts` (middleware — **không** ở `src/app/`).
- **Quy mô**: **102** `route.ts` trong `src/app/api/` · **22** page trong `(app)` ·
  **16** component `ui/` · **23** nhóm component · **38** file test.
- **API**: — · **Model**: —
- **Phụ thuộc**: `src/components/layout/AppShell.tsx` bọc mọi route `(app)`.
- **Số liệu ở trên tính bằng lệnh** (không ghi tay): xem mục *Số liệu hiện tại* ở
  cuối file. Sửa code làm lệch thì cập nhật lại ở đó, đừng để doc tự mâu thuẫn.

### Authentication
- **Files**: `src/auth.ts` (config + `jwt()` mirror) · `src/app/api/auth/**` ·
  `src/lib/auth/` · `src/components/auth/`.
- **UI (đã redesign 2026-10-04)**:
  - `AuthShell.tsx` — khung chung (desktop 2 cột brand+form · ≤900px 1 cột,
    ẩn vùng brand) · `auth.css` (toàn bộ style, token lấy từ `globals.css`)
  - `AuthField.tsx` — ô nhập có `<label>` + `aria-invalid`/`aria-describedby`
  - `PasswordInput.tsx` — dùng chung Login/Register **và** `ChangePasswordPanel`
    (giữ props tương thích ngược: `id`, `minLength`, `label` optional)
  - `PasswordStrength.tsx` — thanh đo, **chỉ dùng quy tắc thật của server**
  - `OAuthButtons.tsx` — Google (`type="button"` + chặn bấm lặp)
  - ~~`AuthCard.tsx`~~ — **đã xoá**, 0 caller sau khi 2 trang chuyển sang `AuthShell`
- **API**: `/api/auth/*` · **Model**: `User`, `Account`, `Session`,
  `VerificationToken`.
- **QUY TẮC**: quyết định đi đâu sau login **không thuộc trang auth** — cả 2
  trang `push("/dashboard")` rồi để `src/proxy.ts` định tuyến (`/welcome` →
  `/onboarding` → `/dashboard`) theo `onboardingStatus` trong JWT. Đọc ở client
  sẽ tạo 3 nguồn sự thật và dễ lệch.
- **Chưa có**: forgot password / reset token (chỉ có đổi mật khẩu qua
  `/api/auth/password`). **Không render link tới trang chưa tồn tại.**
- **URL công khai — MỘT nguồn sự thật** (sửa 2026-10-05): `src/config/app.ts`
  export `PUBLIC_URL_ENV_NAMES` + `resolvePublicUrl(env)`. Cả `auth.ts`
  (`readPublicUrl`, quyết định `trustHost`) và `layout.tsx`
  (`resolveMetadataBase`) **phải** gọi hàm này. Trước đó 2 chỗ liệt kê env
  khác nhau (`APP_URL` vs `AUTH_URL`) ⇒ `trustHost=false` ⇒ **mọi** `/api/auth/*`
  trả 503 trong khi app vẫn chạy. Regression test: `src/config/__tests__/publicUrl.test.ts`.
- → [AUTH.md](./AUTH.md)

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
  `readGradeLevel`, `gradeLevelText`, `buildAdaptiveTeachingRules`) ·
  `src/components/account/LearningProfilePanel.tsx`.
- **Model**: `User.learningProfile` — cột `Json?`, mở rộng shape **không cần
  migration**. Chứa `educationStage`, `grade` (lớp **hiện tại**), `track`,
  `school`, `subjects`, `intents`…
- **Quy tắc**: lớp hiện tại trong hồ sơ ≠ lớp của bài kiểm tra. Xem
  [DATABASE.md](./DATABASE.md) § "Lớp hiện tại vs lớp đang kiểm tra".

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
- **Files**: `src/services/quiz.service.ts` (`generateQuizQuestion` nhận
  `gradeLevelOverride`) · `src/services/assessment.service.ts`
  (**`updateMastery` + `pickNextDifficulty` — nguồn DUY NHẤT cho mastery & độ khó**) ·
  `src/services/diagnostic.service.ts` · `src/services/personalization.service.ts`
  (**`resolveDiagnosticLevel()` — nguồn DUY NHẤT cho lớp đang kiểm tra**).
- **API**: `/api/quiz/*`, `/api/assessment/*`, `/api/diagnostic/*`, `/api/progress`.
- **Model**: `Assessment`, `Attempt`, `QuizQuestionCache`, `MistakeLog`,
  `LearningProgress`. `Assessment`/`DiagnosticSession` có `educationStage` +
  `grade` **nullable** = lớp đang kiểm tra (tách khỏi lớp hiện tại trong hồ sơ).
- **Luồng lớp**: UI chọn lớp (danh sách lấy từ `/api/diagnostic/status`) →
  `POST /api/assessment/start { subject, grade }` → server validate theo
  `gradeOptionsFor(educationStage)` → lưu vào `Assessment` → **mọi câu hỏi sau
  đó lấy lớp từ `Assessment.grade`**, kể cả khi câu đầu sinh ở lớp khác lớp
  hiện tại.

### Practice
- **Files**: `src/services/exercise.service.ts` · `src/app/(app)/practice/page.tsx` ·
  `src/components/exercise/ExerciseSolver.tsx`.
- **API**: `/api/exercises`, `/api/exercises/[id]/attempt` · **Model**: `Exercise`,
  `ExerciseAttempt`.

### Review / Spaced Repetition
- **Files**: `src/services/spaced-repetition.service.ts` — **thuật toán SM-2 duy nhất** ·
  `src/lib/api/reviewDue.ts` — client helper dùng chung cho 2 consumer của `/api/review/due`
  (khử trùng request đang bay — xem CHANGELOG 2026-10-01).
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

### Gamification / Rewards (XP · LXP · Streak · Achievement · Cosmetic)
- **Mục đích**: hệ thống động lực học tập — kiếm XP/LXP khi học, đổi lấy
  phần thưởng, mở khoá thành tựu, giữ streak, và sưu tầm **cosmetic** (pet,
  khung avatar, hiệu ứng, sticker).
- **Lịch sử**: UI bị mất hoàn toàn trong khi backend còn nguyên (2026-10-04 đã
  khôi phục). Xem [CHANGELOG](./CHANGELOG.md).
- **Files**:
  - `src/lib/constants/xp.ts` — **nguồn sự thật** công thức XP/LXP/level
  - `src/services/learning-activity.service.ts` — `recordLearningActivity()`:
    điểm vào DUY NHẤT mọi feature ghi XP/LXP + streak
  - `src/services/achievement.service.ts` — định nghĩa + `checkAndUnlockAchievements`
    + `grantCosmeticsForAchievement` (chỉ chạy **sau** khi server tạo
    `UserAchievement`)
  - `src/services/reward-cosmetic.service.ts` — `equipCosmetic` / `unequipCosmetic` /
    `grantCosmetic` / `getEquippedCosmetics` (**không** đụng LXP)
  - `src/lib/rewards/cosmetic.ts` — **nguồn sự thật** phân loại cosmetic
    (hàm thuần, test được): `isCosmeticType` / `isEquippable` / `isCommentUsable`
  - `src/lib/api/rewardsApi.ts` — client gọi toàn bộ `/api/rewards/*`
  - `src/components/rewards/` — `RewardCard` · `DailyChallengeCard` ·
    `AchievementCard` · `rewards.css`
  - `prisma/seed/cosmetics.ts` — dữ liệu cosmetic (chạy:
    `npx tsx prisma/seed/cosmetics.ts`)
- **API**: `/api/rewards/{shop,redeem,inventory,history,equip}` ·
  `/api/achievements[?progress=true]` · `/api/achievements/unlock` ·
  `/api/daily-challenge[/claim]` · `/api/streak`
- **Model**: `XPTransaction` · `PointTransaction` (LXP) · `Streak` ·
  `LearningDay` · `Achievement` + `UserAchievement` · `DailyChallenge` ·
  `Reward` + `UserReward` (enum `RewardType`/`RewardRarity`/`RewardStatus`)

**Cosmetic (thêm 2026-10-04):**
- Mở RỘNG enum `RewardType` thêm 6 giá trị: `PET` · `AVATAR_FRAME` ·
  `PROFILE_EFFECT` · `CHAT_STICKER` · `CHAT_GIF` · `BADGE`. Giữ nguyên 4 giá
  trị cũ (`DIGITAL`/`LEARNING`/`REAL_WORLD`/`MILESTONE`) ⇒ **không migration
  dữ liệu**, chỉ `ALTER TYPE ... ADD VALUE`.
- Asset nằm trong `Reward.requirements` (cột `Json?` có sẵn): `assetUrl`,
  `previewUrl`, `width`, `height`, `auraColor`, `grantAchievement`.
  Không thêm cột mới vì mỗi loại cosmetic dùng hình thức asset khác nhau.
- **Trạng thái**: `UserReward.status = ACTIVE` = đang trang bị (không thêm bảng
  riêng). Mỗi category chỉ giữ 1 item ACTIVE — `equipCosmetic` gỡ item ACTIVE
  cùng loại trong cùng `$transaction`.
- **Cấp từ achievement**: `requirements.grantAchievement === "<CODE>"`. Chỉ
  chạy sau khi `UserAchievement` đã được tạo ⇒ server xác minh trước khi cấp.
- **Ràng buộc bất di bất dịch**: cosmetic **CHỈ trang trí** — không cộng XP/LXP,
  không mở đáp án, không tạo lợi thế học thuật. Kiểm bằ
  `cosmetic.ts` (test) chứ không bằng quy ước miệng.

**QUY TẮC VÀNG — đọc trước khi sửa:**
1. **Số dư LXP chỉ có 1 nguồn**: `progress.lxpBalance` từ `GET /api/streak`.
   `/rewards` và Dashboard đều đọc chỗ này → không thể lệch số giữa 2 màn hình.
   Đừng tạo endpoint mới cho số dư.
2. **`canAfford` / `isOwned` / `stock` do SERVER tính sẵn** trong
   `/api/rewards/shop` — client không tự suy luận từ `lxpBalance`.
3. **Sau khi redeem, dùng `newLXPBalance` do server trả về**, không tự trừ tay
   (server chặn đổi trùng → tự trừ sẽ lệch).
4. **`completed` (boolean trong DB) ≠ nguồn sự thật cho UI.** Dùng
   `buildChallengeState()` trong `src/types/index.ts`:
   `isCompleted = target > 0 && completedCount >= targetCount`. Cột boolean do
   `checkAndUpdateDailyChallenge` ghi riêng và **có thể lệch** với
   `completedCount` — đọc nó trực tiếp từng sinh bug "0/5 nhưng báo hoàn thành".
5. `isCompleted` và `isClaimed` là **2 trạng thái khác nhau** — `claimed` là cột
   riêng, không được gộp.
6. **Mọi text hiển thị lấy từ `dictionary.ts`**, kể cả con số trong câu —
   dùng placeholder `{n}`, không viết cứng (lỗi `Giải N bài tập`).
7. **Cosmetic không bao giờ được trả về cùng giá/flag do client quyết định.**
   `redeem` lấy `costLXP` từ DB; `equip` tra `UserReward`; `grant` đọc
   `requirements.grantAchievement`. Disable nút ở frontend **không** thay thế
   được kiểm tra server.
8. **Đổi `RewardType` enum phải cập nhật `cosmetic.ts` cùng lúc** — hàm đó là
   nơi quyết định loại nào trang bị / dùng trong comment. Test có case chặn
   việc thêm giá trị mà quên khai báo.
9. **`prisma migrate deploy` / `generate` báo EPERM** nếu dev server đang chạy
   (giữ khoá `query_engine`). Dừng dev server rồi chạy lại.

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
| Danh sách lớp hợp lệ theo cấp | `src/lib/onboarding/options.ts` (`GRADES_BY_STAGE`, `gradeOptionsFor`) |
| **Lớp đang kiểm tra** (validate + ghi vào bài) | `src/services/personalization.service.ts` (`resolveDiagnosticLevel`) |
| Câu mô tả trình độ cho prompt | `src/lib/personalization/context.ts` (`gradeLevelText`) |
| Quy tắc dạy yếu/vững cho AI | `src/lib/personalization/context.ts` (`buildAdaptiveTeachingRules`) |
| Validate + merge hồ sơ | `src/lib/onboarding/profile.ts` |
| Chặn/cho qua trang | `src/proxy.ts` + `src/lib/onboarding/state.ts` |
| Hành vi riêng của môn | `src/lib/subjects/engine.ts` |
| Màu / spacing / theme | `src/app/globals.css` (token ở `:root`) |
| **Màu NGỮ NGHĨA** (success/warning/danger/destructive/info) | Token `--success/--warning/--danger/--destructive/--info` (+ `-soft`, `-border`) — **dùng thay vì gõ hex**. Trước đây "success" có 2 màu khác nhau; nay 1 nguồn |
| **Cỡ chữ / font** | Token `--text-display/heading/body/caption/label`, `--font-display/--font-body`, `--weight-*` — **không tự gõ `fontSize`** |
| Bo góc | `--radius-sm/md/lg/pill` — pill thay cho `99px`/`999px` gõ cứng |
| Độ kính (glass) | `--glass-blur`, `--glass-blur-sm`, `--glass-border-opacity` |
| Màu khi **đổi palette** | Grep `rgba(119, 117, 255` / `rgba(69, 217, 233` — màu gõ cứng ngoài `:root` **không tự đổi theo token** |
| Text hiển thị | `src/lib/i18n/dictionary.ts` |
| Nút nổi góc phải | `src/components/layout/FloatingActions.tsx` |
| Link tải APK | `src/config/app.ts` |
| **Số dư LXP hiển thị** | đọc `progress.lxpBalance` (`GET /api/streak`) — không tạo nguồn mới |
| **Điều kiện "đã xong" của challenge** | `buildChallengeState()` trong `src/types/index.ts` (**KHÔNG** đọc cột boolean `completed`) |
| Công thức XP/LXP/level | `src/lib/constants/xp.ts` |
| Điểm XP/LXP + streak khi học | `recordLearningActivity()` trong `src/services/learning-activity.service.ts` |
| Mở khoá achievement | `src/services/achievement.service.ts` |
| **Trạng thái / nội dung thẻ thưởng & challenge** | `src/components/rewards/` + `rewards.css` (**KHÔNG** sửa rule trong `globals.css`) |
| Lấy user hiện tại | `src/lib/auth/session.ts` → `getCurrentUserId()` |
| Model DB | `prisma/schema.prisma` |

---

## Bẫy đã gặp — đừng lặp lại

| Triệu chứng | Nguyên nhân thật |
|---|---|
| Text dính liền khi copy/đọc (`Số dư LXP279LXPĐổi…`) | Nhiều `<span>` **inline** cạnh nhau. Flex `gap` **không** tạo khoảng trắng trong DOM — phải là block có `margin`, hoặc tách bằng text node |
| Layout vỡ, rule CSS không áp dụng | Selector bị mất + `}` thiếu ở rule trước, nuốt mọi rule phía dưới. Chạy `npm run check:css` sau khi sửa CSS |
| **`<button>` trắng, font mặc định, text dính liền** | Đây KHÔNG phải lỗi JSX — 99% là **rule CSS thiếu `}`** khiến selector bị nest thành `A B` (selector không tồn tại trong DOM) nên không khớp element nào. Xem `docs/architecture/MOBILE.md` |
| **Nút "biến mất" mà JSX không đổi** | Selector **không tồn tại trong CSS engine đang dùng**. Đã gặp: `:host:hover` (web-component selector) trong `<style jsx>` → nhóm `.card-actions` kẹt `opacity:0` vĩnh viễn, nút Lưu/Tải xuống không hiện. Sửa bằng class thật trong `globals.css` |
| **Đổi màu ở `:root` mà app nửa đổi nửa không** | Màu gõ cứng `rgba()` **ngoài token** không đổi theo. Phải quét literal trong tất cả `.css` **và `.tsx`** (kể cả TS như `mindmap/layout.ts` vì export SVG/canvas không đọc được CSS var) |
| **Auth chết nhưng app vẫn chạy (chỉ `/api/auth/*` lỗi)** | 2 chỗ đọc env **khác nhau**: `layout.tsx` đọc `APP_URL`, `auth.ts` đọc `AUTH_URL` ⇒ `publicAuthUrl` undefined ⇒ `trustHost=false` ⇒ 503. Cả hai phải dùng chung `resolvePublicUrl()` ở `@/config/app` |
| **Chỉ `next dev` thấy ổn, `next start` thì hỏng** | `NODE_ENV !== "production"` làm `trustHost` tự `true`, che mất lỗi cấu hình auth. Luôn kiểm chứng bằng `next build && next start` + curl thật |
| **`insert_line` vào giữa file CSS làm hỏng cả khối** | Chèn rơi vào giữa comment đang mở (`/*` chưa có `*/`) ⇒ phần đuôi thành CSS thô ⇒ `Unknown word`. Chạy `npm run check:css` sau **mọi** lần sửa CSS |
| **`npm run build` fail với `EPERM ... query_engine-windows.dll.node`** | Tiến trình `node` khác (dev server) đang giữ file — **không phải lỗi code**. Dùng `npx next build` để kiểm chứng, hoặc tắt dev server |
| `{n}` hiện ra chữ `N` | Chuỗi i18n viết cứng chữ `N` thay vì `{n}`, và component không truyền params |
| "0/5" nhưng báo "Đã hoàn thành!" | UI tin cột boolean `completed` của DB thay vì `completedCount >= targetCount` |
| Mọi API chậm ~1s dù trả 200 | `Cache-Control: max-age=0, must-revalidate` ⇒ browser hỏi lại + tải lại toàn bộ bytes mỗi lần mở app. Dùng `ETag`/`304` |
| `/api/auth/session` gọi nhiều lần | 7 callsite `useSession()` **không** đồng nghĩa 7 request — tất cả dùng chung 1 `SessionProvider`. Kiểm tra `reactStrictMode` trước khi "sửa" |
| Sau khi sửa UI "không thấy gì đổi" | Token lấy từ `globals.css` (`:root`); sửa token ở file khác sẽ không có tác dụng |
| Build warn `Unknown at rule: @keyframes` | `@keyframes` **phải** ở `globals.css`. File `.css` của component đi qua PostCSS transform riêng của Next và không nhận at-rule này |
---

## Số liệu hiện tại (đo bằng lệnh, cập nhật khi code đổi)

| Hạng mục | Giá trị | Lệnh đo |
|---|---|---|
| Page trong `(app)` | **22** | `Get-ChildItem 'src/app/(app)' -Recurse -Filter page.tsx` |
| API route | **102** | `Get-ChildItem src/app/api -Recurse -Filter route.ts` |
| Component `ui/` | **16** | `Get-ChildItem src/components/ui -Filter *.tsx` |
| Nhóm component | **23** | `Get-ChildItem src/components -Directory` |
| File test | **38** | `Get-ChildItem src -Recurse -Filter *.test.ts` |
| Dòng `globals.css` | ~5.5k | `Get-Content src/app/globals.css` |
| Lệnh kiểm chứng | `npm run lint` · `npx tsc --noEmit` · `npm test` · `npm run build` · `npm run check:css` · `npm run check:form` · `npm run check:file-input` | |

## Các module thêm sau 2026-10-04 (chưa có mục riêng ở trên)

| Module | Vị trí | Ghi chú |
|---|---|---|
| Rewards / Cosmetics | `src/components/rewards/` · `src/lib/rewards/` · `src/services/reward-cosmetic.service.ts` · `prisma/seed/cosmetics.ts` | `/rewards` + `/api/rewards/*`. `auraColor` lưu trong DB (cố ý **không** đổi theo palette) |
| Achievements | `src/app/(app)/achievements/` · `src/services/achievement.service.ts` | `/api/achievements`, `/api/achievements/unlock` |
| API client helpers | `src/lib/api/` (`readApi`, `reviewDue`, `rewardsApi`) | `describeError()` ⇒ UI **không** bao giờ lộ `Failed to fetch` |
| Community helpers | `src/lib/community/topicOptions.ts` | `flattenTopicOptions()` cho Subject→Topic 2 tầng |
| Avatar URL | `src/lib/auth/avatarUrl.ts` | `resolveAvatarUrl()` gộp `User.image` + `User.avatarData` |
| Math | `src/lib/math/render.ts` · `segments.ts` | `src/components/math/SafeMath.tsx` render KaTeX |
| Config | `src/config/app.ts` | Thông tin APK + `PUBLIC_URL_ENV_NAMES` / `resolvePublicUrl` |
| Guard scripts | `scripts/check-css-nesting.mjs` · `check-file-input.mjs` · `check-form-inline.mjs` | Chống tái diễn 3 lỗi đã gặp — **chạy sau mỗi lần sửa CSS/form** |

## Design system — token nào dùng cho việc gì

Tất cả token khai ở `:root` trong `src/app/globals.css`, có bản riêng cho
`:root[data-theme="light"]`. **Không gõ hex trong component.**

| Nhóm | Token |
|---|---|
| Nền / chữ | `--bg` `--panel` `--panel-strong` `--panel-hover` `--text` `--text-dim` `--text-faint` |
| Viền | `--border` `--border-soft` `--border-hover` |
| Màu thương hiệu | `--indigo` `--indigo-strong` `--cyan` (`+ -soft`) · `--on-accent` |
| **Ngữ nghĩa** | `--success` `--warning` `--danger` `--destructive` `--info` (+ `-soft`, `-border`) |
| Chữ | `--text-display/heading/body/caption/label` · `--font-display/--font-body` · `--weight-*` |
| Bo góc | `--radius-sm/md/lg/pill` |
| Đổ bóng | `--shadow-sm/md/lg` · `--glow-indigo/cyan` |
| Kính (glass) | `--glass-blur` `--glass-blur-sm` `--glass-border-opacity` |
| **Nền "trũng"** | `--track-bg` `--track-border` `--spinner-track` `--spinner-head` `--workspace-bg` `--workspace-panel` `--scrollbar-thumb` |
| Mobile | `--safe-top/bottom/right` · `--bottom-nav-height/-offset` · `--fab-*` |
| Chuyển động | `--dur-instant/fast/slow` · `--ease-out/in-out/pop` |

> **Vì sao nhóm "Nền trũng" tồn tại:** trước đó các thanh tiến trình/spinner/
> workspace gõ cứng `rgba(255,255,255,.07)` — đúng ở dark, nhưng **vô hình** ở
> light. Mọi overlay nền phải qua token để 2 theme đảo chiều overlay.

## Cách tự đo lại số liệu (đừng tin số ghi tay)

```powershell
Get-ChildItem 'src/app/(app)' -Recurse -Filter page.tsx | Measure-Object
Get-ChildItem src/app/api -Recurse -Filter route.ts   | Measure-Object
Get-ChildItem src -Recurse -Filter *.test.ts          | Measure-Object
```

