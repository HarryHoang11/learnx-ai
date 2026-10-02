# LearnX AI — Architecture Memory

> **Đây là bộ nhớ kiến trúc dành cho AI agent.** Mục tiêu: agent mới hiểu
> LearnX trong vài phút mà không phải đọc lại toàn bộ codebase.
>
> **Code là source of truth.** Nếu tài liệu mâu thuẫn code, hãy tin code và
> sửa lại tài liệu này (xem §17 của CLAUDE.md).

## Cách dùng

```
Đọc CODEBASE_MAP.md
      ↓
Tìm module liên quan tới task
      ↓
Đọc đúng 1 file doc của module đó (vd ONBOARDING.md)
      ↓
Mở CHÍNH những source file cần thiết
      ↓
Sửa code
      ↓
Verify
      ↓
Cập nhật doc + CHANGELOG.md nếu thay đổi có ý nghĩa kiến trúc
```

**Không** đọc song song tất cả các file doc — chúng được viết để tra theo nhu cầu.

## Danh mục

| File | Khi nào đọc |
|---|---|
| [CODEBASE_MAP.md](./CODEBASE_MAP.md) | **Luôn bắt đầu ở đây.** Bản đồ module + dependency |
| [DATA_FLOW.md](./DATA_FLOW.md) | Task đổi luồng dữ liệu, hoặc cần hiểu dữ liệu đi đâu |
| [DATABASE.md](./DATABASE.md) | Task chạm Prisma model, mastery, attempt, review |
| [AUTH.md](./AUTH.md) | Task chạm session, middleware, protected route, `userId` |
| [AI_SYSTEM.md](./AI_SYSTEM.md) | Task chạm AI provider, prompt, context, fallback |
| [ONBOARDING.md](./ONBOARDING.md) | Task chạm luồng welcome → khảo sát → hồ sơ → dashboard |
| [SUBJECTS.md](./SUBJECTS.md) | Task chạm môn học, question type, đa môn |
| [MOBILE.md](./MOBILE.md) | Task chạm responsive, bottom nav, APK, FAB |
| [CHANGELOG.md](./CHANGELOG.md) | Trước khi sửa: thay đổi kiến trúc gần đây có liên quan không |

> Rewards / Achievement / Challenge **chưa** có file doc riêng — hiện nằm ở
> [CODEBASE_MAP.md](./CODEBASE_MAP.md) § Gamification / Rewards (kèm 6 quy tắc
> vàng). Đọc mục đó trước khi sửa UI thưởng.

## Quy ước khi đọc source

- **Route handler** ở `src/app/api/**/route.ts`. Lấy `userId` từ session
  (`getCurrentUserId()`), **không** tin `userId` từ client — xem [AUTH.md](./AUTH.md).
- **UI + logic** tách nhau: page/`"use client"` gọi service; service gọi Prisma và
  AI. Component không query DB.
- **Giá trị cấu hình** nằm ở `src/lib/constants/` và `src/config/`. Không hardcode
  danh sách môn, XP, hay app config rải rác.
- **Text hiển thị** nằm ở `src/lib/i18n/dictionary.ts` (vi + en, cùng key).
  Không hardcode chuỗi trong component — xem [MOBILE.md](./MOBILE.md) phần i18n.

## Kiểm chứng chuẩn

```bash
npx tsc --noEmit -p tsconfig.json   # typecheck (không có script "typecheck" riêng)
npm run lint                        # eslint src
npx vitest run                      # test
npx next build                      # build (bỏ qua prisma generate)
```

`npm run build` chạy `prisma generate && next build`; báo `EPERM` trên Windows nếu
dev server đang chạy (giữ khoá `query_engine-windows.dll.node`). Dùng
`npx next build` để verify trong lúc dev.

Baseline hiện tại: **0 type error · 0 lint error (22 warning cố định) · 437 test
pass · build pass**. Không được làm tăng warning.
