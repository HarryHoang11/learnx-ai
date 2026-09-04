# LearnX AI

Nền tảng học tập thích ứng bằng AI — Next.js App Router + Prisma + NextAuth v5 (Auth.js) + Gemini.

> **Lưu ý về repo này:** đây là bản chia sẻ đã lược bỏ `package.json`, `.env*`, `.gitignore`, `node_modules`, `.next` và các file Prisma migration để tránh lộ khoá bí mật và giảm dung lượng. Xem mục [8. Những gì đã được lược bỏ khỏi repo này](#8-những-gì-đã-được-lược-bỏ-khỏi-repo-này) trước khi cố chạy project.

---

## 1. Triết lý kiến trúc

Nguyên tắc xuyên suốt: **route mỏng, service dày**.

```
app/api/**/route.ts     → CHỈ parse request, kiểm tra session, gọi service, trả JSON.
                           Không chứa logic nghiệp vụ.
services/*.service.ts   → Chứa TOÀN BỘ logic nghiệp vụ (adaptive difficulty,
                           tính mastery, sinh roadmap, lịch học...).
lib/*                   → Công cụ dùng chung, không đặc thù cho 1 tính năng
                           nào (gọi Gemini, kết nối Prisma, session, embedding).
```

Toàn bộ sản phẩm xoay quanh một khái niệm trung tâm: **Hồ sơ năng lực (Skill Profile)** của từng học sinh — bảng `LearningProgress` (mastery 0–1 theo từng `subject`/`topic`). Mọi tính năng khác đều NUÔI hồ sơ này (Assessment, Attempt) hoặc DÙNG hồ sơ này để cá nhân hoá (Roadmap, AI Tutor, đề xuất trên Dashboard). Bài kiểm tra năng lực là **adaptive thật**: độ khó câu hỏi tăng/giảm theo đúng/sai của câu trước (`services/assessment.service.ts` → `pickNextDifficulty`), không phải kịch bản dựng sẵn.

Tính năng tài liệu (Library) dùng **RAG** thật: tài liệu được chunk nhỏ → embedding bằng Gemini → lưu vào Postgres qua `pgvector` → khi hỏi, tìm chunk gần nhất bằng similarity search rồi mới đưa cho Gemini trả lời, để AI không bịa kiến thức ngoài tài liệu.

---

## 2. Cấu trúc thư mục (đúng như hiện có)

```
prisma/
└── schema.prisma              Toàn bộ model DB (xem mục 4)

src/
├── auth.ts                    Cấu hình NextAuth v5 trung tâm (Google + Credentials)
├── middleware.ts               Bảo vệ trang riêng tư, redirect /login nếu chưa đăng nhập
│
├── app/
│   ├── layout.tsx              Root layout: font, SessionProvider, suppressHydrationWarning (cả <html> lẫn <body>)
│   ├── page.tsx                 Redirect "/" -> "/dashboard"
│   ├── globals.css              Theme dark + glassmorphism + responsive (drawer mobile, grid utilities, modal, form, profile)
│   ├── icon.png                  Favicon TĨNH (không dùng next/og ImageResponse — xem mục 9 lý do)
│   │
│   ├── login/page.tsx            Đăng nhập: Google (có icon 4 màu) hoặc Email + Password (PasswordInput có toggle hiện/ẩn)
│   ├── register/page.tsx         Đăng ký: Google hoặc Email + Password + Xác nhận mật khẩu (validate khớp ở client)
│   │
│   ├── (app)/                   Route group dùng chung AppShell (Sidebar + Topbar + drawer mobile)
│   │   ├── layout.tsx            Chỉ bọc <AppShell> — KHÔNG tự giữ state, xem components/layout/AppShell.tsx
│   │   ├── dashboard/page.tsx    Trang chủ: stats, lịch hôm nay, đề xuất ôn tập
│   │   ├── calendar/page.tsx     Lịch học: tab Hôm nay/Tuần/Tháng + tạo buổi học (bảng tuần cuộn ngang trên mobile)
│   │   ├── diagnostic/page.tsx   Kiểm tra năng lực (adaptive)
│   │   ├── tutor/page.tsx        AI Gia sư (Socratic hint 3 cấp độ)
│   │   ├── roadmap/page.tsx      Lộ trình học theo mục tiêu
│   │   ├── progress/page.tsx     Bản đồ năng lực + nhận xét AI
│   │   ├── library/page.tsx      Upload & quản lý tài liệu (RAG)
│   │   └── profile/page.tsx      Trang cá nhân: cover + avatar + tiểu sử + chỉnh sửa
│   │
│   └── api/
│       ├── auth/
│       │   ├── [...nextauth]/route.ts   Bắt buộc theo convention của Auth.js
│       │   └── register/route.ts        Đăng ký email+password (hash bcrypt)
│       ├── ai/
│       │   ├── chat/route.ts             Chat AI Tutor
│       │   └── hint/route.ts             Xin gợi ý theo cấp độ 🟢🟡🔴
│       ├── assessment/
│       │   ├── start/route.ts, answer/route.ts, result/route.ts
│       ├── quiz/
│       │   ├── generate/route.ts, submit/route.ts
│       ├── roadmap/
│       │   ├── route.ts (GET), generate/route.ts (POST)
│       ├── documents/
│       │   ├── route.ts (GET), upload/route.ts (POST), process/route.ts (POST)
│       ├── calendar/
│       │   ├── route.ts (POST), [id]/route.ts (PATCH/DELETE)
│       │   └── today/route.ts, week/route.ts, month/route.ts (GET)
│       ├── profile/
│       │   ├── route.ts (GET/PATCH — tên, biệt danh, tiểu sử)
│       │   └── photo/route.ts (POST — upload avatar hoặc cover, field "type")
│       ├── progress/route.ts     Số liệu dashboard (đọc DB, không gọi AI)
│       └── analytics/route.ts    Nhận xét bằng lời do AI sinh (7 ngày gần nhất)
│
├── components/
│   ├── auth/AuthCard.tsx, OAuthButtons.tsx (icon Google 4 màu), PasswordInput.tsx (toggle hiện/ẩn, dùng chung Login/Register)
│   ├── layout/AppShell.tsx        Client component giữ state drawer mobile, bọc Sidebar+Topbar+children
│   ├── layout/Sidebar.tsx, Topbar.tsx    Sidebar nhận prop open/onNavigate (drawer), Topbar nhận onMenuClick (nút ☰ mobile)
│   ├── profile/ProfileHeader.tsx  Cover + avatar, mỗi ảnh có nút camera riêng, preview tức thời qua URL.createObjectURL
│   ├── profile/EditProfileModal.tsx  Modal sửa tên/biệt danh/tiểu sử (150 ký tự), Lưu/Hủy
│   ├── providers/SessionProviderWrapper.tsx
│   ├── calendar/TodaySchedule.tsx
│   ├── tutor/ChatBubble.tsx
│   └── ui/Panel.tsx, StatCard.tsx, SkillBar.tsx, StateMessage.tsx
│
├── lib/
│   ├── db/prisma.ts             Prisma Client singleton
│   ├── ai/gemini.ts              Wrapper gọi Gemini: generateText, generateJSON, retry tự động (503/429), AIOverloadedError, export client + callWithRetry để dùng lại ở embeddings/vector.ts
│   ├── ai/prompts.ts              Toàn bộ system prompt (Socratic Tutor, sinh câu hỏi, roadmap, tóm tắt tài liệu)
│   ├── auth/session.ts            getCurrentUserId() (có xác minh user còn tồn tại trong DB, tránh P2003) + unauthorizedResponse()
│   ├── documents/extractText.ts   Trích xuất text THẬT từ .txt/.md/.pdf (pdf-parse)/.docx (mammoth)/.pptx (jszip + regex <a:t>)
│   ├── storage/localUpload.ts     Lưu avatar/cover vào public/uploads/{avatars,covers}/ (chưa có cloud storage, xem mục 9)
│   └── embeddings/vector.ts        Embedding (gemini-embedding-001, truncate+normalize còn 768 chiều) + similarity search (pgvector) cho RAG
│
├── services/
│   ├── assessment.service.ts      Adaptive branching + cập nhật mastery + getSkillProfile
│   ├── calendar.service.ts         Tính khoảng today/week/month + CRUD StudySession (kiểm tra ownership)
│   ├── document.service.ts         Pipeline RAG: chunk (đã lọc null byte/control char), embedding, tóm tắt, trả lời dựa trên tài liệu
│   ├── quiz.service.ts              Sinh câu hỏi luyện tập + chấm điểm
│   ├── roadmap.service.ts           Sinh lộ trình học từ mục tiêu + hồ sơ năng lực
│   └── tutor.service.ts             Chat AI Tutor + lưu/đọc lịch sử hội thoại
│
└── types/
    ├── index.ts                   Type dùng chung (ApiResponse có thêm debug?, SkillMasteryPoint, RoadmapPlan, UserProfile...)
    └── next-auth.d.ts              Module augmentation: session.user.id
```

**Không có** `src/app/schedule/`, không có `services/schedule.service.ts`, không có route group `(auth)` — trang đăng nhập/đăng ký nằm trực tiếp tại `src/app/login` và `src/app/register`, ngoài route group `(app)`.

### Responsive (mobile)

Toàn bộ shell (`AppShell.tsx`) chuyển Sidebar thành drawer trượt trên mobile (`<880px`) thay vì chiếm chỗ cố định 230px làm bóp méo nội dung. Các grid layout nhiều cột hard-code trước đây (`dashboard`, `progress`, `tutor`, `calendar`) đã chuyển từ inline style sang class CSS (`.grid-stats`, `.grid-progress`, `.grid-tutor`, `.grid-form-2col` trong `globals.css`) để `@media` có thể ghi đè — inline style JS không thể dùng media query. Bảng lịch tuần giữ nguyên cấu trúc lưới (không ép về 1 cột, sẽ mất ý nghĩa thời khoá biểu), thay vào đó cho cuộn ngang qua `.scroll-x-mobile`.

---

## 3. Authentication

Dùng **NextAuth v5 (Auth.js)**, cấu hình tập trung tại `src/auth.ts`:

- **Google OAuth** — provider `Google`.
- **Email + Password** — provider `Credentials`, mật khẩu hash bằng `bcryptjs` (cost factor 12), lưu ở `User.passwordHash`. Đăng ký qua `POST /api/auth/register`, sau đó tự `signIn("credentials", ...)`. Form đăng ký có trường **Xác nhận mật khẩu**, validate khớp ở client trước khi gọi API. Cả 2 ô mật khẩu (Login lẫn Register) dùng chung component `components/auth/PasswordInput.tsx` có nút mắt hiện/ẩn.
- Session dùng chiến lược **JWT** (không phải database session) — đây là yêu cầu bắt buộc của Auth.js khi có Credentials provider cùng lúc với OAuth provider.
- `PrismaAdapter` vẫn được dùng để lưu `User`/`Account` vào Postgres khi đăng nhập Google.
- `src/middleware.ts` chặn mọi trang trong `(app)` nếu chưa đăng nhập (redirect `/login`), nhưng **không** chặn `/api/**` — API tự trả JSON `401` qua `unauthorizedResponse()` (`lib/auth/session.ts`), vì `fetch()` ở client cần nhận JSON chứ không phải một redirect HTML.
- Không còn "demo user" hard-code — mọi route đều lấy `userId` thật từ session qua `getCurrentUserId()`.

Đăng xuất: nút trong `Topbar.tsx`, gọi `signOut()` của `next-auth/react`.

---

## 4. Database (Prisma)

Model chia làm 2 nhóm:

**Chuẩn Auth.js** (bắt buộc đúng tên/field theo PrismaAdapter): `User`, `Account`, `Session`, `VerificationToken`. `User` có thêm 3 field phục vụ Trang cá nhân: `nickname` (biệt danh), `bio` (tiểu sử, giới hạn 150 ký tự — validate ở tầng API, không ép cứng ở DB), `coverImage` (ảnh bìa, tách riêng khỏi `image` vốn là avatar theo chuẩn Auth.js).

**Nghiệp vụ LearnX**:
| Model | Vai trò |
|---|---|
| `LearningGoal` | Mục tiêu học sinh đặt ra (vd "Thi chuyên Tin", 6 tháng) |
| `Assessment` | 1 phiên kiểm tra năng lực (adaptive) |
| `Attempt` | 1 lần trả lời 1 câu hỏi (thuộc Assessment hoặc Quiz luyện tập) |
| `LearningProgress` | **Hồ sơ năng lực tổng hợp** theo (user, subject, topic) — trung tâm của toàn hệ thống |
| `Roadmap` | Lộ trình học do AI sinh, lưu dạng JSON theo tháng; mỗi lần tái sinh tạo bản ghi mới (giữ lịch sử) |
| `Conversation` | Lịch sử chat AI Tutor |
| `Document` / `DocumentChunk` | Tài liệu upload + các đoạn đã embedding (RAG), cột `embedding` dùng `Unsupported("vector(768)")` vì Prisma chưa có kiểu vector gốc |
| `StudySession` | 1 buổi học cụ thể trong lịch (calendar) — độc lập với `LearningProgress` |
| `Achievement` | Huy hiệu (gamification tối giản) |

`StudySessionStatus` (`PENDING` / `IN_PROGRESS` / `COMPLETED`) được định nghĩa cả ở Prisma enum lẫn `src/types/index.ts` (dùng cho frontend) — 2 nơi này phải khớp tay nhau nếu sửa.

---

## 5. Calendar (lịch học)

- Trang: `/calendar` (không phải `/schedule`).
- Service: `services/calendar.service.ts` — nơi DUY NHẤT tính khoảng thời gian "hôm nay/tuần này/tháng này" (`getTodayRange`, `getWeekRange` quy ước tuần bắt đầu Thứ 2, `getMonthRange`), và các hàm CRUD `createStudySession`/`updateStudySession`/`deleteStudySession` — 2 hàm sau LUÔN kiểm tra `{ id, userId }` cùng lúc để chặn user A sửa/xoá lịch của user B.
- API:
  - `GET /api/calendar/today`, `/week`, `/month`
  - `POST /api/calendar` — tạo buổi học mới
  - `PATCH /api/calendar/[id]`, `DELETE /api/calendar/[id]` — dynamic route chuẩn App Router
- `components/calendar/TodaySchedule.tsx` — hiển thị lịch hôm nay + thanh "X/Y nhiệm vụ hoàn thành", dùng chung ở cả Dashboard và trang Calendar.

⚠️ **Timezone**: hiện xử lý theo **giờ của server** chạy Node (không theo múi giờ trình duyệt học sinh). Với học sinh Việt Nam và server deploy gần khu vực (hoặc set `TZ=Asia/Ho_Chi_Minh`), sai lệch không đáng kể, nhưng đây là điểm cần nâng cấp nếu mở rộng nhiều múi giờ (xem TODO trong `calendar.service.ts`).

---

## 6. AI (Gemini)

- `lib/ai/gemini.ts` — wrapper duy nhất gọi Gemini (`generateText`, `generateJSON`). Model đọc từ **biến môi trường** `GEMINI_MODEL`, mặc định `gemini-flash-latest` (alias Google tự trỏ tới bản Flash GA mới nhất) — đổi model chỉ cần sửa `.env`, không cần sửa code hay build lại. Lý do quan trọng: Google liên tục gỡ các model cũ khỏi API theo từng đợt vài tháng (`gemini-1.5-flash` đã bị gỡ hoàn toàn, gây lỗi `404 model not found` nếu hard-code tên model cụ thể).
  - Tự động **retry** tối đa 3 lần (backoff tăng dần + jitter) khi Google trả `503`/`429` (quá tải tạm thời).
  - Nếu vẫn lỗi sau khi retry hết, ném `AIOverloadedError` (export riêng) — các route AI (`roadmap/generate`, `assessment/start`, `ai/chat`, `ai/hint`) bắt riêng lỗi này để trả **HTTP 503** kèm message tiếng Việt, thay vì `500` chung chung.
  - Export thêm `client` (instance `GoogleGenerativeAI`) và `callWithRetry` để `lib/embeddings/vector.ts` dùng lại, tránh lặp code.
- `lib/ai/prompts.ts` — toàn bộ system prompt: Socratic Tutor (3 cấp độ gợi ý), sinh câu hỏi trắc nghiệm, sinh roadmap, tóm tắt tài liệu.
- `lib/embeddings/vector.ts` — embedding dùng **`gemini-embedding-001`** (đọc từ `GEMINI_EMBEDDING_MODEL` trong `.env`), thay cho `text-embedding-004` đã bị Google **shutdown hoàn toàn ngày 14/1/2026**. `gemini-embedding-001` trả vector 3072 chiều mặc định, nhưng cột DB cố định `vector(768)` (khớp model cũ) — code **cắt vector về 768 chiều đầu rồi chuẩn hoá lại (L2-normalize)**, đây là cách dùng chính thức Google khuyến nghị cho model hỗ trợ Matryoshka Representation Learning (MRL), không phải hack. Dùng đúng `taskType` (`RETRIEVAL_DOCUMENT` khi lưu chunk, `RETRIEVAL_QUERY` khi tìm kiếm) để cải thiện độ chính xác similarity search.
- `lib/documents/extractText.ts` — trích xuất text THẬT theo từng định dạng (thay vì gọi `file.text()` cho mọi loại file như bản đầu, vốn gây lỗi `invalid byte sequence` / null byte khi upload PDF/DOCX vì đây là định dạng nhị phân):
  - `.txt`/`.md`: đọc trực tiếp.
  - `.pdf`: `pdf-parse` (bản `1.1.1`, API đơn giản `pdfParse(buffer) -> {text}`; **không dùng v2.x**, API đã đổi khác hẳn).
  - `.docx`: `mammoth` (`extractRawText({buffer})`).
  - `.pptx`: tự giải nén bằng `jszip` (PPTX vốn là file `.zip` chứa XML) rồi lấy text bằng regex khớp thẻ `<a:t>` trong từng `ppt/slides/slideN.xml`, sắp đúng thứ tự slide theo số N.
  - Ảnh (`.png`/`.jpg`/`.webp`): **chưa hỗ trợ** (cần OCR, ngoài phạm vi hiện tại) — ném `UnsupportedFileTypeError`, route trả `400` rõ ràng.
  - File PDF/DOCX bị mã hoá (đặt mật khẩu) hoặc hỏng: thư viện parse sẽ throw, route bắt lỗi và trả `400` "Không thể đọc nội dung file này" — đây là giới hạn kỹ thuật bình thường, không phải bug.
- `lib/storage/localUpload.ts` — lưu avatar/cover vào `public/uploads/{avatars,covers}/` (xem mục 9, chưa phải giải pháp production).
- `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL` đọc trực tiếp từ `process.env`.

---

## 7. Danh sách API endpoints (đúng theo code)

| Method | Endpoint | Việc gì |
|---|---|---|
| GET/POST | `/api/auth/[...nextauth]` | Toàn bộ luồng Auth.js (OAuth callback, JWT...) |
| POST | `/api/auth/register` | Đăng ký email + password |
| POST | `/api/ai/chat` | Chat với AI Tutor |
| POST | `/api/ai/hint` | Xin gợi ý theo cấp độ 🟢🟡🔴 |
| POST | `/api/assessment/start` | Bắt đầu bài kiểm tra năng lực |
| POST | `/api/assessment/answer` | Trả lời câu hỏi, nhận câu tiếp theo (adaptive) |
| GET | `/api/assessment/result` | Hồ sơ năng lực sau khi làm bài |
| POST | `/api/quiz/generate` | Sinh câu hỏi luyện tập theo chủ đề |
| POST | `/api/quiz/submit` | Chấm câu trả lời luyện tập |
| GET | `/api/roadmap` | Lấy lộ trình mới nhất |
| POST | `/api/roadmap/generate` | Tạo/tái sinh lộ trình học |
| GET | `/api/documents` | Danh sách tài liệu đã upload |
| POST | `/api/documents/upload` | Upload tài liệu (multipart/form-data) |
| POST | `/api/documents/process` | `action: "ask"` hỏi-đáp dựa trên tài liệu (RAG); `action: "retry"` hiện trả `501` (xem mục 9) |
| GET | `/api/calendar/today` \| `/week` \| `/month` | Lịch theo khoảng thời gian |
| POST | `/api/calendar` | Tạo buổi học mới |
| PATCH \| DELETE | `/api/calendar/[id]` | Sửa / xoá buổi học (kiểm tra ownership) |
| GET | `/api/progress` | Số liệu dashboard tiến độ (đọc DB, không gọi AI) |
| GET | `/api/analytics` | Nhận xét bằng lời do AI sinh, dựa trên 7 ngày gần nhất |
| GET \| PATCH | `/api/profile` | Lấy / cập nhật tên, biệt danh, tiểu sử (KHÔNG gồm ảnh) |
| POST | `/api/profile/photo` | Upload avatar hoặc cover (multipart/form-data, field `type`: `"avatar"` \| `"cover"`) |

Toàn bộ route (trừ `/api/auth/**`) đều dùng chung format phản hồi `ApiResponse<T>` (`{ success: true, data }` hoặc `{ success: false, error }`) và đều gọi `getCurrentUserId()` + trả `401` nếu chưa đăng nhập.

---

## 8. Những gì đã được lược bỏ khỏi repo này

Các file sau **cố ý không có trong bản chia sẻ** để tránh lộ khoá bí mật và giảm dung lượng — người nhận repo cần tự tạo lại trước khi chạy được:

| File/thư mục | Vì sao bị lược bỏ | Cần làm gì |
|---|---|---|
| `package.json`, `package-lock.json` | Chứa danh sách dependency, không nhạy cảm nhưng bị xoá cùng đợt dọn | Tự tạo lại theo dependency đã dùng: `next@14.2.35`, `react`, `react-dom`, `@prisma/client`, `prisma`, `next-auth@5.0.0-beta.25`, `@auth/prisma-adapter`, `bcryptjs`, `@google/generative-ai`, `pdf-parse@1.1.1`, `mammoth`, `jszip`, cùng các `@types/*` (bao gồm `@types/pdf-parse`) và `typescript` tương ứng |
| `.env`, `.env.example` | Chứa/gợi ý khoá bí mật thật (`DATABASE_URL`, `AUTH_SECRET`, `GEMINI_API_KEY`, OAuth secret) | Tự tạo `.env` với các biến liệt kê ở mục dưới |
| `.gitignore` | Không nhạy cảm nhưng bị xoá cùng đợt dọn | Tự tạo lại, tối thiểu cần bỏ qua `node_modules`, `.next`, `.env*` |
| `node_modules/` | Cài lại được từ `package.json`, không nên commit | `npm install` |
| `.next/` | Build output, sinh lại mỗi lần build | `npm run build` hoặc `npm run dev` |
| `prisma/migrations/` | Chưa từng chạy migration thật trong môi trường tạo repo này (xem mục 9) | `npx prisma migrate dev --name init` để tự sinh migration đầu tiên từ `schema.prisma` hiện có |

Biến môi trường cần trong `.env`:

```dotenv
DATABASE_URL="postgresql://user:password@localhost:5432/learnx"

AUTH_SECRET="change-this-to-a-random-long-string"

GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

GEMINI_API_KEY=""
# Tuỳ chọn — để trống sẽ dùng mặc định trong lib/ai/gemini.ts
GEMINI_MODEL="gemini-flash-latest"
GEMINI_EMBEDDING_MODEL="gemini-embedding-001"

STORAGE_BUCKET_URL=""
STORAGE_BUCKET_KEY=""
```

- `AUTH_SECRET`: tạo bằng `openssl rand -base64 32`.
- `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`: tạo tại [Google Cloud Console](https://console.cloud.google.com/apis/credentials), OAuth Client ID loại "Web application", Authorized redirect URI: `http://localhost:3000/api/auth/callback/google` (đổi domain khi deploy thật).
- `GEMINI_API_KEY`: lấy tại [Google AI Studio](https://aistudio.google.com/app/apikey).
- `STORAGE_BUCKET_URL`/`STORAGE_BUCKET_KEY`: dự phòng cho việc lưu file tài liệu upload lên storage ngoài (S3/Supabase Storage) — **hiện code chưa đọc 2 biến này ở đâu cả**, tính năng upload hiện xử lý trực tiếp nội dung file trong request (`services/document.service.ts`), chưa lưu file gốc vào storage bền vững. Để trống nếu chưa triển khai storage ngoài.

Sau khi có `.env` và `package.json`:

```bash
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

---

## 9. Điểm kỹ thuật còn mở (chưa hoàn thiện, không phải bug che giấu)

- **Timezone lịch học** theo giờ server, chưa theo múi giờ từng học sinh (xem mục 5 và TODO trong `calendar.service.ts`).
- **Logic Analytics nằm trực tiếp trong `api/analytics/route.ts`**, chưa tách ra `services/analytics.service.ts` như các tính năng khác (vi phạm nhẹ nguyên tắc "route mỏng, service dày" đã nêu ở mục 1) — nên tách khi tính năng này phức tạp thêm.
- **`POST /api/documents/process` với `action: "retry"`** hiện trả `501 Not Implemented` — vì DB mới lưu chunk đã xử lý, chưa lưu lại `rawText` gốc của tài liệu để xử lý lại từ đầu.
- **Upload tài liệu xử lý đồng bộ, không qua queue** (`services/document.service.ts` chạy fire-and-forget ngay trong request) — nên chuyển sang queue thật (BullMQ/Redis) khi tài liệu lớn hoặc traffic cao.
- **Roadmap chưa tự động cập nhật trạng thái `done`** khi học sinh hoàn thành 1 topic — cần nối `LearningProgress` với `Roadmap.months` (xem TODO trong `roadmap.service.ts`).
- **Ảnh (`.png`/`.jpg`/`.webp`) upload vào Library chưa tóm tắt được** — cần OCR (Google Vision, Tesseract...), hiện `lib/documents/extractText.ts` trả `400 UnsupportedFileTypeError` cho ảnh.
- **Trích xuất PPTX bằng regex** (`<a:t>` trong XML), không parse cấu trúc XML đầy đủ — đủ dùng cho mục đích tóm tắt nhưng không giữ layout/bảng biểu phức tạp; nếu slide dùng SmartArt hay text box lồng nhau bất thường có thể bỏ sót 1 phần nội dung.
- **`STORAGE_BUCKET_URL`/`STORAGE_BUCKET_KEY`** được khai báo dự phòng nhưng chưa có code nào đọc cho **tài liệu Library** — file gốc học sinh upload (Document) chưa được lưu bền vững ngoài chunk đã xử lý.
- **Avatar/cover (Trang cá nhân) lưu vào `public/uploads/` trên đĩa cục bộ** (`lib/storage/localUpload.ts`), KHÔNG persistent khi deploy serverless/nhiều instance — cần thay bằng S3/Supabase Storage thật khi lên production (signature hàm giữ nguyên, chỉ cần đổi phần thân hàm).
- **`icon.png` là favicon TĨNH**, không còn dùng `next/og` `ImageResponse` — lý do: bug đã biết của Next.js 14.2.x + `@vercel/og` trên Windows (`ERR_INVALID_URL` khi tự tải font mặc định), né hoàn toàn bằng cách dùng file ảnh tĩnh thay vì sinh động bằng code.
