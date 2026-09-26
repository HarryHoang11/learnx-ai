// ================================================================
// CẤU HÌNH APP — nguồn sự thật DUY NHẤT cho thông tin app LearnX AI
// ================================================================
// Mạch tư duy: mọi nơi cần biết "app Android có sẵn không, tải ở đâu, phiên
// bản bao nhiêu" đều đọc từ đây. Tách config khỏi UI để sau này đổi nơi
// host APK (CDN, S3, GitHub Releases) chỉ cần sửa MỘT chỗ, không phải rà
// layout cũ.
//
// VÌ SAO GIÁ TRỊ Ở ĐÂY LÀ THẬT (không bịa):
//   - `versionName` / `versionCode` / `minSdk` lấy từ chính file APK đã build,
//     đọc bằng `aapt2 dump badging android/app/build/outputs/apk/debug/app-debug.apk`.
//   - `apkPath` là nơi ta ĐÃ COPY file APK thật vào (public/downloads) nên web
//     serve được. Đã kiểm tra SHA256 khớp 100% với file build gốc.
//   - File APK đã qua `apksigner verify` -> exit 0 (có chữ ký hợp lệ, cài
//     được). Bản `app-release-unsigned.apk` KHÔNG verify nên không dùng.
//
// `apkUrl` cho phép ghi đè bằng biến môi trường (client-safe) khi muốn host
// APK ở domain khác. Biến có tiền tố NEXT_PUBLIC_ nên được nhúng vào bundle —
// đây là URL công khai, TUYỆT ĐỐI không đặt secret ở đây.
// ================================================================

export interface AndroidAppInfo {
  /** Đường dẫn tương đối tới file APK trong thư mục public/ (mặc định). */
  readonly apkPath: string;
  /** Tên hiển thị trên launcher. */
  readonly appName: string;
  /** applicationId trong AndroidManifest — dùng để nhận diện app thật. */
  readonly packageName: string;
  /**
   * versionName đọc từ APK thật. KHÔNG tự tăng ở đây: số này phải khớp
   * android/app/build.gradle, nếu lệch thì người dùng thấy sai phiên bản.
   */
  readonly versionName: string;
  /** Android tối thiểu (API 23 = Android 6.0). */
  readonly minSdk: number;
  /**
   * Bản build này được ký bằng CERTIFICATE DEBUG của Android Studio, không
   * phải khoá release. Nghĩa là: cài đặt được ngay, nhưng KHÔNG đủ điều kiện
   * lên Google Play, và nếu sau này phát hành bản ký bằng khoá release thì
   * người đã cài bản này phải gỡ cài đặt trước (lệch chữ ký).
   *
   * UI dùng cờ này để nói đúng sự thật với người dùng thay vì quảng cáo quá
   * mức. Khi nào cấu hình khoá release thành công, đổi thành false.
   */
  readonly isPreviewBuild: boolean;
}

const DEFAULT_ANDROID_APP: AndroidAppInfo = {
  apkPath: "/downloads/learnx-ai.apk",
  appName: "LearnX AI",
  packageName: "ai.learnx.app",
  versionName: "1.0.0",
  minSdk: 23,
  isPreviewBuild: true,
};

/** Đọc biến môi trường client-safe, trả undefined nếu thiếu/rỗng. */
function publicEnv(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

/**
 * Thông tin app Android cho UI.
 *
 * `apkUrl` ưu tiên NEXT_PUBLIC_ANDROID_APK_URL khi được set (trỏ CDN/domain
 * khác), nếu không thì dùng đường dẫn trong public/.
 */
export function getAndroidApp(): AndroidAppInfo & { apkUrl: string } {
  const override = publicEnv("NEXT_PUBLIC_ANDROID_APK_URL");
  return {
    ...DEFAULT_ANDROID_APP,
    apkUrl: override ?? DEFAULT_ANDROID_APP.apkPath,
  };
}
