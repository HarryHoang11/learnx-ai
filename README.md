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
├── proxy.ts                    Bảo vệ trang riêng tư, redirect /login nếu chưa đăng nhập (Next.js 16: thay cho middleware.ts)
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
- `src/proxy.ts` (Next.js 16 đổi tên từ `middleware.ts`) chặn mọi trang trong `(app)` nếu chưa đăng nhập (redirect `/login`), nhưng **không** chặn `/api/**` — API tự trả JSON `401` qua `unauthorizedResponse()` (`lib/auth/session.ts`), vì `fetch()` ở client cần nhận JSON chứ không phải một redirect HTML.
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

## 6. AI (AI Provider Router: Gemini → Groq → DeepSeek → Qwen → OpenRouter)

- `lib/ai/router.ts` — **AI Provider Router**, điểm gọi AI DUY NHẤT mà toàn bộ service/route dùng (`generateText`, `generateJSON`, `AIOverloadedError` — giữ NGUYÊN chữ ký so với bản chỉ-dùng-Gemini trước đây). Thứ tự provider: **Gemini (chính) → Groq (fallback 1) → DeepSeek (fallback 2) → Qwen (fallback 3) → OpenRouter (fallback cuối)** — khai báo 1 nguồn duy nhất ở `DEFAULT_AI_PROVIDERS` (export để test khoá lại đúng thứ tự).
  - Mỗi provider tối đa **1 retry** (transient error: timeout/429/5xx/network) trước khi router chuyển sang provider tiếp theo. Lỗi do API key sai (`401/403`) chuyển provider ngay không retry. Lỗi do request sai (`400`, input không hợp lệ) ném thẳng ra, **không fallback** (provider khác cũng sẽ fail giống hệt).
  - Provider thiếu API key bị **skip tự động** (không crash app) — kiểm tra qua `isConfigured()` của từng provider.
  - Timeout riêng từng provider: Gemini 12s, Groq 8s, DeepSeek 12s, Qwen 12s, OpenRouter 12s (`lib/ai/providers/timeout.ts`) — không để request treo vô hạn.
  - Nếu cả 5 provider đều fail, ném `AIOverloadedError` — các route AI (`roadmap/generate`, `assessment/start`, `ai/chat`, `ai/hint`, `analytics`) bắt riêng lỗi này để trả **HTTP 503** kèm message tiếng Việt.
  - Response mỗi provider được normalize về chung 1 format `AIResponse { content, provider, model, usage? }` (`lib/ai/types.ts`) — service phía trên không biết/không cần biết đang chạy provider nào.
  - Log dạng `[AI] Trying provider: gemini`, `[AI] gemini thất bại...`, `[AI] Bỏ qua provider "groq": thiếu API key.` — KHÔNG log API key/token.
- `lib/ai/providers/gemini.provider.ts`, `groq.provider.ts`, `deepseek.provider.ts`, `qwen.provider.ts`, `openrouter.provider.ts` — implementation riêng từng provider theo interface `AIProvider` (`lib/ai/types.ts`). Groq/DeepSeek/Qwen/OpenRouter dùng thẳng `fetch` tới API tương thích OpenAI (`lib/ai/providers/openaiCompatible.ts`), **không thêm SDK mới** (DeepSeek/Qwen chỉ mô tả config khác nhau: base URL, env var, timeout).
  - **DeepSeek**: base URL mặc định `https://api.deepseek.com` (đổi bằng `DEEPSEEK_BASE_URL` khi đi qua gateway nội bộ), model mặc định `deepseek-flash` (đổi bằng `DEEPSEEK_MODEL`) — chọn model Flash vì đây là provider dự phòng, cần rẻ/nhanh/concurrency cao; cả 2 model DeepSeek hiện tại đều hỗ trợ JSON Output nên `jsonMode` hoạt động.
  - **Qwen** (Alibaba Cloud Model Studio / DashScope compatible-mode): base URL **BẮT BUỘC lấy từ `QWEN_BASE_URL`**, KHÔNG hardcode vì DashScope có endpoint khác nhau theo region (Singapore / Beijing / US / Hong Kong / workspace-dedicated) và API key cũng theo region — dùng key region A với endpoint region B sẽ bị `401`. Thiếu key **hoặc** thiếu base URL thì provider bị **skip** (không đoán region thay người dùng). Model mặc định `qwen-flash`, đổi bằng `QWEN_MODEL`.
- `lib/ai/gemini.ts` — chỉ còn giữ SDK client Gemini thô (`client`, `MODEL_NAME`, `callWithRetry`) dùng bởi `GeminiProvider` **và** `lib/embeddings/vector.ts`. Model đọc từ `GEMINI_MODEL` trong `.env`, mặc định `gemini-flash-latest`.
- `lib/ai/prompts.ts` — toàn bộ system prompt: Socratic Tutor (3 cấp độ gợi ý), sinh câu hỏi trắc nghiệm, sinh roadmap, tóm tắt tài liệu.
- `lib/embeddings/vector.ts` — embedding dùng **`gemini-embedding-001`** (đọc từ `GEMINI_EMBEDDING_MODEL` trong `.env`), thay cho `text-embedding-004` đã bị Google **shutdown hoàn toàn ngày 14/1/2026**. `gemini-embedding-001` trả vector 3072 chiều mặc định, nhưng cột DB cố định `vector(768)` (khớp model cũ) — code **cắt vector về 768 chiều đầu rồi chuẩn hoá lại (L2-normalize)**, đây là cách dùng chính thức Google khuyến nghị cho model hỗ trợ Matryoshka Representation Learning (MRL), không phải hack. Dùng đúng `taskType` (`RETRIEVAL_DOCUMENT` khi lưu chunk, `RETRIEVAL_QUERY` khi tìm kiếm) để cải thiện độ chính xác similarity search.
  - **CHỦ Ý KHÔNG đi qua AI Router**: chỉ Gemini có model embedding cho ra đúng không gian vector khớp cột `vector(768)` hiện tại — trộn embedding từ Groq/OpenRouter (nếu có) vào cùng cột sẽ làm sai lệch ngầm kết quả RAG, khó phát hiện hơn nhiều so với Gemini tạm thời không gọi được.
- `lib/documents/extractText.ts` — trích xuất text THẬT theo từng định dạng (thay vì gọi `file.text()` cho mọi loại file như bản đầu, vốn gây lỗi `invalid byte sequence` / null byte khi upload PDF/DOCX vì đây là định dạng nhị phân):
  - `.txt`/`.md`: đọc trực tiếp.
  - `.pdf`: `pdf-parse` (bản `1.1.1`, API đơn giản `pdfParse(buffer) -> {text}`; **không dùng v2.x**, API đã đổi khác hẳn).
  - `.docx`: `mammoth` (`extractRawText({buffer})`).
  - `.pptx`: tự giải nén bằng `jszip` (PPTX vốn là file `.zip` chứa XML) rồi lấy text bằng regex khớp thẻ `<a:t>` trong từng `ppt/slides/slideN.xml`, sắp đúng thứ tự slide theo số N.
  - Ảnh (`.png`/`.jpg`/`.webp`): **chưa hỗ trợ** (cần OCR, ngoài phạm vi hiện tại) — ném `UnsupportedFileTypeError`, route trả `400` rõ ràng.
  - File PDF/DOCX bị mã hoá (đặt mật khẩu) hoặc hỏng: thư viện parse sẽ throw, route bắt lỗi và trả `400` "Không thể đọc nội dung file này" — đây là giới hạn kỹ thuật bình thường, không phải bug.
- `lib/storage/dbUpload.ts` — validate + đọc avatar/cover thành `Buffer`, lưu thẳng vào cột `Bytes` (`avatarData`/`coverData`) trong Postgres qua `api/profile/photo/route.ts`; ảnh được serve lại qua `GET /api/profile/photo/[type]`, KHÔNG còn ghi ra `public/uploads/` như bản trước.
- `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_EMBEDDING_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`, `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, `QWEN_API_KEY`, `QWEN_BASE_URL`, `QWEN_MODEL`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `APP_URL` (optional, dùng cho header `HTTP-Referer` khi gọi OpenRouter) đọc trực tiếp từ `process.env`. Toàn bộ key chỉ được đọc ở **server** (provider chỉ import trong `lib/ai/router.ts` → service/route handler) và chỉ gửi đi trong header `Authorization`, KHÔNG bao giờ trả về response hay ghi vào log.

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

---

## 10. UI/UX & Learning Experience Upgrade (đợt nâng cấp)

### 10.1. Math rendering (KaTeX) — ưu tiên cao nhất

- Dependency mới duy nhất: `katex` (MIT). Cài bằng `npm install katex --legacy-peer-deps`
  (flag cần thiết vì `next-auth@5.0.0-beta.25` khai báo peer `next@^14||^15` trong khi
  project dùng `next@16` — xung đột có sẵn, không do KaTeX gây ra; xem mục 10.6).
- `src/components/math/SafeMath.tsx` — **nơi duy nhất** render công thức. Hỗ trợ
  `$$..$$` block, `\[..\]` block, `\(..\)` inline, `$..$` inline (single-`$` chỉ render
  khi ruột có dấu hiệu toán học để không nuốt ký hiệu tiền tệ). `throwOnError: false`
  nên công thức lỗi cú pháp rơi về text — không bao giờ trắng trang.
- An toàn: text thường qua React node (tự escape); chỉ HTML do chính KaTeX sinh ra mới
  qua `dangerouslySetInnerHTML`. `renderToString` thuần túy nên SSR/client đồng nhất,
  không hydration mismatch. Mỗi công thức có `role="img"` + `aria-label` LaTeX gốc.
- Đã nối vào: tutor chat (`ChatBubble`, chỉ tin nhắn AI), tóm tắt tài liệu
  (`MarkdownLite` — tách math TRƯỚC rồi mới format bold/code), câu hỏi + đáp án
  diagnostic, đề bài `ExerciseSolver`.
- `lib/ai/prompts.ts`: thêm `MATH_FORMAT_RULE` vào prompt Socratic, sinh câu hỏi,
  diagnostic — AI ra LaTeX đúng delimiters, mỗi đáp án là 1 công thức trọn vẹn.
- CSS KaTeX nạp 1 lần ở root layout (`katex/dist/katex.min.css`, font woff2 đóng gói
  local, không hotlink). Khối display cuộn ngang trên mobile (`.math-block`).
- Test: `src/components/math/__tests__/splitMathSegments.test.ts` (6 cases).

### 10.2. Typography & Level system

- Font nạp thêm subset `vietnamese` (Inter + Space Grotesk đều hỗ trợ) — trước đây chỉ
  `latin` nên chữ Việt rơi về font hệ thống. Token mới `--font-code` thống nhất cho code.
- Level/XP: `xpToReachLevel(1) = 0` (trước đây = 100 nên user mới hiện `-55%`,
  `-100/182 XP`). `getLevelProgress` ủy thác cho `getLevelProgressDetails` — 1 nguồn
  sự thật cho API và mọi UI. Ngưỡng Level 2+ giữ nguyên nên level user cũ không đổi.
- `LevelHero` (đầu trang Tiến độ) + `LevelProgressBar` (bản gọn): animate 0→thật lúc
  mount bằng rAF, `role="progressbar"`, tôn trọng `prefers-reduced-motion`.

### 10.3. Design primitives & feedback

- `Skeleton`, `EmptyState`, Toast system (`ToastProvider` ở `(app)/layout`, `useToast()`),
  `useCountUp` (animate số XP). Toast thay thế `alert()` trong modal tài liệu.
- Dashboard thành trung tâm học tập: lịch hôm nay (có sẵn) + ôn tập đến hạn
  (`/api/review/due`) + học tiếp (`/api/roadmaps`, goal ACTIVE đầu tiên) + tổng quan
  năng lực (Vững/Đang học/Cần củng cố từ skillMap) + hoạt động gần đây
  (`/api/xp/history`) + XP counter animate. Không hardcode, empty state đầy đủ.

### 10.4. Mind Map (backend đã có, bổ sung UI)

- Backend có sẵn: `GET/POST /api/mindmap`, `POST /api/mindmap/generate`. Mới thêm:
  `PUT /api/mindmap/[id]` (lưu sau khi sửa node, verify ownership chống IDOR).
- Trang `/mindmap`: không `?id=` → danh sách mind map của user; có `?id=` → cây thu
  gọn/mở rộng, zoom, tìm kiếm + highlight, sửa/thêm/xóa node (xóa cả nhánh con, cấm
  xóa root), Lưu (PUT), Export JSON. Vào sidebar nhóm Tài nguyên.
- Modal tóm tắt tài liệu: nút “🧠 Tạo Mind Map” → generate → chuyển sang trang mind map.
- Chủ ý không dùng React Flow: cây phân cấp tự vẽ đủ expand/collapse/zoom/pan
  (cuộn)/search/highlight, nhẹ hơn nhiều và không thêm dependency.

### 10.5. Community save/download

- 2 nút `Lưu`/`Tải` ở trang Community trước đây là `TODO` chết — đã nối API thật:
  `POST .../save` (lạc quan + rollback khi lỗi) và `POST .../download` (track + trả
  bytes, tải qua blob, không hotlink).

### 10.6. Điểm mở còn lại (sau đợt này)

- `npm install` cần `--legacy-peer-deps` do xung đột peer có sẵn
  (`next-auth@5.0.0-beta.25` vs `next@16`). Nên nâng cấp `next-auth` hoặc `next` để
  khớp trong 1 PR riêng.
- Script `npm run lint` hỏng sẵn (Next 16 bỏ `next lint`) — kiểm tra bằng
  `npx eslint <file>` trực tiếp; nên đổi script sang `eslint .`.
- Đã migrate `middleware.ts` -> `proxy.ts` theo Next.js 16 (chỉ đổi tên file, giữ nguyên 100% logic auth/matcher). Lưu ý: KHÔNG được tồn tại đồng thời cả 2 file — Next.js 16 ném lỗi E900 ngay khi dựng route manifest và làm MỌI route (kể cả `/`) trả 404 dạng HTML.
- Review submissions UI: API `/api/review/*` đầy đủ nhưng chưa có trang `/review`
  riêng — dashboard hiện dẫn sang `/practice` để ôn.
- Chưa có minimap cho Mind Map (ghi rõ là optional).

### 10.7. Kiểm tra sau đợt nâng cấp

```bash
npm test            # 21 passed (15 AI router + 6 math segmenter)
npx tsc --noEmit    # PASS
npx eslint <file>   # PASS (0 errors trên mọi file đã chạm)
npm run build       # PASS (83+ routes)
```

---

## 11. Document pipeline — audit & nâng cấp độ tin cậy

### 11.1. Kết luận audit (dựa trên code, không đoán)

- **KHÔNG phải file locking**: pipeline không chạm filesystem — bytes đi
  `FormData → Buffer → cột DB Bytes`. Chỗ duy nhất ghi file là avatar/cover.
  Lần duy nhất gặp EPERM thật là `prisma generate` khi DLL query engine bị
  giữ bởi process `next start` cũ còn sót — kill process là xong.
- **KHÔNG phải PDF→Markdown**: pipeline chưa từng có bước convert Markdown
  (Markdown chỉ là format của summary hiển thị). Summary fail không còn làm
  fail cả document (non-fatal, mục 11.2).
- **KHÔNG phải race condition**: không temp file, không stream, không tên
  file dùng chung giữa request (in-memory + DB).
- **Nguyên nhân thật**:
  1. `pdf-parse@1.1.1` (pdf.js cũ) parse fail với PDF dùng xref stream nén
     ("bad XRef entry" — PDF xuất từ nhiều công cụ hiện đại) mà không có
     fallback → rớt cả tài liệu hợp lệ.
  2. PDF scan/ảnh → text rỗng nhưng pipeline vẫn chạy tiếp: 0 chunk, AI tóm
     tắt từ khoảng trống ("upload thành công nhưng AI không nhận nội dung").
     Label UI còn mời upload ảnh dù ảnh luôn fail.
  3. Không validate (magic bytes, size), không error code/stage, message
     chung chung; không giới hạn file lớn; nhánh retry 501 chết song song
     với retry thật ở `/api/documents/[id]/retry`.

### 11.2. Kiến trúc sau sửa

```text
Upload → validate (empty/size/magic bytes) → extract (A: pdf-parse
per-page, fail → B: pdfjs-dist hiện đại) → scan detect (mọi trang rỗng
→ PDF_NO_TEXT_LAYER + hook OCR) → normalize NFC (giữ tiếng Việt + toán)
→ chunk THEO TRANG (pageNumber) → embedding → DB → summary NON-FATAL
```

- `src/lib/documents/docErrors.ts`: 14 error codes + stage + retryable +
  HTTP status + message/gợi ý tiếng Việt; `describeDocumentError()` cho UI;
  logging theo stage (`[DOCUMENT] stage=...`, chỉ metadata).
- `extractText.ts`: `ExtractionResult { text, pages, pageCount }`;
  `MAX_UPLOAD_BYTES` 20MB, `MAX_PDF_PAGES` 150, `MAX_EXTRACTED_CHARS` 400k.
- `document.service.ts`: chunk theo trang, cap 300 chunks, summary lỗi →
  vẫn `ready` (summary null, UI hiện "Chưa có tóm tắt").
- Migration `20260913000000_add_chunk_page_number`: `DocumentChunk.pageNumber`
  (nullable, an toàn dữ liệu cũ). Chạy `npx prisma migrate deploy` khi deploy.
- Routes trả đúng status (400/413/422/503) kèm message + suggestion; dev có
  thêm `debug`. Nhánh 501 ở `/api/documents/process` đã gỡ (retry thật ở
  `[id]/retry`).
- UI Thư viện: trạng thái upload theo phase thật, card failed hiện nguyên
  nhân + gợi ý (suy từ `[CODE]`), input `accept` đúng định dạng, toast thay
  `alert()`.
- OCR: chưa cài (đề xuất `tesseract.js` + model `vie`, opt-in từng document
  vì nặng/chậm) — pipeline có sẵn vị trí cắm `attemptOcrPdfText()`.

### 11.3. Dependencies thêm

| Package | Vì sao | Thay thế đã loại |
|---|---|---|
| `pdfjs-dist@6.3.289` (Apache-2.0) | Fallback parser hiện đại khi pdf-parse fail xref nén; chỉ nạp khi cần (dynamic import) | Nâng pdf-parse (nhánh 1.x bị bỏ, 2.x đổi API); `unpdf` (thừa abstraction) |

Cài bằng `npm install pdfjs-dist --legacy-peer-deps` (xung đột peer
next-auth/next16 có sẵn, xem 10.6).

### 11.4. Test pipeline (không cần DB/AI)

```bash
npm test  # 40 passed, gồm 14 tests extraction thực tế
```

Bao phủ: PDF đơn giản / NFC tiếng Việt / giữ ký tự toán / 3 trang +
30 trang đúng pageNumber-thứ tự / scan→OCR_UNAVAILABLE (phân biệt file
hỏng) / corrupt→PDF_CORRUPTED hoặc PDF_PARSE_FAILED / 2 request đồng
thời không lẫn / empty-oversize-giả PDF-unsupported / đồng thời.
Chưa test với DB thật: double-submit guard, retry end-to-end, restart
giữa job (fire-and-forget, đã ghi TODO queue BullMQ từ trước).

---

## 12. Đợt audit lớn: hydration, UI resources, Goal→Gap, i18n

### 12.1. Hydration — kết luận sau audit

- **Warning đã báo (`data-new-gr-c-s-check-loaded`,
  `data-gr-ext-installed` trên `<body>`): do Grammarly/browser extension
  inject — EXTERNAL, không phải bug LearnX.** `suppressHydrationWarning`
  ở `<html>` không che được attrs của `<body>` (React áp dụng 1 cấp),
  nên thêm `suppressHydrationWarning` đúng vào `<body>` — children vẫn
  warn bình thường, không che bug thật.
- **Bug thật tìm thấy và đã sửa**: `calendar/page.tsx` khởi tạo
  `anchor = toDateStr(new Date())` trong `useState` → SSR render tiêu đề
  bằng giờ server, client hydrate bằng giờ trình duyệt (lệch TZ, rõ nhất
  00:00–07:00 giờ VN) → mismatch. Sửa bằng mounted-pattern
  (`anchor: null` + set trong `useEffect`, tiêu đề fallback tĩnh).
- **Đã audit, an toàn**: `toLocaleString` số (deterministic), date/time
  trong session render sau fetch client-side, `matchMedia` trong effect,
  `Date.now()` trong handler, SessionProvider/Toast/Language providers
  (không đọc storage trong render), không `button>a` lồng sai.

### 12.2. Tài nguyên UI đã tải thật (không chỉ gợi ý link)

| Package | License | Lưu ở | Dùng ở component |
|---|---|---|---|
| `lucide-react@1.45.0` | ISC | `node_modules` (npm) | `Sidebar` (13 icons), `Topbar` (Menu), streak `Flame` |

Trước đó đã có `katex` (render toán) và `pdfjs-dist` (fallback PDF).
Không tải illustration/template ngoài — glassmorphism hiện tại đủ, tránh
bloat và rủi ro license.

### 12.3. Goal → Gap → Roadmap

- `LearningGoal` thêm `subject`, `targetOutcome` (vd "IELTS 7.0"),
  `deadline` (migration `20260914000000_learning_metadata`); form tạo
  goal có 3 trường mới (validate deadline YYYY-MM-DD ở API).
- `GET /api/goals/[id]/gap` (`getGoalGap`): current từ
  `LearningProgress` THẬT (không từ user tự khai), target 80%, priority
  HIGH ≥50 / MEDIUM ≥25 / LOW, topic chưa có dữ liệu ghi rõ "chưa đánh
  giá". Trang roadmap hiện panel gap sắp xếp giảm dần.
- Đã verify: mastery cập nhật từ diagnostic/quiz/exercise qua
  `updateMastery()` chung (evidence-based, không hardcode).

### 12.4. Upload metadata + resources

- Upload Thư viện: form File + Subject (bắt buộc) + Topic + Difficulty
  (easy/medium/hard, chuẩn chung) + Description; API validate + lưu DB;
  card hiện chips metadata.
- Resource URL: validate http/https sẵn có ở `createResource`; AI
  recommendations deterministic từ DB (không bịa URL); link thật render
  `target=_blank rel=noreferrer`.
- Tutor hiểu intent "tìm tài liệu/video/bài tập" → tìm catalog THẬT
  (`/api/resources?search=`) → resource cards có nút "Mở nguồn học ↗"
  đính kèm tin nhắn AI (song song, không chèn vào prompt).

### 12.5. i18n VI/EN + mobile sidebar

- `src/lib/i18n/dictionary.ts` (key type-safe) + `LanguageProvider`
  (localStorage tức thì + `User.language` persist qua `/api/profile`,
  DB thắng khi đăng nhập; đặt `document.lang`; không đọc storage trong
  render). Đã dịch: sidebar, topbar (+switcher VI/EN), pattern cho page
  tiếp theo — chưa dịch hết 50+ component (ghi rõ, làm dần).
- Mobile drawer: `100dvh`, `overflow-y: auto`,
  `overscroll-behavior: contain`, momentum iOS, reduced-motion; overlay
  chỉ chặn pointer, không khóa body scroll sai cách.

### 12.6. Kiểm tra đợt này

```bash
npm test            # 42 passed (6 files)
npx tsc --noEmit    # PASS
npx eslint <file>   # PASS (0 errors)
npm run build       # PASS (84 routes, gồm /api/goals/[id]/gap)
```

Smoke (prod): `/login` 200, `/roadmap|/tutor|/library|/calendar` 307 về
login (đúng auth flow), không 500. Lưu ý: `prisma generate` EPERM khi
dev server đang giữ DLL (xem 11.1) — types vẫn regenerate xong trước
bước copy engine; `migrate deploy` đã chạy OK (DB localhost:2402).
