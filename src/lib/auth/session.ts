// ================================================================
// AUTH SESSION (tối giản cho MVP)
// ================================================================
// Mạch tư duy: MVP đi thi không cần OAuth/social login phức tạp.
// Ở đây mình dùng 1 cookie chứa JWT ký bằng AUTH_SECRET, đủ để mọi
// API route biết "đây là request của user nào" mà không cần kéo
// NextAuth (vốn nặng và có nhiều cấu hình không dùng tới cho demo).
//
// Khi lên production thật (mục 20 "Phase 3 — Competition" trong kế
// hoạch gốc, có Teacher Dashboard/Admin), NÊN thay bằng NextAuth
// hoặc Supabase Auth để có refresh token, social login, v.v.
// ================================================================

import { NextRequest } from "next/server";
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET ?? "dev-only-secret-change-me";

interface SessionPayload {
  userId: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
}

// Ký payload thành 1 chuỗi "base64(payload).signature" — cố tình KHÔNG
// dùng thư viện jsonwebtoken để tránh thêm dependency cho một việc
// đơn giản; MVP chỉ cần chống giả mạo cookie, không cần đủ chuẩn JWT.
export function signSession(payload: SessionPayload): string {
  const json = JSON.stringify(payload);
  const base64 = Buffer.from(json).toString("base64url");
  const signature = crypto.createHmac("sha256", SECRET).update(base64).digest("hex");
  return `${base64}.${signature}`;
}

function verifySession(token: string): SessionPayload | null {
  const [base64, signature] = token.split(".");
  if (!base64 || !signature) return null;

  const expected = crypto.createHmac("sha256", SECRET).update(base64).digest("hex");
  // So sánh bằng timingSafeEqual để tránh timing attack khi so sánh chữ ký
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (sigBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) return null;

  try {
    return JSON.parse(Buffer.from(base64, "base64url").toString()) as SessionPayload;
  } catch {
    return null;
  }
}

// Hàm dùng trong MỌI API route cần biết user hiện tại.
// Trả null nếu chưa đăng nhập / cookie sai — route gọi hàm này tự
// quyết định trả 401 hay dùng user demo mặc định (xem ghi chú dưới).
export function getSessionFromRequest(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get("learnx_session")?.value;
  if (!token) return null;
  return verifySession(token);
}

// --- DEMO MODE ---
// Khi đem đi thi, ban giám khảo có thể không muốn ngồi tạo tài khoản.
// Hàm này cho phép fallback về 1 user demo cố định nếu chưa đăng nhập,
// để mọi API route vẫn chạy được ngay mà không cần luồng login đầy đủ.
// XOÁ hàm này (hoặc chỉ bật qua biến môi trường) khi lên production thật.
export function getSessionOrDemoUser(req: NextRequest): SessionPayload {
  return getSessionFromRequest(req) ?? { userId: "demo-user-id", role: "STUDENT" };
}
