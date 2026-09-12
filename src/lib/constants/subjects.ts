// ================================================================
// CENTRALIZED SUBJECT CONFIGURATION
// ================================================================
// Mạch tư duy: danh sách môn học được dùng LẶP ĐẠI ở nhiều nơi —
// diagnostic page, library upload form, roadmap form, practice filter,
// v.v. Trước đây mỗi file tự hardcode mảng riêng (diagnostic/page.tsx
// có AVAILABLE_SUBJECTS, library/page.tsx có SUBJECTS) — dễ gây lệch
// khi thêm/bớt môn. Tập trung thành 1 file config:
//   - subjects: danh sách cố định các môn học hệ thống hỗ trợ
//   - getSubjectBySlug: tra ngược từ slug (đã dùng trong URL) về tên
//   - validateSubject: dùng ở API để kiểm tra subject gửi lên là hợp lệ
//
// LƯU Ý: danh sách Subject trong DB (model Subject trong schema.prisma)
// là "danh mục cộng đồng mở rộng" — có thêm icon, color, mô tả. Danh
// sách này (config tĩnh) là TẬP CON dùng cho diagnostic/library/rosp
// — luôn luôn hợp lệ vì người dùng chỉ chọn trong danh sách này.
// Nếu DB có thêm môn mới, chỉ cần import Subject từ DB về và thêm
// vào đây để đồng nhất.
// ================================================================

import type { I18nKey } from "@/lib/i18n/dictionary";

export interface SubjectConfig {
  value: string;
  slug: string;
  labelKey: I18nKey;
}

export const SUBJECTS: SubjectConfig[] = [
  { value: "Toán", slug: "toan", labelKey: "library.subjects.math" },
  { value: "Tin học", slug: "tin-hoc", labelKey: "library.subjects.cs" },
  { value: "Vật lý", slug: "vat-ly", labelKey: "library.subjects.physics" },
  { value: "Hóa học", slug: "hoa-hoc", labelKey: "library.subjects.chemistry" },
  { value: "Sinh học", slug: "sinh-hoc", labelKey: "library.subjects.biology" },
  { value: "Tiếng Anh", slug: "tieng-anh", labelKey: "library.subjects.english" },
  { value: "Ngữ văn", slug: "ngu-van", labelKey: "library.subjects.literature" },
  { value: "Lịch sử", slug: "lich-su", labelKey: "library.subjects.history" },
  { value: "Địa lý", slug: "dia-ly", labelKey: "library.subjects.geography" },
];

export const SUBJECT_VALUES = SUBJECTS.map((s) => s.value);

export const CUSTOM_SUBJECT_VALUE = "Khác";

export interface SubjectOption {
  value: string;
  slug: string;
  labelKey: string;
}

export function getSubjectBySlug(slug: string): SubjectConfig | undefined {
  return SUBJECTS.find((s) => s.slug === slug);
}

export function getSubjectByValue(value: string): SubjectConfig | undefined {
  return SUBJECTS.find((s) => s.value === value);
}

export function validateSubject(subject: string): boolean {
  return SUBJECT_VALUES.includes(subject);
}
