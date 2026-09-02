// ================================================================
// GET/POST /api/auth/[...nextauth]
// ================================================================
// Mạch tư duy: đây KHÔNG phải route mình tự viết logic — Auth.js quy
// định BẮT BUỘC phải có đúng file này ở đúng path
// `api/auth/[...nextauth]/route.ts` để xử lý toàn bộ luồng OAuth
// (redirect sang Google/Facebook, callback, tạo session...). Toàn bộ
// cấu hình thật nằm ở src/auth.ts — file này chỉ export lại.
// ================================================================

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
