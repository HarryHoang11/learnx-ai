// ================================================================
// <StateMessage /> — trạng thái "đang tải" / "lỗi" dùng chung
// ----------------------------------------------------------------
// Mạch tư duy: MỌI trang trong app đều fetch API rồi có 3 trạng thái
// giống nhau: loading / error / có data. Thay vì mỗi trang tự viết
// <p>Đang tải...</p> với style khác nhau, gom về 1 component để đồng
// nhất trải nghiệm và dễ đổi (vd thêm spinner) ở đúng 1 nơi.
// ================================================================

interface StateMessageProps {
  kind: "loading" | "error";
  text: string;
  /**
   * Nhãn của nút thử lại (đã qua i18n, ví dụ `t("common.retry")`). Truyền vào
   * thì component hiện nút "Thử lại" bên dưới thông báo.
   *
   * Vì sao cần: trên mobile, lỗi mạng xảy ra rất thường xuyên (rớt vùng,
   * đi vào thang máy). Chỉ hiện dòng chữ lỗi mà không có đường thoát buộc
   * người dùng phải tự tải lại trang — nút thử lại 1 chạm là chuẩn mọi app,
   * và quan trọng hơn là tránh mất dữ liệu họ đang nhập dở.
   */
  onRetry?: () => void;
  /**
   * Nhãn của nút thử lại (đã qua i18n, ví dụ `t("common.retry")`). Bắt buộc
   * phải truyền cùng `onRetry` — component không tự dịch vì nó không biết
   * `useLanguage()` (giữ component thuần, không phụ thuộc provider).
   */
  retryLabel?: string;
}

export default function StateMessage({ kind, text, onRetry, retryLabel }: StateMessageProps) {
  const isError = kind === "error";

  return (
    // role="status" (polite) cho loading, "alert" cho error: screen reader
    // đọc nội dung ngay khi trạng thái đổi mà không cắt ngang nội dung đang
    // đọc. Với lỗi thì báo "assertive" là hợp lý vì người dùng cần biết màn
    // hình đã hỏng.
    <div
      className={`state-msg ${isError ? "error" : ""}`}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      <span className="state-msg__text">{text}</span>
      {onRetry && retryLabel && (
        <button type="button" className="state-msg__retry" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}
