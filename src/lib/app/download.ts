// ================================================================
// Floating action stack — quy tắc hiển thị
// ================================================================
//
// Tách riêng khỏi component vì đây là QUY TẮC SẢN PHẨM thuần: ai được hiện
// ở đâu. Component chỉ render theo — nhờ vậy quy tắc test được bằng hàm
// thuần, không cần dựng React hay trình duyệt.
//
// Đây là điểm dễ hỏng nhất của kiến trúc FAB: thêm 1 route mới mà quên
// cập nhật danh sách thì bubble xuất hiện ở chỗ không muốn, hoặc biến mất
// ở chỗ lẽ ra phải có.
// ================================================================

/**
 * Route KHÔNG hiện bubble tải app.
 *
 * Lý do từng route:
 * - `/tutor`      — panel AI gia sư chiếm gần hết màn hình; thêm bubble chỉ
 *                   che nội dung hội thoại mà không đem lại giá trị gì.
 * - `/onboarding` — trải nghiệm toàn màn hình, người dùng đang tập trung
 *                   trả lời khảo sát.
 * - `/welcome`    — trình diễn sản phẩm, đã có khối tải app riêng.
 * - `/setup`      — quick setup 3 bước, tương tự onboarding.
 *
 * AI Assistant KHÔNG nằm trong danh sách này: nó là hành động nổi chính, phải
 * hiện ở mọi trang trong app (kể cả /tutor — đó là nút quay lại).
 */
export const APP_DOWNLOAD_HIDDEN_ROUTES: readonly string[] = [
  "/tutor",
  "/onboarding",
  "/welcome",
  "/setup",
];

/**
 * Có ẩn bubble tải app ở route này không?
 *
 * Khớp cả route con (`/tutor/abc`) để không bỏ sót khi app thêm route
 * động về sau.
 */
export function isAppDownloadHiddenRoute(pathname: string): boolean {
  return APP_DOWNLOAD_HIDDEN_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}