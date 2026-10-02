# AUTH

NextAuth v5 (beta) + Prisma adapter. Credentials (bcryptjs) + Google OAuth tuỳ chọn.

## Files

| File | Vai trò |
|---|---|
| `src/auth.ts` | Cấu hình NextAuth, callbacks, `jwt()` mirror trạng thái onboarding |
| `src/proxy.ts` | Middleware — redirect dựa trên session |
| `src/lib/auth/` | Helper |
| `src/components/auth/AuthShell.tsx` | Khung chung cho Login/Register (desktop 2 cột · ≤900px 1 cột) |
| `src/components/auth/AuthField.tsx` | Ô nhập có `<label>` + `aria-invalid`/`aria-describedby` |
| `src/components/auth/PasswordInput.tsx` | Ô mật khẩu có nút hiện/ẩn — dùng chung Login/Register/`ChangePasswordPanel` |
| `src/components/auth/PasswordStrength.tsx` | Thanh đo độ mạnh, dùng **đúng quy tắc server** (`zxcvbn`/regex trong `auth.ts`) |
| `src/components/auth/OAuthButtons.tsx` | Nút Google (`type="button"` + chặn bấm lặp) |
| `src/components/auth/auth.css` | Toàn bộ style auth; **token lấy từ `globals.css`**, không khai báo biến mới |
| ~~`src/components/auth/AuthCard.tsx`~~ | **Đã xoá** — 0 caller sau khi 2 trang chuyển sang `AuthShell` |
| `src/app/api/auth/**` | Route của NextAuth |

## Redirect sau login — KHÔNG quyết định ở trang auth

Cả `/login` và `/register` chỉ `router.push("/dashboard")` rồi **để
`src/proxy.ts` định tuyến** (`/welcome` → `/onboarding` → `/dashboard`) dựa trên
`onboardingStatus` trong JWT.

**Lý do**: nếu trang auth tự fetch `onboardingStatus` để quyết định, sẽ tạo
**3 nguồn sự thật** (JWT trong `proxy.ts` · DB qua API · state client) và dễ lệch
— đúng loại bug đã xảy ra ở module khác.

## Performance: `/api/auth/session` chậm

Endpoint này có thể mất ~1s. Nguyên nhân **chưa xác định chắc chắn** — cần đo
runtime thực tế, không nên đoán:

- Auth.js v5 với JWT session: middleware chạy mỗi request.
- Callback `jwt()` trong `auth.ts` có gọi `prisma.user.findUnique` khi refresh
  token ⇒ DB round-trip mỗi lần làm mới.

**Đã kiểm tra và KHÔNG phải nguyên nhân**: 7 callsite `useSession()` **không**
tạo 7 request — tất cả dùng chung 1 `SessionProvider` context
(`SessionProviderWrapper.tsx`), và `reactStrictMode` **không** bật. Không có
duplicate fetch, không sửa.

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

- Nhóm `(app)/*` — 18 route, yêu cầu đăng nhập, bọc trong `AppShell`
- `/dashboard` — **cố ý không bị gate**, user mới phải thấy app
- `/analytics/*`, `/api/*` — tự validate qua `getCurrentUserId()`

## Env

`AUTH_SECRET` nên set riêng (tách khoá ký session khỏi credential DB). Nếu không
set, `auth.ts` tự dẫn xuất từ `DATABASE_URL` và ghi cảnh báo vào Runtime Logs.
Google OAuth bỏ trống ⇒ chỉ dùng email/password.

### BẮT BUỘC self-host: `AUTH_URL` **hoặc** `AUTH_TRUST_HOST`

> Triệu chứng: `GET /api/auth/session` trả **500**, browser báo
> `ClientFetchError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON`.

**Chuỗi nguyên nhân (không đoán — đã kiểm chứng bằng build):**

1. Auth.js `assertConfig()` kiểm tra `trustHost` **TRƯỚC** `secret`.
2. Thiếu cả `AUTH_URL` lẫn `AUTH_TRUST_HOST` ⇒ `UntrustedHost` ⇒ **mọi**
   endpoint `/api/auth/*` trả 500 với body dạng TEXT/HTML.
3. Auth.js client nhận body đó và cố `JSON.parse` ⇒ `Unexpected token '<'`.

Đây là kiểu 500 **dễ chẩn đoán nhầm nhất**: phần còn lại của app vẫn chạy bình
thường, chỉ có auth chết. `getAuthConfigIssues()` (route `[...nextauth]`) trả
JSON nói rõ thiếu biến nào, và `next.config.js` cảnh báo lúc build.

**Cách sửa** (chọn 1):

```bash
AUTH_URL="https://domain-that-that"        # URL công khai, tuyệt đối
# hoặc
AUTH_TRUST_HOST="true"                     # tự host sau reverse-proxy
```

Cơ chế `resolveTrustHost()` trong `src/auth.ts` (thứ tự):
`AUTH_TRUST_HOST` → `AUTH_URL`/`NEXTAUTH_URL` hợp lệ → `VERCEL`/`CF_PAGES` →
`NODE_ENV != production` → `VERCEL_URL`. `readPublicUrl()` **bỏ qua** giá trị rác
thay vì làm hỏng app — dán template có `AUTH_URL=""` là bẫi: Auth.js dùng `??` nên
chuỗi rỗng vẫn bị coi là "đã set" mà `!!""` = `false`.

**Kiểm chứng:** chạy `next build` — nếu thấy
`[auth] CẤU HÌNH AUTH.JS CHƯA ĐẦY ĐỦ` thì còn thiếu. Đặt `AUTH_URL` rồi build
lại, warning biến mất là chắc chắn đủ.

### Đã kiểm chứng bằng HTTP THẬT (2026-10-04)

Không suy đoán — đã dựng `next start -p 3100` (production) rồi gọi thật:

| Điều kiện | Kết quả thực tế |
|---|---|
| **Dev** `localhost:3000` | `HTTP 200` · `application/json` · body `null` |
| **Prod, thiếu `AUTH_URL`** | `HTTP 503` · `application/json` · `{"success":false,"error":"Đăng nhập chưa được cấu hình trên máy chủ: thiếu AUTH_URL hoặc AUTH_TRUST_HOST…"}` |
| **Prod, có `AUTH_URL`** | `HTTP 200` · `application/json` · body `null` ✅ |
| `/api/auth/providers` (prod) | `HTTP 200` · `application/json` · 387 bytes ✅ |

Body `null` là response **ĐÚNG** của Auth.js cho người dùng chưa đăng nhập — không
phải lỗi.

**Về lỗi `Unexpected token '<'`:** route `[...nextauth]` đã có guard trả **JSON**
kèm message rõ ràng *trước khi* Auth.js kịp ném lỗi, nên code hiện tại **không**
còn trả HTML 500. Nếu bạn vẫn thấy HTML ⇒ dev server đang chạy **bản code cũ**:
dừng `npm run dev` rồi chạy lại. Fast Refresh **không** nạp lại `next.config.js`
hay các file sinh trong `.next`.

## Test

Không có test riêng cho auth. Nếu sửa callback hoặc middleware, kiểm tra thủ
tay: login → welcome gate → onboarding gate → không loop. Có test khoá hành vi
gate trong `lib/onboarding/__tests__/state.test.ts`.
