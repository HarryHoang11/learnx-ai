// ================================================================
// DEEP LINK — biến URL `learnx://...` thành đường dẫn web
// ================================================================
// Mạch tư duy: AndroidManifest khai báo intent-filter cho scheme `learnx`
// (xem android/app/src/main/AndroidManifest.xml). Nhưng khai báo intent-filter
// CHỈ giúp Android gửi intent tới app — nếu web không có listener `appUrlOpen`
// thì URL bị bỏ rơi và app vẫn đứng ở trang hiện tại. Hai đầu phải có.
//
// Vì sao cần chuyển về đường dẫn web: `learnx://roadmap/123` có host là
// "roadmap" chứ không phải path, nên trình duyệt không tự hiểu là trang nào.
// Ta chỉ việc dựng lại "/roadmap/123" rồi đẩy vào Next router — mọi page,
// middleware và API route sẵn có chạy đúng như khi user gõ tay, không cần
// viết riêng handler cho từng màn.
//
// An toàn: chỉ nhận path BẮT ĐẦU bằng "/" và chặn "..". Nếu không chặn,
// URL như `learnx://evil.com/..` có thể khiến app điều hướng ra ngoài —
// đây là app đọc dữ liệu người dùng nên không được để URL ngoài điều khiển.
// ================================================================

/** Scheme khai báo trong AndroidManifest + capacitor.config.ts. */
const APP_SCHEME = "learnx";

/**
 * `learnx://roadmap/123` -> `/roadmap/123`
 *
 * Trả về `null` nếu URL không phải deep link hợp lệ, để caller bỏ qua.
 *
 * Vì sao gộp host vào path: với scheme tùy biến, phần đầu tiên sau `//` là
 * HOST, không phải path — nên `learnx://mindmap/123` mang ý nghĩa "trang
 * mindmap, mục 123", đúng như người dùng mong đợi khi chia sẻ link.
 */
export function parseDeepLink(rawUrl: string): string | null {
  // new URL() ném nếu chuỗi rác — bắt để URL lạ chỉ bị bỏ qua, không crash app.
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (url.protocol.replace(":", "") !== APP_SCHEME) return null;

  // Host + pathname, bỏ "/" đầu để ghép lại cho đúng: "roadmap" + "/123".
  //
  // `replace(/^\/+/)` ở cả 2 bên KHÔNG PHẢI cho đẹp — nó là chốt chặn open
  // redirect. Với scheme tùy biến, `new URL("learnx:////evil.com")` cho
  // hostname = "" và pathname = "//evil.com"; nếu ghép thẳng pathname ta được
  // "//evil.com", mà location.assign() hiểu đó là URL protocol-relative và
  // mở sang evil.com. Cắt sạch dấu "/" đầu thì kết quả luôn là "/evil.com"
  // — đường dẫn nội bộ (404), không ra khỏi app.
  const host = url.hostname.replace(/^\/+|\/+$/g, "");
  const path = url.pathname.replace(/^\/+/, "");
  const combined = `/${[host, path].filter(Boolean).join("/")}`;

  // Chốt chặn thứ hai (phòng thủ nếu sau này ai đó sửa hợp đoạn ghép ở trên):
  // kết quả phải bắt đầu bằng ĐÚNG MỘT dấu "/".
  //
  // Lưu ý khi sửa hàm này: KHÔNG dùng `includes("..")` để chặn path traversal.
  // `new URL()` đã tự chuẩn hoá ".." trước khi ta kịp đọc
  // (learnx://x/../../etc/passwd -> pathname "/etc/passwd"), nên điều kiện đó
  // không bao giờ chạy — trông có bảo vệ nhưng thực tế là code chết.
  if (!combined.startsWith("/") || combined.startsWith("//")) return null;
  return combined;
}
