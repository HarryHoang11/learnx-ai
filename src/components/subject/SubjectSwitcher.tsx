// ================================================================
// <SubjectSwitcher /> — chuyển môn, dùng chung mọi trang
// ================================================================
//
// VÌ SAO CẦN (yêu cầu §24): LearnX là nền tảng đa môn, nên "đang học môn nào"
// phải là 1 quyết định LUÔN THẤY, không phải thứ phải nhớ từ URL. Component
// này là nơi DUY NHẤT render danh sách môn — không hardcode môn ở Sidebar, không
// hardcode ở từng page.
//
// 2 NGUYÊN TẮC thiết kế:
//   1. Dùng CHUNG design system: chỉ đổi icon + nhãn, KHÔNG đổi màu theo môn
//      (§32). Màu accent lấy từ token sẵn có (--indigo/--cyan) để 9 môn trông
//      như 1 sản phẩm chứ không phải 9 app.
//   2. Danh sách môn lấy từ registry `lib/subjects/engine.ts` — thêm môn mới
//      không cần sửa file này.
//
// TRẠNG THÁI: `selected` để highlight; `onSelect` để chuyển hồ sơ. Không tự
// điều hướng (nếu tự push thì mất context của trang đang xem — ví dụ đang đọc
// analytics Toán thì bấm môn khác chỉ nên đổi bộ lọc, không thoát trang).
// ================================================================

"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";
import { SUBJECT_ENGINES, withSubject, type SubjectEngine } from "@/lib/subjects/engine";
import "./subject-switcher.css";

interface SubjectSwitcherProps {
  /** Môn đang chọn. So khớp theo TÊN (không phân biệt hoa thường). */
  selected: string | null | undefined;
  /** Danh sách môn muốn hiện. Mặc định = toàn bộ registry. */
  subjects?: readonly SubjectEngine[];
  onSelect: (subject: string) => void;
  /** Nhãn của cụm chuyển môn (dịch qua i18n). */
  label?: string;
}

export default function SubjectSwitcher({
  selected,
  subjects = SUBJECT_ENGINES,
  onSelect,
  label,
}: SubjectSwitcherProps) {
  const { t } = useLanguage();
  const selectedName = (selected ?? "").trim().toLowerCase();

  return (
    <nav className="subject-switcher" aria-label={label ?? t("subjectSwitcher.label")}>
      <ul className="subject-switcher__list">
        {subjects.map((engine) => {
          const isActive = engine.subject.toLowerCase() === selectedName;
          return (
            <li key={engine.slug}>
              <button
                type="button"
                className={`subject-switcher__item${isActive ? " is-active" : ""}`}
                // `aria-current` là cách đúng để trình đọc màn hình biết đang ở
                // môn nào — màu sắc thì người mù màu không thấy.
                aria-current={isActive ? "true" : undefined}
                onClick={() => onSelect(engine.subject)}
              >
                {/* Icon trang trí: tên môn đã có sẵn bằng chữ ngay cạnh, đọc
                    thêm emoji chỉ là nhiễu cho screen reader. */}
                <span className="subject-switcher__icon" aria-hidden="true">
                  {engine.icon}
                </span>
                <span className="subject-switcher__name">{engine.subject}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Engine của môn đang chọn, dùng khi cần metadata (icon, question types) bên
 * ngoài component. Export riêng để page không phải import 2 từ 2 chỗ.
 */
export { withSubject };