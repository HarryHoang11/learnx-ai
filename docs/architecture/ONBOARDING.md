# ONBOARDING

Luồng: `/welcome` → `/onboarding` (5 phase) → `/dashboard`.
Bản đồ nghiệp vụ chi tiết: [docs/WELCOME.md](../WELCOME.md).

## State machine

`User.onboardingStatus` (enum Prisma `OnboardingStatus`):

| Giá trị | Nghĩa |
|---|---|
| `NEW` | Chưa xem `/welcome` |
| `EXPLORING` | Đã xem welcome, đang khảo sát |
| `PERSONALIZED` | Đã có hồ sơ đủ dùng |

Cờ phụ trong `learningProfile.surveyDecidedAt` — **"đã chốt khảo sát"**. Đây là cờ
tắt gate. Server tự sinh mốc này khi user đi tới cuối luồng hoặc bấm "làm sau".

## 5 phase

Nguồn sự thật: **`src/lib/onboarding/steps.ts`**. UI và thanh tiến trình CÙNG đọc
từ đây — không nơi nào tự chế danh sách.

| Phase | Nội dung | Bước (động theo nhóm) |
|---|---|---|
| 01 Profile | Học vấn | `stage` → `grade`/`track` (THCS-THPT) · `field` (ĐH) · `field`+`careerFields` (Đi làm) · `topics` (Tự học) |
| 02 Goals | Mục tiêu | `intent` → `goalCategory` + `goals[].title` + `futureGoal` |
| 03 Cách học | Sở thích | `studyTime` → `aiPreferences` → `learningPreferences` |
| 04 Kiểm tra | Năng lực | chuyển `/diagnostic?from=onboarding` |
| 05 Sẵn sàng | Hồ sơ | `ProfileReady.tsx` |

## Hàm thuần quan trọng

| Hàm | File | Việc |
|---|---|---|
| `stepsForStage(stage)` | `steps.ts` | Trả về chuỗi step cho nhóm người dùng đó |
| `phaseOfStep(step)` | `steps.ts` | Step thuộc phase nào (1-5) |
| `surveyProgress(draft)` | `steps.ts` | Tiến trình % |
| `sanitizeLearningProfile(raw)` | `profile.ts` | Validate + chuẩn hoá input |
| `mergeLearningProfile(cur, next)` | `profile.ts` | Gộp patch vào hồ sơ hiện tại |
| `isStepAnswered(step, draft)` | `profile.ts` | Bước đã trả lời chưa |
| `needsLearningProfile(state)` | `state.ts` | Cần nhắc hoàn thiện hồ sơ? |
| `hasDecidedSurvey(profile)` | `state.ts` | Đã chốt khảo sát? |
| `postLoginDestination(state)` | `state.ts` | Sau login đi đâu |

## Validate field — `readTextField` (QUAN TRỌNG)

`profile.ts` dùng discriminated union 4 nhánh, **không** dùng `cleanString`:

| Kết quả | Khi nào | Merge làm gì |
|---|---|---|
| `{ kind: "absent" }` | key không có trong payload | Không đụng field cũ |
| `{ kind: "clear" }` | `""` (user xoá ô) | **XOÁ** field |
| `{ kind: "value", value }` | chuỗi hợp lệ sau trim | Ghi đè |
| `{ kind: "invalid", reason }` | sai kiểu / quá dài | **BÁO LỖI**, từ chối |

**Lesson đã mắc 1 lần**: sanitizer cũ loại `""` trước khi tới merge ⇒ tín hiệu
"user xoá ô" bị nuốt ⇒ DB giữ giá trị cũ mãi mãi. Đừng đơn giản hoá hàm này.

Field áp dụng: `field`, `topics`, `futureGoal`, `otherSubject`.
`topics` cố ý là **string** (ô tự do), không phải `string[]` — có lý do thiết kế
ghi trong docstring `LearningProfile`.

## Gate mềm (`src/proxy.ts` + `state.ts`)

```
isLoggedIn && needsProfile && isLearningGatedPath(path)
      → redirect /onboarding
```

- `LEARNING_GATE_PATHS = ["/roadmap", "/diagnostic", "/practice", "/library"]`
- **`/dashboard` CỐ Ý không nằm trong danh sách** — user mới phải thấy app trước
  đã. Có test khoá lại điều này.
- `/onboarding` nằm trong `WELCOME_EXEMPT_PATHS` ⇒ không loop.
- `needsLearningProfile()` trả true khi: đã qua Welcome **VÀ** chưa chốt khảo
  sát **VÀ** chưa có dữ liệu học **VÀ** profile < 80%.

### NGOẠI LỆ: `/diagnostic?from=onboarding`

Bước 04 của khảo sát điều hướng sang `/diagnostic?from=onboarding` (`goDiagnostic()`
trong `LearningOnboarding.tsx`). Ở đúng thời điểm đó `surveyDecidedAt` **chưa** được
ghi (cố ý — user còn phải làm phase 05), nên `needsProfile` trả `true` và
`/diagnostic` nằm trong `LEARNING_GATE_PATHS` ⇒ proxy kéo thẳng về `/onboarding`,
tức **chính trang user đang đứng**. Kết quả: bấm "Bắt đầu kiểm tra" không thấy
gì xảy ra.

Vì vậy `proxy.ts` có miễn trừ:

```ts
if (isLoggedIn && needsProfile && isLearningGatedPath(path)
    && !isOnboardingDiagnosticEntry(path, req.nextUrl.searchParams)) {
  return NextResponse.redirect(new URL("/onboarding", req.nextUrl.origin));
}
```

`isOnboardingDiagnosticEntry()` (`src/lib/onboarding/state.ts`) chỉ đúng khi
pathname là `/diagnostic` **và** có `?from=onboarding`. Vào `/diagnostic` trực
tiếp từ sidebar vẫn bị nhắc khảo sát như cũ, và cờ này **không** nới gate cho
`/roadmap`, `/practice`, `/library`. Có test khoá lại trong
`src/lib/onboarding/__tests__/state.test.ts`.

## BẪY: nút rời khỏi màn hồ sơ

Mọi nút ở `ProfileReady.tsx` điều hướng ra ngoài **phải** gọi `leaveTo(path)`:

```ts
async function leaveTo(path: string) {
  if (leaving) return;      // chặn double-click
  setLeaving(true);
  await sendOnboardingAction("complete_survey");  // ghi cờ TRƯỚC
  router.push(path);
}
```

**Gọi `router.push` trực tiếp tới path bị gate là bug** — sẽ bị proxy kéo về
`/onboarding` và tạo vòng lặp. Đã xảy ra 1 lần với nút roadmap.

## API

`GET /api/onboarding` → trạng thái + hồ sơ.
`PATCH /api/onboarding` → action:

| Action | Tác dụng |
|---|---|
| `complete_welcome` | set `EXPLORING` + `welcomeSeenAt` |
| `save_learning_profile` | merge hồ sơ; `completed: true` nâng `PERSONALIZED` |
| `complete_survey` | set `surveyDecidedAt` (KHÔNG nâng `PERSONALIZED`) |
| `skip` | cho qua một bước |

`sendOnboardingAction()` **không throw** — trả `null` khi lỗi. Theo hợp đồng ghi
trong `client.ts`, UI **phải** tự hiện lỗi, không được im lặng coi như đã lưu.

## Offline / draft

`localStorage` (key `DRAFT_KEY`) chỉ là **bản nháp chống mất dữ liệu khi offline**,
không phải nguồn sự thật. Nguồn sự thật là DB.

## i18n

Key: `onboarding.*` + `onboarding.phase.*` + `onboarding.q.*` +
`onboarding.ready.*` + `onboarding.diag.*`. Thêm câu hỏi mới → thêm key **cả vi
và en** trong `src/lib/i18n/dictionary.ts`.

## Test

- `lib/onboarding/__tests__/steps.test.ts` — danh sách step theo nhóm
- `lib/onboarding/__tests__/state.test.ts` — state machine + gate
- `lib/onboarding/__tests__/profile.test.ts` — validate/merge field
- `app/api/onboarding/__tests__/route.test.ts` — route handler thật
