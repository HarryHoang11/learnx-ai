# SUBJECTS

Nền tảng đa môn: **1 Core Learning Engine dùng chung**, mỗi môn có hành vi riêng
nằm trong registry.

## Files

| File | Vai trò | Ghi chú |
|---|---|---|
| `src/lib/subjects/engine.ts` | Registry 9 môn + tra cứu | **Nguồn sự thật hành vi môn** |
| `src/lib/subjects/progress.ts` | Gom tiến bộ theo môn | Hàm thuần, có test |
| `src/lib/constants/subjects.ts` | Danh sách môn cho UI/validate | 6 consumer cũ — **đã có sẵn, đừng sửa** |
| `src/components/subject/SubjectSwitcher.tsx` | Chip chuyển môn | Dùng chung |
| `src/components/subject/SubjectProgressPanel.tsx` | Panel đa môn Dashboard | Dùng chung |

**Vì sao tách khỏi `constants/subjects.ts`:** file đó là "danh sách môn để hiển
thị/validate", đang được 6 file import. Engine là tầng khác — biết *cách học*
môn đó, không chỉ *tên* môn. Gộp vào sẽ kéo tầng AI/assessment vào file danh mục.

**Hai nguồn phải khớp**: `engine.subject` TRÙNG `SUBJECTS[].value`. Có test
(`__tests__/engine.test.ts`) kiểm — thêm môn vào một bên mà quên bên kia sẽ bị
bắt ngay.

## Cấu trúc registry

```ts
interface SubjectEngine {
  subject: string;          // "Toán" — trùng SUBJECTS[].value
  slug: string;             // "toan" — trùng SUBJECTS[].slug
  icon: string;             // "📐"
  questionTypes: readonly QuestionType[];
  cardFields: readonly CardField[];
  skillTaxonomy: readonly SkillNode[];
  promptGuidance: string;   // chèn vào prompt chung
  usesMathNotation: boolean;// bật MATH_FORMAT_RULE
  isCodeSubject: boolean;   // hiển thị editor + chạy test
}
```

9 môn: Toán · Tiếng Anh · Vật lý · Hóa học · Sinh học · Tin học · Ngữ văn ·
Lịch sử · Địa lý.

`QuestionType` (26) và `CardField` (19) là **string union** chứ không phải enum DB:
đây là phân loại AI dùng để định hướng, không phải dữ liệu cần query/lọc. Thêm
loại mới = thêm 1 member (type-safe, có test), **không cần migration**.

## Chính sách mở rộng: `withSubject()`

```ts
withSubject(subject)  // LUÔN trả engine hợp lệ
```

Môn chưa có trong registry (user tự gõ ở onboarding) vẫn dùng được — nhận engine
trung tính dựng từ chính tên môn đó. Nhờ vậy **thêm môn mới không cần sửa code**,
chỉ thêm 1 entry vào `SUBJECT_ENGINES` để có phần tối ưu.

Đừng đổi `withSubject` thành trả `undefined` — mọi call site sẽ phải null-check
và một nơi quên là crash.

## Luồng sử dụng

```
withSubject(subject)
      ↓
buildQuestionGenPrompt(..., { questionType, gradeLevel, mastery })
      ↓
AI Router  ← CHUNG, không provider riêng cho môn
      ↓
Attempt → LearningProgress
      ↓
summarizeBySubject()   ← hàm thuần
      ↓
SubjectProgressPanel (Dashboard) / SubjectSwitcher (Practice)
```

## Design system: KHÔNG tô màu theo môn

Các môn chỉ khác ở **icon + nhãn**. Màu dùng chung token `--indigo` / `--cyan` /
`--panel`. 9 môn phải trông như 1 sản phẩm, không phải 9 app.

## Thứ tự ưu tiên môn (progress.ts)

`summarizeBySubject` sắp theo **số chủ đề đã có dữ liệu học** giảm dần — KHÔNG
sắp theo mastery. Vì người mới bắt đầu có mastery thấp ở *mọi* môn; số chủ đề
mới phản ánh "môn này học sinh đang thực sự đầu tư".

`pickFocusSubject` ưu tiên môn **đang còn yếu** trong nhóm đầu.

## Test

- `__tests__/engine.test.ts` — registry, tra cứu, question type, taxonomy
- `__tests__/progress.test.ts` — gom môn, tìm mạnh/yếu, empty state

Bug đã bắt được nhờ test: `slug` tiếng Việt có dấu → URL hỏng. Đã sửa bằng
`toSlug()` (NFD + bỏ dấu). **Khi thêm môn mới, hãy đảm bảo slug qua test này.**

## Việc chưa làm (biết trước)

- Chưa có model `Flashcard` — flashcard hiện chỉ AI sinh từ document, không lưu
  DB, không chạy SM-2. Khi làm: **tái dùng `ReviewItem`** cho SM-2, đừng tạo hệ
  review thứ 2.
- `nextDifficulty()` đã export + test nhưng **chưa nối vào UI**.
- `CardField` khai báo rồi nhưng chưa dùng (chờ Flashcard engine).
