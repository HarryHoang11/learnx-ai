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
    async jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
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
