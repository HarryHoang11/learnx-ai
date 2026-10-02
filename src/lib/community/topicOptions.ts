// ================================================================
// CHỦ ĐỀ từ taxonomy môn học (Subject → Topic)
// ================================================================
// Mạch tư duy: `GET /api/community/subjects?includeTopics=true` trả mỗi
// môn kèm `topics[]`, mỗi topic lại có `children[]` (Prisma
// `SubjectTopic.parentId` — xem prisma/schema.prisma). Bản form cũ CHỈ đọc
// `subject.topics` nên bỏ rơi hẳn tầng `children`.
//
// Hệ quả: với môn "Tin học", các chuyên đề như "Python", "C++" (con của
// "Lập trình") không bao giờ hiện ⇒ người dùng buộc chọn topic cha không
// liên quan, hoặc bỏ trống. Đó là lỗi domain, không phải lỗi hiển thị.
//
// File này chỉ chứa HÀM THUẦN (không React, không fetch) để test được bằng
// vitest mà không cần dựng server/DB.

/** Một topic từ API (đã gọn, chỉ field cần dùng). */
export interface RawTopic {
  id: string;
  name: string;
  description?: string | null;
  children?: RawTopic[] | null;
}

/** Một dòng trong `<select>` sau khi đã làm phẳng + gắn nhãn hierarchy. */
export interface TopicOption {
  id: string;
  /** Tên hiển thị, đã thêm tiền tố thụt lề theo tầng (vd "└ "). */
  label: string;
  /** 0 = topic gốc, 1 = con. Dùng cho test và styling nếu cần. */
  depth: 0 | 1;
}

/**
 * Làm phẳng `topics[]` + `children[]` thành danh sách option.
 *
 * - Giữ thứ tự `order` mà API đã sắp (không tự sắp lại để không lệch với
 *   seed/admin quản lý).
 * - Bỏ qua `children` rỗng/không phải mảng (API có thể trả `null`).
 * - KHÔNG tự chọn sẵn topic nào: việc chọn thuộc về người dùng, xem `page.tsx`.
 */
export function flattenTopicOptions(
  topics: readonly (RawTopic | null | undefined)[] | null | undefined
): TopicOption[] {
  if (!Array.isArray(topics)) return [];

  const out: TopicOption[] = [];
  for (const topic of topics) {
    // Phải kiểm tra cả `id` RỖNG, không chỉ sai kiểu: `<option value="">` sẽ
    // TRÙNG với mốc "Tổng hợp" ở đầu select ⇒ người dùng chọn vào nó không
    // phân biệt được với lựa chọn mặc định.
    if (!topic || typeof topic.id !== "string" || !topic.id) continue;
    if (typeof topic.name !== "string" || !topic.name) continue;

    out.push({ id: topic.id, label: topic.name, depth: 0 });

    const children = topic.children;
    if (Array.isArray(children)) {
      for (const child of children) {
        if (!child || typeof child.id !== "string" || !child.id) continue;
        if (typeof child.name !== "string" || !child.name) continue;
        out.push({ id: child.id, label: `└ ${child.name}`, depth: 1 });
      }
    }
  }
  return out;
}

/**
 * Có nên hiện lựa chọn "Tổng hợp" cho môn này không?
 *
 * VÌ SAO CẦN: taxonomy hiện có ví dụ môn "Hóa học" chỉ 4 topic lớn (vô cơ,
 * hữu cơ, phân tích, hóa lý). Tài liệu "Cân bằng hóa học" trải qua cả vô cơ
 * lẫn hữu cơ, ép chọn "Hóa học vô cơ" là SAI. Người dùng cần một lựa chọn
 * trung thực là "tài liệu này thuộc nhiều chủ đề".
 *
 * QUY TẮC: chỉ hiện khi môn có TỪ 2 topic trở lên — môn chỉ có 1 topic thì
 * chọn topic đó không sai, ép "Tổng hợp" vô nghĩa.
 */
export function shouldOfferGeneralTopic(
  topics: readonly (RawTopic | null | undefined)[] | null | undefined
): boolean {
  if (!Array.isArray(topics)) return false;
  const valid = topics.filter(
    (t): t is RawTopic =>
      !!t && typeof t.id === "string" && !!t.id && typeof t.name === "string" && !!t.name
  );
  return valid.length >= 2;
}
