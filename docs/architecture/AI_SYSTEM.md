# AI SYSTEM

**1 router duy nhất** điều phối nhiều provider. KHÔNG tạo provider riêng cho tính
năng hay môn học.

## Files

| File | Vai trò |
|---|---|
| `src/lib/ai/router.ts` | `generateText()`, `generateJSON()`, `createAIRouter()` |
| `src/lib/ai/prompts.ts` | **Toàn bộ prompt** của hệ thống |
| `src/lib/ai/types.ts` | `AIProvider`, `GenerateOptions` |
| `src/lib/ai/providers/*` | Gemini, Groq, OpenRouter, DeepSeek, openaiCompatible, timeout |

## Thứ tự provider

```
generateJSON(opts, validate)
      ↓
DEFAULT_AI_PROVIDERS  (thứ tự cố định, export để test khoá lại)
      ↓ lần lượt thử: timeout → retry → provider kế tiếp
Gemini → Groq → OpenRouter → (DeepSeek tuỳ config)
      ↓ tất cả fail
AIOverloadedError
```

Provider thiếu API key tự bị bỏ qua. `validate` là hàm normalize: **parse lỗi
JSON = chuyển provider tiếp theo**, không phải trả lỗi cho user.

## Prompt

Tất cả nằm trong `src/lib/ai/prompts.ts`. Prompt builder quan trọng:

| Builder | Dùng bởi |
|---|---|
| `buildQuestionGenPrompt` | Quiz + Diagnostic — **subject-aware** |
| `buildSocraticPrompt` | AI Tutor (7 cấp độ gợi ý) |
| `buildRoadmapPrompt` | Sinh lộ trình |
| `buildFlashcardsPrompt` | Sinh thẻ nhớ |
| `buildDocumentSummaryPrompt` | Tóm tắt tài liệu |
| `buildStudyGuidePrompt` | Cẩm nang ôn tập (3 mức độ) |
| `buildMindMapPrompt` | Mind map |
| `buildReviewPrompt` | Ôn tập |
| `buildDiagnosticPrompt` | Câu hỏi chẩn đoán (subject-aware) |
| `buildAgentPlannerPrompt` | Kế hoạch agent |
| `buildTutorEvaluationPrompt` | Chấm câu trả lời của học sinh |
| `buildDocumentQualityPrompt` | Đánh giá chất lượng tài liệu cộng đồng |
| `buildSuggestedQuestionsPrompt` | Gợi ý câu hỏi từ tài liệu |

### Subject-aware (từ 2026-09-26)

`buildQuestionGenPrompt(subject, topic, difficulty, sourceContext?, context?)` —
`context` là **tuỳ chọn có default** nên call site cũ không phải sửa:

```ts
context?: {
  questionType?: QuestionType;  // lấy từ lib/subjects/engine.ts
  gradeLevel?: string;          // từ readGradeLevel()
  mastery?: number;             // 0..1, đọc LearningProgress thật
}
```

`MATH_FORMAT_RULE` **chỉ bật cho môn toán** (`engine.usesMathNotation`) — bật cho
mọi môn sẽ ép AI viết `\(x\)` trong câu tiếng Anh.

## Nguyên tắc: không bịa ngữ cảnh

`buildLearningContext()` (`lib/personalization/context.ts`) trả prompt **RỖNG**
khi user chưa có gì. Nguyên tắc: **prompt rỗng tốt hơn prompt bịa**. Thêm câu
"người dùng chưa cho biết gì" ⇒ AI bắt đầu tự suy đoán — đúng thứ cấm.

`mastery` chỉ truyền vào khi có dòng `LearningProgress` thật; thiếu thì
`undefined`, prompt nói "chưa có dữ liệu" chứ không bịa 0%.

## Module dùng AI

| Module | Service | Model ghi |
|---|---|---|
| Quiz | `quiz.service.ts` | `QuizQuestionCache` (giữ đáp án server-side, **không** gửi về client trước khi trả lời) |
| Diagnostic | `diagnostic.service.ts` | `DiagnosticSession`, `Attempt` |
| Tutor | `tutor.service.ts`, `socratic-tutor.service.ts` | `TutorSession`, `Conversation` |
| Roadmap | `roadmap.service.ts` | `Roadmap` |
| Documents | `document.service.ts` | `LearningArtifact` |
| Review | `spaced-repetition.service.ts` | — |
| Mind Map | `mindmap.service` (qua API) | `MindMap` |

Mọi lời gọi được ghi log vào `AIRequestLog` (token, latency, provider đã dùng).

## RAG

```
Document → extractText (PDF/DOCX/MD) → DocumentChunk (embedding vector 768, pgvector)
      ↓ similarity search
   Context đưa vào prompt
```

`src/lib/embeddings/` + `src/lib/documents/`. Lỗi `operator does not exist:
vector <-> vector` ⇒ migration extension pgvector chưa chạy (xem README).

## Test

`src/lib/ai/__tests__/router.test.ts` — khoá thứ tự fallback, timeout, retry,
`AIOverloadedError`. Sửa `DEFAULT_AI_PROVIDERS` phải cập nhật test này.
