// ================================================================
// <NativeShell /> — lớp vỏ cho môi trường app Android
// ================================================================
// Mạch tư duy: đây là DUY NHẤT chỗ biết "mình đang chạy trong app".
// Nó gắn 4 thứ native và không render gì thêm lúc bình thường:
//   1. NÚT BACK ANDROID — đóng lớp phủ trên cùng trước, rồi mới quay lại
//      trang trước, cuối cùng mới đóng app (xem onNativeBackButton).
//   2. STATUS BAR       — tràn nội dung qua status bar, chừa vùng an toàn bằng CSS.
//   3. BÀN PHÍM         — đánh dấu trạng thái mở bàn phím để CSS nhấc ô nhập
//      (Tutor) lên; WebView bị resize nên bàn phím không che ô nhập.
//   4. MẠNG             — hiện băng "offline" thay vì để trang trắng/lỗi.
//
// Mọi thứ đều no-op trên website (xem isNativeApp), nên gắn vào layout gốc
// là an toàn cho cả 2 nền tảng.
// ================================================================

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { useTheme } from "@/components/providers/ThemeProvider";
import {
  applyStatusBar,
  hideSplashScreen,
  hideStatusBarForKeyboard,
  isNativeApp,
  runBackHandlers,
  setStatusBarStyle,
  showStatusBarAfterKeyboard,
  watchNetwork,
} from "@/lib/native/capacitor";
import { parseDeepLink } from "@/lib/native/deepLinks";

export default function NativeShell({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <NetworkWatcher />
      <NativeLifecycle />
    </>
  );
}


/**
 * Theo dõi mạng và báo trạng thái.
 *
 * Chạy cho CẢ web lẫn app: người dùng điện thoại cũng hay rớt mạng ở
 * website, và yêu cầu là "mất mạng thì báo Bạn đang offline, không crash".
 * Ở web dùng sự kiện `online`/`offline` của trình duyệt, ở app dùng plugin
 * Network (đáng tin hơn: bắt được cả trường hợp Wi-Fi còn gắn nhưng không
 * có Internet thật).
 */
function NetworkWatcher() {
  const { t } = useLanguage();
  const [offline, setOffline] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let dispose = () => {};
    let cancelled = false;

    if (isNativeApp()) {
      setOffline(!navigator.onLine);
      void watchNetwork((status) => setOffline(!status.connected)).then((d) => {
        if (cancelled) d();
        else dispose = d;
      });
    } else {
      setOffline(!navigator.onLine);
      const goOnline = () => setOffline(false);
      const goOffline = () => setOffline(true);
      window.addEventListener("online", goOnline);
      window.addEventListener("offline", goOffline);
      dispose = () => {
        window.removeEventListener("online", goOnline);
        window.removeEventListener("offline", goOffline);
      };
    }

    return () => {
      cancelled = true;
      dispose();
    };
  }, []);

  // Băng "đã kết nối lại" — CHỈ hiện khi user THẬT SỰ bị mất mạng rồi quay lại,
  // và tự ẩn sau vài giây.
  //
  // LỖI CŨ (gây "badge hiện mà UI thì đơ"): timer cũ set restored=true sau 3s
  // BẤT KỂ user có offline hay không, và KHÔNG có timer nào set lại về false.
  // Hậu quả: vào app khi đang online, 3 giây sau badge "Đã kết nối lại mạng"
  // hiện ra và sống tới khi reload trang.
  const wasOfflineRef = useRef(false);
  useEffect(() => {
    if (offline) {
      wasOfflineRef.current = true;
      setRestored(false);
      return;
    }
    // Chưa từng mất mạng -> im lặng. Không thèm báo "đã kết nối lại" cho một
    // trạng thái mà user vốn đã ở đó.
    if (!wasOfflineRef.current) return;
    wasOfflineRef.current = false;
    setRestored(true);
    // Tự ẩn — đây là mốc trước đó thiếu.
    const timer = window.setTimeout(() => setRestored(false), 3000);
    return () => window.clearTimeout(timer);
  }, [offline]);

  // Đánh dấu lên <html> để CSS tắt animation khi offline (máy yếu không nên
  // phí sức vẽ) và để các thành phần khác biết trạng thái mạng.
  useEffect(() => {
    document.documentElement.dataset.offline = offline ? "true" : "false";
  }, [offline]);

  if (!offline && !restored) return null;

  return (
    <div className="net-banner" role="status" aria-live="polite">
      <span className="net-banner__dot" aria-hidden="true" />
      {offline ? t("net.offline") : t("net.online")}
    </div>
  );
}

/**
 * Gắn nút back / status bar / bàn phím / splash — chỉ có tác dụng ở app.
 *
 * Tách riêng khỏi NetworkWatcher vì chúng độc lập nhau: một thẻ bị remount
 * (vd đổi theme) không được làm mất các listener native đã gắn.
 */
function NativeLifecycle() {
  const { theme } = useTheme();

  useEffect(() => {
    if (!isNativeApp()) return;
    let disposeBack = () => {};
    let disposeKeyboard = () => {};
    let cancelled = false;

    // --- 1. NÚT BACK ANDROID ---
    // Ưu tiên: đóng lớp phủ trên cùng (bottom sheet/modal đã đăng ký) ->
    // quay lại trang trước -> nếu không có lịch sử thì mới đóng app.
    // Không đóng app sớm: đó là lỗi kinh điển làm người dùng tưởng app
    // bị treo hoặc mất dữ liệu đang gõ.
    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("backButton", () => {
          if (runBackHandlers()) return;
          if (window.history.length > 1) {
            window.history.back();
            return;
          }
          void App.exitApp();
        });
        // Deep link: `learnx://roadmap/123` -> điều hướng tới /roadmap/123.
        // Đăng ký ở đây vì cùng import plugin App, không tốn thêm request.
        const deepLink = await App.addListener("appUrlOpen", (event) => {
          const path = parseDeepLink(event.url);
          if (path) window.location.assign(path);
        });
        // Khi app được mở TỪ ĐẦU bởi deep link, Android khởi động WebView với
        // chính URL đó và KHÔNG phát appUrlOpen. Nếu không đọc ở đây thì link
        // mở app từ trạng thái tắt sẽ bị bỏ qua — lỗi rất dễ tái hiện lúc
        // test và rất dễ gây hiểu nhầm là "app không nhận link".
        try {
          const launched = await App.getLaunchUrl();
          if (launched?.url) {
            const path = parseDeepLink(launched.url);
            if (path) window.location.replace(path);
          }
        } catch {
          // Không có launch URL -> mở bình thường, không phải lỗi.
        }
        if (cancelled) {
          handle.remove();
          deepLink.remove();
        } else {
          disposeBack = () => {
            handle.remove();
            deepLink.remove();
          };
        }
      } catch {
        // Không có plugin App -> WebView tự xử lý mặc định.
      }
    })();

    // --- 2. Status bar + splash ---
    // CHỈ đặt overlay ở đây. Kiểu chữ của status bar do effect bên dưới đảm
    // nhiệm theo theme — nếu setStyle cả 2 nơi thì 2 lệnh async chạy song
    // song và kết quả cuối tuỳ thứ tự hoàn thành (race), khiến status bar
    // nhấp nháy hoặc kẹt sai màu.
    void applyStatusBar();
    void hideSplashScreen();

    // --- 3. BÀN PHÍM ---
    void (async () => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        const onShow = await Keyboard.addListener("keyboardWillShow", () => {
          // Đánh dấu để CSS nhấc ô nhập (Tutor) và thanh nav dưới lên trên bàn phím.
          document.documentElement.dataset.keyboard = "open";
          void hideStatusBarForKeyboard();
        });
        const onHide = await Keyboard.addListener("keyboardWillHide", () => {
          delete document.documentElement.dataset.keyboard;
          void showStatusBarAfterKeyboard();
        });
        if (cancelled) {
          onShow.remove();
          onHide.remove();
        } else {
          disposeKeyboard = () => {
            onShow.remove();
            onHide.remove();
          };
        }
      } catch {
        // Không có plugin Keyboard -> bàn phím do WebView xử lý mặc định.
      }
    })();

    return () => {
      cancelled = true;
      disposeBack();
      disposeKeyboard();
      delete document.documentElement.dataset.keyboard;
    };
    // Gắp listener MỘT LẦN cho cả vòng đời app. Nếu thêm pathname/theme vào
    // deps thì mỗi lần đổi trang sẽ gắp lại và rò rỉ listener.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đồng bộ kiểu chữ status bar theo theme: nền sáng cần chữ tối.
  useEffect(() => {
    if (!isNativeApp()) return;
    void setStatusBarStyle(theme === "light" ? "DARK" : "LIGHT");
  }, [theme]);

  return null;
}

