# Welcome Experience & Onboarding — LearnX AI

Tài liệu này mô tả luồng sau khi đăng nhập và **triết lý sản phẩm** đứng sau
nó. Đọc trước khi sửa bất cứ thứ gì trong `/welcome`, `/onboarding`,
`/setup`, `proxy.ts` hoặc phần onboarding của Dashboard.

---

## 1. Triết lý: Personalize, rồi hãy dive in

> **Thay đổi triết lý (2026-09).** Trước đây là *"Explore before you configure"*
> — vào app trước, cấu hình sau. Điều này **không còn đúng** với LearnX: nếu
> chưa có hồ sơ thì AI gia sư, đề xuất bài và lộ trình đều rơi về mức trung
> bình chung, người dùng **không bao giờ biết sản phẩm tốt ở đâu**.

Thứ tự ưu tiên mới:

```
1. GIỚI THIỆU NGẮN (Welcome)        <- 1 lần, tự phát
2. KHẢO SÁT HỒ SƠ HỌC TẬP           <- 5 phase, ~2 phút, bỏ qua ở mọi bước
3. KIỂM TRA NĂNG LỰC                <- 10-15 câu, bỏ qua được
4. XEM HỒ SƠ + LỘ TRÌNH GỢI Ý       <- dữ liệu thật, không bịa
5. VÀO DASHBOARD                     <- Profile -> Roadmap -> Dashboard
```

**Nhưng "ưu tiên" KHÔNG phải "ép".** Ranh giới bất di bất dịch:

| Quy tắc | Hiện thực |
|---|---|
| **Dashboard KHÔNG BAO GIỜ bị chặn** | `LEARNING_GATE_PATHS` cố tình **không** có `/dashboard` |
| Mọi bước khảo sát đều bỏ qua được | "Bỏ qua" ở từng bước, không xoá dữ liệu đã trả lời |
| Bỏ qua = tắt vĩnh viễn lời nhắc | Ghi `surveyDecidedAt` -> Dashboard tắt banner, không bao giờ hỏi lại |
| Chỉ NHẮC ở trang học chính | `/roadmap`, `/diagnostic`, `/practice`, `/library` mới bị đưa về `/onboarding` |
| Hồ sơ có dữ liệu thật thì thôi nhắc | Đã làm bài/tài liệu/lộ trình -> coi như AI đã biết qua hành vi |

Lý do chỉ chặn ở trang học chính: đó là nơi thiếu hồ sơ khiến tính năng
**không hoạt động** (AI hỏi sai mức, đề xuất bài lệch). Ở Dashboard người
dùng chỉ cần thấy app — chặn ở đó là biến onboarding thành trừng phạt.

---

## 2. Luồng

```
Login / Register
      ↓  (proxy.ts: user mới → /welcome, user cũ → /dashboard)
/welcome  — Welcome Experience (6 phase, ~20s, ESC để bỏ qua)
      ↓  CTA duy nhất: "Hoàn thiện hồ sơ học tập →"
/onboarding — khảo sát 5 phase (xem §3), câu hỏi ĐỔI THEO NHÓM NGƯỜI DÙNG
      ├── phase 04: "Bắt đầu kiểm tra" → /diagnostic?from=onboarding
      └── phase 05: HỒ SƠ SẴN SÀNG (ProfileReady) — hồ sơ + năng lực + lộ trình
      ↓
/roadmap  →  /dashboard
```

### Returning user

```
Login → Dashboard   (không Welcome, không khảo sát, không delay)
```

---

## 3. Khảo sát 5 phase — câu hỏi động theo nhóm

Nguồn duy nhất: **`src/lib/onboarding/steps.ts`** (`stepsForStage()`).
UI và thanh tiến trình cùng đọc hàm này — không nơi nào tự chế danh sách bước.

| Phase | Bước | THCS/THPT | ĐH/CĐ | Đi làm | Tự học |
|---|---|---|---|---|---|
| **01 Profile** | `stage` | ✓ | ✓ | ✓ | ✓ |
| | `grade` + `track` + `career` | ✓ | — | — | — |
| | `field` (ngành / nghề) | — | ✓ | ✓ | — |
| | `topics` (chủ đề tự học) | — | — | — | ✓ |
| **02 Goals** | `intent` (theo nhóm) | ✓ | ✓ | ✓ | ✓ |
| | `goal` + `futureGoal` | ✓ | ✓ | ✓ | ✓ |
| | `subjects` | ✓ | ✓ | ✓ | ✓ |
| **03 Learning style** | `time` | ✓ | ✓ | ✓ | ✓ |
| | `ai` | ✓ | ✓ | ✓ | ✓ |
| **04 Diagnostic** | `diagnostic` | ✓ | ✓ | ✓ | ✓ |
| **05 Ready** | màn hồ sơ | ✓ | ✓ | ✓ | ✓ |

Nguyên tắc: **hỏi "lớp mấy" với người đã đi làm là hỏi vô nghĩa** — đó là dữ
liệu rác làm prompt AI nhiễu. Bước không áp dụng thì không hiện.

`career` chỉ hỏi học sinh: sinh viên và người đi làm đã có `field` (ngành/nghề)
rồi, hỏi lại là hỏi trùng.

Mọi bước lưu được sau **từng** lần bấm Tiếp tục (không chỉ lúc hoàn tất) để
refresh / đóng tab không mất công sức. Quay lại `/onboarding` sẽ mở đúng bước
đầu tiên còn thiếu (`firstIncompleteStep`).

---

## 4. State machine

Enum `OnboardingStatus` (prisma/schema.prisma):

| Trạng thái | Nghĩa | Điều hướng |
|---|---|---|
| `NEW` | Vừa đăng ký, chưa xem Welcome | Bị đưa tới `/welcome` |
| `EXPLORING` | Đã xem Welcome, đang dùng app | Vào thẳng Dashboard |
| `SETTING_UP` | Đang làm Quick Setup | Vào thẳng `/setup` |
| `PERSONALIZED` | Đã có profile đủ dùng | Vào thẳng Dashboard |

**Cờ thứ hai — `learningProfile.surveyDecidedAt`:** user đã đi tới cuối luồng
(hoàn tất **hoặc** bấm bỏ qua). Mốc này tắt banner ưu tiên ở Dashboard.

Cố tình **không** dùng `onboardingStatus` cho việc này: bấm "làm sau" ở bước
kiểm tra năng lực không có nghĩa AI đã biết người dùng — đánh dấu
`PERSONALIZED` lúc đó là nói dối.

Mốc nằm trong JSON `learningProfile` chứ không phải cột riêng: nó là quyết định
của người dùng về chính hồ sơ đó, và luôn đi cùng hồ sơ — tách ra sẽ tạo 2 nơi
nói về cùng 1 sự thật.

---

## 5. Nguồn sự thật & các quy tắc điều hướng

Trạng thái nằm ở **DB** (`User.onboardingStatus`, `User.welcomeSeenAt`,
`User.learningProfile`). `localStorage` **không** dùng làm nguồn sự thật: mất
khi đổi máy, và `proxy.ts` chạy server nên không đọc được.

`surveyDecidedAt` được **mirror vào JWT** (callback `jwt` trong `src/auth.ts`):
đọc từ DB lúc đăng nhập, làm mới qua `useSession().update()` sau mỗi lần ghi.
Nếu thiếu bước làm mới này, proxy giữ cờ cũ và kéo người dùng về `/onboarding`
mãi.

### Bảng điều hướng (không bao giờ tự mâu thuẫn)

| Tình huống | Kết quả |
|---|---|
| Chưa đăng nhập, bất kỳ trang nào | → `/login` |
| Chưa đăng nhập, vào `/welcome` | → `/login` |
| Đã đăng nhập, `NEW`, vào `/login` `/register` | → `/welcome` |
| Đã đăng nhập, đã xem Welcome, vào `/login` `/register` | → `/dashboard` |
| Đã đăng nhập, `NEW`, vào trang app khác | → `/welcome` |
| Đã đăng nhập, `NEW`, vào `/welcome` `/setup` `/onboarding` | cho qua (không loop) |
| Đã xem Welcome, vào `/welcome` | → `/dashboard` |
| Đã xem Welcome, vào `/welcome?replay=true` | cho qua (xem lại) |
| **Chưa chốt khảo sát, vào `/roadmap` `/diagnostic` `/practice` `/library`** | **→ `/onboarding`** |
| **Chưa chốt khảo sát, vào `/dashboard`** | **cho qua — KHÔNG chặn** |
| Đã chốt khảo sát, vào bất kỳ trang nào | cho qua |

`isExemptFromWelcomeRedirect()` liệt kê các đường dẫn miễn — thêm route mới
cần chặn thì nhớ cập nhật hàm đó, kèm test tương ứng.

---

## 6. API

`/api/onboarding`

- `GET` → `{ status, welcomeSeenAt, firstLearningSessionAt, learningProfile, profileCompletion, profileComplete, hasLearningData }`
- `PATCH` `{ action }` với `action` ∈ `complete_welcome` · `start_setup` ·
  `complete_setup` · `mark_first_session` · `save_learning_profile` ·
  `skip_onboarding` · **`complete_survey`**

`complete_survey` ghi mốc `surveyDecidedAt` (idempotent, server tự sinh thời
gian — không tin giá trị client).

Route này **không bao giờ chặn**: client điều hướng bất kể kết quả
(`sendOnboardingAction` trả `null` khi lỗi, không throw).

---

## 7. Chỉ số đo lường

Metric chính **không phải** "onboarding completion rate" mà là:

- `firstLearningSessionAt` — thời điểm *Time to First Meaningful Learning
  Experience*. Được set khi user bắt đầu học ở Getting Started, hoặc khi làm
  bài / upload tài liệu.
- `surveyDecidedAt` — tỉ lệ user chốt khảo sát (hoàn tất vs bỏ qua). Tỉ lệ bỏ
  qua CAO là tín hiệu câu hỏi hỏi sai nhóm, không phải lỗi người dùng.
- Profile completion (`profileCompletion`) — chỉ số phụ, tính trên cùng ngưỡng
  80% mà `needsLearningProfile()` dùng.

---

## 8. Quick Setup (`/setup`)

3 bước, mỗi bước đều bỏ qua được — dành cho người ĐÃ CÓ hồ sơ muốn sửa nhanh.
Luôn mở được từ Trang cá nhân.

> Lưu ý: `/setup` **không** phải bước đầu của luồng mới. Người dùng mới đi
> qua `/onboarding`; `/setup` là lối cập nhật nhanh cho người đã quen app.

## 2. Luong
