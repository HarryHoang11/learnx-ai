// ================================================================
// Điều hướng — hàm THUẦN dùng chung cho mọi nơi tô sáng mục nav.
// ================================================================
// Mạch tư duy: trước đây logic "trang hiện tại có thuộc mục nav này không?"
// được viết inline trong Sidebar. Khi thêm thanh nav dưới cho mobile thì
// cần ĐÚNG logic đó ở nhiều chỗ — viết lại inline ở mỗi chỗ sẽ lệch nhau
// sau này (vd /mindmap vs /mindmap/abc). Gom thành hàm thuần ở đây để
// Sidebar lẫn MobileBottomNav cùng dùng MỘT định nghĩa, và test được.
// ================================================================

/**
 * Mục nav đang active hay không.
 *
 * Quy tắc:
 *  - href "/" chỉ khớp đúng "/" (không nuốt mọi route khác).
 *  - các href còn lại khớp khi: bằng đúng, HOẶC pathname là hậu tố của nó
 *    (vd /community/documents/123 khớp mục /community).
 *  - bỏ dấu "/" cuối ở cả 2 bên trước khi so sánh để không lệch do
 *    basePath/trailing-slash không nhất quán giữa các lần điều hướng.
 */
export function isActiveRoute(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  const current = trimTrailingSlash(pathname);
  const target = trimTrailingSlash(href);
  if (target === "/") return current === "/";
  return current === target || current.startsWith(`${target}/`);
}

function trimTrailingSlash(value: string): string {
  return value.length > 1 && value.endsWith("/") ? value.slice(0, -1) : value;
}
