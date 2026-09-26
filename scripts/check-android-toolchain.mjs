#!/usr/bin/env node
// ================================================================
// Kiểm tra máy đã đủ công cụ build Android chưa
// ================================================================
// Chạy trước khi build APK: `npm run mobile:check`.
//
// Mạch tư duy: lỗi build Android trên máy mới thường KHÔNG phải lỗi code mà
// là thiếu JDK/SDK. Gradle báo lỗi rất dài và khó hiểu cho người chưa từng
// build Android. Script này nói thẳng: thiếu gì, cài ở đâu.
// ================================================================

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const tips = [];

/** Tìm thư mục cha chứa 1 tệp, quét ngược lên cây. */
function findUp(name, from) {
  let dir = from;
  for (let i = 0; i < 6; i += 1) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// --- 1. JDK ---
// Gradle của AGP 8 yêu cầu JDK 17 trở lên (đề xuất 21).
const javaHome = process.env.JAVA_HOME;
let javaOk = false;
if (javaHome && existsSync(join(javaHome, "bin", "java.exe"))) {
  javaOk = true;
} else if (process.platform !== "win32") {
  javaOk = existsSync("/usr/bin/java") || existsSync("/usr/local/bin/java");
}
if (!javaOk) {
  problems.push("Chưa có JDK (cần JDK 17+, đề xuất JDK 21).");
  tips.push("Cài Android Studio (đã kèm JDK) hoặc cài Temurin 21: https://adoptium.net");
  tips.push("Sau khi cài, set JAVA_HOME trỏ tới thư mục JDK rồi mở lại terminal.");
}

// --- 2. Android SDK ---
// local.properties (do Gradle sinh) là nguồn sự thật cho đường dẫn SDK.
let sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || null;
const localProps = join(ROOT, "android", "local.properties");
if (!sdkDir && existsSync(localProps)) {
  const match = readFileSync(localProps, "utf8").match(/sdk\.dir=(.+)/);
  if (match) sdkDir = match[1].trim().replace(/\\/g, "/");
}
if (!sdkDir || !existsSync(sdkDir)) {
  problems.push("Chưa có Android SDK.");
  tips.push("Mở Android Studio > SDK Manager, cài Android SDK Platform 35 + Build-Tools 35.");
  tips.push("Hoặc tạo android/local.properties với nội dung: sdk.dir=/duong/dan/toi/Sdk");
}

// --- 3. Platform + build-tools đúng version ---
// Đọc version từ variables.gradle để không hard-code lệch với cấu hình.
if (sdkDir && existsSync(sdkDir)) {
  const vars = join(ROOT, "android", "variables.gradle");
  if (existsSync(vars)) {
    const text = readFileSync(vars, "utf8");
    const compile = text.match(/compileSdkVersion\s*=\s*(\d+)/)?.[1];
    const target = text.match(/targetSdkVersion\s*=\s*(\d+)/)?.[1];
    if (compile && !existsSync(join(sdkDir, "platforms", `android-${compile}`))) {
      problems.push(`Thiếu Android SDK Platform ${compile} (compileSdkVersion trong variables.gradle).`);
      tips.push("Cài trong Android Studio > SDK Manager > SDK Platforms.");
    }
    if (target && !existsSync(join(sdkDir, "platforms", `android-${target}`))) {
      problems.push(`Thiếu Android SDK Platform ${target} (targetSdkVersion).`);
    }
    const buildToolsDir = join(sdkDir, "build-tools");
    if (!existsSync(buildToolsDir) || readdirSync(buildToolsDir).length === 0) {
      problems.push("Thiếu Android SDK Build-Tools.");
      tips.push("Cài trong SDK Manager > SDK Tools > Android SDK Build-Tools.");
    }
  }
}

// --- 4. Biến môi trường cho bản release ---
// Chỉ CẢNH BÁO, không chặn: build debug vẫn được khi thiếu.
if (!process.env.LEARNX_KEYSTORE_PATH) {
  tips.push("Bản RELEASE sẽ build UNSIGNED nếu chưa set LEARNX_KEYSTORE_PATH (xem docs/MOBILE.md).");
}

// --- Kết quả ---
if (problems.length === 0) {
  console.log("✅ Đủ công cụ build Android.");
  if (tips.length > 0) {
    console.log("\nGhi chú:");
    for (const tip of tips) console.log(`  - ${tip}`);
  }
  process.exit(0);
}

console.log("❌ Chưa đủ để build APK:\n");
for (const p of problems) console.log(`  - ${p}`);
if (tips.length > 0) {
  console.log("\nCách khắc phục:");
  for (const tip of tips) console.log(`  - ${tip}`);
}
process.exit(1);
