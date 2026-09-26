# AUTH

NextAuth v5 (beta) + Prisma adapter. Credentials (bcryptjs) + Google OAuth tuỳ chọn.

## Files

| File | Vai trò |
|---|---|
| `src/auth.ts` | Cấu hình NextAuth, callbacks, `jwt()` mirror trạng thái onboarding |
| `src/proxy.ts` | Middleware — redirect dựa trên session |
| `src/lib/auth/` | Helper |
| `src/components/auth/AuthCard.tsx` | Card login/register dùng chung |
| `src/app/api/auth/**` | Route của NextAuth |

## Flow

```
/login · /register
      ↓ NextAuth signIn
   Session DB + JWT cookie
      ↓
src/proxy.ts đọc session (NextResponse.next({ request: { headers } }))
      ↓ auth.ts re-wrap session để server component thấy user
      ↓
Route handler: getCurrentUserId()  ← NGUỒN SỰ THẬT duy nhất
```

## Quy tắc vàng: KHÔNG tin `userId` từ client

```ts
// SAI — client gửi userId lên, backend tin
const userId = body.userId;

// ĐÚNG
const userId = await getCurrentUserId();  // từ session
```

Mọi query phải có `where: { userId }`. Đây là ranh giới bảo mật của toàn app:
`ExerciseAttempt`, `ReviewItem`, `Attempt`, `LearningProgress`, analytics — tất cả
đều là dữ liệu riêng tư.

## JWT mirror

`auth.ts` callback `jwt()` nhúng `onboardingStatus`, `welcomeSeenAt`,
`surveyDecidedAt` vào token để `proxy.ts` **không phải query DB mỗi request**.

**Hệ quả bắt buộc:** sau khi ghi trạng thái onboarding phải gọi
`useSession().update()` để làm mới token — thiếu bước này là lỗi kinh điển
"onboarding không bao giờ kết thúc" (proxy giữ token cũ).

Nguồn sự thật vẫn là DB; JWT chỉ là cache.

## Middleware: `src/proxy.ts`

**Lưu ý vị trí**: ở `src/proxy.ts`, KHÔNG phải `src/app/proxy.ts`.

Thứ tự kiểm tra:

1. `!isLoggedIn` → cho qua (route handler tự trả 401)
2. `needsWelcome && !isExemptFromWelcomeRedirect(path)` → `/welcome`
3. `/welcome` mà đã xem → `/dashboard` (trừ `?replay=true`)
4. `needsProfile && isLearningGatedPath(path)` → `/onboarding` (gate mềm)

`WELCOME_EXEMPT_PATHS` gồm `/onboarding`, `/setup`, `/welcome` ⇒ không loop.

## Protected routes

- Nhóm `(app)/*` — 16 route, yêu cầu đăng nhập, bọc trong `AppShell`
- `/dashboard` — **cố ý không bị gate**, user mới phải thấy app
- `/analytics/*`, `/api/*` — tự validate qua `getCurrentUserId()`

## Env

`AUTH_SECRET` nên set riêng (tách khoá ký session khỏi credential DB). Nếu không
set, `auth.ts` tự dẫn xuất từ `DATABASE_URL` và ghi cảnh báo vào Runtime Logs.
Google OAuth bỏ trống ⇒ chỉ dùng email/password.

## Test

Không có test riêng cho auth. Nếu sửa callback hoặc middleware, kiểm tra thủ
tay: login → welcome gate → onboarding gate → không loop. Có test khoá hành vi
gate trong `lib/onboarding/__tests__/state.test.ts`.
