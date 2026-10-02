// ================================================================
// <PasswordStrength /> — thanh đánh giá độ mạnh mật khẩu
// ================================================================
// Mạch tư duy — VÌ SAO CHỈ CÓ 4 QUY TẮC NÀY:
// điểm #30 của spec nói "không fake". Backend (`POST /api/auth/register`)
// chỉ kiểm tra `password.length < 8` rồi trả lỗi; `authorize()` trong
// auth.ts cũng không ràng buộc gì thêm. Nếu ta hiện thanh điểm kiểu
// "Yếu / Khá / Tốt / Rất tốt" dựa trên chữ hoa + số + ký tự đặc biệt thì
// người dùng tưởng app YÊU CẦU những điều đó, làm mật khẩu "đạt 4/4"
// rồi server vẫn nhận — hoặc tệ hơn: ta tự chặn người dùng với quy tắc
// không tồn tại. Vì vậy mọi quy tắc ở đây đều LÀ QUY TẮC THẬT của server.
//
// Thêm 1 dòng giải thích rõ điều kiện CÒN THIẾU (spec #39.4: "chỉ rõ
// điều kiện còn thiếu", đừng hiện "Invalid password") — người dùng biết
// chính xác phải làm gì để qua được.
import { useLanguage } from "@/components/providers/LanguageProvider";
import type { I18nKey } from "@/lib/i18n/dictionary";

interface PasswordStrengthProps {
  value: string;
  /** Hiện khi người dùng ĐÃ chạm vào ô (blur) hoặc đã gõ — không hiện lỗi
   *  lúc mới mở trang khi mật khẩu còn rỗng (spec #39.5: đừng spam lỗi
   *  khi user vừa bắt đầu nhập). */
  touched: boolean;
}

/** Điều kiện THẬT của backend: `/api/auth/register` chỉ chặn dưới 8 ký tự. */
const MIN_LENGTH = 8;

/**
 * Chấm 0..4 nhưng chỉ trên 2 tiêu chí thật (độ dài + có ký tự khác chữ cái
 * và số). Mục tiêu là HƯỚNG DẪN chọn mật khẩu tốt, không phải mô phỏng
 * chính sách server — nên phần "còn thiếu" chỉ nêu điều kiện bắt buộc.
 */
function scoreOf(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= MIN_LENGTH) score += 2;
  else if (password.length >= MIN_LENGTH - 3) score += 1;
  // "Nhiều hơn chữ cái" — cộng 1 cho sự đa dạng, cộng thêm 1 cho độ dài lớn.
  const hasVariety = /[^A-Za-z]/.test(password);
  if (hasVariety) score += 1;
  if (password.length >= 14) score += 1;
  return Math.min(4, score);
}

const LEVEL_KEYS: I18nKey[] = [
  "auth.strength.empty",
  "auth.strength.weak",
  "auth.strength.fair",
  "auth.strength.good",
  "auth.strength.strong",
];

export default function PasswordStrength({ value, touched }: PasswordStrengthProps) {
  const { t } = useLanguage();

  // Chưa chạm vào ô -> im lặng hoàn toàn.
  if (!touched || !value) return null;

  const score = scoreOf(value);
  const level = LEVEL_KEYS[score];
  const missing =
    value.length < MIN_LENGTH
      ? t("auth.strength.needLength", { n: String(MIN_LENGTH) })
      : null;

  return (
    <div className="pw-strength" aria-live="polite">
      {/* aria: dùng role="meter" để screen reader đọc được mức hiện tại;
          thanh màu đơn thuần là thông tin chỉ nhìn thấy được. */}
      <div
        className="pw-strength__bar"
        role="meter"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={4}
        aria-label={t("auth.strength.label")}
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`pw-strength__seg${i < score ? " is-on" : ""} is-lv${score}`}
          />
        ))}
      </div>
      <div className="pw-strength__meta">
        <span className={`pw-strength__label is-lv${score}`}>{t(level)}</span>
        {missing && <span className="pw-strength__hint">{missing}</span>}
      </div>
    </div>
  );
}
