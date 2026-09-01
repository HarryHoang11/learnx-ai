// ================================================================
// <StateMessage /> — trạng thái "đang tải" / "lỗi" dùng chung
// ================================================================
// Mạch tư duy: MỌI trang trong app đều fetch API rồi có 3 trạng thái
// giống nhau: loading / error / có data. Thay vì mỗi trang tự viết
// <p>Đang tải...</p> với style khác nhau, gom về 1 component để đồng
// nhất trải nghiệm và dễ đổi (vd thêm spinner) ở đúng 1 nơi.
// ================================================================

interface StateMessageProps {
  kind: "loading" | "error";
  text: string;
}

export default function StateMessage({ kind, text }: StateMessageProps) {
  return <p className={`state-msg ${kind === "error" ? "error" : ""}`}>{text}</p>;
}
