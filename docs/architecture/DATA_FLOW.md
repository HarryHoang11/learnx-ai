# DATA FLOW

Các luồng dữ liệu chính. Khi sửa code làm đổi một luồng, cập nhật file này.

## 1. Luồng vào app (lần đầu)

```
/login · /register
      ↓ NextAuth (credentials | Google)
   User + Account trong DB
      ↓
src/proxy.ts: welcomeSeenAt = null ⇒ redirect /welcome
      ↓
/welcome  (WelcomeExperience.tsx)
      ↓ PATCH /api/onboarding { action: "complete_welcome" }
   User.onboardingStatus = EXPLORING, welcomeSeenAt = now
      ↓
/onboarding  (LearningOnboarding.tsx — 5 phase)
      ↓ mỗi bước: PATCH { action: "save_learning_profile", ...profile }
   User.learningProfile (JSON)  ← upsert từng phần
      ↓ phase 04: /diagnostic?from=onboarding
   Assessment + Attempt + QuizQuestionCache + LearningProgress
      ↓ phase 05
/profile-ready (ProfileReady.tsx)
      ↓ PATCH { action: "complete_survey" }
   learningProfile.surveyDecidedAt = now
      ↓
/dashboard
```

**Điểm mấu chốt**: `surveyDecidedAt` là cờ tắt gate. Xem
[ONBOARDING.md](./ONBOARDING.md) § Gate mềm.

## 2. Luồng học (vòng lặp chính)

```
Practice / Quiz / Document / Mind Map
      ↓
   Attempt hoặc ExerciseAttempt  (bản ghi lịch sử đầy đủ)
      ↓
   updateMastery()  ← assessment.service.ts
      ↓ upsert LearningProgress[userId, subject, topic]
   learningProfile (JSON) + LearningProgress
      ↓
┌─────────────┬────────────────┬────────────────┐
↓             ↓                ↓                ↓
Analytics   Recommendations  Review (SM-2)   AI context
(progress)  (focusAreas)     (ReviewItem)    (buildLearningContext)
      ↓             ↓                ↓
/progress   Dashboard panel    /review         Tutor / Quiz sinh câu hỏi
                                        nhắm đúng điểm yếu
      └─────────────┴────────────────┘
                    ↓
            "Bước tiếp theo nên làm gì?"
```

**Mastery là xương sống**: mọi thứ (analytics, gợi ý ôn tập, prompt AI, roadmap)
đều đọc từ `LearningProgress`. Đổi công thức mastery ⇒ ảnh hưởng toàn hệ.

## 3. Luồng AI

```
Service (quiz / tutor / roadmap / diagnostic)
      ↓
src/lib/ai/router.ts  — DEFAULT_AI_PROVIDERS
      ↓ lần lượt thử, có timeout + retry
Gemini → Groq → OpenRouter (→ DeepSeek)
      ↓ validate JSON bằng hàm normalize
   GeneratedQuestion / object có type
      ↓
   QuizQuestionCache (nếu là quiz — để chấm server-side, không lộ đáp án)
      ↓
   Attempt + updateMastery
```

Chi tiết provider, fallback, prompt: [AI_SYSTEM.md](./AI_SYSTEM.md).

### 3.1 Luồng "Bắt đầu kiểm tra" (`POST /api/assessment/start`)

```
Nút "Bắt đầu kiểm tra"  (app)/diagnostic/page.tsx
      ↓ validate: effectiveSubject.trim() rỗng → toast, KHÔNG gọi API
      ↓ chặn double-click bằng useRef (cùng tick, không chờ render)
      ↓ nút chuyển sang "Đang chuẩn bị..." + spinner, KHÔNG thay cả trang
POST /api/assessment/start { subject }
      ↓ getCurrentUserId() — userId lấy từ session, KHÔNG tin client
      ↓ 401 nếu chưa đăng nhập / session hết hạn
      ↓ sinh câu hỏi đầu tiên (easy) qua AI router  ← TRƯỚC
      ↓ tái dùng Assessment in_progress gần đây nếu có & chưa trả lời
   Assessment (status=in_progress)                  ← SAU
      ↓
{ assessmentId, question }  → phase = "in_progress" (cùng trang, không router.push)
```

Ba điểm dễ sai, đã ghi comment trong code:

1. **Sinh câu hỏi TRƯỚC, tạo Assessment SAU.** Ngược lại thì mỗi lần AI chết
   (503/quota) là đẻ thêm 1 dòng `in_progress` không bao giờ dùng.
2. **Khử trùng ở server, không chỉ ở client.** Ref chặn double-click trong 1
   tab, nhưng request bị abort rồi bấm lại vẫn tạo phiên thứ hai. Route tái
   dùng phiên `in_progress` cùng môn, mở trong 2 phút và **chưa có Attempt**.
   Sau khi đã trả lời câu nào thì bấm lại là làm bài mới → vẫn tạo phiên mới.
3. **Câu hỏi không gắn với dòng Assessment** (nó nằm ở `QuizQuestionCache`),
   nên tái dùng phiên + sinh câu đầu mới vẫn đúng logic chấm điểm.

Client có timeout (`START_TIMEOUT_MS` = 75s, lớn hơn tổng thời gian AI router
có thể mất) để request treo không thành loading vô hạn; 401 thì toast +
`router.push("/login")`; lỗi khác thì màn `error` kèm nút "Thử lại" gọi lại
**đúng bước đã hỏng** (`failedStep`).

## 4. Luồng tài liệu (RAG)

```
Upload → Document (status: PROCESSING)
      ↓ extractText: PDF / DOCX / MD
   DocumentChunk (embedding vector 768, pgvector)
      ↓ tìm kiếm vector similarity
   Context cho Quiz / Tutor / Summary / Flashcards / Study Guide
      ↓
LearningArtifact (kết quả sinh ra: summary, mindmap, flashcards...)
```

## 5. Luồng phân quyền (quan trọng)

```
Request → src/proxy.ts
      ↓ đọc session (JWT)
   authed? ─no→ redirect /login
      │ yes
      ↓
   next({ request: { headers } })  ← auth.ts re-wrap session
      ↓ route handler gọi getCurrentUserId()
   userId TỪ SESSION
      ↓ mọi query đều where: { userId }
```

**Không bao giờ** nhận `userId` từ body/query của client làm nguồn sự thật.
Xem [AUTH.md](./AUTH.md).

## 6. Luồng môn học (multi-subject)

```
SUBJECT_ENGINES (lib/subjects/engine.ts)  ← registry tĩnh
      ↓ withSubject(subject) — luôn trả engine hợp lệ
   QuestionType + CardField + skillTaxonomy + promptGuidance
      ↓
   buildQuestionGenPrompt()  ← chèn promptGuidance + mastery thật
      ↓
   AI Router (CHUNG — không tạo provider riêng cho từng môn)
      ↓
   Attempt → LearningProgress
      ↓
   summarizeBySubject()  (lib/subjects/progress.ts — hàm thuần)
      ↓
   SubjectProgressPanel (Dashboard) / SubjectSwitcher (Practice)
```

Chi tiết: [SUBJECTS.md](./SUBJECTS.md).

## 7. Bảng "ai đọc/ghi model nào"

| Module | Đọc | Ghi |
|---|---|---|
| Onboarding | `User`, `LearningGoal`, `Roadmap` | `User.learningProfile`, `User.onboardingStatus`, `LearningGoal` |
| Quiz / Assessment | `User`, `LearningProgress`, `LearningGoal` | `Attempt`, `QuizQuestionCache`, `LearningProgress`, `MistakeLog` |
| Practice | `Exercise`, `RoadmapResource` | `ExerciseAttempt` |
| Review | `ReviewItem` | `ReviewItem`, `ReviewAttempt` |
| Diagnostic | `User`, `LearningProgress` | `DiagnosticSession`, `Attempt` |
| Roadmap | `LearningGoal`, `LearningProgress`, `MistakeLog` | `Roadmap`, `RoadmapResource` |
| Analytics | `Attempt`, `LearningProgress`, `LearningSession`, `StudySession`, `ReviewAttempt`, `XPTransaction` | `AIRequestLog` (log lời gọi AI) |
| Tutor | `Conversation`, `TutorSession`, `LearningProgress` | `TutorSession`, `Conversation` |
| Documents | `Document`, `DocumentChunk` | `Document`, `DocumentChunk`, `LearningArtifact` |
| Gamification | `XPTransaction`, `Streak` | `XPTransaction`, `PointTransaction`, `Streak`, `LearningDay` |
