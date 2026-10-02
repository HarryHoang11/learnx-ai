# ARCHITECTURE CHANGELOG

Chỉ ghi thay đổi có **giá trị lâu dài** (module boundary, data flow, API, schema,
business logic, navigation). KHÔNG ghi: sửa typo, đổi margin, đổi tên biến.

Đọc file này **trước khi sửa** — để biết thay đổi gần đây có ảnh hưởng không.

---

## 2026-10-05 — Regression: `/api/auth/*` trả 503 (auth chết nhưng app vẫn chạy)

### Root cause thật — KHÔNG phải thiếu env, là 2 chỗ đọc env KHÁC NHAU

Brief báo `/api/auth/session` lỗi + `Unexpected token '<'`. Reproduce bằng
`next start` (production) cho **503 kèm JSON**:

```
{"success":false,"error":"... thiếu AUTH_URL hoặc AUTH_TRUST_HOST ..."}
```

`Unexpected token '<'` chỉ là **hệ quả**: client mong JSON, server trả HTML.

Mắt xích:

| Nơi | Đọc env | Project đặt | Kết quả |
|---|---|---|---|
| `layout.tsx` `resolveMetadataBase()` | `APP_URL` → `NEXTAUTH_URL` | `APP_URL` | ✅ OK |
| `auth.ts` `readPublicUrl()` | `AUTH_URL` → `NEXTAUTH_URL` | `APP_URL` | ❌ `undefined` |

⇒ `publicAuthUrl` undefined ⇒ `resolveTrustHost()` false ⇒ `UntrustedHost` ⇒
guard trong `api/auth/[...nextauth]/route.ts` trả **503 cho mọi `/api/auth/*`**.

**Vì sao dev không lộ:** nhánh `NODE_ENV !== "production"` tự trả `true`. Chỉ
`next build && next start` mới thấy — đó là lý do "sửa xong, Fast Refresh ổn"
không bao giờ bắt được lỗi này.

**Vì sao `/api/streak` trả 401 chứ không 503:** chúng gọi `getCurrentUserId()` →
`auth()` trả `null` → `unauthorizedResponse()`. Auth chết nhưng app vẫn render.

### Sửa: MỘT nguồn sự thật cho "URL công khai của app"

- `src/config/app.ts` — `PUBLIC_URL_ENV_NAMES` + `resolvePublicUrl(env)` (hàm
  thuần, nhận `env` làm tham số nên test không cần mock `process.env`). Đặt ở
  tầng `config/` vì **không** phụ thuộc NextAuth/Prisma — để trong `auth.ts` thì
  `layout.tsx` phải import `@/auth` và kéo Prisma client vào root layout.
- `src/auth.ts` + `src/app/layout.tsx` — cùng gọi `resolvePublicUrl()`.

`resolvePublicUrl` duyệt **từng biến, chỉ nhận URL parse được** thay vì lấy biến
đầu tiên rồi bỏ — nếu lấy biến đầu tiên, đặt `AUTH_URL` sai sẽ chặn luôn
`APP_URL` đúng ⇒ tái tạo đúng lỗi gốc.

Không disable SessionProvider · không fake session · không hardcode secret ·
không thêm biến mới bắt buộc.

### Regression test

`src/config/__tests__/publicUrl.test.ts` — 8 test: đọc `APP_URL`, bỏ biến rỗng,
**bỏ biến sai định dạng rồi thử biến kế tiếp**, thứ tự ưu tiên, từ chối scheme
không phải http(s), trim, và giữ `AUTH_URL` ưu tiên như cũ.

### Kiểm chứng THỰC TẾ (`next start` + curl, không phải suông)

| Endpoint | Trước | Sau |
|---|---|---|
| `/api/auth/session` | 503 | **200** (`null` — đúng, chưa đăng nhập) |
| `/api/auth/providers` | 503 | **200** (google + credentials) |
| `/api/auth/csrf` | 503 | **200** (có csrfToken) |
| login sai mật khẩu | — | **302** (đúng luồng Auth.js) |
| `/api/streak`, `/api/onboarding` | 401 | 401 (đúng) |
| `/dashboard` | 307 | 307 (đúng — proxy chuyển hướng) |

tsc exit 0 · ESLint **0 error** · **478/478 test (38 file)** ·
check:css / check:form / check:file-input PASS · build 0 warning.

### 2. Light mode: thanh tiến trình / spinner / workspace "biến mất"

Đợt 2026-10-04 đã sửa **shadow** hardcode, nhưng bỏ sót nhóm thứ hai: các bề
mặt nền gõ cứng `rgba(255,255,255,0.07)` — đúng trên nền tối, nhưng trên nền
sáng `#f5f6fb` thì trắng-mờ gần như **vô hình**. Đã kiểm tra: light block có
**0** override cho các rule này.

Gom thành token `--track-bg / --track-border / --spinner-track /
--spinner-head / --workspace-bg / --workspace-panel / --scrollbar-thumb`, khai
báo 2 bản (dark giữ **đúng** giá trị cũ; light đảo chiều overlay sang TỐI mờ).
Áp cho `.bar-track`, `.level-hero__track`, `.spinner-ring`, `.workspace-grid`,
`.workspace-sources`, scrollbar, và 1 chỗ inline trong `/diagnostic`.

Ngoài ra chuẩn hoá `borderRadius: 99` (số, không kèm `px`) → `var(--radius-pill)`
ở **11 file** — đợt trước chỉ bắt `99px` nên sót hết dạng số.

### Bài học (đã thêm vào bảng bẫy)

- Chỉ `next dev` **không đủ** để kết luận auth ổn — phải test `next start`.
- Hai chỗ cùng đọc "URL công khai" mà liệt kê env khác nhau là **lỗi kiến trúc**,
  không phải lỗi cấu hình; sửa bằng cách gom về một nguồn sự thật ở đúng tầng.
- **Không** `insert_line` mù vào giữa file CSS: chèn rơi vào giữa một comment
  đang mở (`/*` chưa có `*/`) làm hỏng cả khối. Guard `check:css` bắt được ngay —
  luôn chạy sau mỗi lần sửa CSS.

---

## 2026-10-05 — Phase 1: Design tokens + sửa 2 bug UI thật

---


### Root cause (không phải "làm đẹp thêm")

Brief yêu cầu nâng cấp UI/UX nhưng mô tả tech stack là **Tailwind**, còn repo
thực tế dùng **CSS thuần + CSS variables** (`CODEBASE_MAP.md` đã ghi rõ). Không
cài Tailwind — làm vậy là rewrite toàn bộ project, phá 5.308 dòng CSS + 10 file
CSS component. Nay **mở rộng đúng hệ token sẵn có**.

### Palette (do chủ repo chốt)

Dark `: #070b16` · primary `#7775ff` · secondary `#45d9e9` (đổi từ
`#0a0e16 / #7c6cf0 / #35d0d8`). Áp cho **cả dark và light mode** — light mode
dùng bản đậm hơn của cùng hue để đạt tương phản trên nền sáng.

**Bẫy phát hiện khi đổi palette:** màu KHÔNG nằm trong `:root` mà gõ cứng
`rgba()` rải rác. Đổi mỗi token ở `:root` sẽ khiến app **nửa đổi nửa không**,
trông như lỗi. Đã quét và thay **60 literal** indigo/cyan + 17 chỗ
`border-radius: 99px` (→ `--radius-pill`) ở 6 file. Sau khi sửa: **0 literal màu
cũ còn lại**.

| File | Thay |
|---|---|
| `globals.css` | 48 rgba + token `--bg/--indigo/--cyan` |
| `rewards/rewards.css` | 7 rgba + 10 pill |
| `mindmap/layout.ts` | `NODE_TYPE_COLORS` + `EXPORT_BG` — TS mirror của theme vì SVG/canvas **không** đọc được CSS var (xem ghi chú ngay tại file) |
| `tutor/ChatBubble.tsx`, `subject/*.css`, `onboarding.css` | literal còn sót |

### Token MỚI (phần lớn là điều hoá cái đã có, không phải phát minh)

- **Semantic** `--success / --warning / --danger / --destructive / --info` (+ `-soft`, `-border`) — brief §4 yêu cầu. Trước đó **không tồn tại**: component phải gõ `var(--success, #4ade80)` (fallback vì token không có). Nay đã có token thật → xoá fallback.
- **Hết bất nhất màu**: `success` trước có **2 định nghĩa** (`.toast--success` dùng CYAN, `.badge--success` dùng GREEN); `error` có **2 mã đỏ** (`.badge--error` `#ef6a7d` vs `--rose` `#f07c91`). Nay cả hai cùng trỏ token.
- **Typography scale** `--text-display/heading/body/caption/label` + `--font-display/--font-body` + `--weight-*`. Trước đó mỗi component tự gõ `fontSize` (11/11.5/12/12.5/13/13.5/…) nên cùng một vai trò lệch cỡ ở mỗi nơi. **Font tái dùng Space Grotesk + Inter đã có sẵn — không thêm font.**
- **Glass** `--glass-blur / --glass-blur-sm / --glass-border-opacity`.
- **`--radius-pill`** gom 17 chỗ gõ cứng `99px`.

Token alias trỏ về `--green/--rose/...` nên **light mode không cần khai lại**
trừ 4 token có alpha viết cứng (`--*-border`) — trên nền sáng alpha `.32` của
bản dark quá nhạt, viền biến mất.

### Bug 1 — nút Lưu/Tải xuống VÔ HÌNH (`components/community/DocumentCard.tsx`)

```
opacity: 0 (inline)  +  <style jsx> `.card-actions{opacity:0} :host:hover{...}`
```

`:host` là selector của **web component**, **không tồn tại** trong styled-jsx →
rule không bao giờ khớp → nhóm nút kẹt `opacity:0` vĩnh viễn ⇒ **2 nút không
hiện, không bấm được**. Đây cũng là `<style jsx>` **duy nhất** trong repo (vi
phạm convention: mọi thứ khác dùng `globals.css`).

Sửa: hover do **CSS** đảm nhiệm; ẩn-khi-hover chỉ bật trong `@media (hover: hover)`
⇒ **trên mobile/APK (không có hover) nút luôn hiện**. Kèm `role="button"` +
`tabIndex` + Enter/Space + `:focus-visible` vì thẻ có `onClick`.

### Bug 2 — token không tồn tại (`components/documents/DocumentCard.tsx`)

`color: "var(--success, #4ade80)"` / `var(--danger, #f87171)` — `--success` và
`--danger` **không có trong `:root`**, nên màu thực tế lấy từ fallback hex và
**không theme hoá được** (light mode vẫn xanh lá kiểu dark). Xoá fallback sau khi
có token thật.

### Ảnh hưởng

- **Business logic / API / Prisma / auth: KHÔNG đổi.** Chỉ CSS + 1 component.
- `auraColor` trong `prisma/seed/cosmetics.ts` (`#7c6cf0`) **cố ý giữ**: nó là
  dữ liệu cosmetic đã lưu trong DB, đổi token không đổi được dữ liệu đã có
  (và không được tự ý migrate DB).

### Kiểm chứng

tsc exit 0 · ESLint 0 error (22 warning có sẵn) · **470/470 test (37 file)** ·
build **0 warning**, 34 route · check:css / check:form / check:file-input PASS.
Brace balance `globals.css` 722/722 (HEAD: 633/633) — không mất rule.

### Bài học

`npm run build` gồm `prisma generate` và **fail với EPERM khi có tiến trình
node đang giữ `query_engine-windows.dll.node`** (dev server). Không phải lỗi
code — dùng `npx next build` để kiểm chứng, hoặc tắt dev server trước.

---


### Root cause thật (không phải "thêm padding cho đẹp")

Trace chuỗi: `Prisma SubjectTopic (parentId)` → `GET /api/community/subjects?includeTopics=true`
→ `page.tsx` form state → `FormData` → `route.ts` → `community-document.service.ts`
→ `CommunityDocument`. Mọi lỗi dưới đây đều nằm ở tầng **hiển thị**, không
phải backend.

### Form "Thông tin tài liệu"

| Vấn đề | Root cause | Sửa |
|---|---|---|
| **Grammarly che textarea** | Extension chèn icon; app không có cơ chế báo tắt | `spellCheck={false}` + `data-gramm="false"` (+ 2 attr khác). **KHÔNG** dùng CSS/div trắng che — chỉ giấu triệu chứng. CHỈ áp cho textarea này (tiếng Việt + thuật ngữ), không tắt spellcheck ở ô tiếng Anh khác |
| **Input "11" lệch dọc so với select** | Inline style chỉ có `padding`/`fontSize`, **không có `height`/`line-height`** ⇒ `<input>` và `<select>` gốc có chiều cao nội tuyến khác nhau | `.form-input { height: 42px }` + `line-height: 20px` khai báo cho CẢ `.form-input`/`.form-select` — sửa ở class dùng chung, không margin-top vá từng ô |
| **Mũi tên select mỗi OS khác nhau** | Không tắt `appearance` của browser | `.form-select-wrap` + `.form-select-caret` + `appearance: none`, icon `pointer-events: none`, `padding-right` chừa chỗ |
| **Lỗi gộp lên đầu form** | `setUploadError("Vui lòng nhập tiêu đề")` cho mọi loại lỗi | `FieldErrors` gán lỗi **cạnh từng ô** + `aria-invalid`/`aria-describedby`/`role="alert"` + focus ô đầu tiên sai |
| **`<label>` không `htmlFor`** | Label chỉ "đúng màu", không nhấn được vào ô | `id`/`htmlFor` thật cho mọi field |
| **Toàn bộ inline style** | Lệch design system với Login/Review/Onboarding | Dùng `.form-label`/`.form-input`/`.form-textarea`/`.form-select`/`.form-actions` + `grid-form-2col` có sẵn |

### Domain: Subject → Topic (lỗi nghiêm trọng nhất)

**Root cause:** `GET /api/community/subjects?includeTopics=true` trả kèm
`topics[].children[]` (Prisma `SubjectTopic.parentId`), nhưng form **chỉ đọc
`subject.topics`** ⇒ các chuyên đề con như "Python", "C++" (con của "Lập
trình") **không bao giờ hiện**. Người dùng bị ép chọn topic cha không liên
quan, hoặc bỏ trống.

**Sửa:**
- `src/lib/community/topicOptions.ts` — hàm thuần `flattenTopicOptions()` làm
  phẳng cả 2 tầng (child gắn nhãn `└ ` + `depth`), `shouldOfferGeneralTopic()`.
- Bỏ state `topics` (2 nguồn sự thật cho 1 dữ liệu) → `useMemo` từ
  `selectedSubject`.
- **KHÔNG tự chọn topic** — chính điều này gây ra "Cân bằng hóa học → Hóa học
  vô cơ".
- Mốc rỗng = **"Tổng hợp (nhiều chủ đề)"** cho tài liệu đa lĩnh vực; chỉ hiện
  khi môn có ≥2 topic.
- Guard `id`/`name` rỗng (bất thường do seed/admin) vì `<option value="">` sẽ
  trùng mốc "Tổng hợp".

### Metadata persistence — ĐÃ ĐÚNG, KHÔNG SỬA

Trace `UI → formData → FormData → route.ts:81-111 → community-document.service.ts:148-151
→ prisma.subjectId/topicId/grade`. Cả 3 đều truyền đúng; `topicId || undefined`
⇒ tài liệu đa lĩnh vực lưu `topicId: null` thay vì gán sai. **Không sửa
backend.** Chỉ `.trim()` ở `title`/`grade` trước khi gửi.

### Footer action

`[Hủy] [📤 Tải lên Cộng đồng]` — `.form-actions` (desktop căn phải, mobile 2
nút ≥44px, `--stack-primary` đưa nút chính lên trên). Nút chính `disabled` khi
chưa có file / đang load subjects, có `aria-busy`, nhãn đổi sang "Đang tải
lên…". Lỗi submit hiện ngay trên footer, **không reset form** để người dùng
sửa rồi bấm lại.

### Chống tái diễn

`scripts/check-form-inline.mjs` + `npm run check:form` — phát hiện
`.form-*` bị inline style ghi đè (làm class dùng chung chỉ đúng ở 1 trang).

**Cả 2 script đều được tự kiểm chứng** bằng fixture chứa đúng lỗi cũ: script
báo lỗi + exit 1, xoá fixture → pass. Trong quá trình đó tôi đã phải sửa 2 lỗi
của chính script (quét cửa sổ quá rộng gây báo động giả; chỉ quét `src` nên bỏ
fixture).

### Test mới

`topicOptions.test.ts` — 8 test: flatten 2 tầng · id child dùng được để gửi
`topicId` · môn không children · dữ liệu rác · giữ thứ tự seed ·
`shouldOfferGeneralTopic` theo số topic.

**Một test bắt được lỗi thật trong source**: `id: ""` lọt qua guard → tạo
`<option value="">` trùng mốc "Tổng hợp". Sửa ở `topicOptions.ts`, **không** nới
lỏng test.

### Kiểm chứng

tsc exit 0 · ESLint 0 error · **451/451 test** (35 files) · build 0 warning ·
check:css / check:file-input / check:form PASS. Backend/Prisma/storage
**không đổi**.

> **Chưa** verify bằng mắt (upload thật, cancel, file sai, 320–414px) —
> cần thao tác thật trong trình duyệt.

---

## 2026-10-04 — UI/UX cleanup pass: avatar, light-mode contrast, shadow, safe-area

### 1. Avatar hiện initials ("HỌ") dù user ĐÃ tải ảnh — ROOT CAUSE

LearnX lưu ảnh đại diện ở **hai nơi khác nhau**:

| Nơi | Kiểu | Chứa gì |
|---|---|---|
| `User.image` (`String?`) | URL ngoài | URL Google OAuth, đường dẫn local cũ |
| `User.avatarData` (`Bytes`) | nhị phân trong DB | ảnh user **tự tải lên** |

`AccountMenu` + `FloatingAIButton` đều đọc thẳng `session.user.image`, mà
callback `session` của Auth.js **không nạp field đó từ DB** (xem `src/auth.ts`).
⇒ Với tài khoản đăng ký bằng email, `image` luôn `undefined` ⇒ Avatar fallback
initials, dù DB có `avatarData`.

**Sửa tại nguồn, không vá 2 file riêng:** `src/lib/auth/avatarUrl.ts` —
`resolveAvatarUrl()` chuẩn hoá về MỘT giá trị:

- có `image` → dùng URL ngoài (CDN tự cache).
- không có → trỏ `/api/profile/photo/avatar`: route đó tự đọc `avatarData` và
  phục vụ ảnh (app không cần biết URL nào). Route đã có ETag/304.
- `?v=<version>` cache-buster: đổi ảnh là URL mới.

**KHÔNG** thêm cờ `hasAvatar` vào session — sẽ tạo thêm 1 nguồn sự thật phải
đồng bộ, đúng loại bug vừa gặp.

### 2. Avatar: ảnh hỏng/404 phải fallback, không lộ ảnh vỡ

`Avatar` giờ có `onError` → `failed` state → initials. Cần thiết vì route ảnh trả
**404** khi user chưa tải ảnh lên; không có `onError` thì mọi user mới thấy icon
broken. `useEffect` reset `failed` khi `src` đổi (đổi tài khoản).
Initials dùng `--on-accent` (cố định theo brand, không đổi theo theme) nên đọc
được ở **cả** dark lẫn light.

### 3. Light mode "chìm vào nền" — ROOT CAUSE là shadow hardcode

Token `--shadow-sm/md/lg` **đã có sẵn** và đã khai báo riêng cho light
(`rgba(15,23,42,.06/.08/.1)`), nhưng **34 rule CSS không dùng chúng** mà viết
thẳng `rgba(0,0,0,.xx)` — shadow đen đậm trên nền trắng đọc như vết bẩn.

Đã thay toàn bộ bằng `var(--shadow-*, <giá trị cũ làm fallback>)` qua
`scripts/fix-hardcoded-shadows.mjs`. Script **chỉ** đụng `box-shadow`, bỏ qua
`rgba(0,0,0,0)` (overlay backdrop cố ý của modal).

Kết quả: `.panel` (mọi card glass), `.app-bubble`, `.ach-card`, modal, toast,
tooltip… giờ đều đổi bóng theo theme.

### 4. Cột nút nổi sát mép phải trên thiết bị có tai thỏ

`.floating-actions` dùng `right: var(--fab-edge)` — **không tính safe-area**.
`env(safe-area-inset-right)` = 0 ở desktop và hầu hết điện thoại dọng, nhưng
khác 0 ở iPhone xoay ngang ⇒ nút bị đẩy sát mép / kẹp mép.

Sửa ở tầng token: `--safe-right` + `--fab-right: max(lề, safe-area)` cho cả
desktop và mobile. Không đụng `overflow` (như spec cảnh báo).

### 5. Icon không đồng bộ

`FloatingAIButton` dùng glyph `✺` trong khi `AppDownloadBubble` dùng Lucide
(`Smartphone`/`Download`) ⇒ hai nút cạnh nhau khác hẳn. Đổi sang Lucide
`Sparkles`. **Cả 2 nút đã có `aria-label` + `title`** sẵn — không cần thêm.
Không tạo hệ icon mới.

### Kiểm chứng

- TypeScript: ✅ exit 0 · ESLint: ✅ 0 error (22 warning cố định)
- Build: ✅ Compiled, 0 warning · Tests: ✅ **470/470** (37 files, +6)
- check:css / check:form: ✅ PASS
- Shadow: **34 rule dùng token, 0 hardcoded** (verify bằng script AST)
- `Avatar` chỉ có 2 call site, cả 2 đã cập nhật → không regression

> **Chưa** verify bằng mắt ở 320/375/390/430/768/1280/1440/1920px và light/dark
> — cần mở trình duyệt thật.

---

## 2026-10-04 — Fix compile, upload ref, Auth 500, metadataBase, favicon 404

### 1. `fileInputRef` khai báo trùng — ĐÃ CÓ SẴN TỪ LƯỢT TRƯỚC

Kiểm tra thực tế: chỉ có **1** khai báo (dòng 70) và `tsc` exit 0. Lỗi trùng đã
được gộp ở lượt sửa form trước (diff lúc đó cho thấy dòng 71 + 73 trùng nhau).

**Việc còn lại:** sau khi bỏ `onClick` (fix user activation), ref thành **code
chết** — không nơi nào đọc `.current`. Giữ một ref chết là cruft, và chính cruft
đó đã tạo ra bug trùng khai báo lần trước. Đã **xoá hẳn** `fileInputRef` +
bỏ `useRef` khỏi import, kèm comment giải thích để không ai thêm lại.

Không tạo `fileInputRef2`/`uploadInputRef` để né — đó chỉ che triệu chứng.

### 2. Upload user activation — ĐÃ FIX, có script canh

`<label>` **đã tự** kích hoạt `<input type="file">` khi bấm (chuẩn HTML). Bản cũ
vừa bọc input trong label **vừa** thêm `onClick={() => ref.current?.click()}` ⇒ 1
cú bấm gọi `click()` 2 lần; lần 2 không còn user activation ⇒ Chrome cảnh báo.

Đã bỏ `onClick`. `npm run check:file-input` (từ lượt trước) phát hiện lại loại
lỗi này: PASS.

### 3. `/api/auth/session` 500 — ROOT CAUSE THẬT (không phải do compile error)

Giả thuyết ban đầu của spec là "Auth 500 chỉ xảy ra lúc Next compile error".
**Kiểm chứng bằng build thực tế cho thấy KHÔNG phải vậy** — build sạch nhưng vẫn
in:

```
[auth] CẤU HÌNH AUTH.JS CHƯA ĐẦY ĐỦ -> mọi endpoint /api/auth/* sẽ lỗi:
   - thiếu AUTH_URL hoặc AUTH_TRUST_HOST (self-host production cần 1 trong 2)
```

Chuỗi nguyên nhân đầy đủ:
1. Auth.js `assertConfig()` kiểm tra `trustHost` **TRƯỚC** `secret`.
2. `.env` **thiếu cả** `AUTH_URL` lẫn `AUTH_TRUST_HOST` ⇒ `UntrustedHost` ⇒ mọi
   `/api/auth/*` trả 500 với body **dạng text**.
3. Auth.js client `JSON.parse` body đó ⇒ `Unexpected token '<'`.

**Bằng chứng dứt khoát:** chạy `next build` với `AUTH_URL` được set ⇒ warning
`[auth]` **biến mất hoàn toàn**, build sạch, không warning nào.

`src/auth.ts` **đã xử lý đúng** `AUTH_URL` qua `readPublicUrl()` (có validate
URL, bỏ qua giá trị rác) — không sửa logic auth. Chỉ sửa điểm còn thiếu:
`next.config.js` trước chỉ kiểm `AUTH_SECRET`, **không** kiểm `AUTH_URL` ⇒ đã
thêm `"AUTH_URL|AUTH_TRUST_HOST"` vào `RECOMMENDED_PRODUCTION_ENV` để cảnh báo
đúng biến gây lỗi ngay lúc build.

Không bypass auth, không fake session, không hardcode userId.

### 4. `metadataBase` warning

Root cause: `src/app/layout.tsx` khai báo `openGraph.images` + `twitter.images`
bằng URL tương đối (`/brand/...`) nhưng **không có `metadataBase`** ⇒ Next thay
bằng `http://localhost:3000` (ảnh OG/Twitter hỏng khi share lên production).

Thêm `resolveMetadataBase()` đọc `APP_URL` → `NEXTAUTH_URL`, **chỉ nhận khi
parse được thành URL tuyệt đối** (`.env` có thể còn dấu nháy kép gây throw lúc
build), fallback localhost. Không hardcode domain production.

Build xác nhận: **warning `metadataBase` đã hết**.

### 5. `favicon.ico` 404

Root cause: browser **luôn** gọi `/favicon.ico` khi mở tab, kể cả khi trang đã
có `<link rel="icon">` (Chrome fallback, Safari <16, crawler). Dự án chỉ khai
báo `/brand/learnx-mark.svg`, không có file `.ico`.

Cách sửa theo convention native của Next App Router: `src/app/favicon.ico` —
Next tự phục vụ `/favicon.ico`, không phải hack redirect.

**Không tạo logo tạm.** `scripts/generate-favicon.mjs` bọc PNG launcher Android
đã có sẵn (`ic_launcher.png` — chính là logo LearnX) vào container ICO (định
dạng cho phép nhúng PNG nguyên bản từ Windows Vista). Đã verify byte-level:
`reserved=0`, `type=1`, `count=1`, `192×192`, `bytesInRes` khớp, PNG signature
hợp lệ. Chạy lại: `npm run favicon`.

### 6. `.next/dev/types/*.d.ts` bị hỏng — KHÔNG phải bug source

`tsc` báo lỗi cú pháp trong `routes.d.ts` dòng 197: `eact.ReactNode` (mất chữ
`R` trong `React`). Cả 5 file cùng ghi **đúng 1 giây** ⇒ ghi đè chồng giữa
`next build` và dev server đang chạy. `.next` là git-ignored generated artifact
⇒ xóa `.next/dev` để regenerate, `tsc` sạch trở lại.

**Bài học thao tác:** không chạy `next build` song song với `npm run dev`.

### Kiểm chứng

| | Kết quả |
|---|---|
| TypeScript | ✅ exit 0 |
| ESLint | ✅ 0 error (22 warning cố định) |
| Build | ✅ Compiled, **không còn warning `metadataBase`** |
| Test | ✅ 464/464 (36 files) |
| check:file-input / check:css | ✅ PASS |
| Build **không có** `AUTH_URL` | ⚠️ in cảnh báo (đúng mong muốn) |
| Build **có** `AUTH_URL` | ✅ cảnh báo biến mất |

---

## 2026-10-04 — Audit console log: phân loại noise vs lỗi thật

### Phân loại

| Log | Phân loại | Xử lý |
|---|---|---|
| `Unchecked runtime.lastError: Could not establish connection…` | **Extension** (Chrome) | Không sửa. Không thêm try/catch để "làm console sạch" |
| `Grammarly.js:2 [DEFAULT] WARN : Using DEFAULT root logger` | **Extension** Grammarly | Không sửa |
| `Grammarly.js:2 grm ERROR … Not supported: in app messages from Iterable` | **Extension** Grammarly | Không sửa |
| `[Fast Refresh] rebuilding / done` | **Next.js dev mode** — bình thường | Giữ nguyên, không tắt |
| `upload:1 File chooser dialog can only be shown with a user activation.` | **Lỗi LearnX — đã sửa** | Xem bên dưới |

Cả 3 log extension đều phát ra từ `chrome-extension://…` khi trình duyệt chạy
script của extension — LearnX không kiểm soát và không thể sửa.

### Root cause lỗi upload

`src/app/(app)/community/upload/page.tsx` — vùng chọn file bọc
`<input type="file">` trong `<label>` **và** đồng thời thêm
`onClick={() => fileInputRef.current?.click()}`.

`<label>` **đã tự** kích hoạt input khi bấm (hành vi chuẩn HTML). Thêm
`onClick` ⇒ **1 cú bấm gọi `input.click()` 2 lần**:

1. `click()` lần 1 mở file dialog → tiêu thụ user activation.
2. `click()` lần 2 chạy khi activation đã hết ⇒ Chrome cảnh báo
   *"File chooser dialog can only be shown with a user activation"*.

**Sửa:** bỏ `onClick`, để `<label>` lo. Đây là cơ chế native — không cần JS,
không cần ref, và luôn nằm trong user gesture.

**Giữ nguyên:** validation định dạng + giới hạn 50MB, preview tên/dung lượng,
loading state, error state, API. Không sửa backend.

### Audit toàn bộ file picker (spec §5)

| Nơi | Trigger | Kết luận |
|---|---|---|
| `community/upload/page.tsx` | `<label onClick>` + input | **Đã sửa** |
| `library/page.tsx` | `<label>` bọc input, không `onClick` | Đúng |
| `profile/ProfileHeader.tsx` (avatar + cover) | `<button onClick>` + input `hidden` | Đúng — nút tách khỏi input |

Không nơi nào gọi `.click()` từ `useEffect` / `setTimeout` / callback bất
đồng bộ.

### Chống tái diễn

`scripts/check-file-input.mjs` + `npm run check:file-input`:
phát hiện `<label>` bao `<input type="file">` mà vùng đó còn gọi `.click()`,
và phát hiện `.click()` nằm trong `useEffect` / `setTimeout` / `.then()`.

**Script đã được tự kiểm chứng**: tạo fixture chứa đúng lỗi cũ → script báo
lỗi và exit 1; xoá fixture → script pass. Không chỉ tin vào việc script chạy.

> Validation: tsc exit 0 · ESLint 0 error · 443/443 test · build 0 warning.

---

## 2026-10-04 — Audit trang Thành tựu: 7 lỗi (bố cục, icon, reward, filter)

Audit toàn trang `/achievements` theo chuỗi `page → component → CSS → responsive`.

### 1. Nội dung dồn hẳn sang trái, bên phải trống (spec §3)

**Root cause:** `.main-content` (`globals.css`) có `max-width: 1180px` nhưng
**thiếu `margin-inline: auto`** ⇒ khối 1180px dán sát mép trái.

Không sửa ở `globals.css` (ảnh hưởng mọi trang). Khai báo `.rewards-page`
trong `rewards.css`: `width: 100%` + `max-width` + `margin-inline: auto`.
`/rewards` dùng chung class này và được lợi luôn.

### 2. Icon rơi thành dòng riêng phía trên title (spec §4)

**Root cause:** `.ach-card__icon` là block `height: 84px` nằm TRÊN `__body`
chứa title ⇒ emoji chiếm hẳn 1 dòng, tách khỏi tên thành tựu.

**Sửa:** thay bằng `.ach-card__top` — grid 3 cột `auto minmax(0,1fr) auto`:
huy hiệu 40px bo tròn (`__emblem`) · tiêu đề (`-webkit-line-clamp: 2`) · ổ khoá.
Ổ khoá bỏ `position: absolute` (từng tràn ra ngoài card ở `.ach-card__icon`).

### 3. Reward hiện `- -` (spec §5)

**Root cause:** `+{xp} XP · +{lxp} LXP` nằm trong **MỘC text node**. Khi một
field là `null`/`undefined`/`NaN` (DB cũ, service chưa set) chuỗi thành
`+- - +null LXP`; khi một field bằng 0 thì separator vẫn hiện dù chỉ có 1 phần.

**Sửa:** `rewardParts()` trả về từng phần (`null` khi không hợp lệ), mỗi phần là
element riêng + `·` là node độc lập chỉ render khi có **cả hai**. Loại `0`,
số âm, `NaN`, `null`, `undefined`.

### 4. Bản sao CSS ghi đè bản chính (spec §15)

`.ach-card__foot` và `.ach-card__reward` bị khai báo **2 lần**; bản sao đứng
sau nên ghi đè `flex-wrap` / `margin-top` / `gap` đã xử lý ở mục ACHIEVEMENTS
⇒ thẻ không xuống dòng được ở màn hình hẹp. Xoá bản sao.

### 5. Grid quá nhiều cột ở tablet

`@media (max-width: 880px)` đặt `minmax(160px, 1fr)` ⇒ 4–5 cột quá hẹp ở
768–820px. Đổi thành `minmax(190px, 1fr)` (2 cột) và chỉ ép 1 cột ở ≤400px.

### 6. `.ach-card.is-locked { opacity: 0.62 }`

Làm mờ **toàn bộ** card kể cả text ⇒ mất contrast, khó đọc. Thay bằng nền/viền
nhạt hơn + `grayscale` riêng icon.

### 7. Filter chưa reset `<button>` mặc định

`.rewards-filter` thiếu `appearance: none` và `border: 1px solid transparent`
⇒ thừa nền/viền của browser. Thêm 2 khai báo này (chỉ trong component, **không**
sửa global `button`). Nâng `.rewards-filters` thành segmented control có vỏ
kính + `focus-visible` + `aria-pressed` (đã có sẵn ở JSX).

### Kiểm chứng

- `npm run check:css` OK · 20/20 class JSX đều có CSS.
- 24 selector achievements ở top-level, không bị nest.
- 6 test mới (`achievementReward.test.ts`) khoá logic reward: cả hai / chỉ XP /
  chỉ LXP / dữ liệu rác / số âm / separator đúng 1 lần.
- **443/443 test** · tsc exit 0 · ESLint 0 error · build 0 warning.
- Dữ liệu/API/Prisma **không đổi**.

---

## 2026-10-04 — LXP card mất toàn bộ style: root cause là rule CSS thiếu `}`

Báo cáo mới cho biết thẻ "Số dư LXP" hiện **nền trắng, font mặc định, button
mặc định của browser** và text dính `Số dư LXP:279LXPĐổi thưởng →`.

### Root cause — KHÔNG phải lỗi JSX

`.reward-card__footer {` (dòng 285, `rewards.css`) **thiếu dấu `}`**. Trình
duyệt / PostCSS coi mọi rule phía dưới là **rule con** của nó, biến:

```css
.dash-lxp { ... }        →   .reward-card__footer .dash-lxp { ... }
```

Selector này **không tồn tại trong DOM** (thẻ LXP nằm trong `.dash-motivation`)
⇒ **không khớp element nào** ⇒ mất sạch style.

**Bằng chứng:** trong `.next/static/chunks/*.css` có đúng
`.reward-card__footer .dash-lxp{...}`. Rule `.dash-lxp` đó chứa
`80 node / 640 dòng`: toàn bộ `.challenge-card*`, `.dash-lxp*`,
`.dash-motivation`.

### Vì sao dễ bị quy chụp nhầm sang lỗi React

| Triệu chứng | Nguyên nhân thật |
|---|---|
| `<button>` trắng, viền mặc định | `background`/`border` trong `.dash-lxp` không chạy |
| Font rơi về browser default | `font-family` trong rule bị chặn bởi selector sai |
| `Số dư LXP:279LXPĐổi thưởng →` | `display:block` của `.dash-lxp__label/__value/__cta` không chạy → `<span>` còn inline |
| Thẻ LXP dính "Thử thách hôm nay" | `gap: 24px` + `grid-template-columns` của `.dash-motivation` không chạy |

**JSX và structure đã ĐÚNG từ trước** — chỉ cần CSS được áp dụng là hết.

### Phát hiện thêm 2 rule cùng lỗi

| Rule | Dòng | Hậu quả |
|---|---|---|
| `.reward-card__footer {` | 285 | 640 dòng bị nest (`.dash-lxp`, `.challenge-card`, `.dash-motivation`) |
| `.ach-card__cond {` | 768 | 146 dòng mục REVIEW bị nest |

Cả 2 đều kèm `}` mồ côi ở cuối file (dòng 945 / 919) — dấu `}` đóng rule bị
đẩy khỏi chỗ. Xoá 2 dải orphan đó.

### Sửa

- Đóng 2 rule tại đúng chỗ; xoá `}` thừa.
- Gộp bản trùng `.reward-card__footer` (khai báo 2 lần) về 1.
- Thêm `scripts/check-css-nesting.mjs` + `npm run check:css`: bắt rule chứa ≥2
  rule con (dấu hiệu nest sai) và báo `}` thừa. Chạy sau **mỗi lần** sửa
  `.css` theo miền chức năng.

### Kiểm chứng

- `npm run check:css` → OK, 4 file CSS sạch.
- 18 selector quan trọng (`.dash-lxp*`, `.challenge-card*`, `.dash-motivation`,
  `.reward-card__footer`…) đều ở **top-level**.
- CSS bundle: `.dash-lxp{` top-level; `.reward-card__footer .dash-lxp` **biến mất**.
- `tsc` exit 0 · ESLint 0 error · **437/437 test** · build compiled, 0 warning.

> Dữ liệu **không đổi** (279 / 40 XP / 20 LXP / 5 / 0) — chỉ sửa CSS.

---

## 2026-10-04 — UI integrity audit: sửa lỗi text dính + logic challenge sai

Audit theo dấu vết `Database → API → service → state → component → JSX → CSS`.
**Không sửa Prisma** (các API đều 200, Prisma query là bình thường).

### Root cause từng lỗi

| # | Hiện tượng | Root cause THẬT (không phải giả định) |
|---|---|---|
| 1 | `Số dư LXP279LXPĐổi thưởng →` | 3 `<span>` **inline** (`.dash-lxp__label/value/cta`) trong `<button>`; không có khoảng trắng text node nên khi đọc/copy chúng dính liền |
| 2 | `Thưởng 40 XP · 20 LXPĐã hoàn thành!` | Cùng nguyên nhân ở `.challenge-card__foot` (flex `gap` **không** tạo khoảng trắng trong DOM) |
| 3 | `Giải N bài tập` | **Bug i18n**: chuỗi viết cứng chữ `N` thay vì placeholder `{n}`; component không truyền param |
| 4 | `0/5` nhưng hiện *"Đã hoàn thành!"* | **Bug logic**: nhánh `else` (chưa hoàn thành) render nhầm `t("challenge.completed")` |
| 5 | — | **UI đọc cột boolean `challenge.completed`**, trong khi `completedCount/targetCount` mới là số thật. Hai nguồn có thể lệch → UI hiện sai |
| 7 | Card LXP dính/đè thử thách | **CSS hỏng**: `.rewards-hint {` và `.reward-card__footer {` bị mất selector + `}`, khiến các rule phía dưới (kể cả `.dash-motivation`) **không được áp dụng**. KHÔNG phải thiếu margin. |
| 8 | Build warn `Unknown at rule: @keyframes` | `@keyframes` đặt trong file `.css` của **component** (`rewards.css`) — Next chạy PostCSS transform riêng cho các file này và không nhận at-rule đó. Phải khai báo ở `globals.css`. |
| 9 | `5/5` không thấy chữ "Đã hoàn thành" | Nhánh `isCompleted` chỉ render nút "Nhận thưởng", **bỏ mất** badge trạng thái. Spec §12 yêu cầu cả hai. |

### Logic đã chuẩn hoá

`buildChallengeState()` trong `src/types/index.ts` — hàm thuần, **nguồn duy nhất**
quyết định trạng thái challenge:

```
isCompleted = target > 0 && completedCount >= targetCount
```

- Bỏ đọc cột boolean `completed` ở UI (nguồn lệch).
- Clamp `completed` về `[0, target]` → không bao giờ hiện `7/5`.
- `target <= 0` ⇒ **không** hoàn thành (tránh `0 >= 0` báo oan).
- Chuẩn hoá NaN/undefined → 0, không để lọt chuỗi rác ra UI.
- Tách `isCompleted` và `isClaimed` — 2 trạng thái khác nhau trong DB.

### Files

- **Sửa**: `src/types/index.ts` (thêm `ChallengeState` + `buildChallengeState`),
  `DailyChallengeCard.tsx` (logic + tách khối + truyền `{n}`),
  `dashboard/page.tsx` (tách 3 khối LXP, `lxpBalance` biến riêng),
  `rewards.css` (3 CSS rule hỏng + `display:block` + spacing 24px),
  `dictionary.ts` (`{n}` thật + 4 key trạng thái, VI + EN),
  `api/profile/photo/[type]/route.ts` (cache)
- **Mới**: `src/lib/__tests__/challengeState.test.ts` — 10 test, gồm đúng 4
  case bắt buộc của spec + case dữ liệu rác

### Performance (spec §19, §20)

`GET /api/profile/photo/[type]` gửi `Cache-Control: private, max-age=0,
must-revalidate` ⇒ **mỗi lần mở app đều query DB + tải lại toàn bộ bytes ảnh**
(dù API trả 200, ~1s). Sửa bằng chuẩn HTTP, **không đổi kiến trúc lưu trữ**:

- `ETag` (sha1 từ bytes, không cần cột DB mới) + `If-None-Match` → 304 với 0 byte.
- `max-age=60` thay cho `max-age=0, must-revalidate`.
- Vẫn `private`; URL có `?v=` cache-buster nên đổi ảnh là URL mới.

### Đã kiểm tra, KHÔNG cần sửa (spec §17, §18, §21)

- **SQL/Prisma log không lọt ra UI**: đã grep `error.message` / `.stack` /
  `LIMIT $` trong JSX — không có chỗ nào render message kỹ thuật.
- **`/api/auth/session` gọi nhiều lần**: 7 callsite `useSession()` nhưng
  **tất cả dùng chung 1 `SessionProvider` context** ⇒ 1 request duy nhất.
  `reactStrictMode` không bật. **Không có duplicate fetch** — không sửa.
- **`/api/roadmaps`, `/api/goals/*/gap`**: đã thành công, không có fetch trùng.

---

## 2026-10-04 — Redesign Authentication (Login / Register)

Redesign 2 trang auth theo spec §39. **KHÔNG đổi kiến trúc auth** (spec §39.22):
`src/auth.ts`, `proxy.ts`, `/api/auth/register`, `/api/auth/[...nextauth]` giữ
nguyên 100%. Đợt này chỉ nâng lớp UI/UX + validate + xử lý lỗi.

### [Auth] Audit trước khi sửa — 4 phát hiện quyết định hướng đi

| Kiểm tra | Kết quả | Hành động |
|---|---|---|
| Password rule | `register/route.ts:20` chỉ chặn `length < 8` | Thanh đo mạnh **chỉ dùng quy tắc thật** — không bịa "cần chữ hoa/số" |
| Forgot password | **Không có** API/UI (chỉ có đổi mật khẩu `/api/auth/password`) | **Không tạo link giả** — link tới trang không tồn tại tệ hơn không có |
| `VerificationToken` | Có model nhưng **không dùng** cho reset | Không đụng (thêm flow reset = viết feature mới, ngoài phạm vi) |
| `ChangePasswordPanel` | **Cũng dùng `PasswordInput`** | Giữ props tương thích ngược (`id`, `minLength`, `label` optional) |

### [Auth] Bug thật đã sửa

- **`OAuthButtons` thiếu `type="button"`**: nằm trong `<form>` (bản mới) hoặc
  nếu ai đó bọc lại → bấm nút sẽ **submit form**, mất hết dữ liệu đã gõ.
- **Link `<a href="/register">` thay vì Next `<Link>`**: mỗi lần bấm chuyển
  trang kia đều tải lại **toàn bộ bundle** app.
- **Không có `<label>`** — chỉ dùng `placeholder`; placeholder biến mất khi
  gõ nên mất ngữ cảnh, và screen reader đọc placeholder rất kém.
- **`res.json()` trong register**: nếu proxy/server trả HTML (502, bảo trì)
  thì ném lỗi parse khó hiểu → chuyển sang `readApi` + map sang message
  tiếng Việt.

### [Auth] Đã thêm

- `AuthShell` — khung split-layout: desktop 2 cột (brand + form), ≤900px 1
  cột và **ẩn hẳn vùng brand** (ăn ~300px chiều cao, bàn phím mở là mất
  CTA). Logo + tagline vẫn còn ở vùng form nên không mất thông tin.
- `AuthField` — ô nhập có `<label>` + `aria-invalid` + `aria-describedby`.
- `PasswordStrength` — 4 mức, chỉ tính trên quy tắc thật của server.
- Validate tức thì có cờ `touched` (chỉ hiện lỗi sau blur/submit — không
  spam lỗi lúc vừa mở trang), `noValidate` để không bị bubble tiếng Anh
  của trình duyệt.
- Lỗi cấp form map theo status: 409 → email đã tồn tại, 503 → server, còn
  lại → lỗi mạng. **Không lộ message kỹ thuật.**
- Nút có spinner + trạng thái thành công (nền xanh) giữ **420ms** rồi mới
  chuyển trang — đủ để mắt bắt, ngắn đến mức không cảm thấy chờ.
- `useSession`: đã đăng nhập mà vào `/login`|`/register` → `replace("/dashboard")`
  (đi vòng qua proxy để đúng luồng user mới).
- `autoComplete`: `current-password` ở Login, `new-password` ở Register.

### [Auth] Mobile & accessibility

- `100dvh` (không phải `100vh`) + `overflow-y:auto` + `padding-bottom` có
  `--keyboard-inset` → bàn phím mở không che CTA.
- "Safe centering": `align-items:flex-start` + `margin:auto 0` trên inner →
  form ngắn vẫn căn giữa, form dài (Register 4 field) thì cuộn từ trên xuống
  thay vì bị cắt 2 đầu.
- Vùng chạm ≥44px: nút mắt, link chuyển trang, nút OAuth, nút submit.
- `prefers-reduced-motion`: tắt trôi của 2 orb + nâng card, **giữ spinner**
  (đó là thông tin đang chờ, không phải trang trí).

### [Auth] Files

- **Mới**: `AuthShell.tsx`, `AuthField.tsx`, `PasswordStrength.tsx`, `auth.css`
- **Xoá**: `AuthCard.tsx` (0 caller sau khi 2 trang chuyển sang `AuthShell`) +
  block `.auth-card` cũ trong `globals.css`
- **Sửa**: `login/page.tsx`, `register/page.tsx`, `PasswordInput.tsx` (thêm
  label/a11y/strength, giữ tương thích `ChangePasswordPanel`),
  `OAuthButtons.tsx`, `dictionary.ts` (~45 key VI + EN)

---

## 2026-10-04 — Product-wide UI/UX: khôi phục Reward system + Smart Review

Đợt này **khôi phục feature đã mất khỏi UI** và mở rộng API review. Không
viết lại hệ thống mới, không phát minh schema.

### [Rewards] XP/LXP economy bị "mồ côi" — backend đủ, UI không còn

**Root cause (không đoán):** Prisma có đầy đủ `Reward`, `UserReward`,
`PointTransaction` + enum `RewardType/RewardStatus/RewardRarity`, có 4 API
(`/api/rewards/{shop,redeem,inventory,history}`), có migration
`20260910124324_add_xp_lxp_economy`. Nhưng **không có file `.tsx` nào** gọi tới
bất kỳ endpoint nào — economy hoàn toàn không có UI. Người học kiếm XP/LXP
qua `recordLearningActivity()` nhưng không có nơi tiêu, không thấy thành tựu,
không thấy thử thách ngày.

**Restored (UI mới, dùng backend cũ):**
- `/rewards` — 4 tab: Tổng quan · Cửa hàng · Túi đồ · Lịch sử. Redeem có bước
  xác nhận (mất LXP), sau đó cập nhật số dư bằng `newLXPBalance` **do server
  trả về** (không tự trừ tay → không lệch khi server chặn đổi trùng).
- `/achievements` — danh sách đầy đủ kèm điều kiện thật từ `condition`.
- Dashboard: ô số dư LXP (CTA tới `/rewards`) + thẻ **Thử thách hôm nay**
  có nút nhận thưởng (`/api/daily-challenge/claim`).

**Quyết định quan trọng — không hiện % tiến độ giả:**
`getAchievementProgress()` hiện trả `progress: 0` cho **mọi** achievement
(có TODO sẵn trong `achievement.service.ts`). Thay vì render "0%" (nói dối
người dùng), UI hiển thị **ĐIỀU KIỆN thật** lấy từ `AchievementDefinition.condition`
(`"streak_days": 7` → "Yêu cầu: giữ chuỗi 7 ngày"). Khi service tính được
`progress`, chỉ cần đổi 1 chỗ render.

**Files:**
- Mới: `src/app/(app)/rewards/page.tsx`, `src/app/(app)/achievements/page.tsx`,
  `src/components/rewards/{RewardCard,DailyChallengeCard,AchievementCard}.tsx`,
  `src/components/rewards/rewards.css`, `src/lib/api/rewardsApi.ts`
- Mới: `src/components/ui/{Badge,AnimatedNumber}.tsx` (design system dùng chung)
- Sửa: `navGroups.ts` (thêm 2 mục nhóm "Tiến độ"), `dashboard/page.tsx`,
  `src/types/index.ts` (13 type mirror shape API), `dictionary.ts` (~90 key VI+EN)
- `globals.css`: thêm token **motion** (`--dur-*`/`--ease-*`), **spacing**,
  **depth** (`--shadow-*`/`--glow-*`), **rarity** — mỗi theme 1 bản riêng

**Số dư là nguồn duy nhất:** `/api/streak` (đã có) trả cả `progress.lxpBalance`.
Không tạo endpoint mới cho số dư; `/rewards` và Dashboard đều đọc từ đây
→ không thể lệch số giữa 2 màn hình.

### [Review] Thêm lọc môn + smart review (SM-2 data thật)

`/api/review/due` trả **mọi môn trộn lẫn**, nên không thể ôn riêng "Toán 11".

**Changed:**
- `getDueReviews(userId, limit, { subject })` — thêm filter môn (optional).
- `getReviewStats(userId, { subject })` — dùng `Prisma.sql` ghép điều kiện
  **động** an toàn (không nối chuỗi thô vào SQL); giữ nguyên 1-query `COUNT FILTER`.
- **Mới** `getReviewInsights()` — `groupBy(subject)` đếm nội dung đến hạn
  theo môn + top chủ đề hay sai (`lapses > 0`, tức đúng chỗ SM-2 đã hạ lịch).
  Chỉ tính ở DB, không kéo row về Node.
- `/api/review/due?subject=&insights=true` — server **tự bỏ `insights` khi đã
  lọc môn** (gợi ý về môn khác khi đang ở tab khác là vô nghĩa).
- `fetchDueReviews(limit, options)` — khoá gộp request giờ gồm **cả `subject`**
  trong URL. Đây là điểm dễ sai: nếu khoá chỉ theo `limit`, chọn "Toán" rồi
  bấm "Vật lý" sẽ nhận lại dữ liệu Toán. Có test chặn.

**UI `/review`:** thanh chọn môn (từ registry `lib/subjects/engine.ts`, cuộn
ngang trên mobile) + khối "Bạn nên ôn hôm nay" (số đến hạn thật, chip môn
đếm theo, dòng "bạn thường sai ở: …"). **Không hỏi lại lớp/hồ sơ** — dữ liệu
đó đã ở onboarding/profiles.

---

## 2026-10-03 — Nâng cấp trải nghiệm điện thoại (web mobile + APK)

Đợt này chỉ sửa lớp UI/UX và cấu hình wrapper — **không đổi schema, không đổi
API contract, không hardcode dữ liệu**. Mọi thay đổi đều chỉ trong
`≤ 880px` (hoặc `≤ 360px`) nên desktop giữ nguyên hành vi.

### [Keyboard] Ô nhập 14px khiến trình duyệt tự phóng to cả trang

**Root cause (không đoán):** nhiều component ghim inline
`style={{ fontSize: 14 }}` (login, register, `PasswordInput`, Tutor, ô hỏi ở
Dashboard). Inline style **thắng** mọi rule thường của stylesheet, nên rule
`.tutor-composer input { font-size: 16px }` sẵn có từ trước là **code chết** —
nó không bao giờ áp dụng vào chính cái input nó nhắm tới. Hậu quả trên iOS
Safari/WebView: focus vào ô nào là cả trang tự phóng to, bàn phím che nội
dung.

**Changed:**
- `globals.css`: khối `INPUT 16px TRÊN MOBILE` — `input/textarea/select`
  `font-size: 16px !important` trong `@media (max-width: 880px)`. `!important`
  là cần thiết chính vì lý do trên; chỉ trong media query nên desktop giữ 14px.
- Xoá `fontSize` inline ở `login/page.tsx`, `register/page.tsx`,
  `PasswordInput.tsx`, `tutor/page.tsx`, `dashboard/page.tsx` — để CSS là
  nguồn sự thật duy nhất.
- Xoá rule chết `.tutor-composer input { font-size: 16px }`, thay bằng
  `min-width: 0` (xem mục overflow).

### [Keyboard] Mở bàn phím là mất ô nhập trong Tutor

`Panel` của trang Tutor cao **cứng 560px**. Bàn phím Android co WebView còn
~350px ⇒ ô nhập (sticky ở đáy panel) bị đẩy vượt ra ngoài khung nhìn.

- `.tutor-panel` (mới): desktop `height: 560px` (không đổi), mobile
  `height: min(560px, 72dvh)` + `min-height: 320px` cho màn hình thấp.

### [Overflow] Ô nhập trong flex đẩy hàng tràn ngang ở 320px

Input có kích thước nội tại mặc định nên không co lại trong flex; thiếu
`min-width: 0` thì nút bấm bị đẩy khỏi màn hình. Thêm cho ô nhập Tutor và ô
"hỏi AI" ở Dashboard.

### [Navigation] 5 tab dưới đúng vai trò; sheet "Thêm" tự cuộn tới mục đang mở

- `PRIMARY_TAB_HREFS` đổi sang Home/Learn/Practice/Progress/Profile (bản gốc
  là Dashboard/Mindmap/Tutor/Profile). Mind Map + AI Gia sư nằm trong sheet
  "Thêm" cùng toàn bộ route còn lại.
- Nhãn ngắn mới `nav.tabHome`/`nav.tabLearn` qua `tabLabelKey()` — Sidebar
  desktop **giữ nguyên** nhãn đầy đủ, không bị đổi theo.
- `BottomSheet` nhận `activeHref` + `data-sheet-href`: mở sheet cuộn ngay tới
  mục đang active (dùng `block: "nearest"` để không nhảy nếu đã hiện).

### [Touch] Vùng chạm < 44px

- Nút gợi ý Tutor (~26px) → 44px.
- Nút mắt hiện/ẩn mật khẩu (30px) → 44×44.
- Nút "Gửi" Tutor và "Hỏi" Dashboard không bị bóp (`flex-shrink: 0`).
- Phản hồi chạm bằng `:active` (không dùng `:hover` làm tín hiệu chính trên
  mobile — không có con trỏ chuột).
- `≤ 360px`: nhãn tab xuống 2 dòng thay vì bị ellipsis cắt.

### [Safe-area] Trang ngoài `(app)` nằm dưới camera punch-hole

`.main-content` chỉ tồn tại trong route group `(app)`; các trang ngoài phải tự
chừa. Sửa: `AuthCard` (login/register), `/setup`, `/welcome` (topbar + bottom
dock). Riêng `/welcome` có `@media (max-width: 768px)` ghi đè mất
`var(--safe-top)` — giữ lại ở **mọi** breakpoint.

### [Error] Không lộ message kỹ thuật ra UI

Pattern `catch (err) { setError(err.message) }` làm màn hình hiện
"Unexpected token '<'" (proxy trả HTML), "Failed to fetch"/"Load failed" (mạng).

- `src/lib/api/readApi.ts` (mới, dùng chung): `readApi()` ném `TransportError`
  khi body không phải JSON; `describeError()` quy lỗi thành thông điệp hiển
  thị được; `ApiError` cho lỗi chủ động mang message do API viết.
- Chuyển bản `readApi` trùng lặp trong `diagnostic/page.tsx` sang dùng helper
  chung (xoá hẳn bản local, không để code chết).
- Áp cho `tutor` (chat + hint + resources) và `library` (upload + retry — màn
  hình lỗi dễ gặp nhất khi upload file lớn qua mạng di động).

### [Error] Retry 1 chạm

Trước đây lỗi mạng chỉ còn cách tải lại trang. `StateMessage` nhận
`onRetry`/`retryLabel`; áp cho Dashboard (progress + streak) và Progress/Analytics
(gọi lại đúng bộ lọc đang chọn, không mất dữ liệu đang xem).

### [Chat] Giữ vị trí đang đọc, retry, loading indicator

- Auto-cuộn **chỉ khi người dùng đang ở đáy** (ngưỡng 80px). Bản gốc luôn
  `scrollTo(scrollHeight)`, nên đang đọc lại lịch sử sẽ bị giật về đáy. Gửi
  tin nhắn mới thì bật lại auto-cuộn.
- Tin nhắn lỗi kèm nút "Thử lại" (xoá tin lỗi rồi gửi lại y hệt).
- 3 chấm "đang trả lời" (`role="status"`) thay dòng chữ tĩnh.
- Khung chat `overscroll-behavior: contain` — chặn cuộn lây sang trang ngoài.

### [Android wrapper]

- `res/xml/file_paths.xml`: đủ 5 vùng FileProvider (`external-path`,
  `external-files-path`, `external-cache-path`, `cache-path`, `files-path`).
  Bản gốc chỉ có 2 ⇒ `<input type="file">` có thể crash với
  `IllegalArgumentException: Failed to find configured root`.
- `versionCode` 1 → 2, `versionName` 1.1.0 (Play từ chối bản có versionCode
  không lớn hơn bản trước).
- `appId ai.learnx.app` đã đồng nhất ở cả 4 nơi — không đổi.

**Verification:** `tsc --noEmit` sạch · `eslint src` **0 error** (22 warning cũ,
không thuộc file đã sửa) · `vitest run` **421/421** (thêm 10 test mới cho
`readApi`/`describeError`) · `next build` compiled successfully.
**APK chưa build được trên máy này** — `npm run mobile:check` báo thiếu JDK
17+/Android SDK Platform 35; đây là giới hạn môi trường, không phải lỗi code.

---

## 2026-10-02 — Tách `currentGrade` (hồ sơ) khỏi `diagnosticGrade` (lớp đang kiểm tra)

### [Schema] Mỗi bài kiểm tra mang lớp của riêng nó

**Vấn đề:** chỉ có 1 `grade` trong `User.learningProfile` (lớp hiện tại). Bài
kiểm tra cũng lấy chính số đó → không thể lưu "đã kiểm tra lớp 10" khi đang
lớp 11, và lịch sử bị ghi đè.

**Changed:**
- `prisma/schema.prisma` + migration `20261002000000_add_diagnostic_grade`:
  - `Assessment.educationStage`, `Assessment.grade` (**nullable**, giữ dữ liệu cũ);
  - `DiagnosticSession.educationStage`, `DiagnosticSession.grade` (nullable);
  - index `Assessment(userId, grade)`.
- Không backfill giá trị lịch sử: dữ liệu cũ đọc được với `grade = null`, không
  bịa số lớp cho những bài đã làm trước đây.

### [Service] `resolveDiagnosticLevel()` — 1 nguồn sự thật cho lớp kiểm tra

- Đọc `learningProfile` từ **DB**; danh sách lớp lấy từ
  `gradeOptionsFor(educationStage)` (`lib/onboarding/options.ts`) nên UI và
  validate không lệch nhau, không hardcode 10/11/12 ở frontend.
- Lớp client xin kiểm tra phải hợp lệ với cấp đã khai, không hợp lệ → rơi về
  lớp hiện tại.
- **Tuyệt đối không ghi lại vào hồ sơ** → học sinh lớp 11 vẫn kiểm tra được
  lớp 10 mà `currentGrade` giữ nguyên 11.
- `gradeLevelText()` (`lib/personalization/context.ts`) dựng câu trình độ cho
  prompt từ lớp ĐÃ LƯU, dùng chung với `readGradeLevel` để mọi prompt nói
  cùng một cách ("học sinh lớp 10").

### [API] Lớp chạy xuyên suốt 1 bài kiểm tra

- `POST /api/assessment/start`: nhận `grade`, validate server-side, sinh câu đầu
  theo lớp đó, lưu `educationStage/grade` vào `Assessment`; chỉ tái dùng phiên
  `in_progress` **cùng lớp** (trước đây có thể trộn hai lớp vào một phiên).
- `POST /api/assessment/answer`: câu tiếp theo lấy lớp từ `Assessment.grade` —
  trước đây gọi `generateQuizQuestion` không kèm lớp, tức câu 2..15 có thể lệch
  chương trình so với câu 1.
- `POST /api/diagnostic/session` + `GET /api/diagnostic/status`: nhận/trả
  `educationStage`, lớp hiện tại và `availableGrades` suy từ DB.

### [UI] Chọn lớp ở màn Diagnostic

Danh sách lớp render từ `availableGrades` của server, mặc định = lớp hiện tại,
nhãn dùng chung key `onboarding.grade.*`. Hồ sơ chưa khai cấp → ẩn khối này
(không hiện gì mới so với hành vi cũ).

### [AI] `buildAdaptiveTeachingRules()` — dạy theo trình độ thật

Chủ đề yếu (<50%) → dựng lại nền tảng 7 bước, không nhảy thẳng công thức nâng
cao; chủ đề vững (≥80%) → bỏ phần cơ bản, nâng bài tập (khớp ngưỡng
`skillsMastered` của Analytics). Nối vào `buildLearningContext` nên Tutor /
Agent / Quiz / Diagnostic cùng hưởng.

### [Profile] Thêm trường học (`school`)

Text tự do, validate bằng `readTextField` (không có "danh sách trường" trong hệ
thống và không được bịa): `""` = xoá, sai kiểu/quá dài = báo lỗi. Ghi vào
`mergeLearningProfile` nên lần lưu sau không có `school` vẫn giữ nguyên giá
trị cũ.

**Verification:** `tsc --noEmit` sạch · `eslint src` 0 error (23 warning cũ, không
thuộc file đã sửa) · `vitest run` **411/412** (1 test file tạm `_tmp_dump.test.ts`
đã xoá) · `next build` compiled successfully.

---

## 2026-10-01 — Fix render công thức toán (LaTeX) + React duplicate key ở Analytics

### [Math] LaTeX AI sinh sai cú pháp không còn lộ raw ra UI

**Root cause (không đoán, có bằng chứng):**
1. **KaTeX KHÔNG hỗ trợ `\textsuperscript`** — kiểm chứng trực tiếp bằng
   `katex.renderToString("\\textsuperscript{2}", { throwOnError: true })` ⇒
   `Undefined control sequence`. Với `throwOnError: false` (cấu hình cũ) lỗi bị vẽ
   thành **CHỮ ĐỎ** trên UI. Mô hình sinh dạng này vì quen viết mũ kiểu HTML.
2. **`src/lib/math/segments.ts` không có tầng bọc fragment LaTeX TRẦN**: AI hay quên
   delimiter (đáp án `\; \text{(m/s\textsuperscript{2})}`) ⇒ không có `$`/`\(...\)`
   ⇒ `splitMathSegments` coi là TEXT ⇒ **lộ nguyên chuỗi ra UI**.
3. **`normalizeLatexEscapes` chỉ vá `\\(`/`\\[`** — backslash thừa trước lệnh khác
   (`\\text`, `\\frac`, `\;`) không được gộp.
4. **Một số màn hình render nội dung AI bằng plain text**, không đi qua SafeMath:
   quiz/flashcard ở Workspace, prompt/đáp án ở trang Review.

**Đã kiểm tra và LOẠI trừ:** `MATH_FORMAT_RULE` (prompts.ts) hiển thị đúng 1 dấu `\`
(`\\(` trong template literal → chuỗi `\(`), nên **không phải** nguồn double-escape;
DB thực tế cũng lưu LaTeX đúng delimiter + 1 backslash (đã quét 324 cột DB).

**Changed:**
- `src/lib/math/segments.ts` (normalizer dùng chung):
  - `normalizeMathLatex()`: `\textsuperscript{x}`→`^{x}`, `\textsubscript{x}`→`_{x}`;
    `\text{...}` CHỨA toán → `\mathrm{...}` (vì `^` không hợp lệ trong text mode).
    `\text{m/s}` (đơn vị thuần) GIỮ NGUYÊN — không đổi cách hiển thị đang chạy tốt.
  - `collapseDoubleBackslash()`: gộp `\\` thừa ngoài math (không đụng `\\` ngắt dòng
    của matrix/cases, không đụng `\n`/`\t`).
  - `expandBareLatex()`: bọc fragment LaTeX trần thành math, chỉ khi gặp lệnh trong
    **whitelist** (chặn `C:\Users`, `\n`), bỏ qua khi có `` ` ``/`*` (không phá code
    span/italic), dừng run ở chữ có dấu (không nuốt tiếng Việt vào math mode).
- `src/lib/math/render.ts` (mới): `renderMathHtml()` dùng chung — parse `throwOnError:
  true` trước (công thức hợp lệ ra HTML y hệt trước đây), chỉ khi **parse fail** mới
  `repairLatex()` rồi thử lại, cuối cùng mới vẽ lỗi như cũ. SafeMath + MarkdownLite
  dùng chung hàm này (không tạo renderer thứ ba, không đổi UI).
- `src/app/(app)/workspace/page.tsx`, `src/app/(app)/review/page.tsx`: nội dung AI
  (câu hỏi/đáp án/giải thích/flashcard/prompt ôn tập) render qua `SafeMath` sẵn có.

### [Analytics] Duplicate React key ở BarChart

**Root cause:** `BarChart` dùng `key={d.label}` trong khi `label` là **TÊN MÔN**
(`data.subjectTimeShare` đến từ `GROUP BY subject` — không thể sinh 2 chuỗi giống
hệt nhau). Hai môn khác byte nhưng hiển thị giống (trailing space / NBSP / NFC-NFD)
⇒ 2 item cùng key ⇒ React cảnh báo và có nguy cơ trộn identity khi re-render.

**Changed:** `src/components/analytics/AnalyticsChart.tsx` — key = `` `${d.label}-${index}` ``
(identity theo VỊ TRÍ trong danh sách dữ liệu tĩnh, ổn định giữa các render).
KHÔNG dedupe dữ liệu, không đổi UI/CSS/tính toán analytics.

**Verification:** `tsc --noEmit` exit 0 · `eslint src --quiet` 0 error · `vitest run`
**31 file / 392 test pass** (gồm 17 test mới: case `\; \text{(m/s\textsuperscript{2})}`,
case over-escape `\\;\\text{...}`, bảo vệ `\(15\ \text{m/s}\)` của DB, giữ `\\` của
matrix/cases, code span + đường dẫn file không bị bọc, toàn bộ case BƯỚC 7 của đề bài,
và test mức component render `MarkdownLite`) · `next build` exit 0.

---

## 2026-10-01 — Fix auth-gate asset tĩnh (manifest/logo) + ổn định session ↔ Review API

### [Auth/Proxy] `manifest.webmanifest` + asset công khai không còn bị chặn sau đăng nhập

**Root cause (Manifest Syntax error — tái hiện được):** `/manifest.webmanifest` (Next sinh từ
`src/app/manifest.ts`) KHÔNG nằm trong danh sách miễn trừ của matcher `src/proxy.ts` → request
manifest của browser (thường phát sinh từ trang `/login`, khi CHƯA có cookie) bị proxy bắt và
redirect `307 → /login` → browser nhận HTML thay vì JSON → console báo đúng lỗi
`Manifest: Line: 1, column: 1, Syntax error`. Cùng lỗi với asset tĩnh `brand/learnx-mark.svg`
(logo/icon trỏ từ metadata + manifest) khi chưa đăng nhập.

**Root cause (401 dù `/api/auth/session` 200):** callback `session` trong `src/auth.ts` chỉ gán
`session.user.id` KHI token có claim `userId` — JWT "cũ" (phát hành trước khi claim này tồn tại,
hoặc qua luồng không truyền `user` vào callback `jwt`) thiếu claim đó ⇒ `getCurrentUserId()`
trả `null` ⇒ mọi API protected 401, trong khi session endpoint vẫn 200 và proxy vẫn cho qua
(`req.auth.user` truthy) — trạng thái "nửa đăng nhập" rất khó chẩn đoán.

**Changed:**
- `src/proxy.ts`: matcher miễn trừ thêm `brand` + `manifest.webmanifest` (giữ NGUYÊN toàn bộ
  logic auth/onboarding bên trong; `/api/**` vẫn không bị redirect như trước).
- `src/auth.ts`: callback `jwt` thêm fallback `if (!token.userId && token.sub) token.userId = token.sub`
  (chạy TRƯỚC session callback trên mọi lần đọc JWT); callback `session` bỏ gate `&& token.userId`
  và gán `session.user.id = token.userId ?? token.sub` — mọi JWT hợp lệ đều cho ra `user.id`.
- `src/app/(app)/review/page.tsx`: fetch review điều kiện hoá theo `useSession().status` —
  `loading`: không fetch/không redirect; `authenticated`: fetch; `unauthenticated`:
  `router.replace("/login")`. Loại bỏ race "gọi API protected khi session chưa sẵn sàng".
- `src/app/api/review/due/route.ts`: `limit` không phải số nguyên trong [1,100] → **400** rõ ràng
  (trước đây NaN rơi xuống Prisma `take` → 500). Auth vẫn chạy TRƯỚC (ẩn danh → 401, không lộ
  hành vi validate); không truyền limit → default 20 (contract cũ giữ nguyên).

**Affected:** `src/proxy.ts` · `src/auth.ts` · `src/app/(app)/review/page.tsx` ·
`src/app/api/review/due/route.ts` · `README.md` (Project Structure) · CHANGELOG.

**Impact:** không đổi Prisma query/ReviewItem, không đổi luồng Google/Credentials login.
Về chuỗi redirect: `/review` (ẩn danh) → 307 một chiều → `/login` 200 — không tồn tại vòng
`/review ↔ /login` trong code (đã audit toàn bộ `router.push/replace`, `redirect()`, `signOut`);
pattern log xen kẽ là các request KHÔNG có cookie hợp lệ (client thứ hai / probe / session cũ
sau khi AUTH_SECRET thay đổi) chứ không phải loop của ứng dụng.

**Verification:** tái hiện `GET /manifest.webmanifest` → 307 `/login` trước fix; sau fix:
200 `application/manifest+json` + JSON hợp lệ · `GET /brand/learnx-mark.svg` → 200 `image/svg+xml`
(trước: 307) · refresh `/review` × 3 (ẩn danh) → luôn 307 một chiều → `/login` 200 ·
`/api/review/due?limit=30` & `?limit=abc` (ẩn danh) → 401 JSON (auth-guard trước validate) ·
`tsc --noEmit` exit 0 · `eslint src --quiet` exit 0 · `vitest run` 30 file / 375 pass ·
`next build` exit 0 (`/manifest.webmanifest` được prerender static).

**Lưu ý kiểm chứng:** luồng đã-đăng-nhập (200 cho `/api/review/due`) không test được từ shell
(không có credential session) — cần xác nhận trên browser đã login: Network chỉ hiện
`/api/review/due?limit=30 200` đúng 1 lần/lần load, không còn 401.

---

## 2026-10-01 — Fix request lặp `/api/review/due` + tối ưu query Prisma

### [Review] Gộp request đang bay + giảm query thống kê `ReviewItem`

**Changed:**
- Thêm `src/lib/api/reviewDue.ts` — **client helper dùng chung** cho 2 consumer duy nhất của
  endpoint (trang `/review` limit=30, dashboard limit=5): khử trùng request ĐANG BAY theo URL
  (in-flight dedupe). React StrictMode (dev) gọi effect 2 lần + Fast Refresh re-run effect +
  remount nhanh trước đây bắn nhiều request trùng, mỗi request chạy lại cả chùm query Prisma;
  giờ cùng URL đang bay chỉ còn 1 request. Sau khi xong entry bị xoá ⇒ refresh (nút "Làm mới",
  vào lại trang) vẫn là request mới, KHÔNG cache.
- `GET /api/review/due`: chuẩn hoá `limit` (NaN từ query rác trước đây làm Prisma ném 500;
  giờ fallback 20 và chặn trần 100).
- `services/spaced-repetition.service.ts`:
  - `getReviewStats()`: 4 query (3 × `count` + `findMany` nạp TOÀN BỘ row để tự cộng) → **1
    query** `$queryRaw` với `COUNT(*) FILTER` + `AVG("easeFactor")` tại DB (cùng pattern
    `learning-analytics.service.ts`). Ngữ nghĩa giữ nguyên (due/upcoming bỏ qua NULL, total =
    due + upcoming, avg tính trên mọi item, mặc định 2.5).
  - `getDueReviews()`: thêm `select` (id, topic, concept, subject, prompt, answer,
    repetitions, nextReviewAt) thay vì kéo nguyên row (metadata Json, easeFactor, timestamps…).
    Type trả về mới `ReviewDueItem` (thay `ReviewItemData` ở consumer `api/next-action`).

**Affected:** `src/lib/api/reviewDue.ts` (mới) · `src/app/(app)/review/page.tsx` ·
`src/app/(app)/dashboard/page.tsx` · `src/app/api/review/due/route.ts` ·
`src/app/api/next-action/route.ts` · `src/services/spaced-repetition.service.ts`

**Impact:** endpoint vẫn là nguồn dữ liệu DUY NHẤT từ PostgreSQL như trước — không mock,
không hardcode; response `reviews[]` giờ chỉ chứa các field UI thật sự đọc (2 consumer đã dùng
đúng subset này từ trước). Requests/trang-load: 2 → 1 (dev StrictMode); query Prisma/request:
6 → 3 và không còn O(N) row transfer cho phần thống kê.

**Verification:** `tsc --noEmit` exit 0 · `eslint src --quiet` 0 error · `vitest run`
30 file / 375 test pass (gồm 4 test mới cho dedupe) · `next build` exit 0 · smoke test dev
server: `/api/review/due?limit=30` & `?limit=abc` → 401 JSON (auth-guard chạy trước),
`/review` `/dashboard` → 307 về `/login` (không redirect loop).

**Migration:** không có (index `[userId, nextReviewAt]` đã tồn tại sẵn trong schema).

---

## 2026-09-26 — Dọn dead code (audit PROVE BEFORE DELETE)

### [Cleanup] Xoá 15 file dead code + 4 thư mục rỗng

**Changed:**
- Xoá 12 component **0 tham chiếu** (đã chứng minh bằng import-graph + grep toàn repo; repo
  KHÔNG có dynamic import dạng biến/`next/dynamic`/`React.lazy` nên graph là đầy đủ):
  `components/FilterPanel.tsx` · `components/SearchBar.tsx` (legacy feature "tasks") ·
  `components/auth/LogoutButton.tsx` (thay bằng `account/AccountMenu.tsx`) ·
  `components/documents/CodeBlock.tsx` (thay bằng `MarkdownLite` render code inline) ·
  `components/ui/LevelHero.tsx` (thay bằng `ui/LevelProgressBar.tsx`) ·
  `components/ui/{Badge,ConfirmDialog,GlassCard,ProgressRing,Tabs,Tooltip}.tsx` ·
  `components/tutor/TutorSidePanel.tsx` + cascade `TutorModeBar.tsx` (chỉ được dùng bởi
  TutorSidePanel) + cascade `components/tutor/types.ts` (chỉ được dùng bởi 2 component trên).
- Xoá `lib/storage/localUpload.ts` — README đã ghi rõ là code cũ; `dbUpload.ts` thay thế hoàn toàn.
- Xoá 4 thư mục rỗng: `src/pages` (Pages Router thừa), `src/services/__tests__`,
  `src/app/api/agent/adapt`, `src/app/api/agent/plan/[id]`.

**Affected:** `src/components/**` · `src/lib/storage/` · `README.md` · `CHANGELOG.md`

**Impact:** không đổi hành vi runtime. CSS design-system trong `globals.css` (`.badge--*`,
`.toast--*`, `.tooltip`, `.tabs`, `.ring` …) **giữ nguyên** vì được ghép class động trong JSX
(rule "không xoá CSS chỉ vì search string không thấy"). `ui/Modal.tsx` + `ui/Drawer.tsx` giữ lại
dù 0 tham chiếu — đang được sửa trong working tree (rule: không xoá file user vừa chỉnh).

**Ghi nhận (không xoá — cần quyết định của user):** 26 API route không có caller tĩnh
(`/api/tutor/*` cũ, `/api/rewards/*`, `/api/daily-challenge*`, `/api/agent/*`,
`/api/diagnostic/{answer,result,session}` — đã bị flow `/api/assessment/*` thay thế,
`/api/analytics/{insights,overview}`, `/api/lxp/history`, `/api/learning/activity`,
`/api/review/create`, `/api/achievements*`); `services/document-quality.service.ts` (0 caller,
README còn mô tả); 4 gói không thấy import (`@supabase/ssr`, `@supabase/supabase-js`,
`@fontsource/noto-sans`, `@capacitor/browser`); 107 i18n key không thấy ngoài `dictionary.ts`
(nhiều key dùng động như `` t(`analytics.difficulty.${d}`) `` nên KHÔNG xoá tự động).

**Verification:** `tsc --noEmit` exit 0 · `npm run lint` 0 error / 23 warning (không đổi) ·
`npm test` 28 file / 357 test pass.

**Migration:** không có. Khôi phục file đã xoá: `git checkout HEAD -- <đường-dẫn>`.

---

## 2026-09-26 — Onboarding + Brand + Analytics + Multi-subject

Phiên này gồm 5 nhóm thay đổi kiến trúc độc lập.

### [Onboarding] Onboarding thành 5 phase + gate mềm

**Changed:**
- `/onboarding` chuyển sang **5 phase** với danh sách step **động theo nhóm người
  dùng** (học sinh / sinh viên / người đi làm / tự học).
- Thêm phase 04 **Kiểm tra năng lực**, phase 05 **Profile Ready**.
- Thêm mốc `learningProfile.surveyDecidedAt` — cờ "đã chốt khảo sát".
- Thêm **gate mềm**: `LEARNING_GATE_PATHS` + `needsLearningProfile()`.
- `postLoginDestination()` **giữ nguyên** (21 test cũ vẫn xanh).

**Affected:** `LearningOnboarding.tsx` · `ProfileReady.tsx` · `onboarding.css` ·
`lib/onboarding/{steps,options,state,profile,client}.ts` ·
`services/onboarding.service.ts` · `api/onboarding/route.ts` · `auth.ts` ·
`proxy.ts` · `dictionary.ts` · 4 file test

**Impact:**
- Câu hỏi khảo sát **đổi theo nhóm** — mỗi nhóm thấy đúng bước của nhóm đó.
- `/roadmap`, `/diagnostic`, `/practice`, `/library` redirect `/onboarding` khi chưa
  chốt. **`/dashboard` cố ý KHÔNG bị chặn** (có test khoá lại).

**Migration:** không có — `learningProfile` là cột `Json?`, chỉ mở rộng shape.

---

### [Onboarding] Sửa lỗi vòng lặp khi bấm "Bắt đầu học theo lộ trình"

**Changed:** `ProfileReady.tsx` — gộp `goDashboard()` → `leaveTo(path)`, gọi
`complete_survey` **trước** khi điều hướng; thêm state `leaving` (disable +
`aria-busy` + spinner, chặn double-click).

**Root cause:** nút roadmap gọi thẳng `router.push("/roadmap")` mà không ghi
`surveyDecidedAt`; `/roadmap` nằm trong gate ⇒ bị kéo về `/onboarding` ⇒ bấm lại
lặp lại, **không bao giờ ra khỏi màn hồ sơ**.

**Lesson:** mọi nút rời khỏi `/onboarding` phải đi qua `leaveTo()`. Gọi
`router.push` trực tiếp tới path bị gate là bug.

---

### [Brand] Logo + app download thành hệ thống dùng chung

**Changed:**
- `public/brand/learnx-mark.svg` là **nguồn duy nhất** (web + favicon + PWA +
  Android adaptive icon).
- `src/components/brand/LearnXLogo.tsx` — cửa ngõ duy nhất được render logo.
- Xoá `AndroidAppCard.tsx` + 248 dòng CSS, thay bằng
  `src/components/mobile/AppDownloadBlock.tsx`.
- Thêm `AppDownloadBubble.tsx` + `FloatingActions.tsx` (cột nổi chung cho AI
  Assistant + App Download).
- `metadata`: icons, apple, manifest, OpenGraph, Twitter.

**Root cause (lỗi chồng chữ ở Profile Ready):** thẻ APK cũ xếp
`QR | chữ | 2 nút` trong **một hàng `nowrap`** + breakout
`margin-left:50% + translateX(-50%)` (chỉ đúng khi cha rộng = viewport). Tái dùng
trong khung 620px ⇒ chữ tràn **đè lên nút**, thẻ tràn 2 mép bị cắt, QR bị
`display:none` dưới 1099px. Sửa bằng cột dọc tuần tự trong normal flow.

**Lesson:** thêm UI tải app — dùng `AppDownloadBlock` (khối) hoặc
`AppDownloadBubble` (nổi). Không tạo thẻ APK mới.

---

### [Analytics] Bổ sung 2 biểu đồ còn thiếu

**Changed:**
- **Phân bổ thời gian theo môn** (`subjectTimeShare`) — SQL `GROUP BY subject` trên
  `LearningSession`, dùng **cùng công thức** `COALESCE(completedAt, startedAt)` với
  KPI thời gian học.
- **Đúng / Sai / Chưa hoàn thành** (`outcomes`) — `Attempt` UNION
  `ExerciseAttempt`; "chưa hoàn thành" tách riêng khỏi "sai".
- Tạo `src/services/analytics/outcomes.ts` — hàm thuần có docstring định nghĩa metric.
- Tạo `scripts/verify-analytics-sql.mjs` — verify SQL với DB thật (chỉ đọc).

**Impact:** `/progress` là trang **Study Analytics** (đã có trong nav, không tạo
route `/analytics` trùng). Số liệu 100% từ DB — không có fallback fake data.

**Verified:** SQL thật trên DB dev → `{"correct":23,"incorrect":13}` từ 36 Attempt
(23+13=36 khớp tuyệt đối).

---

### [Subjects] Tạo Subject Engine — nền tảng đa môn

**Changed:**
- Tạo `src/lib/subjects/engine.ts`: registry 9 môn (Toán, Tiếng Anh, Vật lý, Hóa
  học, Sinh học, Tin học, Ngữ văn, Lịch sử, Địa lý) với `QuestionType` (26 loại),
  `CardField` (19 trường), `SkillNode` taxonomy, `promptGuidance`.
- Tạo `src/lib/subjects/progress.ts`: `summarizeBySubject`, `pickFocusSubject`,
  `pickWeakestTopic` — **hàm thuần**, có test.
- `buildQuestionGenPrompt()` nhận `context` **tuỳ chọn** (questionType, gradeLevel,
  mastery) → prompt Toán khác prompt Tin học, **vẫn qua 1 AI Router**.
- `quiz.service.ts` đọc `LearningProgress.mastery` + `educationStage/grade` thật
  trước khi sinh câu hỏi.
- Tạo `readGradeLevel()` trong `lib/personalization/context.ts`.
- Tạo `SubjectSwitcher` + `SubjectProgressPanel`; mount vào `/practice` + `/dashboard`.
- Thay ô text "môn học" ở `/practice` bằng chip chuyển môn.

**Quyết định tránh trùng lặp (quan trọng cho agent sau):**
- **Không** tạo bảng mastery thứ 2 → dùng `LearningProgress` có sẵn.
- **Không** tạo thuật toán adaptive thứ 2 → `nextDifficulty()` **uỷ chuyển**
  `pickNextDifficulty()` sẵn có, nhận hàm làm tham số.
- **Không** tạo AI provider riêng cho môn → chỉ thêm `promptGuidance`.
- **Không** sửa `lib/constants/subjects.ts` (6 consumer) → engine tách file riêng.
- **Không** migration: schema đã đủ `subject`/`topic`/`difficulty` ở mọi bảng.

**Bug tự bắt được nhờ test:** `slug` tiếng Việt có dấu → URL hỏng. Đã sửa bằng
`toSlug()` (NFD + bỏ dấu).

→ Chi tiết: [SUBJECTS.md](./SUBJECTS.md)

---

## 2026-09-26 (trước đó) — Onboarding bug fix

### [Onboarding] `cleanString` gộp 3 trạng thái vào `undefined`

**Changed:** thay bằng `readTextField()` trả discriminated union 4 nhánh
(`absent` / `clear` / `value` / `invalid`) cho `field`, `topics`, `futureGoal`,
`otherSubject`.

**Root cause:** frontend cố ý gửi `""` làm tín hiệu "đã xoá ô", nhưng sanitizer
loại `""` **trước khi** tới `mergeLearningProfile` ⇒ tín hiệu xoá bị huỷ ⇒ user
xoá "Kinh tế" nhưng DB vẫn giữ. `otherSubject` bị lỗi **im lặng**.

**Migration:** không có.

---

## Mẫu thêm thay đổi

```md
## YYYY-MM-DD

### [Tên module]

Changed:
- ...

Affected:
- file1 · file2

Impact:
- Ảnh hưởng hành vi gì.

Migration:
- None. | mô tả migration + cách rollback.
```