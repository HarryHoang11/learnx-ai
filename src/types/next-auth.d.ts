// ================================================================
// MODULE AUGMENTATION — next-auth
// ================================================================
// Mạch tư duy: type gốc của next-auth KHÔNG có field `id` trong
// `session.user` (chỉ có name/email/image mặc định). Vì toàn bộ app
// dựa vào `session.user.id` để xác định user hiện tại (xem
// lib/auth/session.ts), phải khai báo lại type ở đây — nếu không,
// TypeScript sẽ báo lỗi "Property 'id' does not exist" ở auth.ts.
// ================================================================

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
