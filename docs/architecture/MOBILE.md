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

`src/components/layout/MobileBottomNav.tsx` — 5 ô: Home, Learn, Practice,
Progress, Profile. Chiều cao `--bottom-nav-height`.

## Không horizontal overflow

- `SubjectSwitcher`: cuổn **ngang** (9 môn xuống dòng = 200px chiếm mất màn
  hình học). `overflow-x: auto` + `scroll-snap` + ẩn scrollbar.
- Popover App Download: `width: min(320px, calc(100vw - 32px))`, mở lên trên.
- Mọi khối: `overflow-wrap: anywhere` để chữ dài không tràn ngang.

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
npm run mobile:sync        # cap sync android
npm run mobile:apk:debug  # assembleDebug
```

> `prisma generate` báo `EPERM` nếu dev server đang chạy (giữ khoá
> `query_engine-windows.dll.node`). Tắt dev server trước, hoặc verify build bằng
> `npx next build`.

## Cần kiểm bằng mắt

Các màn dưới đây **chưa** được verify trực quan ở 360/390/430px sau các thay đổi
gần đây: Quiz, Flashcards, Analytics, Subject Switcher, Dashboard, Tutor, Roadmap,
Mind Map. Khi sửa UI, kiểm 3 mức: 360 · 390 · 430px, và cả dark/light mode.
