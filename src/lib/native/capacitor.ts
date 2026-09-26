// ================================================================
// Lớp bọc Capacitor — điểm DUY NHẤT app web chạm vào thư viện native.
// ================================================================
// Mạch tư duy: code chạy trong WebView VÀ trong trình duyệt. Nếu import
// thẳng `@capacitor/app` ở component thì website sẽ vỡ (plugin không tồn
// tại ngoài app). Ở đây mọi lời gọi native đều đi qua đây và đều "no-op an
// toàn" khi không phải native — nhờ vậy website giữ nguyên hành vi cũ.
//
// Import ĐỘNG (await import) thay vì import tĩnh: plugin native kéo theo
// code chỉ chạy được trong app; import tĩnh sẽ bị Next đưa vào chunk của
// website và có thể lỗi khi SSR.
// ================================================================

type Cleanup = () => void;

/** true khi đang chạy trong app Android (không phải website). */
export function isNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

/** "android" | "ios" | "web" — dùng để chỉnh hành vi theo nền tảng. */
export async function getPlatform(): Promise<"android" | "ios" | "web"> {
  if (typeof window === "undefined") return "web";
  try {
    const { Capacitor } = await import("@capacitor/core");
    const platform = Capacitor.getPlatform();
    return platform === "android" || platform === "ios" ? platform : "web";
  } catch {
    return "web";
  }
}

/**
 * Gọi 1 plugin native, bỏ qua mọi lỗi.
 *
 * Bọc try/catch + check isNativeApp vì plugin có thể vắng mặt ở BẢN WEB
 * (đó là trường hợp bình thường, không phải lỗi) — nếu để lỗi nổi lên thì
 * một tính năng phụ (status bar, splash…) làm hỏng cả trang trên website.
 */
async function callPlugin<T>(load: () => Promise<T>, run: (plugin: T) => Promise<void> | void): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const plugin = await load();
    await run(plugin);
  } catch {
    // Plugin chưa cài trong app build này -> bỏ qua, app vẫn chạy bình thường.
  }
}

// ----------------------------------------------------------------
// NÚT BACK ANDROID
// ----------------------------------------------------------------
type BackHandler = () => boolean;

// Stack handler, handler mới nhất được ưu tiên (đúng trực giác: lớp phủ
// trên cùng — bottom sheet/modal — ăn nút back trước). Dùng stack thay vì 1
// biến để 2 lớp phủ lồng nhau (vd modal mở sheet) đóng đúng thứ tự.
const backHandlers: BackHandler[] = [];

/**
 * Đăng ký handler cho nút back. Trả về hàm gỡ đăng ký.
 *
 * Handler trả `true` nếu ĐÃ TỰ XỬ LÝ (đóng sheet chẳng hạn) — lúc đó app
 * không điều hướng. Trả `false` để mặc định xử lý (quay lại trang trước).
 */
export function onNativeBackButton(handler: BackHandler): Cleanup {
  backHandlers.push(handler);
  return () => {
    const index = backHandlers.indexOf(handler);
    if (index >= 0) backHandlers.splice(index, 1);
  };
}

/** Chạy handler trên cùng; true nếu có handler xử lý xong. */
export function runBackHandlers(): boolean {
  for (let i = backHandlers.length - 1; i >= 0; i -= 1) {
    if (backHandlers[i]()) return true;
  }
  return false;
}

// ----------------------------------------------------------------
// TRẠNG THÁI MẠNG
// ----------------------------------------------------------------
export type NetworkStatus = { connected: boolean; connectionType: string };

/**
 * Đăng ký theo dõi mạng. Gọi ngay 1 lần với trạng thái hiện tại rồi mỗi lần
 * đổi. Trả hàm gỡ đăng ký.
 */
export async function watchNetwork(listener: (status: NetworkStatus) => void): Promise<Cleanup> {
  if (!isNativeApp()) return () => {};
  try {
    const { Network } = await import("@capacitor/network");
    const send = (status: { connected: boolean; connectionType: string }) => listener(status);
    send(await Network.getStatus());
    const handle = await Network.addListener("networkStatusChange", (status) => send(status));
    return () => void handle.remove();
  } catch {
    return () => {};
  }
}

// ----------------------------------------------------------------
// STATUS BAR / BÀN PHÍM / SPLASH
// ----------------------------------------------------------------
export function applyStatusBar(): Promise<void> {
  return callPlugin(
    () => import("@capacitor/status-bar"),
    async (mod) => {
      // Dynamic import trả về MODULE, nên phải bóc `.StatusBar` — gọi
      // thẳng mod.setOverlaysWebView() là sai và TS sẽ bắt lỗi.
      const StatusBar = mod.StatusBar;
      // Vẽ nội dung tràn lên vùng status bar; phần chừa an toàn do CSS
      // env(safe-area-inset-top) lo (bắt buộc viewport-fit=cover ở layout).
      await StatusBar.setOverlaysWebView({ overlay: true });
      // KHÔNG setStyle ở đây. Kiểu chữ phụ thuộc theme (sáng/tối) nên để
      // effect ở NativeShell đảm nhiệm; đặt ở cả hai nơi sẽ thành race
      // giữa 2 lệnh async và status bar có thể kẹt sai màu khi app vừa mở.
    }
  );
}

/**
 * "DARK" = chữ TỐI (dùng khi nền sáng); "LIGHT" = chữ SÁNG (nền tối).
 *
 * Tên ở đây bám theo enum của Capacitor (`Style.Dark` / `Style.Light`) — nhớ
 * rằng chúng mô tả MÀU CHỮ chứ không phải màu nền, dễ đảo nhầm.
 */
export type StatusBarStyle = "DARK" | "LIGHT";

export function setStatusBarStyle(style: StatusBarStyle): Promise<void> {
  return callPlugin(
    () => import("@capacitor/status-bar"),
    (mod) => mod.StatusBar.setStyle({ style: style === "LIGHT" ? mod.Style.Light : mod.Style.Dark })
  );
}

/** Nhấc bàn phím: ẩn status bar để có thêm chỗ cho bàn phím (native app). */
export function hideStatusBarForKeyboard(): Promise<void> {
  return callPlugin(
    () => import("@capacitor/status-bar"),
    (mod) => mod.StatusBar.hide()
  );
}

export function showStatusBarAfterKeyboard(): Promise<void> {
  return callPlugin(
    () => import("@capacitor/status-bar"),
    (mod) => mod.StatusBar.show()
  );
}

export function hideSplashScreen(): Promise<void> {
  return callPlugin(
    () => import("@capacitor/splash-screen"),
    (mod) => mod.SplashScreen.hide()
  );
}
