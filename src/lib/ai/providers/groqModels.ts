// ================================================================
// GROQ MODEL REGISTRY — nguồn sự thật DUY NHẤT cho model ID của Groq
// ================================================================
// Mạch tư duy: display name trên Groq Console ("GPT OSS 120B", "Qwen
// 3.6 27B"...) KHÔNG phải model ID thật mà API yêu cầu — dùng nhầm
// display name sẽ ra lỗi 404 model_not_found (đúng lỗi đã gặp với
// "llama-3.3-70b-versatile" bị deprecate). Toàn bộ ID dưới đây tra
// trực tiếp từ https://console.groq.com/docs/models, KHÔNG đoán.
//
// LearnX hiện tại CHỈ dùng capability "chat" (tutor/quiz/roadmap sinh
// text) — các model vision/STT/TTS/moderation được khai báo sẵn ở đây
// để khi nào LearnX có tính năng tương ứng (vd nhận diện ảnh bài tập,
// đọc to câu hỏi...) chỉ cần import từ registry này, KHÔNG cần tra lại
// model ID hay tạo thêm registry khác. groq.provider.ts hiện tại CHỈ
// wire model "chat" vào callOpenAICompatibleChat — cố tình KHÔNG viết
// sẵn hàm gọi vision/STT/TTS vì chưa có nơi nào trong app cần, viết
// trước sẽ là code chết không ai test được.
// ================================================================

export type GroqCapability =
  | "chat"
  | "reasoning"
  | "tool-use"
  | "text"
  | "multilingual"
  | "vision"
  | "speech-to-text"
  | "text-to-speech"
  | "moderation";

interface GroqModelDef {
  id: string;
  capabilities: GroqCapability[];
}

export const GROQ_MODELS = {
  // Reasoning/Function Calling/Text/Multilingual mạnh nhất hiện có —
  // dùng làm default cho chat/tutoring/reasoning/coding.
  GPT_OSS_120B: {
    id: "openai/gpt-oss-120b",
    capabilities: ["chat", "reasoning", "tool-use", "text", "multilingual"],
  },
  // Bản nhẹ hơn, dùng cho task không cần suy luận sâu.
  GPT_OSS_20B: {
    id: "openai/gpt-oss-20b",
    capabilities: ["chat", "reasoning", "tool-use", "text", "multilingual"],
  },
  QWEN_3_6_27B: {
    id: "qwen/qwen3.6-27b",
    capabilities: ["vision", "tool-use"],
  },
  QWEN_3_8_27B: {
    id: "qwen/qwen3.8-27b",
    capabilities: ["vision", "tool-use"],
  },
  WHISPER_LARGE_V3: {
    id: "whisper-large-v3",
    capabilities: ["speech-to-text"],
  },
  WHISPER_LARGE_V3_TURBO: {
    id: "whisper-large-v3-turbo",
    capabilities: ["speech-to-text"],
  },
  ORPHEUS_ENGLISH: {
    id: "canopylabs/orpheus-v1-english",
    capabilities: ["text-to-speech"],
  },
  ORPHEUS_ARABIC_SAUDI: {
    id: "canopylabs/orpheus-arabic-saudi",
    capabilities: ["text-to-speech"],
  },
  SAFETY_GPT_OSS_20B: {
    id: "openai/gpt-oss-safeguard-20b",
    capabilities: ["moderation"],
  },
} as const satisfies Record<string, GroqModelDef>;

// Model mặc định cho use case chat/tutor/quiz/roadmap hiện tại của
// LearnX — đọc qua biến này thay vì hardcode string ở groq.provider.ts,
// để sau này đổi default chỉ cần sửa 1 chỗ.
export const DEFAULT_GROQ_CHAT_MODEL: string = GROQ_MODELS.GPT_OSS_120B.id;
