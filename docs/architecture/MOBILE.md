# MOBILE

Chiến lược: **mobile-first bằng CSS, không phải thu nhỏ desktop.** Capacitor đóng
gói cùng codebase web — nên mọi thứ phải chạy được trên 360px ngay từ đầu.

## Vùng chạm chuẩn

Mọi nút/row bấm được: **`min-height: 44px`**. Đây là quy tắc không thỏa hiệp ở
bất kỳ component mới nào. Kiểm chứng: `SubjectSwitcher__item`,
`subject-progress__link`, `.app-dl__btn` (46px), `.onb-btn` (44px).

## Safe area

Token ở `src/app/globals.css` (`:root`):

```css
--safe-top: env(safe-area-inset-top, 0px);
--safe-bottom: env(safe-area-inset-bottom, 0px);
--bottom-nav-height: 58px;
--bottom-nav-offset: calc(var(--bottom-nav-height) + var(--safe-bottom));
```

Dùng `var(--bottom-nav-offset)`, **đừng tự cộng lại** — sẽ lệch chỗ.

## Token của cột nổi

```css
--fab-size: 56px;         /* AI Assistant (ưu tiên cao nhất) */
--fab-app-size: 52px;     /* App Download (thứ cấp) */
--fab-gap: 14px;          /* khoảng cách giữa 2 bubble */
--fab-edge: 22px;         /* lề mép màn hình (desktop) */
--fab-edge-mobile: 16px;  /* lề mép màn hình (mobile) */
```

## Cột nút nổi: `.floating-actions`

**Đây là nguồn sự thật DUY NHẤT cho vị trí mọi nút nổi góc phải dưới.**

```
.floating-actions   ← position: fixed, z-index 60, flex column
   ├── AppDownloadBubble   (thứ cấp — render TRƯỚC ⇒ ở trên)
   └── FloatingAIButton    (chính    — render SAU   ⇒ ở dưới)
```

Ưu tiên được quyết định bằng **thứ tự render**, không phải z-index — nên hai
nút không thể chồng nhau về mặt cấu trúc.

Khoảng cách dùng token `--fab-gap: 14px`, `--fab-edge` (22px desktop / 16px
mobile). Trên mobile cột này dùng `bottom: calc(var(--bottom-nav-offset) + 12px)`
⇒ nằm trên bottom nav.

> **Lesson đã mắc 1 lần:** `FloatingAIButton` từng tự `position: fixed;
> right:22px; bottom:22px`. Thêm bubble mới ở cùng góc là **đè lên nó**. Đã sửa
> bằng cách bỏ `position` khỏi button, để `.floating-actions` lo. Đừng thêm
> `position: fixed` vào bất kỳ nút nổi nào.

## Bottom navigation

`src/components/layout/MobileBottomNav.tsx` — 5 ô: **Home, Learn, Practice,
Progress, Profile** + ô "Thêm" mở sheet toàn bộ tính năng. Chiều cao
`--bottom-nav-height`.

Danh sách ô: `PRIMARY_TAB_HREFS` trong `src/components/layout/navGroups.ts`.
Nhãn ngắn (`nav.tabHome`, `nav.tabLearn`) lấy qua `tabLabelKey()` — Sidebar
desktop vẫn dùng nhãn đầy đủ, không bị đổi.

Sheet "Thêm" cuộn tới mục đang active nhờ `activeHref` + `data-sheet-href`
(xem `BottomSheet.tsx`) — không phải cuộn tìm trong 16 route.

## Ô nhập: 16px là BẮT BUỘC trên mobile

Khối `INPUT 16px TRÊN MOBILE` trong `globals.css`:

```css
@media (max-width: 880px) {
  input, textarea, select { font-size: 16px !important; }
}
```

`!important` là cần thiết: nhiều component dùng inline
`style={{ fontSize: 14 }}` và **inline style thắng mọi rule thường**. Không
có nó, quy tắc sẽ thành code chết (đúng như rule `.tutor-composer input`
trước đây). Khi thêm ô nhập mới, **đừng ghim fontSize inline** — để CSS lo.

## Khung chat Tutor không mất ô nhập khi mở bàn phím

`.tutor-panel`: desktop `height: 560px`; mobile `height: min(560px, 72dvh)`.

Bàn phím Android co WebView còn ~350px. Nếu panel cao cứng 560px thì ô nhập
(sticky ở đáy panel) bị đẩy vượt khỏi màn hình — mở bàn phím là mất ô nhập.

Ngoài ra ô nhập trong flex cần `minWidth: 0`, nếu không input giữ chiều rộng
nội tại và đẩy hàng tràn ngang ở 320px (áp dụng cho cả ô "hỏi AI" ở Dashboard).

## Lỗi: không bao giờ lộ message kỹ thuật ra UI

`src/lib/api/readApi.ts` — dùng chung cho mọi trang:

| Hàm | Việc |
|---|---|
| `readApi(res, label)` | Đọc body dạng text rồi parse; body không phải JSON (proxy trả HTML 502) thì ném `TransportError` thay vì `SyntaxError` |
| `describeError(err, fallback)` | `TransportError`/lỗi mạng → `fallback` (key i18n); `ApiError` → giữ nguyên message |
| `ApiError` | Lỗi chủ động throw với message đã viết cho người dùng (`json.error`) |

Pattern sai đã gặp: `catch (err) { setError(err.message) }` → màn hình hiện
"Unexpected token '<'", "Failed to fetch", "Load failed".

## Vùng chạm & phản hồi chạm

- Tối thiểu **44px** cho mọi nút/row bấm được.
- Trên mobile dùng `:active` để phản hồi, **không dùng `:hover`** (không có
  con trỏ chuột; `:hover` bám lại sau khi bấm và trông như trạng thái sai).
- `-webkit-tap-highlight-color: transparent` cho ô nav và nút icon.

## Màn rất hẹp (≤360px)

Block `MÀN RẤT HẸP` trong `globals.css` (đặt TOP-LEVEL vì CSS không cho
`@media` lồng trong `@media`). Nhãn tab xuống 2 dòng thay vì bị ellipsis cắt.

## Safe-area ở mọi trang ngoài (app)

Trang nằm ngoài route group `(app)` không có `.main-content` cấp padding, nên
phải tự chừa: `AuthShell` (login/register), `/setup`, `/welcome`. Thiếu chỗ
chừa = nội dung nằm dưới camera punch-hole.

> **Lesson đã mắc 1 lần:** `.welcome-topbar` có media query `@media
> (max-width: 768px) { padding: 16px 20px }` ghi đè mất `var(--safe-top)` mà
> bản desktop có. Media query sau luôn thắng — phải giữ safe-area ở **mọi**
> breakpoint.

## Hai bài học CSS đã mắc (2026-10-04)

**1. `gap`/`margin` trong flex KHÔNG tạo khoảng trắng trong DOM.**
Nhiều `<span>` inline cạnh nhau (ví dụ `.dash-lxp__label` / `__value` / `__cta`
trong một `<button>`) sẽ cho ra text **dính liền** khi copy hoặc screen reader
đọc: `Số dư LXP279LXPĐổi thưởng →`.

→ Muốn tách khối hiển thị: dùng `display: block` + `margin`, hoặc chèn text node
khoảng trắng thật giữa các phần tử. `flex`/`grid` `gap` chỉ tách **về mặt
thị giác**, không tách **về mặt văn bản**.

**2. Selector mất + `}` thiếu ⇒ nuốt mọi rule phía dưới.**
Trong `rewards.css` có `.rewards-hint {` và `.reward-card__footer {` bị mất
selector. Rule hỏng đó nuốt luôn các rule sau (kể cả `.dash-motivation`) ⇒
layout vỡ mà nhìn rất giống "thiếu margin".

→ **Luôn parse CSS sau khi sửa** để chắc chắn mọi selector mong muốn còn tồn
tại trong AST:

```bash
npm run check:css   # scripts/check-css-nesting.mjs
```

Script này phát hiện rule chứa ≥2 rule con (dấu hiệu bị nest nhầm) và báo
`}` thừa. Chạy sau **mỗi lần** sửa file `.css` theo miền chức năng.

**3. Dấu hiệu nhận biết: rule bị nest KHÔNG PHẢI lỗi JSX.**
Khi rule `.foo {` thiếu `}`, toàn bộ CSS phía dưới trở thành
`.foo .bar` — selector **không tồn tại trong DOM** nên không khớp element nào.
Triệu chứng rất dễ bị quy chụp nhầm cho lỗi React:

| Bạn thấy | Thực tế |
|---|---|
| `<button>` nền trắng, viền mặc định | CSS không áp dụng cho `.foo` |
| Font rơi về Times New Roman | `font-family` trong rule bị chặn bởi selector sai |
| `Số dư LXP:279LXPĐổi thưởng →` | `display:block` trong rule không chạy → `<span>` vẫn inline |
| Layout chồng/chạm | `gap`/`grid-template-columns` trong rule không chạy |

**Cách chẩn đoán nhanh (không đoán mò):** build rồi grep CSS bundle:

```bash
rg -l 'ten-class' .next/static --glob '*.css'
# Nếu thấy "ten-class-khac ten-class" => rule đang bị nest sai
```

Trường hợp thật gặp 2026-10-04: `.reward-card__footer {` (dòng 285) thiếu `}`
⇒ **80 node / 640 dòng** phía sau bị nest, kể cả `.dash-lxp`, `.challenge-card`,
`.dash-motivation`. CSS có trong bundle nhưng selector là
`.reward-card__footer .dash-lxp` — không tồn tại trong DOM. Sửa: đóng rule
tại chỗ + xoá `}` mồ côi ở cuối file.

Ngoài ra cần giữ an toàn ở các màn hẹp (320/360/375/390/414px): khoảng cách
giữa section dùng **token spacing có sẵn** (`--space-5` = 24px), `flex-wrap`
cho hàng metadata, `overflow-wrap: anywhere` cho số lớn (LXP), và
`min-width: 0` cho khối tiêu đề trong grid.

## Không horizontal overflow

- `SubjectSwitcher`: cuổn **ngang** (9 môn xuống dòng = 200px chiếm mất màn
  hình học). `overflow-x: auto` + `scroll-snap` + ẩn scrollbar.
- Popover App Download: `width: min(320px, calc(100vw - 32px))`, mở lên trên.
- Mọi khối: `overflow-wrap: anywhere` để chữ dài không tràn ngang.
- Ô nhập trong flex: `min-width: 0` — không có nó input giữ chiều rộng nội
  tại và đẩy cả hàng (ô nhập + nút) tràn khỏi 320px.

## App download

| Thành phần | Dùng ở |
|---|---|
| `src/config/app.ts` | **Nguồn URL APK duy nhất** (`getAndroidApp()`) |
| `components/mobile/AppDownloadBlock.tsx` | Khối đầy đủ (Welcome, ProfileReady) |
| `components/app-download/AppDownloadBubble.tsx` | Nút nổi trong FAB stack |
| `src/app/manifest.ts` | PWA manifest |

`getAndroidApp()` đọc `NEXT_PUBLIC_ANDROID_APK_URL` (nếu set) → fallback
`/downloads/learnx-ai.apk`. **Đổi APK sau này chỉ sửa 1 chỗ.**

`AppDownloadBlock` kiểm `HEAD` 1 lần; nếu 404 thì nút `aria-disabled` + ghi chú
trung thực, không bỏ mặc người dùng bấm vào nút chết.

**Không tạo thẻ APK mới** — bản cũ (`AndroidAppCard`) đã bị xoá vì gây chồng
chữ (xếp `QR | chữ | 2 nút` trong một hàng `nowrap` + breakout
`margin-left:50% + translateX(-50%)`).

## Brand trên mobile

- Logo: `public/brand/learnx-mark.svg` (nguồn duy nhất) qua
  `components/brand/LearnXLogo.tsx`.
- PWA icon + apple-touch icon + favicon đều trỏ cùng file.
- Android adaptive icon: `android/app/src/main/res/drawable/ic_launcher_foreground.xml`
  + PNG mipmap sinh bằng `npm run mobile:icons`.

## i18n

`src/lib/i18n/dictionary.ts` — vi + en, key dạng `module.sub.key` trong object
`as const` (nên `I18nKey` là union type, sai key là lỗi TypeScript).
`useLanguage()` → `t(key)`. **Không hardcode chuỗi trong component.**

## Build APK

```bash
npm run mobile:check         # kiểm tra JDK + Android SDK TRƯỚC khi build
npm run mobile:sync          # cap sync android
npm run mobile:apk:debug    # assembleDebug
npm run mobile:apk:release  # assembleRelease (cần keystore — xem build.gradle)
```

> **Điều kiện tiên quyết:** `mobile:check` phải báo "Đủ công cụ build Android"
> (JDK 17+ / 21 + Android SDK Platform 35 + Build-Tools 35). Nếu báo thiếu thì
> Gradle sẽ fail với lỗi dài và khó hiểu — đọc gợi ý ngay trong output của
> `mobile:check` (nó in đúng thứ thiếu và cách cài).
>
> `prisma generate` báo `EPERM` nếu dev server đang chạy (giữ khoá
> `query_engine-windows.dll.node`). Tắt dev server trước, hoặc verify build bằng
> `npx next build`.

### FileProvider (`res/xml/file_paths.xml`)

`<input type="file">` trong WebView đi qua FileProvider. Thiếu path tương ứng
⇒ app crash với `IllegalArgumentException: Failed to find configured root`.
Đang khai báo đủ 5 vùng: `external-path`, `external-files-path`,
`external-cache-path`, `cache-path`, `files-path`.

### Version

`versionCode` / `versionName` trong `android/app/build.gradle`. Bản release lên
Google Play **bắt buộc** versionCode lớn hơn bản trước.

## Cần kiểm bằng mắt

Các màn dưới đây **chưa** được verify trực quan ở 320/360/390/430px sau các
thay đổi gần đây: Quiz, Flashcards, Analytics, Subject Switcher, Dashboard,
Tutor, Roadmap, Mind Map. Khi sửa UI, kiểm các mức **320 · 360 · 390 · 430px**,
và cả dark/light mode.

Checklist bàn phím (mở bàn phím thật trên Android hoặc DevTools mobile):
ô nhập còn nhìn thấy · không bị che · trang không nhảy zoom · không tràn ngang.

Checklist cảm ứng: mọi nút ≥44px · `:active` có phản hồi · bottom nav không
che nội dung · sheet kéo xuống đóng được · nút back đóng sheet/modal trước khi
quay trang.

