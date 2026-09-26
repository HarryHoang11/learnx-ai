# ARCHITECTURE CHANGELOG

Chỉ ghi thay đổi có **giá trị lâu dài** (module boundary, data flow, API, schema,
business logic, navigation). KHÔNG ghi: sửa typo, đổi margin, đổi tên biến.

Đọc file này **trước khi sửa** — để biết thay đổi gần đây có ảnh hưởng không.

---

## 2026-09-26 — Dọn dead code (audit PROVE BEFORE DELETE)

### [Cleanup] Xoá 15 file dead code + 4 thư mục rỗng

**Changed:**
- Xoá 12 component **0 tham chiếu** (đã chứng minh bằng import-graph + grep toàn repo; repo
  KHÔNG có dynamic import dạng biến/`next/dynamic`/`React.lazy` nên graph là đầy đủ):
  `components/FilterPanel.tsx` · `components/SearchBar.tsx` (legacy feature "tasks") ·
  `components/auth/LogoutButton.tsx` (thay bằng `account/AccountMenu.tsx`) ·
  `components/documents/CodeBlock.tsx` (thay bằng `MarkdownLite` render code inline) ·
  `components/ui/LevelHero.tsx` (thay bằng `ui/LevelProgressBar.tsx`) ·
  `components/ui/{Badge,ConfirmDialog,GlassCard,ProgressRing,Tabs,Tooltip}.tsx` ·
  `components/tutor/TutorSidePanel.tsx` + cascade `TutorModeBar.tsx` (chỉ được dùng bởi
  TutorSidePanel) + cascade `components/tutor/types.ts` (chỉ được dùng bởi 2 component trên).
- Xoá `lib/storage/localUpload.ts` — README đã ghi rõ là code cũ; `dbUpload.ts` thay thế hoàn toàn.
- Xoá 4 thư mục rỗng: `src/pages` (Pages Router thừa), `src/services/__tests__`,
  `src/app/api/agent/adapt`, `src/app/api/agent/plan/[id]`.

**Affected:** `src/components/**` · `src/lib/storage/` · `README.md` · `CHANGELOG.md`

**Impact:** không đổi hành vi runtime. CSS design-system trong `globals.css` (`.badge--*`,
`.toast--*`, `.tooltip`, `.tabs`, `.ring` …) **giữ nguyên** vì được ghép class động trong JSX
(rule "không xoá CSS chỉ vì search string không thấy"). `ui/Modal.tsx` + `ui/Drawer.tsx` giữ lại
dù 0 tham chiếu — đang được sửa trong working tree (rule: không xoá file user vừa chỉnh).

**Ghi nhận (không xoá — cần quyết định của user):** 26 API route không có caller tĩnh
(`/api/tutor/*` cũ, `/api/rewards/*`, `/api/daily-challenge*`, `/api/agent/*`,
`/api/diagnostic/{answer,result,session}` — đã bị flow `/api/assessment/*` thay thế,
`/api/analytics/{insights,overview}`, `/api/lxp/history`, `/api/learning/activity`,
`/api/review/create`, `/api/achievements*`); `services/document-quality.service.ts` (0 caller,
README còn mô tả); 4 gói không thấy import (`@supabase/ssr`, `@supabase/supabase-js`,
`@fontsource/noto-sans`, `@capacitor/browser`); 107 i18n key không thấy ngoài `dictionary.ts`
(nhiều key dùng động như `` t(`analytics.difficulty.${d}`) `` nên KHÔNG xoá tự động).

**Verification:** `tsc --noEmit` exit 0 · `npm run lint` 0 error / 23 warning (không đổi) ·
`npm test` 28 file / 357 test pass.

**Migration:** không có. Khôi phục file đã xoá: `git checkout HEAD -- <đường-dẫn>`.

---

## 2026-09-26 — Onboarding + Brand + Analytics + Multi-subject

Phiên này gồm 5 nhóm thay đổi kiến trúc độc lập.

### [Onboarding] Onboarding thành 5 phase + gate mềm

**Changed:**
- `/onboarding` chuyển sang **5 phase** với danh sách step **động theo nhóm người
  dùng** (học sinh / sinh viên / người đi làm / tự học).
- Thêm phase 04 **Kiểm tra năng lực**, phase 05 **Profile Ready**.
- Thêm mốc `learningProfile.surveyDecidedAt` — cờ "đã chốt khảo sát".
- Thêm **gate mềm**: `LEARNING_GATE_PATHS` + `needsLearningProfile()`.
- `postLoginDestination()` **giữ nguyên** (21 test cũ vẫn xanh).

**Affected:** `LearningOnboarding.tsx` · `ProfileReady.tsx` · `onboarding.css` ·
`lib/onboarding/{steps,options,state,profile,client}.ts` ·
`services/onboarding.service.ts` · `api/onboarding/route.ts` · `auth.ts` ·
`proxy.ts` · `dictionary.ts` · 4 file test

**Impact:**
- Câu hỏi khảo sát **đổi theo nhóm** — mỗi nhóm thấy đúng bước của nhóm đó.
- `/roadmap`, `/diagnostic`, `/practice`, `/library` redirect `/onboarding` khi chưa
  chốt. **`/dashboard` cố ý KHÔNG bị chặn** (có test khoá lại).

**Migration:** không có — `learningProfile` là cột `Json?`, chỉ mở rộng shape.

---

### [Onboarding] Sửa lỗi vòng lặp khi bấm "Bắt đầu học theo lộ trình"

**Changed:** `ProfileReady.tsx` — gộp `goDashboard()` → `leaveTo(path)`, gọi
`complete_survey` **trước** khi điều hướng; thêm state `leaving` (disable +
`aria-busy` + spinner, chặn double-click).

**Root cause:** nút roadmap gọi thẳng `router.push("/roadmap")` mà không ghi
`surveyDecidedAt`; `/roadmap` nằm trong gate ⇒ bị kéo về `/onboarding` ⇒ bấm lại
lặp lại, **không bao giờ ra khỏi màn hồ sơ**.

**Lesson:** mọi nút rời khỏi `/onboarding` phải đi qua `leaveTo()`. Gọi
`router.push` trực tiếp tới path bị gate là bug.

---

### [Brand] Logo + app download thành hệ thống dùng chung

**Changed:**
- `public/brand/learnx-mark.svg` là **nguồn duy nhất** (web + favicon + PWA +
  Android adaptive icon).
- `src/components/brand/LearnXLogo.tsx` — cửa ngõ duy nhất được render logo.
- Xoá `AndroidAppCard.tsx` + 248 dòng CSS, thay bằng
  `src/components/mobile/AppDownloadBlock.tsx`.
- Thêm `AppDownloadBubble.tsx` + `FloatingActions.tsx` (cột nổi chung cho AI
  Assistant + App Download).
- `metadata`: icons, apple, manifest, OpenGraph, Twitter.

**Root cause (lỗi chồng chữ ở Profile Ready):** thẻ APK cũ xếp
`QR | chữ | 2 nút` trong **một hàng `nowrap`** + breakout
`margin-left:50% + translateX(-50%)` (chỉ đúng khi cha rộng = viewport). Tái dùng
trong khung 620px ⇒ chữ tràn **đè lên nút**, thẻ tràn 2 mép bị cắt, QR bị
`display:none` dưới 1099px. Sửa bằng cột dọc tuần tự trong normal flow.

**Lesson:** thêm UI tải app — dùng `AppDownloadBlock` (khối) hoặc
`AppDownloadBubble` (nổi). Không tạo thẻ APK mới.

---

### [Analytics] Bổ sung 2 biểu đồ còn thiếu

**Changed:**
- **Phân bổ thời gian theo môn** (`subjectTimeShare`) — SQL `GROUP BY subject` trên
  `LearningSession`, dùng **cùng công thức** `COALESCE(completedAt, startedAt)` với
  KPI thời gian học.
- **Đúng / Sai / Chưa hoàn thành** (`outcomes`) — `Attempt` UNION
  `ExerciseAttempt`; "chưa hoàn thành" tách riêng khỏi "sai".
- Tạo `src/services/analytics/outcomes.ts` — hàm thuần có docstring định nghĩa metric.
- Tạo `scripts/verify-analytics-sql.mjs` — verify SQL với DB thật (chỉ đọc).

**Impact:** `/progress` là trang **Study Analytics** (đã có trong nav, không tạo
route `/analytics` trùng). Số liệu 100% từ DB — không có fallback fake data.

**Verified:** SQL thật trên DB dev → `{"correct":23,"incorrect":13}` từ 36 Attempt
(23+13=36 khớp tuyệt đối).

---

### [Subjects] Tạo Subject Engine — nền tảng đa môn

**Changed:**
- Tạo `src/lib/subjects/engine.ts`: registry 9 môn (Toán, Tiếng Anh, Vật lý, Hóa
  học, Sinh học, Tin học, Ngữ văn, Lịch sử, Địa lý) với `QuestionType` (26 loại),
  `CardField` (19 trường), `SkillNode` taxonomy, `promptGuidance`.
- Tạo `src/lib/subjects/progress.ts`: `summarizeBySubject`, `pickFocusSubject`,
  `pickWeakestTopic` — **hàm thuần**, có test.
- `buildQuestionGenPrompt()` nhận `context` **tuỳ chọn** (questionType, gradeLevel,
  mastery) → prompt Toán khác prompt Tin học, **vẫn qua 1 AI Router**.
- `quiz.service.ts` đọc `LearningProgress.mastery` + `educationStage/grade` thật
  trước khi sinh câu hỏi.
- Tạo `readGradeLevel()` trong `lib/personalization/context.ts`.
- Tạo `SubjectSwitcher` + `SubjectProgressPanel`; mount vào `/practice` + `/dashboard`.
- Thay ô text "môn học" ở `/practice` bằng chip chuyển môn.

**Quyết định tránh trùng lặp (quan trọng cho agent sau):**
- **Không** tạo bảng mastery thứ 2 → dùng `LearningProgress` có sẵn.
- **Không** tạo thuật toán adaptive thứ 2 → `nextDifficulty()` **uỷ chuyển**
  `pickNextDifficulty()` sẵn có, nhận hàm làm tham số.
- **Không** tạo AI provider riêng cho môn → chỉ thêm `promptGuidance`.
- **Không** sửa `lib/constants/subjects.ts` (6 consumer) → engine tách file riêng.
- **Không** migration: schema đã đủ `subject`/`topic`/`difficulty` ở mọi bảng.

**Bug tự bắt được nhờ test:** `slug` tiếng Việt có dấu → URL hỏng. Đã sửa bằng
`toSlug()` (NFD + bỏ dấu).

→ Chi tiết: [SUBJECTS.md](./SUBJECTS.md)

---

## 2026-09-26 (trước đó) — Onboarding bug fix

### [Onboarding] `cleanString` gộp 3 trạng thái vào `undefined`

**Changed:** thay bằng `readTextField()` trả discriminated union 4 nhánh
(`absent` / `clear` / `value` / `invalid`) cho `field`, `topics`, `futureGoal`,
`otherSubject`.

**Root cause:** frontend cố ý gửi `""` làm tín hiệu "đã xoá ô", nhưng sanitizer
loại `""` **trước khi** tới `mergeLearningProfile` ⇒ tín hiệu xoá bị huỷ ⇒ user
xoá "Kinh tế" nhưng DB vẫn giữ. `otherSubject` bị lỗi **im lặng**.

**Migration:** không có.

---

## Mẫu thêm thay đổi

```md
## YYYY-MM-DD

### [Tên module]

Changed:
- ...

Affected:
- file1 · file2

Impact:
- Ảnh hưởng hành vi gì.

Migration:
- None. | mô tả migration + cách rollback.
```