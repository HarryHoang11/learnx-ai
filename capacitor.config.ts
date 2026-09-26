import type { CapacitorConfig } from "@capacitor/cli";
// Import ENUM thật (không phải type) ở file config: config chỉ chạy lúc
// build trong Node nên không ảnh hưởng bundle website, đổi lại được type-safe
// thay vì hardcode chuỗi rời rạc dễ sai ("native" vs "body").
import { KeyboardResize } from "@capacitor/keyboard";

// ================================================================
// CAPACITOR — cấu hình app Android cho LearnX AI
// ================================================================
// Mạch tư duy kiến trúc (quan trọng — đọc trước khi sửa):
//
//   LearnX AI chạy Next.js ở DẠNG HYBRID: app Android KHÔNG bundle một
//   bản copy của web. Nó mở WebView trỏ tới CÙNG origin với website
//   (`server.url`), nên:
//     - API hiện có gọi bằng đường dẫn tương đối ("/api/...") chạy y hệt
//       trên web, KHÔNG phải sửa 1 route nào cho mobile;
//     - cookie session của Auth.js dùng chung -> đóng app rồi mở lại vẫn
//       đã đăng nhập, không phải fix riêng cho mobile;
//     - database, AI key, logic AI vẫn nằm ở server, KHÔNG bao giờ vào APK.
//
// Hệ quả (nói thẳng để không ai hiểu nhầm): app CẦN mạng để tải app.
// Offline phần nào đã cache thì vẫn xem được; các màn cần server sẽ hiện
// trạng thái offline rõ ràng thay vì giả vờ hoạt động.
//
// `webDir` vẫn phải trỏ tới 1 thư mục có thật (Capacitor copy nó vào
// android/app/src/main/assets/public lúc `cap sync`). Vì runtime dùng
// server.url, thư mục này chỉ là phần dự phòng offline; trỏ vào `public/`
// đã tồn tại sẵn trong repo, không tạo thêm thư mục rỗng.
// ================================================================

/** Đọc biến môi trường kiểu string, trả undefined nếu thiếu/rỗng. */
function env(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

// Server mà WebView sẽ tải.
//   - Build APK production: set NEXT_PUBLIC_APP_URL (hoặc CAPACITOR_SERVER_URL).
//   - Build APK dev trên máy:  set CAPACITOR_SERVER_URL=http://<IP-LAN>:3000
//     (KHÔNG dùng localhost — trong emulator/máy thật, "localhost" là chính
//     điện thoại, không phải máy đang chạy Next dev).
const serverUrl = env("CAPACITOR_SERVER_URL") ?? env("NEXT_PUBLIC_APP_URL");

// Cảnh báo sớm: thiếu server.url thì app mở vào trang trắng của origin
// nội bộ — lỗi dễ hiểu nhầm thành "app hỏng" nên nói thẳng khi build.
if (!serverUrl) {
  console.warn(
    "[capacitor] CAPACITOR_SERVER_URL chưa được set — app sẽ mở trang trắng.\n" +
      "  Dev trên máy thật/emulator: set CAPACITOR_SERVER_URL=http://<IP-của-máy>:3000 (KHÔNG dùng localhost).\n" +
      "  Production: set CAPACITOR_SERVER_URL=https://<domain-của-bạn>."
  );
}

const config: CapacitorConfig = {
  appId: "ai.learnx.app",
  appName: "LearnX AI",
  webDir: "public",

  // Không bật: trên Android, thư viện web Capacitor vẽ bằng file local nên
  // bật Cleartext là không có tác dụng gì (nó chỉ có tác dụng với
  // `androidScheme: "http"`). Vẫn đặt false để rõ ý.
  android: {
    allowMixedContent: false,
  },

  server: {
    androidScheme: "https",
    // `hostname` là origin WebView dùng cho scheme `https` khi KHÔNG có
    // server.url. Giữ "localhost" (mặc định của Capacitor) vì đây chỉ là
    // scheme-origin nội bộ, không phải địa chỉ thật.
    hostname: "localhost",
    ...(serverUrl ? { url: serverUrl } : {}),
  },

  plugins: {
    SplashScreen: {
      // Tự ẩn: app gọi SplashScreen.hide() sau khi UI dựng xong, để không có
      // khoảng trắng giữa splash và nội dung.
      launchAutoHide: false,
      launchShowDuration: 0,
      backgroundColor: "#070B16",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
    Keyboard: {
      // Native: bàn phím thu nhỏ CẢ khung WebView -> input Tutor ở đáy luôn
      // nhìn thấy, không bị che (Body chỉ resize thẻ body, không đủ).
      resize: KeyboardResize.Native,
      resizeOnFullScreen: true,
    },
    StatusBar: {
      // Vẽ nội dung tràn qua status bar; safe-area padding (env()) lo phần
      // chừa chỗ. Nền status bar trùng màu app.
      overlaysWebView: true,
      // "LIGHT" = CHỮ SÁNG. LearnX mặc định nền tối (#070B16) nên chữ
      // sáng mới đọc được — "DARK" ở đây là chữ tối, tức gần như vô hình
      // trên nền tối. Effect trong NativeShell sẽ ghi đè theo theme.
      style: "LIGHT",
      backgroundColor: "#070B16",
    },
  },
};

export default config;
