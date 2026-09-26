# DATABASE

PostgreSQL + **pgvector**. Prisma 5. Schema: `prisma/schema.prisma` (~1300 dòng,
53 model, 16 enum).

## Nguyên tắc: JSON cho hồ sơ, bảng chuẩn hoá cho sự kiện học

| Loại dữ liệu | Nơi lưu | Ví dụ |
|---|---|---|
| Hồ sơ người học (ít ghi, đọc nhiều, shape thay đổi) | **cột `Json?`** | `User.learningProfile` |
| Mọi sự kiện học tập (ghi nhiều, query nhiều) | **bảng chuẩn hoá** | `Attempt`, `LearningProgress`, `ReviewItem` |

`User.learningProfile` là `Json?` ⇒ **mở rộng shape KHÔNG cần migration**. Đây là
lý do onboarding đổi 5 phase mà không phải `db push`.

Ngược lại: đừng đẩy dữ liệu query được vào JSON (analytics cần `GROUP BY`, index).

## Nhóm model

### Identity
`User` · `Account` · `Session` · `VerificationToken` (NextAuth)

`User` mang cột quan trọng: `onboardingStatus` (enum), `welcomeSeenAt`,
`firstLearningSessionAt`, `learningProfile` (Json), `learningProfileCompletedAt`.

### Học tập lõi
| Model | Unique key | Ghi bởi |
|---|---|---|
| `LearningProgress` | `[userId, subject, topic]` | `updateMastery()` |
| `Attempt` | — | Quiz + Diagnostic |
| `Exercise` | — | `Exercise` có `@@index([subject, topic])` |
| `ExerciseAttempt` | `[userId, exerciseId]` | Practice |
| `MistakeLog` | — | ghi 1 lần mỗi lần sai (input cho mistake-analysis) |
| `Assessment` | — | Diagnostic |
| `DiagnosticSession` | — | Diagnostic |
| `QuizQuestionCache` | `[questionId]` | giữ đáp án server-side, TTL 24h |

**`LearningProgress` là xương sống.** Mọi thứ — analytics, gợi ý ôn tập, prompt
AI, roadmap, subject progress — đều đọc từ đây. Đổi công thức mastery ở
`assessment.service.ts` ⇒ ảnh hưởng toàn hệ.

### Ôn tập (SM-2)
`ReviewItem` (`easeFactor`, `intervalDays`, `repetitions`, `lapses`, `nextReviewAt`)
+ `ReviewAttempt`. Index `[userId, nextReviewAt]`.

**Hệ thống SM-2 DUY NHẤT** — thuật toán ở
`services/spaced-repetition.service.ts`. Thêm Flashcard thì **tái dùng
`ReviewItem`**, đừng tạo bảng review riêng.

### Môn & tài liệu
`Subject` · `SubjectTopic` (có `parentId` ⇒ cây phân cấp) ·
`CommunityDocument` · `Document` · `DocumentChunk` (vector 768) · `LearningArtifact`

`Subject` là danh mục **cộng đồng, mở rộng dần** (có icon/color/order). Riêng
`lib/subjects/engine.ts` là registry **tĩnh** của phần lõi sản phẩm, phải chạy
được cả khi DB rỗng. Hai nguồn cố ý tách biệt — xem [SUBJECTS.md](./SUBJECTS.md).

### Gamification
`XPTransaction` · `PointTransaction` · `Streak` · `LearningDay` · `Achievement` ·
`UserAchievement` · `DailyChallenge` · `Reward` · `UserReward`

Công thức level ở `src/lib/constants/xp.ts` (không nằm trong DB).

### AI / hội thoại
`Conversation` · `TutorSession` · `AIRequestLog` · `LearningAgentPlan` · `LearningAgentTask`

## Migration

```bash
npm run db:migrate    # prisma migrate deploy
npm run db:generate   # prisma generate
npm run db:studio
```

> **KHÔNG BAO GIỜ** chạy `prisma migrate reset` trên DB có dữ liệu thật.
> Mọi cột mới phải **nullable hoặc có default** để migration tương thích ngược.
> Xem comment `20260928000000` (cột `learningProfile`) làm mẫu.

## Index đáng chú ý

| Model | Index | Lý do |
|---|---|---|
| `LearningProgress` | `[userId, subject, topic]` unique | key upsert mastery |
| `ReviewItem` | `[userId, nextReviewAt]`, `[userId, topic]` | lấy thẻ đến hạn |
| `Attempt` | `[userId, subject, topic]`, `[userId, createdAt]` | analytics theo môn + theo ngày |
| `MistakeLog` | `[userId, subject, topic]`, `[userId, createdAt]` | mistake-analysis |
| `Exercise` | `[subject, topic]`, `[difficulty]` | lọc ngân hàng bài |
| `DocumentChunk` | pgvector | similarity search |
| `LearningGoal` | `[userId, status, priority]` | sắp xếp mục tiêu |

**Chỉ thêm index khi đã phân tích query.** Đừng thêm bừa.

## Bảo mật

Mọi bảng dữ liệu học đều có `userId` + `onDelete: Cascade` từ `User`. Query
luôn kèm `where: { userId }` lấy từ session — **không** tin `userId` client
(xem [AUTH.md](./AUTH.md)).
