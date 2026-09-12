// ================================================================
// i18n — từ điển VI/EN dùng chung (không hardcode text UI khắp nơi)
// ================================================================
// Mạch tư duy: full i18n cho 50+ component trong 1 đợt là không tưởng
// mà vẫn giữ chất lượng — nên hệ thống đi theo lộ trình: 1) dictionary
// tập trung + type-safe key (thêm key mới là TS báo ngay chỗ thiếu
// bản dịch); 2) LanguageProvider (localStorage tức thì + DB persist);
// 3) dịch dần từ chrome (sidebar/topbar) ra từng page. Mọi text mới
// từ nay viết qua t(), không hardcode trực tiếp vào component chrome.

export type Language = "vi" | "en";

export const LANGUAGE_STORAGE_KEY = "learnx-lang";

export function normalizeLanguage(value: unknown): Language {
  return value === "en" ? "en" : "vi";
}

const vi = {
  "nav.groups.learn": "Học tập",
  "nav.groups.ai": "AI",
  "nav.groups.progress": "Tiến độ",
  "nav.groups.community": "Cộng đồng",
  "nav.groups.resources": "Tài nguyên",
  "nav.groups.account": "Tài khoản",
  "nav.dashboard": "Trang chủ",
  "nav.calendar": "Lịch học",
  "nav.roadmap": "Lộ trình học",
  "nav.practice": "Luyện tập",
  "nav.diagnostic": "Kiểm tra năng lực",
  "nav.tutor": "AI Gia sư",
  "nav.progress": "Tiến độ",
  "nav.friends": "Bạn bè",
  "nav.leaderboard": "Bảng xếp hạng",
  "nav.community": "Cộng đồng",
  "nav.library": "Thư viện",
  "nav.resources": "Tài liệu học",
  "nav.mindmap": "Mind Map",
  "nav.profile": "Trang cá nhân",
  "nav.streak": "Chuỗi ngày học",
  "topbar.menu": "Mở menu điều hướng",
  "topbar.logout": "Đăng xuất",
  "topbar.student": "Học sinh",
  "topbar.language": "Ngôn ngữ",
  "common.loading": "Đang tải...",
  "common.retry": "Thử lại",
  "common.cancel": "Hủy",
  "common.save": "Lưu",
  "common.close": "Đóng",
  "common.open": "Mở",
} as const;

const en: Record<keyof typeof vi, string> = {
  "nav.groups.learn": "Learn",
  "nav.groups.ai": "AI",
  "nav.groups.progress": "Progress",
  "nav.groups.community": "Community",
  "nav.groups.resources": "Resources",
  "nav.groups.account": "Account",
  "nav.dashboard": "Home",
  "nav.calendar": "Calendar",
  "nav.roadmap": "Roadmap",
  "nav.practice": "Practice",
  "nav.diagnostic": "Assessment",
  "nav.tutor": "AI Tutor",
  "nav.progress": "Progress",
  "nav.friends": "Friends",
  "nav.leaderboard": "Leaderboard",
  "nav.community": "Community",
  "nav.library": "Library",
  "nav.resources": "Resources",
  "nav.mindmap": "Mind Map",
  "nav.profile": "Profile",
  "nav.streak": "Learning streak",
  "topbar.menu": "Open navigation menu",
  "topbar.logout": "Log out",
  "topbar.student": "Student",
  "topbar.language": "Language",
  "common.loading": "Loading...",
  "common.retry": "Retry",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.close": "Close",
  "common.open": "Open",
};

export type I18nKey = keyof typeof vi;

const dictionaries: Record<Language, Record<I18nKey, string>> = { vi, en };

export function translate(lang: Language, key: I18nKey): string {
  return dictionaries[lang][key];
}
