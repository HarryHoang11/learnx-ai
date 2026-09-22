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
import { prisma } from "@/lib/db/prisma";

// ----------------------------------------------------------------
// CHẨN ĐOÁN LỖI CẤU HÌNH Ở PRODUCTION
// ----------------------------------------------------------------
// Auth.js bắt buộc phải có AUTH_SECRET (hoặc NEXTAUTH_SECRET) khi
// NODE_ENV=production — thiếu biến này, `assertConfig()` trả lỗi
// MissingSecret cho MỌI request vào /api/auth/*, tức toàn bộ endpoint
// đăng nhập/session trả HTTP 500 trong khi phần còn lại của app (page,
// API khác) vẫn chạy bình thường. Đây là kiểu lỗi dễ bị chẩn đoán nhầm
// thành "server sập", nên log thẳng TÊN biến còn thiếu ra Runtime Logs
// của Vercel. KHÔNG in giá trị của bất kỳ biến nào (tránh lộ secret).
const hasAuthSecret = !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET);
if (!hasAuthSecret && process.env.NODE_ENV === "production") {
  // eslint-disable-next-line no-console
  console.error(
    "[auth] THIẾU AUTH_SECRET: mọi endpoint /api/auth/* sẽ trả HTTP 500 (MissingSecret). " +
      "Thêm AUTH_SECRET vào Environment Variables của môi trường Production rồi redeploy. " +
      "Tạo giá trị bằng: openssl rand -base64 32"
  );
}

// Cùng họ lỗi trên: Auth.js chỉ tin `Host` header khi có 1 trong các dấu
// hiệu AUTH_URL / AUTH_TRUST_HOST / VERCEL / CF_PAGES, HOẶC khi đang chạy
// dev. Vercel/Cloudflare tự set biến nên không cần làm gì; nhưng self-host
// (`next start` sau Docker/Nginx/VPS) mà quên AUTH_URL sẽ hỏng y hệt
// MissingSecret — log sẵn hướng dẫn để khỏi mất thời gian dò.
const hasTrustedHostSignal = !!(
  process.env.AUTH_URL ||
  process.env.NEXTAUTH_URL ||
  process.env.AUTH_TRUST_HOST ||
  process.env.VERCEL ||
  process.env.CF_PAGES
);
if (!hasTrustedHostSignal && process.env.NODE_ENV === "production") {
  // eslint-disable-next-line no-console
  console.error(
    "[auth] Không có AUTH_URL/AUTH_TRUST_HOST: khi self-host production, Auth.js sẽ từ chối Host header " +
      "(UntrustedHost -> /api/auth/* trả HTTP 500). Set AUTH_URL=https://<domain-cua-ban> hoặc AUTH_TRUST_HOST=true. " +
      "(Trên Vercel/Cloudflare không cần, nền tảng tự set biến tương ứng.)"
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
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
