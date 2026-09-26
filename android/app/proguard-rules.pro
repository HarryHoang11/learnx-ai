# ==================================================================
# ProGuard / R8 rules — LearnX AI
# ==================================================================
# Bật R8 (minifyEnabled) trong build.gradle chỉ an toàn khi giữ lại được
# các lớp Capacitor gọi bằng REFLECTION. Gỡ những rule này sẽ khiến app
# crash ngay khi mở (lỗi ClassNotFoundException ở Bridge), nên đừng xoá.
# ==================================================================

# --- Capacitor: lớp core, bridge, plugin, và các interface JS ---
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.plugin.** { *; }
-keep class com.getcapacitor.**$* { *; }

# --- WebView JS interface: WebView gọi các method này qua reflection ---
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# --- Thư viện androidx mà Capacitor phụ thuộc ---
-keep class androidx.core.** { *; }
-keep class androidx.appcompat.** { *; }
-keep class androidx.activity.result.** { *; }
-keep class androidx.fragment.** { *; }
-keep class androidx.lifecycle.** { *; }
-dontwarn androidx.**

# --- OkHttp (Capacitor Http dùng cho mọi request tới API LearnX) ---
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# --- Gson: Capacitor dùng để đọc JSON trong @capacitor/network ---
-keep class com.google.gson.** { *; }
-dontwarn com.google.gson.**

# --- MainActivity: AndroidManifest gọi nó theo TÊN, không theo class ref ---
-keep class ai.learnx.app.MainActivity { *; }