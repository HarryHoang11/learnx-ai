// ================================================================
// PROXY (trước đây middleware.ts) — bảo vệ route riêng tư
// ================================================================
// Đổi tên từ middleware.ts sang proxy.ts theo đúng migration guide
// chính thức của Next.js 16 (nextjs.org/docs/messages/middleware-to-
// proxy): quy ước file "middleware" đã deprecated, đổi tên thành
// "proxy" để làm rõ đây là network boundary, không phải Express-style
// middleware. Next.js 16 vẫn chạy được middleware.ts (chỉ cảnh báo,
// không lỗi), nhưng đổi sớm để tránh bị breaking ở version sau và
// giảm nhầm lẫn khi đọc docs mới. Logic bên dưới giữ NGUYÊN 100% —
// export default auth(...) vốn không phải named function "middleware"
// nên chỉ cần đổi tên FILE, không cần đổi code.
//
// Mạch tư duy gốc: đây là lớp bảo vệ Ở TẦNG NGOÀI CÙNG, chạy TRƯỚC khi
// bất kỳ page nào trong (app) render — nếu chưa đăng nhập, redirect
// thẳng về /login, KHÔNG để lọt vào dashboard rồi mới báo lỗi 401 ở
// từng API call riêng lẻ (trải nghiệm tệ hơn nhiều).
// API routes (/api/**) đã tự kiểm tra qua getCurrentUserId() ở từng
// route — middleware này KHÔNG chặn API, chỉ chặn PAGE, vì API cần
// trả JSON 401 (để frontend xử lý), còn page cần redirect (điều
// hướng trình duyệt).
// ================================================================

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import {
  hasCompletedWelcome,
  isExemptFromWelcomeRedirect,
  isLearningGatedPath,
  isOnboardingDiagnosticEntry,
  hasDecidedSurvey,
  type OnboardingStatus,
} from "@/lib/onboarding/state";

const PUBLIC_PATHS = ["/login", "/register"];

export default auth((req) => {
  const path = req.nextUrl.pathname;

  // API routes tự kiểm tra đăng nhập và trả JSON 401 riêng (xem
  // lib/auth/session.ts) — middleware KHÔNG được redirect các request
  // API, vì fetch() ở frontend cần nhận JSON, không phải 1 redirect
  // sang trang HTML /login (sẽ khiến res.json() lỗi parse).
  if (path.startsWith("/api")) {
    return NextResponse.next();
  }

  const isLoggedIn = !!req.auth?.user;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  // ---- WELCOME EXPERIENCE ----
  // Trạng thái onboarding đọc từ JWT (đã ký bằng AUTH_SECRET nên user không
  // giả mạo được) -> KHÔNG phải query DB ở mỗi request, vì proxy chạy trên
  // MỌI lần điều hướng và 1 query DB ở đây sẽ làm chậm toàn bộ app.
  const onboardingStatus = (req.auth?.user as { onboardingStatus?: OnboardingStatus } | undefined)
    ?.onboardingStatus;
  const needsWelcome = !hasCompletedWelcome({ status: onboardingStatus ?? "NEW", welcomeSeenAt: null });

  // GATE MỀM (khảo sát học tập) — xem docs/WELCOME.md §5.
  //
  // Cờ `surveyDecidedAt` được mirror từ `learningProfile` vào JWT lúc đăng nhập
  // và làm mới qua update() sau mỗi lần ghi — cùng cơ chế với `onboardingStatus`,
  // nên proxy KHÔNG query DB ở mỗi request.
  //
  // CHỈ chặn các trang học chính (/roadmap, /diagnostic, /practice, /library)
  // và Dashboard vẫn vào được — người dùng mới phải nhìn thấy app trước đã,
  // chặn ở đó là biến onboarding thành trừng phạt. Dashboard tự hiện banner
  // ưu tiên bằng CÙNG điều kiện `needsLearningProfile()`.
  const surveyDecidedAt = (
    req.auth?.user as { surveyDecidedAt?: string | null } | undefined
  )?.surveyDecidedAt;
  const needsProfile = !needsWelcome && !hasDecidedSurvey({ surveyDecidedAt });

  // Trang gốc "/" tự redirect sang /dashboard (page.tsx) — để middleware
  // xử lý luôn ở đây, sau đó "/" sẽ rơi vào nhánh cần đăng nhập bên dưới.
  if (!isLoggedIn && !isPublic && path !== "/") {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }

  // Đã đăng nhập mà cố vào /welcome -> về login (đã xử lý ở nhánh trên,
  // nhưng giữ kiểm tra tường minh để đọc code không phải suy diễn).
  if (!isLoggedIn && path.startsWith("/welcome")) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  // Đã đăng nhập rồi mà cố vào /login hoặc /register -> đưa thẳng vào app.
  // User MỚI đi tới /welcome; user cũ đi thẳng /dashboard (không delay).
  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL(needsWelcome ? "/welcome" : "/dashboard", req.nextUrl.origin));
  }

  // User mới cố vào thẳng /dashboard (đánh dấu sách, deep link...) -> dẫn
  // qua Welcome trước. isExemptFromWelcomeRedirect loại /welcome, /setup,
  // /login, /register và /api — nhờ đó KHÔNG có nguy cơ redirect loop.
  if (isLoggedIn && needsWelcome && !isExemptFromWelcomeRedirect(path)) {
    return NextResponse.redirect(new URL("/welcome", req.nextUrl.origin));
  }

  // Đã xem Welcome rồi mà cố vào /welcome -> về dashboard. KHÔNG chặn việc
  // xem lại: /welcome?replay=true vẫn vào được (WelcomeExperience đọc
  // query này) — chỉ chặn để không mắc kẹt ở trang giới thiệu.
  if (isLoggedIn && !needsWelcome && path === "/welcome" && req.nextUrl.searchParams.get("replay") !== "true") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl.origin));
  }

  // ---- GATE MỀM: mở trang học chính mà chưa có hồ sơ -> đưa tới /onboarding ----
  //
  // /onboarding nằm trong WELCOME_EXEMPT_PATHS nên KHÔNG có nguy cơ loop:
  // vào /onboarding -> điều hướng về /onboarding là vô hại, và bước cuối của
  // khảo sát ghi mốc `surveyDecidedAt` làm cờ này tắt.
  //
  // NGOẠI LỆ BẮT BUỘC: `/diagnostic?from=onboarding` — lối vào do chính bước 04
  // của khảo sát tạo ra (`goDiagnostic()` trong LearningOnboarding.tsx). Ở bước
  // đó `surveyDecidedAt` CHƯA được ghi (cố ý, user còn phase 05), nên nếu không
  // miễn thì bấm "Bắt đầu kiểm tra" sẽ bị kéo về `/onboarding` — đúng trang đang
  // đứng — và nút trông như không phản hồi. Lối vào TRỰC TIẾP (không có query
  // này) vẫn bị nhắc khảo sát như cũ.
  if (
    isLoggedIn &&
    needsProfile &&
    isLearningGatedPath(path) &&
    !isOnboardingDiagnosticEntry(path, req.nextUrl.searchParams)
  ) {
    return NextResponse.redirect(new URL("/onboarding", req.nextUrl.origin));
  }

  return NextResponse.next();
});

// matcher loại trừ các đường dẫn tĩnh/nội bộ Next.js (_next, favicon,
// api/auth) — KHÔNG loại trừ /api/** khác, vì middleware vẫn chạy qua
// nhưng logic ở trên chỉ redirect cho page, không ảnh hưởng API JSON.
//
// `downloads` PHẢI được loại trừ: đó là file tĩnh công khai (APK Android).
// Nếu không loại, matcher bắt `/downloads/learnx-ai.apk`, rơi vào nhánh
// "chưa đăng nhập -> /login" và trả 307. Người dùng bấm "Tải app Android"
// sẽ tải về một trang HTML đăng nhập thay vì file APK — lỗi rất dễ bị bỏ
// qua vì nút trông như "chạy" nhưng kết quả sai hoàn toàn.
// Người dùng tải app TRƯỚC khi có tài khoản, nên đường này phải công khai.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|downloads).*)"],
};
