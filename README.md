# LearnX AI

> **Học cùng AI, không chỉ hỏi AI**

## Overview

LearnX AI là nền tảng học tập thích ứng: người học **upload tài liệu thật** (PDF/DOCX/PPTX/TXT/MD),
AI biến tài liệu đó thành **tóm tắt → mind map → câu hỏi chẩn đoán → lộ trình → buổi học với gia sư →
bài luyện tập → thẻ ôn tập**, và mọi hoạt động đều ghi lại vào **hồ sơ năng lực (Skill Profile)** để
cá nhân hoá các bước sau. Điểm khác biệt so với "chat với AI": kiến thức AI trả lời được **neo vào
tài liệu gốc** (RAG + pgvector) và tiến độ/điểm số **lấy từ dữ liệu học tập thật trong DB**
(không hardcode, không cộng điểm chỉ vì mở trang).

## Features

### Document learning pipeline

```
Document → Summary → Mind Map → Diagnostic → Skill Profile
        → Roadmap → Tutor → Practice → Review → XP/LXP → Achievement
```

| Bước | Người dùng làm gì | Code chịu trách nhiệm |
|---|---|---|
| Document | Upload PDF/DOCX/PPTX/TXT/MD (≤20MB, ≤150 trang PDF) | `api/documents/upload`, `lib/documents/extractText.ts`, `services/document.service.ts` |
| Summary | Nhận tóm tắt có cấu trúc + xem/tải PDF, DOCX, TXT, MD | `api/documents/[id]/summary/download`, `components/documents/SummaryDrawer.tsx` |
| Mind Map | Sinh mind map từ tóm tắt, sửa/thêm/xoá node, lưu, export 5 định dạng | `api/mindmap/*`, `(app)/mindmap/page.tsx`, `lib/mindmap/*` |
| Diagnostic | Bài kiểm tra năng lực **adaptive** (độ khó đổi theo câu trả lời) | `api/diagnostic/*`, `services/diagnostic.service.ts`, `services/assessment.service.ts` |
| Skill Profile | Mastery 0–1 theo từng `subject`/`topic`, tính từ bằng chứng thật | `LearningProgress`, `services/assessment.service.ts` (`updateMastery`) |
| Roadmap | Lộ trình theo mục tiêu + bảng **Goal → Gap** (thiếu bao nhiêu so với mục tiêu 80%) | `api/roadmap*`, `api/goals/[id]/gap`, `services/roadmap.service.ts` |
| Tutor | Gia sư Socratic, gợi ý 3 cấp độ, hội thoại có lịch sử, nhận xét bài làm | `api/tutor/*`, `services/socratic-tutor.service.ts`, `services/tutor-context.service.ts` |
| Practice | Quiz sinh theo chủ đề/độ khó + bài tập (Exercise) + phân tích lỗi sai | `api/quiz/*`, `api/exercises/*`, `services/mistake-analysis.service.ts` |
| Review | Ôn tập ngắt quãng (spaced repetition), thẻ đến hạn | `api/review/*`, `services/spaced-repetition.service.ts` |
| XP/LXP | XP + level (công thức luỹ thừa), Points, streak, daily challenge, rewards shop | `lib/constants/xp.ts`, `api/xp/history`, `api/lxp/history`, `api/rewards/*`, `api/streak` |
| Achievement | Thành tích mở khoá theo điều kiện thật | `api/achievements*`, `services/achievement.service.ts` |

### Tính năng khác có trong code

- **Workspace học tập** (`/(app)/workspace`): đọc tài liệu + hỏi đáp RAG + xem tóm tắt + sinh quiz/exercise + mind map ngay trong 1 màn hình.
- **Library**: danh sách tài liệu, trạng thái xử lý theo phase thật, tải file gốc, thử lại khi lỗi, phát hiện trùng lặp, chất lượng tài liệu.
- **Calendar**: buổi học theo hôm nay/tuần/tháng, tạo–sửa–xoá, learning session đang hoạt động.
- **Tiến độ**: bản đồ năng lực + nhận xét do AI sinh từ 7 ngày gần nhất; **streak** và lịch sử hoạt động.
- **Learning Agent**: kế hoạch học hằng ngày + danh sách task, gợi ý "học gì tiếp theo".
- **Community**: chia sẻ tài liệu công khai, rating, report, save, contributor + leaderboard đóng góp.
- **Friends**: kết bạn, chấp nhận/từ chối, tìm kiếm.
- **Resources**: kho tài nguyên học tập do cộng đồng đóng góp (link thật, có rating/report).
- **Leaderboard** theo XP và theo môn.
- **Profile**: avatar/cover upload (lưu trong DB dạng Bytes, serve qua `/api/profile/photo/[type]`), tiểu sử, ngôn ngữ.
- **i18n VI/EN** + dark theme + responsive (sidebar thành drawer trên mobile).

## Tech Stack

Chỉ những gì thực sự có trong `package.json` và đang được dùng:

- **Next.js 16.3.5** (App Router, Turbopack build, `src/proxy.ts` — Next 16 thay thế `middleware.ts`)
- **React 19.3** + **TypeScript 5.5**
- **Prisma 5.20** + **PostgreSQL** + **pgvector** (cột `DocumentChunk.embedding = Unsupported("vector")`, 768 chiều, thao tác bằng raw SQL)
- **Auth.js v5** (`next-auth@5.0.0-beta.32`) + `@auth/prisma-adapter`, session strategy **JWT**, `bcryptjs` cho mật khẩu
- **AI provider**: `@google/generative-ai` (Gemini) + 4 provider gọi qua `fetch` theo chuẩn OpenAI-compatible (Groq, DeepSeek, Qwen, OpenRouter)
- **Tài liệu**: `pdf-parse` (+ fallback `pdfjs-dist`), `mammoth` (DOCX), `jszip` (PPTX), `docx` (xuất DOCX), `pdfkit` (xuất PDF)
- **Hiển thị**: `katex` (công thức), `MarkdownLite` (markdown nội bộ), `lucide-react` (icon), `@fontsource/noto-sans` + `src/fonts/*.ttf`
- **Test**: `vitest` (12 file, 90 test)
- **Lint**: `eslint` 8 + `eslint-config-next` 14 (xem [Troubleshooting](#troubleshooting) — chưa nâng lên ESLint 9/flat config)

## Project Structure

```
prisma/
├── schema.prisma          53 model (User, Document, DocumentChunk, LearningProgress,
│                          MindMap, ReviewItem, XPTransaction, Achievement, ...)
└── migrations/            19 migration SQL (đã gồm pgvector + cột vector(768))

src/
├── auth.ts                Cấu hình Auth.js TRUNG TÂM (Google + Credentials, JWT, PrismaAdapter)
├── proxy.ts               Chặn page chưa đăng nhập -> /login (Next.js 16: thay cho middleware.ts)
│
├── app/
│   ├── layout.tsx, globals.css, icon.png
│   ├── login/, register/          Ngoài route group (app) — không có sidebar
│   ├── (app)/                     Route group dùng chung AppShell (Sidebar + Topbar + drawer)
│   │   ├── dashboard, workspace, library, mindmap, diagnostic, progress,
│   │   ├── roadmap, tutor, practice, review, calendar, leaderboard, friends,
│   │   ├── community/*, resources, profile
│   │   └── layout.tsx             ToastProvider + AppShell + PageTransition
│   └── api/                       97 route handler (xem bảng bên dưới)
│
├── components/
│   ├── layout/ (AppShell, Sidebar, Topbar)   ui/ (Panel, Button, Modal, Toast, Skeleton, ...)
│   ├── documents/ (DocumentCard, SummaryDrawer, MarkdownLite, DocumentDetailModal)
│   ├── mindmap/MindMapExportModal.tsx         Modal chọn định dạng export
│   ├── math/SafeMath.tsx                      Render KaTeX an toàn
│   └── providers/ (SessionProviderWrapper, LanguageProvider)
│
├── lib/
│   ├── db/prisma.ts                   Prisma singleton + pooling cho serverless
│   ├── auth/session.ts                getCurrentUserId() (xác minh user còn tồn tại) + unauthorizedResponse()
│   ├── ai/                            router.ts (fallback chain) + providers/* + prompts.ts + gemini.ts
│   ├── mindmap/                       graph.ts (kiểu dữ liệu + validate), layout.ts (tính toạ độ), export.ts (5 format)
│   ├── documents/                     extractText.ts (đọc mọi định dạng), docErrors.ts (error code + gợi ý)
│   ├── embeddings/vector.ts           embedding Gemini + similarity search pgvector
│   ├── constants/xp.ts                công thức XP/level dùng chung
│   └── i18n/dictionary.ts             từ điển VI/EN type-safe
│
├── services/                          Toàn bộ nghiệp vụ (24 file: document, diagnostic, quiz,
│                                      spaced-repetition, roadmap, socratic-tutor, leaderboard,
│                                      achievement, community-document, mistake-analysis, ...)
│
└── types/                             Kiểu dùng chung (ApiResponse<T>...) + augmentation next-auth
```

**Nguyên tắc:** route mỏng – service dày. `app/api/**/route.ts` chỉ parse request, kiểm tra session,
gọi service và trả `ApiResponse<T>` (`{ success: true, data }` hoặc `{ success: false, error }`);
logic nghiệp vụ nằm ở `services/`, tiện ích dùng chung ở `lib/`.

### API endpoints (nhóm chính)

| Nhóm | Endpoint |
|---|---|
| Auth | `GET/POST /api/auth/[...nextauth]`, `POST /api/auth/register` |
| AI | `POST /api/ai/chat`, `POST /api/ai/hint` |
| Tài liệu | `GET/POST /api/documents`, `POST /api/documents/upload`, `POST /api/documents/process`, `GET /api/documents/[id]`, `/download`, `/retry`, `POST /api/documents/[id]/summary/download`, `POST /api/documents/flashcards`, `POST /api/documents/study-guide` |
| Mind map | `GET/POST /api/mindmap`, `GET/PUT/DELETE /api/mindmap/[id]`, `POST /api/mindmap/generate`, `POST /api/mindmap/export` |
| Chẩn đoán | `POST /api/diagnostic/session`, `/answer`, `GET /api/diagnostic/result`, `/status` |
| Quiz & bài tập | `POST /api/quiz/generate`, `/submit`, `GET/POST /api/exercises`, `POST /api/exercises/[id]/submit`, `GET /api/practice/mistakes` |
| Ôn tập | `POST /api/review/create`, `GET /api/review/due`, `POST /api/review/submit` |
| Lộ trình | `GET/POST /api/roadmap`, `POST /api/roadmap/generate`, `GET /api/roadmaps/[id]`, `/recommendations`, `/resources`, `GET /api/goals/[id]/gap` |
| Gia sư | `POST /api/tutor/session`, `/message`, `/hint`, `/evaluate`, `GET /api/tutor/context` |
| Gamification | `GET /api/xp/history`, `/api/lxp/history`, `/api/streak`, `/api/achievements`, `POST /api/achievements/unlock`, `GET/POST /api/rewards/*`, `GET/POST /api/daily-challenge`, `/claim` |
| Học tập | `GET /api/progress`, `/api/analytics`, `/api/next-action`, `POST /api/learning-session/start`, `/complete`, `GET /api/learning-session/active`, `POST /api/learning/activity` |
| Lịch | `GET /api/calendar/today` \| `/week` \| `/month` \| `/day` \| `/month-grid`, `POST /api/calendar`, `PATCH/DELETE /api/calendar/[id]` |
| Cộng đồng | `GET/POST /api/community/documents`, `[id]`, `/download`, `/rate`, `/report`, `/save`, `GET /api/community/leaderboard`, `/subjects`, `/contributors/[id]` |
| Khác | `/api/profile` (+`/photo`, `/photo/[type]`), `/api/friends/*`, `/api/leaderboard*`, `/api/resources*`, `/api/agent/daily` \| `/plan` \| `/task` |


## Environment Variables

Danh sách **thực tế code đọc** (`process.env.*`). Không commit file `.env` — repo chỉ chứa
`.env.example` với giá trị placeholder.

```dotenv
# ---- Bắt buộc ----
DATABASE_URL=your_postgres_connection_string

# ---- Khuyến nghị set (Auth.js dùng để ký session JWT) ----
# Không set vẫn chạy: src/auth.ts tự dẫn xuất secret từ DATABASE_URL và ghi
# cảnh báo vào Runtime Logs. Set riêng để tách khoá ký session khỏi credential DB.
AUTH_SECRET=your_random_secret            # openssl rand -base64 32

# ---- Chỉ cần khi self-host production (Vercel/Cloudflare tự set biến nền tảng) ----
AUTH_URL=your_public_app_url              # hoặc AUTH_TRUST_HOST=true
AUTH_TRUST_HOST=true

# ---- Đăng nhập Google (bỏ trống = chỉ dùng email/password) ----
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ---- AI provider: provider nào thiếu key sẽ tự bị bỏ qua ----
GEMINI_API_KEY=your_gemini_key            # provider chính (+ embedding cho RAG)
GEMINI_MODEL=gemini-flash-latest
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GROQ_API_KEY=your_groq_key
GROQ_MODEL=openai/gpt-oss-120b
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_BASE_URL=your_deepseek_base_url
DEEPSEEK_MODEL=deepseek-flash
QWEN_API_KEY=your_qwen_key
QWEN_BASE_URL=your_qwen_base_url          # bắt buộc nếu dùng Qwen (khác nhau theo region)
QWEN_MODEL=qwen-flash
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct:free

# ---- Hiển thị tên app trên dashboard OpenRouter (không bắt buộc) ----
APP_URL=your_public_app_url
APP_NAME=LearnX AI
```

`NEXTAUTH_SECRET` / `NEXTAUTH_URL` cũng được Auth.js chấp nhận (alias của `AUTH_SECRET` / `AUTH_URL`).
`STORAGE_BUCKET_URL` / `STORAGE_BUCKET_KEY` có trong `.env.example` nhưng **hiện không code nào đọc** —
đặt giá trị cũng không thay đổi hành vi app.

## Installation

```bash
git clone https://github.com/HarryHoang11/learnx-ai.git
cd learnx-ai
npm install
cp .env.example .env      # rồi điền giá trị thật
```

Yêu cầu: Node.js 20+ và một PostgreSQL có extension **pgvector**.

## Database Setup

```bash
# 1) Áp migration (tạo bảng + extension pgvector + cột vector(768))
npm run db:migrate             # = prisma migrate deploy — dùng cho CI/production
npx prisma migrate dev         # dev (tạo migration mới khi sửa schema)

# 2) Sinh Prisma Client (build script cũng tự chạy bước này)
npm run db:generate

# 3) Xem dữ liệu trực quan
npm run db:studio
```

> ⚠️ **`npm run build` KHÔNG chạy migration.** Nếu DB thiếu bảng mới, các API dùng bảng đó sẽ trả HTTP 500
> (`The table public.X does not exist`) trong khi phần còn lại của app vẫn chạy — xem
> [Troubleshooting](#troubleshooting) mục 2. Kiểm tra nhanh bằng `npx prisma migrate status`.

- Nếu DB chưa bật pgvector: `CREATE EXTENSION IF NOT EXISTS vector;` (migration đầu tiên đã khai báo,
  nhưng một số nhà cung cấp yêu cầu bật thủ công trước).
- **Không chạy migration qua PgBouncer transaction-mode** (Supabase cổng 6543) — Prisma migrate cần
  connection trực tiếp (cổng 5432). Dùng `DATABASE_URL="<direct-url>" npm run db:migrate`.
- Chưa có seed script trong repo — dữ liệu khởi tạo là do bạn dùng app (upload tài liệu, làm bài chẩn đoán).

## Development

```bash
npm run dev        # next dev — http://localhost:3000
npm run lint       # eslint src
npm test           # vitest run (90 test / 12 file)
npm run db:studio  # Prisma Studio
```

Dev Indicator của Next.js đã bị tắt trong `next.config.js` để log/UI dev sạch.

## Production Build

```bash
npm run build   # prisma generate && next build
npm start       # next start (chạy server production ở local)
npx tsc --noEmit  # typecheck riêng (build của Next không fail theo TS error ở mọi trường hợp)
npm run lint
npm test
```

Kiểm tra nhanh sau khi `npm start`:

```bash
curl -i localhost:3000/login              # 200
curl -i localhost:3000/api/auth/session   # 200 ({} nếu chưa đăng nhập) — 500 nghĩa là thiếu AUTH_SECRET
curl -i localhost:3000/api/mindmap        # 401 JSON (đúng, vì chưa đăng nhập)
```


## AI Architecture

Điểm gọi AI **duy nhất** của toàn app là `src/lib/ai/router.ts` (`generateText` / `generateJSON`).
Chuỗi provider và điều kiện chuyển tiếp:

```
Gemini  →  Groq  →  DeepSeek  →  Qwen  →  OpenRouter
```

- Provider **thiếu API key bị bỏ qua hoàn toàn** (`isConfigured()`), không tính là lỗi và không crash app.
- Mỗi provider được thử **tối đa 2 lần** (1 gốc + 1 retry) cho lỗi **transient**: `429`, `5xx`, timeout, network.
- `401/403` (sai/hết hạn API key) → **không retry**, chuyển provider kế tiếp ngay.
- `404` (model bị gỡ/đổi tên) → **không retry** (lỗi cấu hình riêng của provider đó), chuyển provider kế tiếp.
- `400/422` (request sai) → **dừng luôn**, không fallback, vì provider khác cũng sẽ từ chối y hệt.
- Hết toàn bộ provider → ném `AIOverloadedError`; route map thành **HTTP 503** + message thân thiện
  (KHÔNG phải 500), nên một provider hết quota **không** làm sập ứng dụng.
- Timeout mỗi provider: Gemini 12s, Groq 8s, OpenRouter 12s (`providers/timeout.ts`).

**Ngoại lệ có chủ ý — embedding (RAG) KHÔNG đi qua router:** `lib/embeddings/vector.ts` chỉ dùng Gemini
`gemini-embedding-001` vì cột DB là `vector(768)`; trộn vector từ model khác sẽ làm sai lệch ngầm kết quả
similarity search. Vector 3072 chiều được cắt về 768 chiều đầu rồi L2-normalize (kỹ thuật MRL chính thức
của Google). Vì vậy khi Gemini hết quota, phần **hỏi đáp tài liệu** có thể lỗi dù tutor/quiz vẫn chạy nhờ fallback.

System prompt của mọi tính năng nằm tập trung ở `src/lib/ai/prompts.ts`.

## Mind Map Export

Nút **Export** trên trang `/mindmap` mở `MindMapExportModal` (không tải file ngay):

| Định dạng | Nội dung | Ghi chú |
|---|---|---|
| **PNG** | Toàn bộ graph raster hoá ở scale 2× | `svgToPngBlob()` — vẽ qua canvas từ SVG |
| **SVG** | Vector đầy đủ (node, nhánh, label, badge loại node, màu theo theme) | Không vỡ khi phóng to |
| **PDF** | Ảnh mind map khổ A4 (595×842pt) + footer | Sinh ở **server** (`POST /api/mindmap/export`, pdfkit) vì pdfkit là package server-only |
| **JSON** | `{ version, title, nodes[{id,label,parentId,type,description}], edges[{id,source,target}] }` | Dùng để **backup & restore** — đủ dữ liệu để xây dựng Import Mind Map sau này |
| **Markdown** | Outline phân cấp (`#` → `##` → `-`), kèm `> description` và nhãn loại node | Đọc/chia sẻ nhanh |

**Không phải screenshot viewport.** `lib/mindmap/layout.ts` chạy thuật toán 2 pass (tính chiều cao cây con →
gán toạ độ) để có **bounding box của toàn bộ graph**, nên node nằm ngoài vùng nhìn hiện tại vẫn được xuất.
Nhánh đang **thu gọn** trên UI sẽ bị bỏ khỏi file (đúng ý người dùng); edge được hợp nhất từ `edges` khai báo
và từ quan hệ `parentId` để không mất nhánh nào.

Tên file tự động: `<tên mind map>.<png|svg|pdf|json|md>`, đã sanitize ký tự cấm nhưng **giữ dấu tiếng Việt**
(`sanitizeFilename()`), có loading state, toast thành công/lỗi và responsive trên mobile.

Logic export tách khỏi `page.tsx` thành service thuần trong `src/lib/mindmap/` (`graph.ts` → kiểu dữ liệu,
`layout.ts` → toạ độ, `export.ts` → sinh file) và được test bằng `src/lib/mindmap/__tests__/export.test.ts`.

## Authentication

- **Auth.js v5** (`next-auth`), cấu hình duy nhất ở `src/auth.ts`; route handler bắt buộc theo convention
  ở `app/api/auth/[...nextauth]/route.ts`.
- Provider: **Google OAuth** + **Credentials (email + password)**, mật khẩu hash `bcryptjs` (cost 12) ở
  `User.passwordHash`. Đăng ký qua `POST /api/auth/register`.
- **Session strategy = JWT** vì Auth.js không hỗ trợ Credentials provider với session kiểu "database";
  `PrismaAdapter` vẫn lưu User/Account vào Postgres (không tạo bản ghi Session khi dùng JWT — đúng thiết kế).
- `lib/auth/session.ts` → `getCurrentUserId()` đọc session, **xác minh user còn tồn tại trong DB** trước khi
  trả userId (tránh lỗi P2003 khi DB đổi/reset mà cookie cũ vẫn hợp lệ) và trả `401` JSON chuẩn hoá.
- `src/proxy.ts` chặn **page** chưa đăng nhập (redirect `/login`); **API không bị redirect** để client luôn
  nhận JSON 401 thay vì HTML của trang login.
- `AUTH_SECRET` nên được set ở production (khoá ký session JWT). Nếu thiếu, `src/auth.ts` **tự dẫn xuất
  secret dự phòng** từ `DATABASE_URL` (SHA-256 + domain separator, bỏ query string để không đổi khoá khi
  chỉnh tham số pool) và ghi cảnh báo trong Runtime Logs — nhờ vậy `/api/auth/*` vẫn chạy thay vì 500.
  Set `AUTH_SECRET` để tách khoá ký session khỏi credential DB (best practice). Self-host ngoài
  Vercel/Cloudflare cần thêm `AUTH_URL` (hoặc `AUTH_TRUST_HOST=true`).


## Deployment

### Vercel

1. Import repo `learnx-ai` vào Vercel (framework tự nhận là Next.js).
2. Build command giữ mặc định `npm run build` (= `prisma generate && next build`).
3. Thêm **Environment Variables** cho cả Production và Preview:

| Biến | Bắt buộc | Nếu thiếu thì sao |
|---|---|---|
| `DATABASE_URL` | ✅ | Mọi API đọc/ghi DB trả HTTP 500 |
| `AUTH_SECRET` | ⬜ (khuyến nghị) | Thiếu thì `src/auth.ts` dẫn xuất secret từ `DATABASE_URL` → auth vẫn chạy; set riêng để tách khoá ký session khỏi credential DB |
| `GEMINI_API_KEY` | ⬜ (nên có) | RAG/embedding không chạy, AI phải dựa vào fallback |
| `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `QWEN_API_KEY` | ⬜ | Provider tương ứng bị bỏ qua |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ⬜ | Cần nếu dùng đăng nhập Google |
| `AUTH_URL` / `AUTH_TRUST_HOST` | ❌ trên Vercel | Vercel tự set `VERCEL=1` nên Host được tin |

4. **Áp migration lên DB production** (một lần sau mỗi đợt có migration mới) — Vercel KHÔNG tự chạy bước này:
   ```bash
   DATABASE_URL="<direct-connection-string>" npm run db:migrate
   npx prisma migrate status   # xác nhận "Database schema is up to date!"
   ```
   Thiếu bước này, mọi API dùng bảng mới sẽ trả HTTP 500 (`The table public.X does not exist`).
5. Google OAuth: thêm `https://<domain>/api/auth/callback/google` vào Authorized redirect URIs.
6. Sau khi đổi biến môi trường **phải Redeploy** (biến chỉ được nạp lúc build/runtime mới).
7. `next.config.js` in cảnh báo `[env] THIẾU BIẾN BẮT BUỘC: ...` ngay trong build log nếu thiếu biến —
   đọc Build Logs trước khi đọc Runtime Logs.

Cấu hình trong `next.config.js` đã xử lý 3 vấn đề đặc thù serverless:

- `serverExternalPackages` cho `pdfkit`, `pdf-parse`, `pdfjs-dist`, `mammoth`, `jszip`, `docx` — nếu bị
  bundle, chúng mất đường dẫn file nội bộ (`fs`) và route sẽ 500 dù chạy tốt ở local.
- `outputFileTracingIncludes` cho `src/fonts/**` — không có, PDF trên Vercel rơi về font Helvetica và mất
  dấu tiếng Việt.
- `lib/db/prisma.ts` tự thêm `connection_limit=1&pool_timeout=20` khi chạy trên Vercel/Lambda (và
  `pgbouncer=true` nếu URL dùng cổng pooler 6543) để không cạn connection Postgres khi scale ngang.

### Kiểm tra sau deploy

```bash
curl -i https://<domain>/login              # 200
curl -i https://<domain>/api/auth/session   # 200  ← 500 tại đây = thiếu AUTH_SECRET
curl -i https://<domain>/api/mindmap        # 401 JSON (đúng: chưa đăng nhập)
```


## Troubleshooting

### 1. `/api/auth/*` trả 500, app hiện "Server Problem" / `ClientFetchError`

Đây là lỗi đã được audit và xác định **root cause** bằng cách tái hiện local. Triệu chứng đặc trưng:

```text
GET /api/auth/providers → 500   body: {"message":"There was a problem with the server configuration..."}
GET /api/auth/session   → 500   (client log: ClientFetchError)
GET /api/auth/error     → 500
GET /api/profile        → 401   (hệ quả: auth() không trả được session)
GET /login              → 200 • middleware/proxy → 200
Vercel log: invocation 10–105ms, KHÔNG có outgoing external API call
```

Body trên là AuthError kind **"Configuration"** của Auth.js: nó fail ngay ở `assertConfig()` — TRƯỚC khi đọc
provider và TRƯỚC khi tạo session, nên không gọi ra ngoài (giải thích vì sao invocation chỉ vài chục ms).
Chỉ có **2 nguyên nhân khả thi**, và code hiện tại đã xử lý + tự báo rõ nguyên nhân nào:

| Nguyên nhân | Dấu hiệu | Cách xử lý |
|---|---|---|
| **Thiếu `AUTH_SECRET`** → Auth.js ném `MissingSecret`. **Đã được xử lý tự động**: `src/auth.ts` dẫn xuất secret ký session từ `DATABASE_URL` (kèm cảnh báo `[auth] AUTH_SECRET ... chưa được set — đang dùng secret DẪN XUẤT` trong Runtime Logs) | Trước fix: mọi `/api/auth/*` = 500. Sau fix: **200** bình thường; nếu **cả** `DATABASE_URL` cũng thiếu → **503** JSON nói rõ | Không bắt buộc để app chạy. Nên set `AUTH_SECRET` (`openssl rand -base64 32`) để tách khoá ký session khỏi credential DB — lưu ý đổi `DATABASE_URL` (user/password/host) sẽ làm session cũ hết hiệu lực |
| **`trustHost` bị tắt** → Auth.js ném `UntrustedHost`. Xảy ra khi self-host production thiếu `AUTH_URL`, hoặc khi biến `AUTH_URL`/`AUTH_TRUST_HOST` tồn tại với **giá trị rỗng** (`AUTH_URL=""` — Auth.js dùng `??` nên chuỗi rỗng vẫn tính là "có set") | `/api/auth/*` trả **503** JSON: `"…thiếu AUTH_URL hoặc AUTH_TRUST_HOST"` | Set `AUTH_URL="https://<domain>"` hoặc `AUTH_TRUST_HOST="true"` (và **xoá** biến rỗng nếu có) |
| Đăng nhập xong quay lại trang login | Redirect URI Google sai | Thêm `https://<domain>/api/auth/callback/google` vào Authorized redirect URIs |
| Sửa env trên Vercel nhưng lỗi không đổi | Env chỉ được nạp cho deployment MỚI | **Redeploy** sau khi sửa biến |

**Vì sao lỗi chỉ ảnh hưởng `/api/auth/*`:** `assertConfig()` chỉ chạy trong Auth.js route handler. Còn `auth()`
(dùng bởi mọi API khác qua `getCurrentUserId()`) không ném lỗi ra ngoài mà trả `null` → các API đó trả **401**.
Nghĩa là "`/api/auth/*` 500 + `/api/profile` 401" **không phải 2 lỗi khác nhau** — cùng một lỗi cấu hình.

**Code đã sửa để không phải đoán:**

- `src/auth.ts`: coi **chuỗi rỗng = chưa set** (tránh bẫy `AUTH_URL=""` → `trustHost=false` → UntrustedHost
  ngay cả trên Vercel); chỉ nhận `AUTH_URL` khi là URL tuyệt đối hợp lệ; **tự quyết định `trustHost`**
  (`AUTH_TRUST_HOST` hợp lệ / `AUTH_URL` hợp lệ / `VERCEL` / `CF_PAGES` / dev) và truyền tường minh
  `secret` + `trustHost` vào `NextAuth()`.
- `src/app/api/auth/[...nextauth]/route.ts`: guard chặn trước Auth.js → trả **503 JSON nêu đúng TÊN biến còn thiếu**
  (không bao giờ kèm giá trị) + log `[auth] CẤU HÌNH AUTH.JS CHƯA ĐẦY ĐỦ`. Khi cấu hình đầy đủ, request đi thẳng
  vào Auth.js như cũ (Google OAuth / Credentials / PrismaAdapter / JWT không đổi).
- `.env.example`: bỏ 2 dòng `AUTH_URL=""` / `AUTH_TRUST_HOST=""` + cảnh báo không tạo biến env rỗng.

**Kiểm chứng local trên bản production build:**

| Kịch bản | Trước | Sau |
|---|---|---|
| `VERCEL=1` + `AUTH_URL=""` + `AUTH_TRUST_HOST=""` + có secret | 500 (UntrustedHost) | **200** cho `/api/auth/providers|session|csrf`; providers liệt kê đủ `google` + `credentials` |
| `VERCEL=1` + không có `AUTH_SECRET` (có `DATABASE_URL`) | 500 chung chung | **200** cho `providers/session/csrf/error` nhờ secret dẫn xuất + log cảnh báo rõ ràng |
| Không có `AUTH_SECRET` **và** không có `DATABASE_URL` | 500 chung chung | **503** JSON nói rõ (`cần AUTH_SECRET hoặc DATABASE_URL`) |
| Config chuẩn — luồng credentials | — | providers 200 → csrf 200 → login 302 → session 200 (`user.id`) → **`/api/profile` 200** → `/api/mindmap` 200 |

### 2. API 500 kèm `The table public.X does not exist` (bảng chưa được tạo)

DB production **chưa được áp migration** — đây là nguyên nhân 500 rất hay gặp và không liên quan gì tới code.
Triệu chứng thực tế đã gặp: `/api/tutor/context`, `/api/practice/mistakes` 500 vì thiếu bảng `MistakeLog`,
`/api/learning-session/*` 500 vì thiếu `LearningSession`, artifact 500 vì thiếu `LearningArtifact`.

```bash
npx prisma migrate status     # xem migration nào chưa áp
npm run db:migrate            # áp tất cả (dùng connection TRỰC TIẾP, không qua PgBouncer)
```

Sau khi thêm/sửa model trong `prisma/schema.prisma`, phải chạy `npx prisma migrate dev --name <tên>` ở local
để sinh file SQL rồi commit thư mục `prisma/migrations/` — Vercel chỉ chạy `prisma generate`, **không** tự migrate.

### 3. API 500 khác kèm lỗi Prisma / "too many connections" / P1001

- Local: `DATABASE_URL` sai hoặc Postgres chưa chạy.
- Production: Postgres hết slot connection do serverless scale ngang → code tự ép `connection_limit=1`;
  nếu bạn tự set `connection_limit` trong `DATABASE_URL` thì giá trị **của bạn** được giữ nguyên.
- Dùng Supabase pooler (cổng 6543): cần `?pgbouncer=true` (code tự thêm khi phát hiện cổng 6543) — thiếu tham số
  này sẽ gặp `prepared statement "s0" already exists`.
- `Raw query failed. Code 42702: column reference "..." is ambiguous`: lỗi SQL do JOIN nhiều bảng cùng tên cột —
  phải qualify alias (`a.subject`). Đã gặp và sửa ở `getAssessmentHistoryBySubject()` (`/api/diagnostic/status`).

### 4. `prisma generate` báo EPERM trên Windows

Xảy ra khi tiến trình `next dev`/`next start` cũ còn giữ file DLL của query engine. Tắt process Node còn sót rồi
chạy lại `npm run db:generate`. Không ảnh hưởng Vercel (môi trường build sạch).

### 5. AI trả 503 / "tất cả AI provider đều không khả dụng"

Đây là hành vi **đúng** khi mọi provider fail (không phải app crash). Kiểm tra theo thứ tự:

- Gemini 429 (`rate limit`) hoặc 503 (`high demand`) → router tự retry rồi chuyển Groq → DeepSeek → Qwen → OpenRouter.
  Muốn chắc chắn có fallback, hãy set tối thiểu `GROQ_API_KEY` **hoặc** `OPENROUTER_API_KEY`.
- Gemini 404 (`model ... is not found for API version v1beta`) → model đã bị Google gỡ; đổi `GEMINI_MODEL` trong `.env`
  (không cần sửa code).
- Log `[AI] Trying provider: ...` trong Runtime Logs cho biết router đã thử tới provider nào.
- Lỗi **embedding** (RAG) không có fallback (cố ý, xem mục AI Architecture) — chỉ Gemini khớp cột `vector(768)`.

### 6. `operator does not exist: vector <-> vector` hoặc tìm kiếm tài liệu ra kết quả sai

Extension `pgvector` chưa bật, hoặc số chiều vector không khớp: cột DB là `vector(768)`, code cắt vector về 768 chiều
(`EMBEDDING_DIMENSIONS`). Muốn đổi số chiều phải sửa **cả** schema/migration **và** tạo lại toàn bộ embedding cũ.

### 7. Upload tài liệu báo `[PDF_PARSE_FAILED]` / `[PDF_NO_TEXT_LAYER]`

- `PDF_CORRUPTED`/`PDF_PARSE_FAILED`: PDF dùng xref stream nén mà `pdf-parse` không đọc được → pipeline tự chuyển sang
  `pdfjs-dist`; nếu vẫn lỗi thì file hỏng thật.
- `PDF_NO_TEXT_LAYER`: PDF scan/ảnh (không có text layer) → cần OCR, hiện chưa tích hợp. Ảnh `.png/.jpg/.webp` không
  được nhận làm tài liệu.

### 8. Vercel báo "Server Problem" nhưng local chạy tốt

Nguyên nhân phổ biến theo thứ tự: (1) thiếu biến môi trường (mục 1) — đọc Build Logs để thấy cảnh báo `[env]`;
(2) package server-only bị bundle (đã khai báo `serverExternalPackages`); (3) route dùng `fs`/`path` rơi vào Edge
runtime (route cần Node đã khai báo `export const runtime = "nodejs"`, ví dụ `/api/mindmap/export`); (4) DB connection
(mục 2). Runtime Logs của deployment chứa stack trace thật — đối chiếu với 4 nhóm trên.

### 9. Các lỗi đã sửa — đừng "sửa" lại lần nữa

- **"Updating a style property during rerender (border + borderLeft)"**: node mind map set đủ 4 longhand
  (`borderTop/Right/Bottom/Left`) trong cùng 1 style object, không trộn `border` shorthand với longhand.
- **Thiếu key dịch của SummaryDrawer**: `workspace.summaryDrawerTitle`, `workspace.downloadGuide`, `doc.downloading`
  đã có đủ ở cả VI và EN trong `lib/i18n/dictionary.ts`.
- **`middleware.ts` + `proxy.ts` cùng tồn tại**: chỉ còn `src/proxy.ts` (Next 16 đổi tên `middleware` → `proxy`).
- **Cảnh báo Next.js "stale version"**: `next` đã lên bản patch mới nhất `16.3.5`.

### 10. Khác biệt đã biết (chưa xử lý, có lý do)

- `eslint-config-next` vẫn ở nhánh 14 trong khi `next` là 16: bản 16 yêu cầu **ESLint 9 + flat config**
  (`eslint.config.mjs`), còn repo đang dùng ESLint 8 + `.eslintrc.json`. `npm run lint` hiện chạy được (0 error,
  chỉ warning `react-hooks/exhaustive-deps` và `@next/next/no-img-element`), và Next 16 **không** chạy ESLint trong
  `next build` nên không ảnh hưởng deploy. Nâng cấp cần một đợt migrate cấu hình lint riêng.
- `lib/storage/localUpload.ts` là code cũ (ghi ra `public/uploads/`) **không còn được import** — ảnh đã chuyển sang
  lưu DB (`lib/storage/dbUpload.ts` + `/api/profile/photo/[type]`).
- Trang `/mindmap` chưa có chức năng **Import**: JSON export đã chứa đủ `nodes`/`edges`/`parentId` để xây dựng
  tính năng này sau (dùng `parseMindMapData()` trong `lib/mindmap/graph.ts` để validate).
- Các tác vụ nặng (OCR, xử lý tài liệu dài) vẫn chạy inline trong request; hàng đợi (BullMQ) chỉ là ghi chú TODO.

