# LearnX AI — Backend Next.js + Prisma + Gemini

Đây là phần **backend thật** (API routes + database schema) nối tiếp bản demo giao diện HTML tĩnh trước đó. Mục tiêu: biến các API giả lập trong bản demo thành API thật, có thể gọi Gemini và ghi/đọc Postgres.

## 1. Vì sao tách nhiều file như vậy?

Nguyên tắc xuyên suốt dự án: **route mỏng, service dày**.

```
app/api/**/route.ts     → CHỈ parse request, gọi service, trả JSON.
                           Không chứa logic nghiệp vụ.
services/*.service.ts   → Chứa TOÀN BỘ logic nghiệp vụ (adaptive
                           difficulty, tính mastery, sinh roadmap...).
lib/*                   → Các "công cụ" dùng chung, không đặc thù
                           cho 1 tính năng nào (gọi Gemini, ký JWT,
                           kết nối Prisma, tính embedding).
```

Lý do: nếu 1 năm sau bạn đổi Gemini sang Claude/OpenAI, chỉ cần sửa `lib/ai/gemini.ts`. Nếu đổi công thức tính mastery, chỉ cần sửa `services/assessment.service.ts`. Không route nào bị ảnh hưởng.

## 2. Cấu trúc thư mục

```text
learnx-ai/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── public/
│   ├── images/
│   └── icons/
│
├── src/
│   │
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── register/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   │
│   │   ├── (app)/
│   │   │   ├── layout.tsx
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── tutor/
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── diagnostic/
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── roadmap/
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── progress/
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── library/
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   └── schedule/
│   │   │       └── page.tsx
│   │   │
│   │   └── api/
│   │       │
│   │       ├── auth/
│   │       │   ├── login/
│   │       │   │   └── route.ts
│   │       │   ├── register/
│   │       │   │   └── route.ts
│   │       │   ├── logout/
│   │       │   │   └── route.ts
│   │       │   └── session/
│   │       │       └── route.ts
│   │       │
│   │       ├── ai/
│   │       │   ├── chat/
│   │       │   │   └── route.ts
│   │       │   └── hint/
│   │       │       └── route.ts
│   │       │
│   │       ├── assessment/
│   │       │   ├── start/
│   │       │   │   └── route.ts
│   │       │   ├── answer/
│   │       │   │   └── route.ts
│   │       │   └── result/
│   │       │       └── route.ts
│   │       │
│   │       ├── quiz/
│   │       │   ├── generate/
│   │       │   │   └── route.ts
│   │       │   └── submit/
│   │       │       └── route.ts
│   │       │
│   │       ├── roadmap/
│   │       │   ├── route.ts
│   │       │   └── generate/
│   │       │       └── route.ts
│   │       │
│   │       ├── documents/
│   │       │   ├── route.ts
│   │       │   ├── upload/
│   │       │   │   └── route.ts
│   │       │   └── process/
│   │       │       └── route.ts
│   │       │
│   │       ├── progress/
│   │       │   └── route.ts
│   │       │
│   │       ├── analytics/
│   │       │   └── route.ts
│   │       │
│   │       └── schedule/
│   │           ├── route.ts
│   │           └── today/
│   │               └── route.ts
│   │
│   ├── components/
│   │   │
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Topbar.tsx
│   │   │   └── MobileNav.tsx
│   │   │
│   │   ├── ui/
│   │   │   ├── Panel.tsx
│   │   │   ├── StatCard.tsx
│   │   │   ├── SkillBar.tsx
│   │   │   ├── StateMessage.tsx
│   │   │   ├── Button.tsx
│   │   │   └── Modal.tsx
│   │   │
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── RegisterForm.tsx
│   │   │   └── OAuthButtons.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── TodaySchedule.tsx
│   │   │   ├── ProgressOverview.tsx
│   │   │   ├── SkillOverview.tsx
│   │   │   └── DailyGoal.tsx
│   │   │
│   │   ├── tutor/
│   │   │   └── ChatBubble.tsx
│   │   │
│   │   ├── roadmap/
│   │   │   ├── RoadmapCard.tsx
│   │   │   └── RoadmapTimeline.tsx
│   │   │
│   │   ├── progress/
│   │   │   ├── ProgressChart.tsx
│   │   │   └── AchievementCard.tsx
│   │   │
│   │   └── schedule/
│   │       ├── StudyCalendar.tsx
│   │       ├── ScheduleCard.tsx
│   │       └── TodayTimeline.tsx
│   │
│   ├── lib/
│   │   ├── db/
│   │   │   └── prisma.ts
│   │   │
│   │   ├── ai/
│   │   │   ├── gemini.ts
│   │   │   └── prompts.ts
│   │   │
│   │   ├── auth/
│   │   │   ├── session.ts
│   │   │   ├── password.ts
│   │   │   └── oauth.ts
│   │   │
│   │   ├── embeddings/
│   │   │   └── vector.ts
│   │   │
│   │   └── utils/
│   │       └── ...
│   │
│   ├── services/
│   │   ├── assessment.service.ts
│   │   ├── quiz.service.ts
│   │   ├── roadmap.service.ts
│   │   ├── tutor.service.ts
│   │   ├── document.service.ts
│   │   ├── progress.service.ts
│   │   ├── analytics.service.ts
│   │   ├── schedule.service.ts
│   │   └── auth.service.ts
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   └── middleware.ts
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json
├── next.config.js
└── README.md
```

### Vai trò của từng khu vực

**`prisma/`**

Chứa database schema và migration của PostgreSQL. Prisma là lớp ORM dùng để giao tiếp giữa ứng dụng và database.

**`src/app/(auth)/`**

Các trang xác thực người dùng:

* Đăng nhập bằng email/password.
* Đăng ký tài khoản.
* Đăng nhập bằng Google.
* Đăng nhập bằng Facebook.
* Quản lý trạng thái phiên đăng nhập.

**`src/app/(app)/`**

Các trang chính dành cho học sinh sau khi đăng nhập:

* `/dashboard` — Tổng quan việc học trong ngày.
* `/tutor` — AI Gia sư.
* `/diagnostic` — Kiểm tra năng lực đầu vào.
* `/roadmap` — Lộ trình học cá nhân hóa.
* `/progress` — Theo dõi tiến độ và năng lực.
* `/library` — Thư viện tài liệu.
* `/schedule` — Lịch học và kế hoạch học tập.

Route group `(app)` không xuất hiện trong URL. Ví dụ:

```text
src/app/(app)/dashboard/page.tsx
→ /dashboard
```

### Dashboard và lịch học

Dashboard được thiết kế để học sinh có thể nhìn nhanh **hôm nay cần học gì và đang tiến độ đến đâu**.

Các thông tin chính gồm:

```text
┌─────────────────────────────────────────────┐
│ HÔM NAY                                     │
│                                             │
│ 🔥 Streak       📚 Bài tập      🎯 Tiến độ │
│                                             │
│ Lịch học hôm nay                            │
│ ├─ 08:00  Toán — Hàm số                    │
│ ├─ 14:00  Tin — Dynamic Programming        │
│ └─ 19:30  Anh — Reading                    │
│                                             │
│ Tiến độ hôm nay                             │
│ ███████████████░░░░░  75%                  │
│                                             │
│ Mục tiêu tiếp theo                          │
│ → Hoàn thành Topic: Segment Tree            │
└─────────────────────────────────────────────┘
```

`/api/schedule/today` cung cấp dữ liệu cho phần lịch học trong ngày.

`/api/progress` cung cấp dữ liệu về số bài đã làm, độ chính xác, streak và mức độ thành thạo.

### `src/components/`

Chứa các React component dùng lại giữa nhiều trang.

Các component giao diện được tách khỏi page để tránh việc một file `page.tsx` trở nên quá lớn.

Ví dụ:

```text
dashboard/page.tsx
        │
        ├── TodaySchedule
        ├── ProgressOverview
        ├── SkillOverview
        └── DailyGoal
```

### `src/lib/`

Chứa các thư viện và tiện ích cấp thấp dùng chung:

* Kết nối Prisma.
* Gemini AI.
* Authentication.
* OAuth.
* Session.
* Embedding và vector search.

### `src/services/`

Chứa logic nghiệp vụ chính của LearnX.

Nguyên tắc:

```text
API Route
   ↓
Service
   ↓
Prisma / Gemini / External API
```

API route chỉ xử lý request/response, còn service chịu trách nhiệm xử lý nghiệp vụ.

### `src/middleware.ts`

Middleware dùng để kiểm tra authentication và bảo vệ các route yêu cầu đăng nhập.

Các trang như:

```text
/dashboard
/tutor
/roadmap
/progress
/library
/schedule
```

có thể yêu cầu người dùng đăng nhập trước khi truy cập.

### `src/types/`

Chứa các TypeScript type/interface dùng chung giữa frontend, API routes và services.

---

## Nguyên tắc kiến trúc

LearnX sử dụng mô hình:

```text
                    ┌─────────────────┐
                    │    Next.js UI   │
                    │  React Pages    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   API Routes    │
                    │  route.ts       │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    Services     │
                    │ Business Logic  │
                    └───────┬─┬───────┘
                            │ │
                 ┌──────────┘ └──────────┐
                 ▼                       ▼
        ┌─────────────────┐     ┌─────────────────┐
        │ Prisma/Postgres │     │   Gemini AI     │
        │    Database     │     │      RAG        │
        └─────────────────┘     └─────────────────┘
```

Nguyên tắc chính:

**Route mỏng — Service dày — Lib dùng chung.**

Nhờ đó frontend, API và business logic được tách biệt, giúp dự án dễ bảo trì và mở rộng.
```

Mỗi file đều có comment đầu file giải thích **vì sao** nó tồn tại và **vì sao** logic được chia như vậy — đọc comment trước khi đọc code sẽ dễ hiểu mạch suy nghĩ hơn.

## 3. Chạy thử local

```bash
# 1. Cài dependency
npm install

# 2. Tạo file .env từ mẫu, điền DATABASE_URL và GEMINI_API_KEY thật
cp .env.example .env

# 3. Bật extension pgvector trên Postgres (chạy 1 lần duy nhất)
#    Nếu dùng Supabase: vào SQL Editor, chạy:
#    CREATE EXTENSION IF NOT EXISTS vector;

# 4. Đẩy schema lên database
npm run db:push
npm run db:generate

# 5. Chạy dev server
npm run dev
# Mở http://localhost:3000 — sẽ tự chuyển vào /dashboard
```

## 4. Vì sao có "demo user" mặc định?

`lib/auth/session.ts` có hàm `getSessionOrDemoUser()` — nếu chưa đăng nhập, mọi API vẫn chạy được với 1 `userId` giả cố định (`demo-user-id`). Mục đích: khi đem đi thi, ban giám khảo bấm thử ngay được mà không cần luồng đăng ký/đăng nhập đầy đủ. **Trước khi lên production thật, cần:**
- Thay bằng NextAuth hoặc Supabase Auth.
- Xoá/khoá fallback demo user (chỉ bật qua biến môi trường riêng cho môi trường demo).

## 5. Giao diện (đã ghép xong)

Toàn bộ giao diện dark + glassmorphism từ bản demo HTML tĩnh trước đó đã được ghép thành các trang Next.js THẬT, gọi thẳng vào API đã xây (không còn dữ liệu giả lập):

```
src/app/globals.css                Theme dùng chung (biến màu, panel, nút...)
src/app/layout.tsx                 Nạp font Space Grotesk + Inter
src/app/(app)/layout.tsx           Khung Sidebar + Topbar cho mọi trang chính
src/app/(app)/dashboard/page.tsx   Trang chủ — gọi /api/progress
src/app/(app)/tutor/page.tsx       AI Gia sư — gọi /api/ai/chat, /api/ai/hint
src/app/(app)/diagnostic/page.tsx  Kiểm tra năng lực — gọi /api/assessment/*
src/app/(app)/roadmap/page.tsx     Lộ trình học — gọi /api/roadmap, /api/roadmap/generate
src/app/(app)/progress/page.tsx    Tiến độ — gọi /api/progress, /api/analytics
src/app/(app)/library/page.tsx     Thư viện — gọi /api/documents, /api/documents/upload
src/components/layout/             Sidebar, Topbar (dùng chung mọi trang)
src/components/ui/                 Panel, StatCard, SkillBar, StateMessage (dùng lặp lại nhiều nơi)
src/components/tutor/ChatBubble.tsx Bong bóng chat (dùng trong trang Tutor)
```

`(app)` là route group của Next.js — không xuất hiện trong URL, chỉ dùng để nhóm các trang cần chung Sidebar/Topbar. Vào `/dashboard`, `/tutor`, `/roadmap`... vẫn đúng như URL thường.

Có thêm 1 route backend mới so với trước: `GET /api/documents` (liệt kê tài liệu đã upload) — cần thiết để trang Thư viện hiển thị dữ liệu thật.

## 6. Việc CHƯA làm (nằm ngoài phạm vi MVP, ghi rõ để không quên)

- Retry xử lý tài liệu lỗi (`api/documents/process` action `retry`) cần lưu thêm `rawText` gốc — hiện DB chỉ lưu chunk đã xử lý.
- Xử lý upload tài liệu hiện chạy trực tiếp trong request (`await file.text()`), nên dùng queue thật (BullMQ/Redis) khi tài liệu lớn hoặc traffic cao.
- Roadmap chưa tự động cập nhật trạng thái `done` khi học sinh hoàn thành 1 topic — cần thêm logic nối `LearningProgress` với `Roadmap.months` (đã ghi TODO trong `roadmap.service.ts`).
- Trang Tutor hiện cố định `topic = "Toán — Đại số"` — nên thêm dropdown chọn môn/chủ đề khi mở rộng.
- Achievements (huy hiệu) ở trang Progress chưa có API riêng, có thể thêm `GET /api/achievements` khi cần.

## 7. Danh sách API đã có

| Method | Endpoint | Việc gì |
|---|---|---|
| POST | `/api/ai/chat` | Chat với AI Tutor (Socratic) |
| POST | `/api/ai/hint` | Xin gợi ý theo cấp độ 🟢🟡🔴 |
| POST | `/api/assessment/start` | Bắt đầu Diagnostic Test |
| POST | `/api/assessment/answer` | Trả lời câu hỏi, nhận câu tiếp theo (adaptive) |
| GET | `/api/assessment/result` | Hồ sơ năng lực sau khi làm bài |
| POST | `/api/quiz/generate` | Sinh câu hỏi luyện tập theo chủ đề |
| POST | `/api/quiz/submit` | Chấm câu trả lời luyện tập |
| GET | `/api/roadmap` | Lấy lộ trình mới nhất |
| POST | `/api/roadmap/generate` | Tạo/tái sinh lộ trình học |
| POST | `/api/documents/upload` | Upload tài liệu (PDF/Word/ảnh) |
| POST | `/api/documents/process` | Retry xử lý, hoặc hỏi-đáp dựa trên tài liệu (RAG) |
| GET | `/api/progress` | Số liệu dashboard tiến độ |
| GET | `/api/analytics` | Nhận xét bằng lời do AI sinh (7 ngày gần nhất) |
| GET | `/api/documents` | Danh sách tài liệu đã upload (phục vụ trang Thư viện) |
