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

```
prisma/schema.prisma          Toàn bộ bảng DB (User, Attempt, Roadmap...)
src/
  app/
    layout.tsx, page.tsx      Khung Next.js tối thiểu
    dashboard/page.tsx        Trang mẫu minh hoạ gọi API (chưa có UI đẹp)
    api/
      ai/chat, ai/hint        AI Tutor kiểu Socratic
      assessment/*            Diagnostic Test thích ứng
      quiz/*                  Luyện tập theo chủ đề
      roadmap/*                AI Learning Path
      documents/*              Upload + RAG (pgvector)
      progress, analytics       Dashboard tiến độ
  lib/
    db/prisma.ts               Prisma Client singleton
    ai/gemini.ts, ai/prompts.ts Gọi Gemini + toàn bộ prompt
    auth/session.ts             Session tối giản (JWT tự chế)
    embeddings/vector.ts         Embedding + tìm kiếm pgvector
  services/
    assessment.service.ts       Adaptive branching + tính mastery
    quiz.service.ts              Sinh câu hỏi + chấm điểm
    roadmap.service.ts           Sinh lộ trình theo mục tiêu
    tutor.service.ts             Chat AI Tutor + lịch sử hội thoại
    document.service.ts          Pipeline RAG (chunk/embed/tóm tắt)
  types/index.ts                 Type dùng chung toàn bộ backend
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

## 5. Việc CHƯA làm (nằm ngoài phạm vi MVP, ghi rõ để không quên)

- Retry xử lý tài liệu lỗi (`api/documents/process` action `retry`) cần lưu thêm `rawText` gốc — hiện DB chỉ lưu chunk đã xử lý.
- Xử lý upload tài liệu hiện chạy trực tiếp trong request (`await file.text()`), nên dùng queue thật (BullMQ/Redis) khi tài liệu lớn hoặc traffic cao.
- Roadmap chưa tự động cập nhật trạng thái `done` khi học sinh hoàn thành 1 topic — cần thêm logic nối `LearningProgress` với `Roadmap.months` (đã ghi TODO trong `roadmap.service.ts`).
- Giao diện `dashboard/page.tsx` mới là bản "trần", cần ghép lại CSS + markup từ bản demo HTML tĩnh trước đó (dark + glassmorphism) — cấu trúc component nên tách theo từng view (Home/Tutor/Diagnostic/Roadmap/Progress/Library) giống các section trong bản demo.

## 6. Danh sách API đã có

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
