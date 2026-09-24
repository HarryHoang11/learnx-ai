// ================================================================
// AUTH.JS (NextAuth v5) — CẤU HÌNH TRUNG TÂM
// ================================================================
// Mạch tư duy: đây là điểm DUY NHẤT khai báo các phương thức đăng
// nhập (Google, Credentials) và cách session được tạo. Mọi nơi khác
// trong app (route handler, middleware, server component) đều import
// `auth`/`signIn`/`signOut` từ ĐÚNG file này, không tự tạo NextAuth()
// instance thứ hai — nếu có 2 instance, cookie/secret có thể lệch
// nhau và session sẽ không nhất quán.
//
// Vì sao session strategy = "jwt" (không phải "database"):
// Auth.js CHỈ hỗ trợ Credentials provider (email+password) khi dùng
// JWT session — session kiểu "database" (lưu Session record, đọc lại
// mỗi request) không tương thích với Credentials provider theo thiết
// kế của chính Auth.js. Vì app cần cả 2 phương thức (Google,
// Credentials) cùng lúc, bắt buộc phải chọn "jwt" cho TẤT CẢ, kể cả
// Google — PrismaAdapter vẫn được dùng để lưu User/Account vào
// Postgres (KHÔNG lưu Session record khi dùng jwt strategy, đó là
// hành vi đúng của Auth.js, không phải thiếu sót).
// ================================================================

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";

// ----------------------------------------------------------------
// CHUẨN HOÁ ENV + CHẨN ĐOÁN LỖI CẤU HÌNH Ở PRODUCTION
// ----------------------------------------------------------------
// Auth.js assert config theo thứ tự (1) trustHost -> (2) secret, và CẢ HAI
// đều ném AuthError kind "Configuration": mọi request /api/auth/* trả HTTP
// 500 với body chung chung "There was a problem with the server
// configuration" — KHÔNG nói thiếu gì, nên rất dễ chẩn đoán nhầm là "server
// sập" (triệu chứng thực tế: /api/auth/providers|session|error = 500, các
// page và API khác vẫn chạy, invocation chỉ vài chục ms và không gọi ra
// ngoài vì fail ngay ở bước assert).
//
// Vì vậy ở đây chuẩn hoá + quyết định TƯỜNG MINH:
//   1. Coi chuỗi RỖNG như "chưa set". Auth.js dùng `??` nên `AUTH_URL=""`
//      vẫn bị tính là "có set" -> `!!""` = false -> trustHost = false ->
//      UntrustedHost (500) NGAY CẢ TRÊN VERCEL. Đây là cái bẫy thật: dán
//      template env vào dashboard với dòng `AUTH_URL=""` là dính.
//   2. Chỉ nhận AUTH_URL khi là URL tuyệt đối hợp lệ (thiếu scheme như
//      "domain.vercel.app" sẽ làm `new URL()` throw trong MỖI request).
//   3. getAuthConfigIssues() để route handler trả JSON nói rõ THIẾU BIẾN
//      NÀO (chỉ tên biến — không bao giờ in giá trị/secret).
function readEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    // Trả về giá trị GỐC (không trim) để không làm đổi key material của
    // secret; chỉ dùng trim() để phát hiện biến rỗng/toàn khoảng trắng.
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return undefined;
}

const authSecretFromEnv = readEnv("AUTH_SECRET", "NEXTAUTH_SECRET");

/**
 * Secret DẪN XUẤT — phương án dự phòng để production không sập vì thiếu
 * biến môi trường.
 *
 * Vì sao cần: Auth.js BẮT BUỘC có secret khi NODE_ENV=production; thiếu nó
 * thì `assertConfig()` ném `MissingSecret` cho MỌI request /api/auth/* →
 * /api/auth/providers|session|error trả 500 (trước đây) trong khi toàn bộ
 * phần còn lại của app vẫn chạy, còn /api/profile chỉ trả 401 vì `auth()`
 * trả null. Đây là lỗi cấu hình platform, nhưng để app không "chết đứng"
 * khi chưa kịp thêm biến, ta dẫn xuất khoá ký session từ một bí mật ĐÃ CÓ
 * trong môi trường (DATABASE_URL) thay vì hardcode hay dùng giá trị giả.
 *
 * Vì sao là DATABASE_URL: đây là biến duy nhất bắt buộc phải có để app chạy
 * được (thiếu nó thì mọi API DB đã hỏng trước cả auth); mật khẩu trong đó
 * là bí mật thật, cùng mức ảnh hưởng với việc ký được session (ai có
 * credential DB thì đã đọc/ghi được toàn bộ dữ liệu user).
 *
 * QUAN TRỌNG: AUTH_SECRET luôn được ưu tiên — set biến đó là tự động thoát
 * khỏi chế độ dự phòng (chỉ làm session cũ hết hiệu lực, user đăng nhập lại).
 * Phần query string bị BỎ khi băm: chính code này (lib/db/prisma.ts) và tài
 * liệu deploy hay thêm `?connection_limit=1&pgbouncer=true`, nếu tính cả
 * query thì mỗi lần chỉnh tham số pool sẽ vô tình đổi khoá và logout toàn bộ
 * người dùng đang đăng nhập.
 */
function deriveSecretFromDatabaseUrl(): string | undefined {
  const raw = readEnv("DATABASE_URL");
  if (!raw) return undefined;

  let keyMaterial = raw;
  try {
    const parsed = new URL(raw);
    keyMaterial = `${parsed.protocol}//${parsed.username}:${parsed.password}@${parsed.host}${parsed.pathname}`;
  } catch {
    // URL không parse được → băm nguyên chuỗi, vẫn hơn là không có secret.
  }

  return createHash("sha256")
    .update(`learnx-authjs-session-secret-v1\u0000${keyMaterial}`)
    .digest("base64");
}

const derivedAuthSecret = authSecretFromEnv ? undefined : deriveSecretFromDatabaseUrl();
const authSecret = authSecretFromEnv ?? derivedAuthSecret;

if (derivedAuthSecret) {
  console.warn(
    "[auth] AUTH_SECRET (và NEXTAUTH_SECRET) chưa được set — đang dùng secret DẪN XUẤT từ DATABASE_URL " +
      "để /api/auth/* hoạt động. Nên set AUTH_SECRET=<chuỗi ngẫu nhiên> trong Environment Variables " +
      "để tách khoá ký session khỏi credential DB. Lưu ý: đổi user/password/host trong DATABASE_URL " +
      "sẽ làm toàn bộ session hiện tại hết hiệu lực (người dùng chỉ cần đăng nhập lại)."
  );
}

function readPublicUrl(): string | undefined {
  const raw = readEnv("AUTH_URL", "NEXTAUTH_URL");
  if (!raw) return undefined;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return raw;
  } catch {
    // rơi xuống log bên dưới (không in giá trị)
  }
  console.error(
    "[auth] AUTH_URL/NEXTAUTH_URL không phải URL tuyệt đối hợp lệ (cần dạng https://domain) — tạm bỏ qua biến này."
  );
  return undefined;
}

const publicAuthUrl = readPublicUrl();
const trustHostFlag = readEnv("AUTH_TRUST_HOST");

/**
 * Auth.js chỉ tin `Host` header khi biết chắc app nằm sau proxy tin cậy.
 * Ta tự quyết định thay vì phó mặc auto-detect (`??` + chuỗi rỗng = tắt
 * trust âm thầm):
 *   - AUTH_TRUST_HOST=true|1         -> tin (opt-in cho self-host sau proxy)
 *   - AUTH_URL hợp lệ                -> tin (URL công khai đã xác định)
 *   - VERCEL / CF_PAGES              -> tin (nền tảng tự quản lý Host header)
 *   - NODE_ENV != production (dev)   -> tin (giữ nguyên hành vi Auth.js)
 */
function resolveTrustHost(): boolean {
  if (trustHostFlag && !/^(false|0|no)$/i.test(trustHostFlag.trim())) return true;
  if (publicAuthUrl) return true;
  if (readEnv("VERCEL", "CF_PAGES")) return true;
  return process.env.NODE_ENV !== "production";
}

const trustHost = resolveTrustHost();

/**
 * Các vấn đề cấu hình khiến Auth.js không thể phục vụ /api/auth/*.
 * CHỈ trả về mô tả + TÊN biến môi trường cần thêm — tuyệt đối không kèm
 * giá trị (không lộ secret ra HTTP response hay log).
 */
export function getAuthConfigIssues(): string[] {
  const issues: string[] = [];
  if (!authSecret) {
    issues.push(
      "thiếu AUTH_SECRET và không thể dẫn xuất secret dự phòng (cần AUTH_SECRET hoặc DATABASE_URL)"
    );
  }
  if (!trustHost) {
    issues.push("thiếu AUTH_URL hoặc AUTH_TRUST_HOST (self-host production cần 1 trong 2)");
  }
  return issues;
}

const authConfigIssues = getAuthConfigIssues();
if (authConfigIssues.length > 0 && process.env.NODE_ENV === "production") {
  console.error(
    `[auth] CẤU HÌNH AUTH.JS CHƯA ĐẦY ĐỦ -> mọi endpoint /api/auth/* sẽ lỗi:\n - ${authConfigIssues.join(
      "\n - "
    )}\n Cách sửa: Vercel > Project > Settings > Environment Variables (Production) rồi Redeploy.` +
      (authSecret ? "" : " Tạo AUTH_SECRET bằng: openssl rand -base64 32")
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  // Truyền tường minh 2 giá trị mà Auth.js assert trước mọi thứ khác:
  // secret (đã chuẩn hoá: "" -> undefined) và trustHost (đã tự quyết định).
  // Nhờ đó config không còn phụ thuộc vào auto-detect dựa trên `??` — nơi
  // một biến env RỖNG có thể âm thầm tắt trust và làm 500 toàn bộ
  // /api/auth/*. Giá trị vẫn lấy từ env, KHÔNG hardcode.
  secret: authSecret,
  trustHost,
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      // Nhận CẢ 2 quy ước tên biến đang tồn tại ngoài thực tế:
      // GOOGLE_CLIENT_ID/SECRET (đang dùng trong .env của project) và
      // AUTH_GOOGLE_ID/SECRET (quy ước auto-infer của Auth.js v5). Auth.js
      // cũng tự điền từ AUTH_GOOGLE_* khi clientId undefined, nhưng ghi rõ
      // ở đây để người deploy biết chính xác biến nào được đọc.
      clientId: process.env.GOOGLE_CLIENT_ID ?? process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? process.env.AUTH_GOOGLE_SECRET,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
      },
      // authorize() là nơi DUY NHẤT kiểm tra email+password — trả về
      // null nếu sai (Auth.js tự hiểu là đăng nhập thất bại), KHÔNG
      // throw Error trực tiếp vì Auth.js sẽ hiển thị lỗi generic hơn.
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // User đăng ký qua Google có passwordHash = null — không cho
        // đăng nhập bằng password trong trường hợp đó, để tránh nhầm
        // lẫn "quên mật khẩu" cho tài khoản chưa từng đặt.
        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    // Nhét userId THẬT (từ DB) vào JWT ngay lúc đăng nhập, vì mặc định
    // Auth.js chỉ nhét "sub" (subject) — cần rõ ràng field "userId" để
    // dùng nhất quán ở callback session bên dưới và trong toàn bộ app.
    //
    // VÌ SAO CẦN "trigger"/"session" ở đây (phần mới thêm): với JWT
    // strategy, sau lần đăng nhập đầu tiên, `token.picture`/`token.name`
    // KHÔNG tự đồng bộ lại với DB nữa — chúng bị "đóng băng" trong JWT
    // cho tới khi user đăng xuất/đăng nhập lại. Đây là nguyên nhân THẬT
    // của bug "đổi avatar ở Profile nhưng Topbar/floating button không
    // đổi theo": phía client gọi useSession().update(...) sẽ trigger
    // callback này với `trigger === "update"` và `session` chứa dữ liệu
    // mới truyền vào — ta merge nó vào token ở đây thì MỌI nơi đọc
    // session (Topbar, FloatingAIButton...) sẽ thấy avatar mới ngay,
    // không cần logout/login lại, không cần F5.
    async jwt({ token, user, trigger, session }) {
      if (user?.id) token.userId = user.id;
      if (trigger === "update" && session?.user?.image !== undefined) {
        token.picture = session.user.image;
      }
      return token;
    },
    // Đưa userId từ token vào session.user.id — đây là field mà MỌI
    // API route sẽ đọc qua getCurrentUserId() (lib/auth/session.ts),
    // để biết chính xác "request này thuộc về user nào" mà KHÔNG tin
    // bất kỳ userId nào gửi từ phía client.
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
